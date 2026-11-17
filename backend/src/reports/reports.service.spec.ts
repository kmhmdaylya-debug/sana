import { ReportsService } from './reports.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { NotFoundException, BadRequestException } from '@nestjs/common';

const actor = {
  id: 'actor-a', username: 'actor.a', fullName: 'Test Actor', email: 'actor@test.com',
  mobile: null, isSuperAdmin: false, employeeId: null, roleIds: [], roleCodes: [],
  permissions: ['reports.view', 'reports.run', 'reports.export'],
  scope: { unrestricted: false, companyIds: ['company-a'], branchIds: [], orgUnitIds: [], employeeIds: [], ownEmployeeId: null },
} as unknown as AuthenticatedUser;

describe('ReportsService', () => {
  let prisma: any;
  let service: ReportsService;

  beforeEach(() => {
    prisma = {
      reportRun: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), create: jest.fn(), update: jest.fn() },
      user: { findUnique: jest.fn() },
      $transaction: jest.fn(work => work(prisma)),
    };
    service = new ReportsService(prisma);
  });

  describe('listReportRuns', () => {
    it('returns paginated report runs', async () => {
      prisma.reportRun.count.mockResolvedValue(2);
      prisma.reportRun.findMany.mockResolvedValue([{ id: 'rr1', reportCode: 'EMPLOYEE_LIST', status: 'DONE', userId: 'actor-a' }, { id: 'rr2', reportCode: 'PAYROLL_SUMMARY', status: 'RUNNING', userId: 'actor-a' }]);
      const result = await service.listReportRuns({ page: 1, limit: 10, skip: 0 } as any, actor);
      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
    });

    it('filters by report code', async () => {
      await service.listReportRuns({ page: 1, limit: 10, skip: 0, reportCode: 'EMPLOYEE_LIST' } as any, actor);
      const where = prisma.reportRun.findMany.mock.calls[0][0].where;
      expect(where.reportCode).toBe('EMPLOYEE_LIST');
    });

    it('filters by status', async () => {
      await service.listReportRuns({ page: 1, limit: 10, skip: 0, status: 'DONE' } as any, actor);
      const where = prisma.reportRun.findMany.mock.calls[0][0].where;
      expect(where.status).toBe('DONE');
    });

    it('filters by user', async () => {
      await service.listReportRuns({ page: 1, limit: 10, skip: 0, userId: 'actor-a' } as any, actor);
      const where = prisma.reportRun.findMany.mock.calls[0][0].where;
      expect(where.userId).toBe('actor-a');
    });
  });

  describe('createReportRun', () => {
    it('creates report run', async () => {
      prisma.reportRun.create.mockResolvedValue({ id: 'rr1', reportCode: 'EMPLOYEE_LIST', status: 'RUNNING', userId: 'actor-a', rowCount: 0 });
      const result = await service.createReportRun({ reportCode: 'EMPLOYEE_LIST', params: { department: 'IT' }, format: 'csv' } as any, actor);
      expect(result.reportCode).toBe('EMPLOYEE_LIST');
      expect(result.status).toBe('RUNNING');
      expect(result.userId).toBe('actor-a');
    });

    it('rejects invalid report code', async () => {
      await expect(service.createReportRun({ reportCode: 'INVALID_CODE', params: {}, format: 'csv' } as any, actor)).rejects.toThrow(BadRequestException);
    });

    it('rejects invalid format', async () => {
      await expect(service.createReportRun({ reportCode: 'EMPLOYEE_LIST', params: {}, format: 'exe' } as any, actor)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getReportRun', () => {
    it('returns report run by id', async () => {
      prisma.reportRun.findUnique.mockResolvedValue({ id: 'rr1', reportCode: 'EMPLOYEE_LIST', status: 'DONE', deletedAt: null });
      const result = await service.getReportRun('rr1', actor);
      expect(result.id).toBe('rr1');
    });

    it('throws NotFoundException for non-existent report run', async () => {
      prisma.reportRun.findUnique.mockResolvedValue(null);
      await expect(service.getReportRun('rr1', actor)).rejects.toThrow(NotFoundException);
    });

    it('rejects accessing other user report run', async () => {
      prisma.reportRun.findUnique.mockResolvedValue({ id: 'rr1', reportCode: 'EMPLOYEE_LIST', status: 'DONE', userId: 'other-user', deletedAt: null });
      await expect(service.getReportRun('rr1', actor)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateReportRun', () => {
    it('updates report run status and result', async () => {
      prisma.reportRun.findUnique.mockResolvedValue({ id: 'rr1', reportCode: 'EMPLOYEE_LIST', status: 'RUNNING', userId: 'actor-a', deletedAt: null });
      prisma.reportRun.update.mockResolvedValue({ id: 'rr1', status: 'DONE', rowCount: 150, filePath: '/reports/employee_list.csv', finishedAt: new Date() });
      const result = await service.updateReportRun('rr1', { status: 'DONE', rowCount: 150, filePath: '/reports/employee_list.csv' } as any, actor);
      expect(result.status).toBe('DONE');
      expect(result.rowCount).toBe(150);
      expect(result.filePath).toBe('/reports/employee_list.csv');
    });

    it('rejects updating completed report run', async () => {
      prisma.reportRun.findUnique.mockResolvedValue({ id: 'rr1', reportCode: 'EMPLOYEE_LIST', status: 'DONE', userId: 'actor-a', deletedAt: null });
      await expect(service.updateReportRun('rr1', { status: 'RUNNING' } as any, actor)).rejects.toThrow(BadRequestException);
    });
  });

  describe('deleteReportRun', () => {
    it('soft deletes report run', async () => {
      prisma.reportRun.findUnique.mockResolvedValue({ id: 'rr1', reportCode: 'EMPLOYEE_LIST', status: 'DONE', userId: 'actor-a', deletedAt: null });
      prisma.reportRun.update.mockResolvedValue({ id: 'rr1', deletedAt: new Date() });
      const result = await service.deleteReportRun('rr1', actor);
      expect(result.success).toBe(true);
    });

    it('rejects deleting running report', async () => {
      prisma.reportRun.findUnique.mockResolvedValue({ id: 'rr1', reportCode: 'EMPLOYEE_LIST', status: 'RUNNING', userId: 'actor-a', deletedAt: null });
      await expect(service.deleteReportRun('rr1', actor)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getReportStats', () => {
    it('returns report statistics', async () => {
      prisma.reportRun.groupBy.mockResolvedValue([{ status: 'DONE', _count: { _all: 10 } }, { status: 'FAILED', _count: { _all: 2 } }, { status: 'RUNNING', _count: { _all: 1 } }]);
      const result = await service.getReportStats(actor);
      expect(result.byStatus).toHaveLength(3);
      expect(result.total).toBe(13);
    });
  });

  describe('exportReport', () => {
    it('exports report data', async () => {
      prisma.reportRun.findUnique.mockResolvedValue({ id: 'rr1', reportCode: 'EMPLOYEE_LIST', status: 'DONE', filePath: '/reports/employee_list.csv', userId: 'actor-a' });
      const result = await service.exportReport('rr1', actor);
      expect(result.filePath).toBe('/reports/employee_list.csv');
      expect(result.downloadUrl).toContain('/reports/employee_list.csv');
    });

    it('rejects export for non-existent report run', async () => {
      prisma.reportRun.findUnique.mockResolvedValue(null);
      await expect(service.exportReport('rr1', actor)).rejects.toThrow(NotFoundException);
    });

    it('rejects export for non-DONE report', async () => {
      prisma.reportRun.findUnique.mockResolvedValue({ id: 'rr1', reportCode: 'EMPLOYEE_LIST', status: 'RUNNING', userId: 'actor-a' });
      await expect(service.exportReport('rr1', actor)).rejects.toThrow(BadRequestException);
    });
  });
});
