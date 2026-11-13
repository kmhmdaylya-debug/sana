import { Injectable, NotFoundException } from '@nestjs/common';
import { createCipheriv, createHash, randomBytes } from 'crypto';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { AuditAction, BackupResult, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';
import { BackupQueryDto } from './dto/backup.dto';

const BACKUP_DIR = path.resolve(process.cwd(), 'backups');

@Injectable()
export class BackupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  /** رمزنگاری AES-256-GCM: خروجی = iv(12) | tag(16) | ciphertext */
  private encrypt(plain: string): Buffer {
    const keyMaterial = this.config.get<string>('app.backup.encryptionKey');
    if (!keyMaterial) throw new Error('کلید رمزنگاری پشتیبان تنظیم نشده است.');
    const key = createHash('sha256').update(keyMaterial).digest();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), body]);
  }

  async listHistory(query: BackupQueryDto, pagination: PaginationDto) {
    const where: Prisma.BackupHistoryWhereInput = {
      ...(query.result ? { result: query.result } : {}),
    };

    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const [total, rows] = await Promise.all([
      this.prisma.backupHistory.count({ where }),
      this.prisma.backupHistory.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { startedAt: 'desc' },
        include: { createdBy: { select: { id: true, fullName: true } } },
      }),
    ]);

    return {
      data: rows.map((b) => ({ ...b, size: Number(b.size) })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * اجرای پشتیبان‌گیری منطقی:
   * خروجی کامل داده‌ها را به‌صورت JSON در پوشه backups ذخیره می‌کند.
   * (در استقرار واقعی، pg_dump توصیه می‌شود — این پیاده‌سازی برای شروع است.)
   */
  async runBackup(user: AuthenticatedUser) {
    const startedAt = new Date();
    const fileName = `sana-backup-${startedAt.toISOString().replace(/[:.]/g, '-')}.json.enc`;

    try {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });

      // استخراج داده‌های اصلی (بدون توکن‌ها)
      const data = {
        exportedAt: startedAt.toISOString(),
        users: await this.prisma.user.findMany({
          select: { id: true, username: true, fullName: true, email: true, status: true },
        }),
        roles: await this.prisma.role.findMany(),
        permissions: await this.prisma.permission.findMany(),
        companies: await this.prisma.company.findMany(),
        branches: await this.prisma.branch.findMany(),
        employees: await this.prisma.employee.findMany(),
        contracts: await this.prisma.contract.findMany(),
        attendanceRecords: await this.prisma.attendanceRecord.findMany(),
        leaveRequests: await this.prisma.leaveRequest.findMany(),
        settings: await this.prisma.setting.findMany(),
      };

      const json = JSON.stringify(data, null, 2);
      const filePath = path.join(BACKUP_DIR, fileName);
      // فایل پشتیبان رمزنگاری‌شده و فقط برای مالک قابل خواندن ذخیره می‌شود
      fs.writeFileSync(filePath, this.encrypt(json), { mode: 0o600 });

      const stats = fs.statSync(filePath);
      const checksum = createHash('sha256').update(json).digest('hex').slice(0, 64);

      const row = await this.prisma.backupHistory.create({
        data: {
          fileName,
          size: BigInt(stats.size),
          checksum,
          location: filePath,
          result: BackupResult.SUCCESS,
          createdById: user.id,
          startedAt,
          finishedAt: new Date(),
        },
      });

      await this.audit.record(user.id, {
        action: AuditAction.BACKUP,
        entity: 'BackupHistory',
        entityId: row.id,
        after: { fileName, size: stats.size },
      });

      return {
        data: { id: row.id, fileName, size: stats.size, checksum },
        success: true,
        timestamp: new Date().toISOString(),
      };
    } catch (err: any) {
      const row = await this.prisma.backupHistory.create({
        data: {
          fileName,
          result: BackupResult.FAILED,
          error: String(err?.message ?? err),
          createdById: user.id,
          startedAt,
          finishedAt: new Date(),
        },
      });
      await this.audit.record(user.id, {
        action: AuditAction.BACKUP,
        entity: 'BackupHistory',
        entityId: row.id,
        note: 'پشتیبان‌گیری ناموفق',
      });
      throw err;
    }
  }

  async get(id: string) {
    const row = await this.prisma.backupHistory.findUnique({
      where: { id },
      include: { createdBy: { select: { id: true, fullName: true } } },
    });
    if (!row) throw new NotFoundException('رکورد پشتیبان یافت نشد.');
    return {
      data: { ...row, size: Number(row.size) },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }
}
