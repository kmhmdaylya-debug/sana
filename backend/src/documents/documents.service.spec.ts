import { DocumentsService } from './documents.service';
import { AccessService } from '../common/access/access.service';
import { AuditService } from '../common/audit/audit.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { NotFoundException, ConflictException, BadRequestException, ForbiddenException } from '@nestjs/common';

const actor = {
  id: 'actor-a', username: 'actor.a', fullName: 'Test Actor', email: 'actor@test.com',
  mobile: null, isSuperAdmin: false, employeeId: 'emp-a', roleIds: [], roleCodes: [],
  permissions: ['documents.view', 'documents.create', 'documents.update', 'documents.delete'],
  scope: { unrestricted: false, companyIds: ['company-a'], branchIds: [], orgUnitIds: [], employeeIds: [], ownEmployeeId: 'emp-a' },
} as unknown as AuthenticatedUser;

describe('DocumentsService', () => {
  let prisma: any;
  let access: any;
  let audit: any;
  let service: DocumentsService;

  beforeEach(() => {
    prisma = {
      employeeDocument: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), create: jest.fn(), update: jest.fn() },
      employeeDocumentVersion: { create: jest.fn(), findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn() },
      employee: { findUnique: jest.fn().mockResolvedValue({ id: 'emp-a', companyId: 'company-a', deletedAt: null }) },
      $transaction: jest.fn(work => work(prisma)),
    };
    access = { allowedCompanyIds: jest.fn().mockResolvedValue(['company-a']), canAccessEmployee: jest.fn().mockResolvedValue(true), assertEmployeeAccess: jest.fn().mockResolvedValue(undefined), assertCompanyAccess: jest.fn().mockResolvedValue(undefined) };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    service = new DocumentsService(prisma, access, audit);
  });

  describe('listDocuments', () => {
    it('returns paginated employee documents', async () => {
      prisma.employeeDocument.count.mockResolvedValue(2);
      prisma.employeeDocument.findMany.mockResolvedValue([{ id: 'd1', docType: 'NATIONAL_ID', title: 'National ID' }, { id: 'd2', docType: 'DEGREE', title: 'Degree' }]);
      const result = await service.listDocuments('emp-a', { page: 1, limit: 10, skip: 0 } as any, actor);
      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
    });

    it('validates employee access', async () => {
      access.canAccessEmployee.mockResolvedValue(false);
      await expect(service.listDocuments('emp-other', { page: 1, limit: 10, skip: 0 } as any, actor)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('createDocument', () => {
    it('creates employee document', async () => {
      prisma.employee.findUnique.mockResolvedValue({ id: 'emp-a', companyId: 'company-a', deletedAt: null });
      prisma.employeeDocument.create.mockResolvedValue({ id: 'd1', docType: 'NATIONAL_ID', title: 'National ID', employeeId: 'emp-a' });
      const result = await service.createDocument('emp-a', { docType: 'NATIONAL_ID', title: 'National ID', documentNumber: '1234567890' } as any, actor);
      expect(result.docType).toBe('NATIONAL_ID');
      expect(audit.record).toHaveBeenCalled();
    });

    it('rejects document for non-existent employee', async () => {
      prisma.employee.findUnique.mockResolvedValue(null);
      await expect(service.createDocument('emp-other', { docType: 'NATIONAL_ID', title: 'National ID' } as any, actor)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getDocument', () => {
    it('returns document by id', async () => {
      prisma.employeeDocument.findUnique.mockResolvedValue({ id: 'd1', docType: 'NATIONAL_ID', employeeId: 'emp-a', deletedAt: null });
      const result = await service.getDocument('d1', actor);
      expect(result.id).toBe('d1');
    });

    it('throws NotFoundException for non-existent document', async () => {
      prisma.employeeDocument.findUnique.mockResolvedValue(null);
      await expect(service.getDocument('d1', actor)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateDocument', () => {
    it('updates document', async () => {
      prisma.employeeDocument.findUnique.mockResolvedValue({ id: 'd1', docType: 'NATIONAL_ID', title: 'Old Title', employeeId: 'emp-a', deletedAt: null });
      prisma.employeeDocument.update.mockResolvedValue({ id: 'd1', docType: 'NATIONAL_ID', title: 'New Title' });
      const result = await service.updateDocument('d1', { title: 'New Title' } as any, actor);
      expect(result.title).toBe('New Title');
    });
  });

  describe('deleteDocument', () => {
    it('soft deletes document', async () => {
      prisma.employeeDocument.findUnique.mockResolvedValue({ id: 'd1', docType: 'NATIONAL_ID', employeeId: 'emp-a', deletedAt: null });
      prisma.employeeDocument.update.mockResolvedValue({ id: 'd1', deletedAt: new Date() });
      const result = await service.deleteDocument('d1', actor);
      expect(result.success).toBe(true);
    });
  });

  describe('uploadDocumentVersion', () => {
    it('uploads document version', async () => {
      prisma.employeeDocument.findUnique.mockResolvedValue({ id: 'd1', currentVersion: 1, employeeId: 'emp-a' });
      prisma.employeeDocumentVersion.findFirst.mockResolvedValue(null);
      prisma.employeeDocumentVersion.create.mockResolvedValue({ id: 'dv1', version: 2, fileName: 'file.pdf' });
      prisma.employeeDocument.update.mockResolvedValue({ id: 'd1', currentVersion: 2 });
      const result = await service.uploadDocumentVersion('d1', { fileName: 'file.pdf', filePath: '/uploads/file.pdf', mimeType: 'application/pdf', size: 1024 } as any, actor);
      expect(result.version).toBe(2);
    });
  });

  describe('deleteDocumentVersion', () => {
    it('deletes document version', async () => {
      prisma.employeeDocumentVersion.findUnique.mockResolvedValue({ id: 'dv1', documentId: 'd1', version: 1 });
      prisma.employeeDocumentVersion.delete.mockResolvedValue({ id: 'dv1' });
      const result = await service.deleteDocumentVersion('dv1', actor);
      expect(result.success).toBe(true);
    });
  });

  describe('getDocumentDownloadUrl', () => {
    it('returns download URL for document version', async () => {
      prisma.employeeDocumentVersion.findUnique.mockResolvedValue({ id: 'dv1', documentId: 'd1', filePath: '/uploads/file.pdf', mimeType: 'application/pdf' });
      const result = await service.getDocumentDownloadUrl('dv1', actor);
      expect(result.url).toContain('/uploads/file.pdf');
    });

    it('logs download for audit', async () => {
      prisma.employeeDocumentVersion.findUnique.mockResolvedValue({ id: 'dv1', documentId: 'd1', filePath: '/uploads/file.pdf', mimeType: 'application/pdf' });
      await service.getDocumentDownloadUrl('dv1', actor);
      expect(audit.record).toHaveBeenCalledWith(actor.id, expect.objectContaining({ action: 'DOWNLOAD' }));
    });
  });
});