import { AuditLogService } from './audit-log.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { NotFoundException, BadRequestException } from '@nestjs/common';

const actor = {
  id: 'actor-a', username: 'actor.a', fullName: 'Test Actor', email: 'actor@test.com',
  mobile: null, isSuperAdmin: false, employeeId: null, roleIds: [], roleCodes: [],
  permissions: ['audit.view'],
  scope: { unrestricted: false, companyIds: ['company-a'], branchIds: [], orgUnitIds: [], employeeIds: [], ownEmployeeId: null },
} as unknown as AuthenticatedUser;

describe('AuditLogService', () => {
  let prisma: any;
  let service: AuditLogService;

  beforeEach(() => {
    prisma = {
      auditLog: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), create: jest.fn() },
      user: { findUnique: jest.fn() },
      $transaction: jest.fn(work => work(prisma)),
    };
    service = new AuditLogService(prisma);
  });

  describe('listAuditLogs', () => {
    it('returns paginated audit logs', async () => {
      prisma.auditLog.count.mockResolvedValue(2);
      prisma.auditLog.findMany.mockResolvedValue([{ id: 'al1', action: 'CREATE', entity: 'Employee', userId: 'actor-a' }, { id: 'al2', action: 'UPDATE', entity: 'Employee', userId: 'actor-a' }]);
      const result = await service.listAuditLogs({ page: 1, limit: 10, skip: 0 } as any, actor);
      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
    });

    it('filters by action', async () => {
      await service.listAuditLogs({ page: 1, limit: 10, skip: 0, action: 'CREATE' } as any, actor);
      const where = prisma.auditLog.findMany.mock.calls[0][0].where;
      expect(where.action).toBe('CREATE');
    });

    it('filters by entity', async () => {
      await service.listAuditLogs({ page: 1, limit: 10, skip: 0, entity: 'Employee' } as any, actor);
      const where = prisma.auditLog.findMany.mock.calls[0][0].where;
      expect(where.entity).toBe('Employee');
    });

    it('filters by user', async () => {
      await service.listAuditLogs({ page: 1, limit: 10, skip: 0, userId: 'actor-a' } as any, actor);
      const where = prisma.auditLog.findMany.mock.calls[0][0].where;
      expect(where.userId).toBe('actor-a');
    });

    it('filters by date range', async () => {
      await service.listAuditLogs({ page: 1, limit: 10, skip: 0, fromDate: '2026-01-01', toDate: '2026-01-31' } as any, actor);
      const where = prisma.auditLog.findMany.mock.calls[0][0].where;
      expect(where.createdAt).toBeDefined();
    });
  });

  describe('getAuditLog', () => {
    it('returns audit log by id', async () => {
      prisma.auditLog.findUnique.mockResolvedValue({ id: 'al1', action: 'CREATE', entity: 'Employee', entityId: 'emp1', userId: 'actor-a' });
      const result = await service.getAuditLog('al1', actor);
      expect(result.id).toBe('al1');
    });

    it('throws NotFoundException for non-existent audit log', async () => {
      prisma.auditLog.findUnique.mockResolvedValue(null);
      await expect(service.getAuditLog('al1', actor)).rejects.toThrow(NotFoundException);
    });
  });

  describe('recordAuditLog', () => {
    it('creates audit log entry', async () => {
      prisma.auditLog.create.mockResolvedValue({ id: 'al1', action: 'CREATE', entity: 'Employee', entityId: 'emp1', userId: 'actor-a' });
      const result = await service.recordAuditLog({ userId: 'actor-a', action: 'CREATE', entity: 'Employee', entityId: 'emp1', before: null, after: { name: 'John' }, ip: '127.0.0.1', userAgent: 'test-agent' } as any);
      expect(result.action).toBe('CREATE');
      expect(result.entity).toBe('Employee');
      expect(result.entityId).toBe('emp1');
    });

    it('sanitizes sensitive data before recording', async () => {
      const sensitive = { password: 'secret123', token: 'abc123', nationalId: '0012345678', salary: 50000000 };
      prisma.auditLog.create.mockResolvedValue({ id: 'al1', action: 'UPDATE', entity: 'User', entityId: 'u1', userId: 'actor-a' });
      await service.recordAuditLog({ userId: 'actor-a', action: 'UPDATE', entity: 'User', entityId: 'u1', before: sensitive, after: sensitive } as any);
      const callArg = prisma.auditLog.create.mock.calls[0][0].data;
      expect(callArg.before).not.toContain('secret123');
      expect(callArg.before).not.toContain('abc123');
      expect(callArg.before).not.toContain('0012345678');
    });
  });

  describe('exportAuditLogs', () => {
    it('exports audit logs to CSV', async () => {
      prisma.auditLog.findMany.mockResolvedValue([{ id: 'al1', action: 'CREATE', entity: 'Employee', createdAt: new Date() }]);
      const result = await service.exportAuditLogs({ fromDate: '2026-01-01', toDate: '2026-01-31', format: 'csv' } as any, actor);
      expect(result.format).toBe('csv');
      expect(result.data).toBeDefined();
      expect(auditLogContainsNoSecrets(result.data)).toBe(true);
    });
  });

  describe('getAuditStats', () => {
    it('returns audit statistics', async () => {
      prisma.auditLog.groupBy.mockResolvedValue([{ action: 'CREATE', _count: { _all: 10 } }, { action: 'UPDATE', _count: { _all: 5 } }]);
      const result = await service.getAuditStats({ fromDate: '2026-01-01', toDate: '2026-01-31' } as any, actor);
      expect(result.byAction).toHaveLength(2);
      expect(result.total).toBe(15);
    });
  });

  describe('deleteAuditLog', () => {
    it('rejects deletion of audit logs (immutable)', async () => {
      await expect(service.deleteAuditLog('al1', actor)).rejects.toThrow(BadRequestException);
    });
  });
});

function auditLogContainsNoSecrets(data: string): boolean {
  const secrets = ['password', 'secret', 'token', 'nationalId', 'sheba', 'cardNumber'];
  return !secrets.some(s => data.toLowerCase().includes(s));
}