import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
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
import { CreateDocumentDto, DocumentQueryDto, UpdateDocumentDto } from './dto/documents.dto';

const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads', 'documents');
const ALLOWED_EXT = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx', '.xls', '.xlsx'];
const MAX_SIZE = 10 * 1024 * 1024;

export interface UploadedFilePayload {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

/** اعتبارسنجی و ذخیره فایل آپلودی */
export function storeUpload(file: UploadedFilePayload, subdir: string): { fileName: string; filePath: string } {
  if (!file) throw new BadRequestException('فایل پیوست الزامی است.');
  if (file.size > MAX_SIZE) throw new BadRequestException('حجم فایل نباید از ۱۰ مگابایت بیشتر باشد.');
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXT.includes(ext)) {
    throw new BadRequestException(`پسوند «${ext}» مجاز نیست. پسوندهای مجاز: ${ALLOWED_EXT.join('، ')}`);
  }
  const dir = path.join(UPLOAD_DIR, subdir);
  fs.mkdirSync(dir, { recursive: true });
  const stored = `${randomFileName(ext)}`;
  fs.writeFileSync(path.join(dir, stored), file.buffer);
  return { fileName: file.originalname, filePath: `${subdir}/${stored}` };
}

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly audit: AuditService,
  ) {}

  async list(query: DocumentQueryDto, pagination: PaginationDto, user: AuthenticatedUser) {
    const canSeeConfidential =
      user.isSuperAdmin || user.permissions.includes(PERMISSIONS.EMPLOYEES_VIEW_SENSITIVE);
    const where: Prisma.EmployeeDocumentWhereInput = {
      deletedAt: null,
      employee: this.access.employeeWhereFor(user),
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      ...(query.docType ? { docType: query.docType } : {}),
      ...(query.confidentiality ? { confidentiality: query.confidentiality } : {}),
      ...(!canSeeConfidential ? { confidentiality: { not: 'SECRET' } } : {}),
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

    // فیلتر «در حال انقضا» روی آخرین نسخه — ساده و در حافظه
    let data = rows;
    if (query.expiring === 'true' || query.expiring === '1') {
      const to = new Date();
      to.setDate(to.getDate() + 60);
      data = rows.filter((d) => d.expiryDate && d.expiryDate >= new Date() && d.expiryDate <= to);
    }

    return {
      data,
      meta: {
        total: query.expiring ? data.length : total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil((query.expiring ? data.length : total) / limit)),
        hasNext: page * limit < (query.expiring ? data.length : total),
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
    const doc = await this.getDoc(id, user);
    const stored = storeUpload(file, 'documents');

    const version = doc.currentVersion + 1;
    await this.prisma.employeeDocumentVersion.create({
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
    const updated = await this.prisma.employeeDocument.update({
      where: { id },
      data: { currentVersion: version },
    });

    await this.audit.record(user.id, {
      action: AuditAction.DOWNLOAD,
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
  }

  /** دانلود فایل مدرک (فقط مجازهای مناسب) */
  async downloadVersion(versionId: string, user: AuthenticatedUser) {
    const version = await this.prisma.employeeDocumentVersion.findUnique({
      where: { id: versionId },
      include: { document: { include: { employee: true } } },
    });
    if (!version || version.document.deletedAt) throw new NotFoundException('نسخه مدرک یافت نشد.');

    const canSeeConfidential =
      user.isSuperAdmin || user.permissions.includes(PERMISSIONS.EMPLOYEES_VIEW_SENSITIVE);
    if (version.document.confidentiality === 'SECRET' && !canSeeConfidential) {
      throw new ForbiddenException('این مدرک محرمانه است و دسترسی به آن ندارید.');
    }
    const ok = await this.access.canAccessEmployee(user, version.document.employeeId);
    if (!ok) throw new ForbiddenException('به مدارک این نیرو دسترسی ندارید.');

    const absolute = path.join(UPLOAD_DIR, '..', version.filePath);
    if (!fs.existsSync(absolute)) throw new NotFoundException('فایل روی سرور یافت نشد.');

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

  private async getDoc(id: string, user: AuthenticatedUser) {
    const doc = await this.prisma.employeeDocument.findFirst({
      where: { id, deletedAt: null, employee: this.access.employeeWhereFor(user) },
      include: {
        employee: { select: { id: true, userId: true, code: true, firstName: true, lastName: true } },
        versions: { orderBy: { version: 'desc' } },
      },
    });
    if (!doc) throw new NotFoundException('مدرک موردنظر یافت نشد یا به حوزه دسترسی شما تعلق ندارد.');

    const canSeeConfidential =
      user.isSuperAdmin || user.permissions.includes(PERMISSIONS.EMPLOYEES_VIEW_SENSITIVE);
    if (doc.confidentiality === 'SECRET' && !canSeeConfidential) {
      throw new ForbiddenException('این مدرک محرمانه است و دسترسی به آن ندارید.');
    }
    return doc;
  }
}
