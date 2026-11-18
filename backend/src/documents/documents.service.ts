import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { AuditAction, DocumentType, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { AccessService } from '../common/access/access.service';
import { AuditService } from '../common/audit/audit.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { PERMISSIONS } from '../common/constants/permissions';
import { PaginationDto } from '../common/dto/pagination.dto';
import { randomFileName } from '../common/utils/crypto.util';
import { employeeVisibility } from '../employees/employee-privacy';
import { CreateDocumentDto, DocumentQueryDto, UpdateDocumentDto } from './dto/documents.dto';
import { ConfigService } from '@nestjs/config';
import { execFile } from 'child_process';
import { promisify } from 'util';

const UPLOAD_ROOT = path.resolve(process.cwd(), 'uploads');
const UPLOAD_DIR = path.join(UPLOAD_ROOT, 'documents');
const ALLOWED_EXT = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx', '.xls', '.xlsx'];
const MAX_SIZE = 10 * 1024 * 1024;
const PERSONAL_DOCUMENTS: DocumentType[] = ['NATIONAL_ID', 'BIRTH_CERTIFICATE', 'RESUME', 'NDA'];

export interface UploadedFilePayload {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

/** اسکن آنتی‌ویروس فایل (در صورت فعال بودن) */
export async function scanFileForViruses(filePath: string, config: ConfigService): Promise<void> {
  if (!config.get<boolean>('app.security.antivirusEnabled')) return;
  try {
    await promisify(execFile)(config.get<string>('app.security.antivirusCommand') ?? 'clamscan',
      ['--no-summary', '--infected', filePath], {
        timeout: config.get<number>('app.security.antivirusTimeoutMs') ?? 30000,
        windowsHide: true,
        maxBuffer: 1024 * 1024,
      });
  } catch (error: unknown) {
    const code = (error as { code?: number | string }).code;
    if (code === 1) throw new BadRequestException('فایل آپلودی حاوی محتوای خطرناک است و رد شد.');
    throw new ServiceUnavailableException('بررسی امنیت فایل انجام نشد؛ دوباره تلاش کنید.');
  }
}

/** اعتبارسنجی و ذخیره فایل آپلودی */
export async function storeUpload(file: UploadedFilePayload, subdir: string, config: ConfigService): Promise<{ fileName: string; filePath: string }> {
  if (!file) throw new BadRequestException('فایل پیوست الزامی است.');
  if (!Buffer.isBuffer(file.buffer) || !file.buffer.length || file.size !== file.buffer.length || file.size > MAX_SIZE) throw new BadRequestException('حجم فایل معتبر نیست یا از ۱۰ مگابایت بیشتر است.');
  if (!/^[a-z0-9-]{1,40}$/.test(subdir)) throw new BadRequestException('مسیر ذخیره فایل معتبر نیست.');
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXT.includes(ext)) {
    throw new BadRequestException(`پسوند «${ext}» مجاز نیست. پسوندهای مجاز: ${ALLOWED_EXT.join('، ')}`);
  }
  const signatures: Record<string, { mime: string[]; prefix: number[] }> = {
    '.pdf': { mime: ['application/pdf'], prefix: [0x25, 0x50, 0x44, 0x46, 0x2d] },
    '.png': { mime: ['image/png'], prefix: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
    '.jpg': { mime: ['image/jpeg'], prefix: [0xff, 0xd8, 0xff] },
    '.jpeg': { mime: ['image/jpeg'], prefix: [0xff, 0xd8, 0xff] },
    '.doc': { mime: ['application/msword'], prefix: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] },
    '.xls': { mime: ['application/vnd.ms-excel'], prefix: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] },
    '.docx': { mime: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'], prefix: [0x50, 0x4b, 0x03, 0x04] },
    '.xlsx': { mime: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'], prefix: [0x50, 0x4b, 0x03, 0x04] },
  };
  const expected = signatures[ext];
  if (!expected.mime.includes(file.mimetype) || !file.buffer.subarray(0, expected.prefix.length).equals(Buffer.from(expected.prefix))) throw new BadRequestException('محتوای فایل با نوع آن مطابقت ندارد.');
  const dir = path.join(UPLOAD_ROOT, subdir);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const stored = `${randomFileName(ext)}`;
  const fullPath = path.join(dir, stored);
  fs.writeFileSync(fullPath, file.buffer, { flag: 'wx', mode: 0o600 });
  try {
    await scanFileForViruses(fullPath, config);
  } catch (error) {
    await fs.promises.unlink(fullPath).catch(() => undefined);
    throw error;
  }
  return { fileName: path.basename(file.originalname.replace(/\\/g, '/')).replace(/[\x00-\x1f\x7f]/g, '').slice(0, 255), filePath: `${subdir}/${stored}` };
}

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  async list(query: DocumentQueryDto, pagination: PaginationDto, user: AuthenticatedUser) {
    const where: Prisma.EmployeeDocumentWhereInput = {
      AND: [this.documentVisibility(user)],
      deletedAt: null,
      employee: this.access.employeeWhereFor(user),
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      ...(query.docType ? { docType: query.docType } : {}),
      ...(query.confidentiality ? { confidentiality: query.confidentiality } : {}),
      ...(['true', '1'].includes(query.expiring ?? '') ? { expiryDate: { gte: new Date(), lte: new Date(Date.now() + 60 * 86400000) } } : {}),
    };

    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const [total, rows] = await Promise.all([
      this.prisma.employeeDocument.count({ where }),
      this.prisma.employeeDocument.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          employee: { select: { id: true, code: true, firstName: true, lastName: true } },
          versions: { orderBy: { version: 'desc' }, take: 1 },
        },
      }),
    ]);

    return {
      data: rows.map(row => ({ ...row, versions: row.versions.map(({ filePath: _path, ...version }) => version) })),
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

  /** مدارک دارای تاریخ انقضا در ۶۰ روز آینده (برای اعلان‌ها و داشبورد) */
  async expiring(user: AuthenticatedUser) {
    const from = new Date();
    const to = new Date();
    to.setDate(to.getDate() + 60);
    const rows = await this.prisma.employeeDocument.findMany({
      where: {
        AND: [this.documentVisibility(user)],
        deletedAt: null,
        expiryDate: { gte: from, lte: to },
        employee: this.access.employeeWhereFor(user),
      },
      include: {
        employee: { select: { id: true, code: true, firstName: true, lastName: true } },
      },
      orderBy: { expiryDate: 'asc' },
    });
    return {
      data: rows,
      meta: { total: rows.length, page: 1, limit: rows.length, totalPages: 1, hasNext: false, hasPrev: false },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  async get(id: string, user: AuthenticatedUser) {
    const doc = await this.getDoc(id, user);
    await this.audit.recordView(user.id, 'EmployeeDocument', id, {});
    return {
      data: {
        ...doc,
        versions: doc.versions.map((v) => ({ ...v, filePath: undefined })),
      },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  async create(dto: CreateDocumentDto, user: AuthenticatedUser) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, deletedAt: null, AND: [this.access.employeeWhereFor(user)] },
    });
    if (!employee) throw new NotFoundException('نیروی موردنظر یافت نشد.');

    const row = await this.prisma.employeeDocument.create({
      data: {
        employeeId: employee.id,
        docType: dto.docType,
        title: dto.title.trim(),
        documentNumber: dto.documentNumber ?? null,
        issueDate: dto.issueDate ? new Date(dto.issueDate) : null,
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null,
        confidentiality: dto.confidentiality ?? 'NORMAL',
      },
    });

    await this.audit.record(user.id, {
      action: AuditAction.CREATE,
      entity: 'EmployeeDocument',
      entityId: row.id,
      after: { docType: dto.docType, title: dto.title },
    });

    return {
      data: { id: row.id },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  /** آپلود نسخه فایل مدرک */
  async uploadVersion(id: string, file: UploadedFilePayload, note: string | undefined, user: AuthenticatedUser) {
    if (note !== undefined && (typeof note !== 'string' || note.length > 2000)) throw new BadRequestException('یادداشت فایل معتبر نیست.');
    let stored: Awaited<ReturnType<typeof storeUpload>> | undefined;
    try {
    return await this.prisma.$transaction(async (db) => {
    await db.$queryRaw`SELECT id FROM "EmployeeDocument" WHERE id = ${id}::uuid FOR UPDATE`;
    const doc = await this.getDoc(id, user, db);
    stored = await storeUpload(file, 'documents', this.config);

    const version = doc.currentVersion + 1;
    await db.employeeDocumentVersion.create({
      data: {
        documentId: id,
        version,
        fileName: stored.fileName,
        filePath: stored.filePath,
        mimeType: file.mimetype,
        size: file.size,
        note: note ?? null,
        uploadedById: user.id,
      },
    });
    const updated = await db.employeeDocument.update({
      where: { id },
      data: { currentVersion: version },
    });

    await this.audit.recordInTransaction(db, user.id, {
      action: AuditAction.CREATE,
      entity: 'EmployeeDocumentVersion',
      entityId: id,
      after: { version, fileName: stored.fileName, size: file.size },
      note: 'آپلود نسخه جدید مدرک',
    });

    return {
      data: { id, version: updated.currentVersion },
      success: true,
      timestamp: new Date().toISOString(),
    };
    }, { maxWait: 10000, timeout: 30000 });
    } catch (error) {
      if (stored) {
        const absolute = path.resolve(UPLOAD_ROOT, stored.filePath);
        if (path.dirname(absolute) === UPLOAD_DIR) fs.unlinkSync(absolute);
      }
      throw error;
    }
  }

  /** دانلود فایل مدرک (فقط مجازهای مناسب) */
  async downloadVersion(versionId: string, user: AuthenticatedUser) {
    const version = await this.prisma.employeeDocumentVersion.findUnique({
      where: { id: versionId },
      include: { document: { include: { employee: true } } },
    });
    if (!version || version.document.deletedAt) throw new NotFoundException('نسخه مدرک یافت نشد.');

    if (!this.canReadDocument(version.document, user)) {
      throw new ForbiddenException('این مدرک محرمانه است و دسترسی به آن ندارید.');
    }
    const ok = await this.access.canAccessEmployee(user, version.document.employeeId);
    if (!ok) throw new ForbiddenException('به مدارک این نیرو دسترسی ندارید.');

    const absolute = this.resolveDocumentFile(version.filePath);

    await this.audit.record(user.id, {
      action: AuditAction.DOWNLOAD,
      entity: 'EmployeeDocumentVersion',
      entityId: versionId,
      note: `دانلود مدرک «${version.document.title}»`,
    });

    return {
      fileName: version.fileName,
      mimeType: version.mimeType ?? 'application/octet-stream',
      buffer: fs.readFileSync(absolute),
    };
  }

  async update(id: string, dto: UpdateDocumentDto, user: AuthenticatedUser) {
    await this.getDoc(id, user);
    const row = await this.prisma.employeeDocument.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.documentNumber !== undefined ? { documentNumber: dto.documentNumber } : {}),
        ...(dto.issueDate !== undefined ? { issueDate: dto.issueDate ? new Date(dto.issueDate) : null } : {}),
        ...(dto.expiryDate !== undefined ? { expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null } : {}),
        ...(dto.confidentiality !== undefined ? { confidentiality: dto.confidentiality } : {}),
      },
    });
    await this.audit.record(user.id, {
      action: AuditAction.UPDATE,
      entity: 'EmployeeDocument',
      entityId: id,
      after: { title: row.title, confidentiality: row.confidentiality },
    });
    return {
      data: { id: row.id },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  /** حذف منطقی مدرک */
  async remove(id: string, user: AuthenticatedUser) {
    await this.getDoc(id, user);
    await this.prisma.employeeDocument.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit.record(user.id, {
      action: AuditAction.DELETE,
      entity: 'EmployeeDocument',
      entityId: id,
    });
    return { success: true, timestamp: new Date().toISOString() };
  }

  private async getDoc(id: string, user: AuthenticatedUser, db: Prisma.TransactionClient = this.prisma) {
    const doc = await db.employeeDocument.findFirst({
      where: { id, deletedAt: null, employee: this.access.employeeWhereFor(user) },
      include: {
        employee: { select: { id: true, userId: true, code: true, firstName: true, lastName: true } },
        versions: { orderBy: { version: 'desc' } },
      },
    });
    if (!doc) throw new NotFoundException('مدرک موردنظر یافت نشد یا به حوزه دسترسی شما تعلق ندارد.');

    if (!this.canReadDocument(doc, user)) {
      throw new ForbiddenException('این مدرک محرمانه است و دسترسی به آن ندارید.');
    }
    return doc;
  }

  private documentVisibility(user: AuthenticatedUser): Prisma.EmployeeDocumentWhereInput {
    const visibility = employeeVisibility(user, '__document_scope__');
    const excluded: DocumentType[] = visibility.personal ? [] : [...PERSONAL_DOCUMENTS];
    if (!visibility.personal || !visibility.salary) excluded.push('CONTRACT');
    return { OR: [{ AND: [visibility.personal ? {} : { confidentiality: 'NORMAL' }, { docType: { notIn: excluded } }] }, ...(user.employeeId ? [{ employeeId: user.employeeId }] : [])] };
  }

  private canReadDocument(doc: { employeeId: string; docType: DocumentType; confidentiality: string }, user: AuthenticatedUser): boolean {
    const visibility = employeeVisibility(user, doc.employeeId);
    if (doc.confidentiality !== 'NORMAL' && !visibility.personal) return false;
    if (PERSONAL_DOCUMENTS.includes(doc.docType) && !visibility.personal) return false;
    return doc.docType !== 'CONTRACT' || (visibility.personal && visibility.salary);
  }

  private resolveDocumentFile(storedPath: string): string {
    // Strict validation: only alphanumeric, underscore, hyphen, dot - no directory separators
    if (!/^documents\/[a-zA-Z0-9_.-]+$/.test(storedPath)) throw new NotFoundException('فایل معتبر یافت نشد.');
    
    // Normalize and check for traversal attempts
    const normalized = path.normalize(storedPath);
    if (normalized !== storedPath || normalized.startsWith('..') || path.isAbsolute(normalized)) {
      throw new NotFoundException('فایل معتبر یافت نشد.');
    }
    
    if (!fs.existsSync(UPLOAD_DIR)) throw new NotFoundException('فایل یافت نشد.');
    const root = fs.realpathSync(UPLOAD_DIR);
    
    // Retain access to files written by the old, duplicated documents directory.
    for (const candidate of [path.resolve(UPLOAD_ROOT, storedPath), path.resolve(UPLOAD_DIR, storedPath)]) {
      if (!fs.existsSync(candidate)) continue;
      const real = fs.realpathSync(candidate);
      const relative = path.relative(root, real);
      if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) continue;
      const stat = fs.statSync(real);
      if (stat.isFile() && stat.size <= MAX_SIZE) return real;
    }
    throw new NotFoundException('فایل معتبر یافت نشد.');
  }
}
