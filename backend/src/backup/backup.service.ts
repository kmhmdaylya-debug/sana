import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditAction, BackupHistory, BackupResult, Prisma, PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';
import { verifyPassword } from '../common/utils/password.util';
import { BackupQueryDto, RestoreBackupDto } from './dto/backup.dto';
import { archiveChecksum, decryptArchive, encryptArchive } from './backup-archive';
import { runPostgresTool } from './postgres-tools';

@Injectable()
export class BackupService {
  private restoring = false;
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService, private readonly config: ConfigService) {}

  private authorize(user: AuthenticatedUser) {
    // Full database archives contain every tenant and password hashes.
    if (!user.isSuperAdmin) throw new ForbiddenException('پشتیبان کامل سامانه فقط برای مدیر ارشد قابل دسترسی است.');
  }
  private directory() { return path.resolve(this.config.get<string>('app.backup.dir') ?? './backups'); }
  private key() { return this.config.getOrThrow<string>('app.backup.encryptionKey'); }
  private databaseUrl() { return this.config.getOrThrow<string>('app.database.url'); }
  private publicRow(row: BackupHistory) {
    return { id: row.id, fileName: row.fileName, size: Number(row.size), checksum: row.checksum, result: row.result, startedAt: row.startedAt, finishedAt: row.finishedAt, createdById: row.createdById };
  }

  async listHistory(query: BackupQueryDto, pagination: PaginationDto, user: AuthenticatedUser) {
    this.authorize(user);
    const where: Prisma.BackupHistoryWhereInput = query.result ? { result: query.result } : {};
    const [total, rows] = await Promise.all([
      this.prisma.backupHistory.count({ where }),
      this.prisma.backupHistory.findMany({ where, skip: pagination.skip, take: pagination.limit, orderBy: { startedAt: 'desc' }, include: { createdBy: { select: { id: true, fullName: true } } } }),
    ]);
    return { data: rows.map(row => ({ ...this.publicRow(row), createdBy: row.createdBy })), meta: { total, page: pagination.page, limit: pagination.limit, totalPages: Math.max(1, Math.ceil(total / pagination.limit)), hasNext: pagination.page * pagination.limit < total, hasPrev: pagination.page > 1 }, success: true, timestamp: new Date().toISOString() };
  }

  async runBackup(user: AuthenticatedUser) {
    this.authorize(user);
    const startedAt = new Date();
    const fileName = `sana-${startedAt.toISOString().replace(/[:.]/g, '-')}-${randomUUID()}.pgdump.enc`;
    const filePath = path.join(this.directory(), fileName);
    try {
      const dump = await runPostgresTool(this.config.get<string>('app.backup.pgDumpPath') ?? 'pg_dump', ['--format=custom', '--no-owner', '--no-privileges'], this.databaseUrl());
      const encrypted = encryptArchive(dump, this.key());
      if (!decryptArchive(encrypted, this.key()).equals(dump)) throw new Error('Archive verification failed');
      await fs.mkdir(this.directory(), { recursive: true, mode: 0o700 });
      await fs.writeFile(filePath, encrypted, { flag: 'wx', mode: 0o600 });
      const row = await this.prisma.backupHistory.create({ data: { fileName, location: filePath, size: BigInt(encrypted.length), checksum: archiveChecksum(encrypted), result: BackupResult.SUCCESS, createdById: user.id, startedAt, finishedAt: new Date() } });
      await this.audit.record(user.id, { action: AuditAction.BACKUP, entity: 'BackupHistory', entityId: row.id, after: { fileName, size: encrypted.length } });
      return { data: this.publicRow(row), success: true, timestamp: new Date().toISOString() };
    } catch {
      await this.prisma.backupHistory.create({ data: { fileName, result: BackupResult.FAILED, error: 'تهیه یا اعتبارسنجی آرشیو PostgreSQL ناموفق بود.', createdById: user.id, startedAt, finishedAt: new Date() } });
      await this.audit.record(user.id, { action: AuditAction.BACKUP, entity: 'BackupHistory', after: { result: 'FAILED' } });
      throw new ServiceUnavailableException('پشتیبان‌گیری انجام نشد؛ تنظیمات ابزار PostgreSQL و فضای ذخیره‌سازی را بررسی کنید.');
    }
  }

  async get(id: string, user: AuthenticatedUser) {
    this.authorize(user);
    const row = await this.prisma.backupHistory.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('رکورد پشتیبان یافت نشد.');
    return { data: this.publicRow(row), success: true, timestamp: new Date().toISOString() };
  }

  private async archive(id: string) {
    const row = await this.prisma.backupHistory.findUnique({ where: { id } });
    if (!row || row.result !== 'SUCCESS') throw new NotFoundException('فایل پشتیبان معتبر یافت نشد.');
    try {
      const root = await fs.realpath(this.directory());
      const location = await fs.realpath(path.join(root, path.basename(row.fileName)));
      if (path.dirname(location) !== root || path.basename(location) !== row.fileName) throw new Error('Invalid backup path');
      const stats = await fs.stat(location);
      if (!stats.isFile() || stats.size > 256 * 1024 * 1024) throw new Error('Invalid backup size');
      const encrypted = await fs.readFile(location);
      if (archiveChecksum(encrypted) !== row.checksum) throw new Error('Checksum mismatch');
      const dump = decryptArchive(encrypted, this.key());
      await runPostgresTool(this.config.get<string>('app.backup.pgRestorePath') ?? 'pg_restore', ['--list'], this.databaseUrl(), dump);
      return { row, encrypted, dump };
    } catch {
      throw new BadRequestException('فایل پشتیبان موجود نیست، خراب است یا کلید آن معتبر نیست.');
    }
  }

  async download(id: string, user: AuthenticatedUser) {
    this.authorize(user);
    const { row, encrypted } = await this.archive(id);
    await this.audit.recordExport(user.id, 'BackupHistory', id);
    return { buffer: encrypted, fileName: row.fileName };
  }

  async restore(dto: RestoreBackupDto, user: AuthenticatedUser) {
    this.authorize(user);
    const configured = this.config.get<string>('app.backup.restoreDatabaseUrl');
    if (!configured) throw new ServiceUnavailableException('دیتابیس جداگانهٔ بازیابی در سرور تنظیم نشده است.');
    const destination = new URL(configured);
    const source = new URL(this.databaseUrl());
    const name = decodeURIComponent(destination.pathname.slice(1));
    if (!/^sana_restore_[a-zA-Z0-9_]+$/.test(name) || destination.pathname === source.pathname || name !== dto.confirmationDatabase) throw new BadRequestException('بازیابی فقط در دیتابیس مجزای تأییدشده با پیشوند sana_restore_ مجاز است.');
    const current = await this.prisma.user.findUnique({ where: { id: user.id } });
    if (!current?.isSuperAdmin || current.status !== 'ACTIVE' || current.deletedAt || !await verifyPassword(current.passwordHash, dto.currentPassword)) throw new ForbiddenException('احراز هویت مجدد مدیر ارشد ناموفق بود.');
    if (this.restoring) throw new ConflictException('یک عملیات بازیابی در حال اجراست.');
    const { dump } = await this.archive(dto.backupId);
    const target = new PrismaClient({ datasources: { db: { url: configured } }, log: [] });
    this.restoring = true;
    try {
      const result = await target.$transaction(async tx => {
        const [lock] = await tx.$queryRaw<{ locked: boolean }[]>`SELECT pg_try_advisory_xact_lock(1935765057) AS locked`;
        if (!lock.locked) throw new ConflictException('بازیابی دیگری در حال اجراست.');
        const [tables] = await tx.$queryRaw<{ count: bigint }[]>`SELECT count(*) FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog', 'information_schema')`;
        if (Number(tables.count) !== 0) throw new BadRequestException('دیتابیس مقصد باید خالی باشد؛ هیچ داده‌ای جایگزین نشد.');
        const safety = await this.runBackup(user);
        await runPostgresTool(this.config.get<string>('app.backup.pgRestorePath') ?? 'pg_restore', ['--exit-on-error', '--single-transaction', '--no-owner', '--no-privileges', '--dbname', name], configured, dump);
        const now = new Date();
        await tx.userSession.updateMany({ data: { revokedAt: now } });
        await tx.refreshToken.updateMany({ data: { revokedAt: now } });
        return { database: name, safetyBackupId: safety.data.id };
      }, { timeout: 300000, maxWait: 10000 });
      await this.audit.record(user.id, { action: AuditAction.RESTORE, entity: 'BackupHistory', entityId: dto.backupId, after: result });
      return { data: result, success: true, timestamp: new Date().toISOString() };
    } catch (error) {
      await this.audit.record(user.id, { action: AuditAction.RESTORE, entity: 'BackupHistory', entityId: dto.backupId, after: { result: 'FAILED' } });
      if (error instanceof BadRequestException || error instanceof ConflictException || error instanceof ServiceUnavailableException) throw error;
      throw new ServiceUnavailableException('بازیابی ناموفق بود؛ دیتابیس اصلی تغییر نکرده است.');
    } finally {
      this.restoring = false;
      await target.$disconnect();
    }
  }
}
