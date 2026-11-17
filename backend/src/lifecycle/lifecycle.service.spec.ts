import { LifecycleService } from './lifecycle.service';
import { AccessService } from '../common/access/access.service';
import { AuditService } from '../common/audit/audit.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { NotFoundException, ConflictException, BadRequestException, ForbiddenException } from '@nestjs/common';

const actor = {
  id: 'actor-a', username: 'actor.a', fullName: 'Test Actor', email: 'actor@test.com',
  mobile: null, isSuperAdmin: false, employeeId: 'emp-a', roleIds: [], roleCodes: [],
  permissions: ['lifecycle.view', 'lifecycle.create', 'lifecycle.update', 'lifecycle.delete'],
  scope: { unrestricted: false, companyIds: ['company-a'], branchIds: [], orgUnitIds: [], employeeIds: [], ownEmployeeId: 'emp-a' },
} as unknown as AuthenticatedUser;

describe('LifecycleService', () => {
  let prisma: any;
  let access: any;
  let audit: any;
  let service: LifecycleService;

  beforeEach(() => {
    prisma = {
      onboardingChecklistTemplate: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), create: jest.fn(), update: jest.fn() },
      onboardingTemplateItem: { findMany: jest.fn().mockResolvedValue([]), create: jest.fn() },
      onboardingChecklist: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), create: jest.fn(), update: jest.fn() },
      onboardingChecklistItem: { create: jest.fn(), findMany: jest.fn().mockResolvedValue([]), update: jest.fn() },
      offboardingChecklist: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), create: jest.fn(), update: jest.fn() },
      offboardingChecklistItem: { create: jest.fn(), findMany: jest.fn().mockResolvedValue([]), update: jest.fn() },
      terminationRequest: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), create: jest.fn(), update: jest.fn() },
      employee: { findUnique: jest.fn().mockResolvedValue({ id: 'emp-a', companyId: 'company-a', deletedAt: null, status: 'ACTIVE' }) },
      user: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]), update: jest.fn() },
      $transaction: jest.fn(work => work(prisma)),
    };
    access = { allowedCompanyIds: jest.fn().mockResolvedValue(['company-a']), canAccessEmployee: jest.fn().mockResolvedValue(true), assertCompanyAccess: jest.fn().mockResolvedValue(undefined), assertEmployeeAccess: jest.fn().mockResolvedValue(undefined), assertEmployeeMutable: jest.fn().mockResolvedValue(undefined) };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    service = new LifecycleService(prisma, access, audit);
  });

  describe('listOnboardingTemplates', () => {
    it('returns paginated onboarding templates', async () => {
      prisma.onboardingChecklistTemplate.count.mockResolvedValue(2);
      prisma.onboardingChecklistTemplate.findMany.mockResolvedValue([{ id: 't1', name: 'Developer Onboarding', appliesTo: 'PERMANENT', isActive: true }, { id: 't2', name: 'Contractor Onboarding', appliesTo: 'CONTRACTUAL', isActive: true }]);
      const result = await service.listOnboardingTemplates({ page: 1, limit: 10, skip: 0 } as any, actor);
      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
    });

    it('filters by appliesTo', async () => {
      await service.listOnboardingTemplates({ page: 1, limit: 10, skip: 0, appliesTo: 'PERMANENT' } as any, actor);
      const where = prisma.onboardingChecklistTemplate.findMany.mock.calls[0][0].where;
      expect(where.appliesTo).toBe('PERMANENT');
    });
  });

  describe('createOnboardingTemplate', () => {
    it('creates onboarding template with items', async () => {
      prisma.onboardingChecklistTemplate.findFirst.mockResolvedValue(null);
      prisma.onboardingChecklistTemplate.create.mockResolvedValue({ id: 't1', name: 'New Template', companyId: 'company-a', appliesTo: 'PERMANENT', isActive: true });
      prisma.onboardingTemplateItem.create.mockResolvedValue({ id: 'ti1', templateId: 't1', title: 'Setup Workspace', sortOrder: 1, isRequired: true });
      const result = await service.createOnboardingTemplate({ name: 'New Template', appliesTo: 'PERMANENT', items: [{ title: 'Setup Workspace', sortOrder: 1, isRequired: true, requiresDocument: false }] } as any, actor);
      expect(result.name).toBe('New Template');
      expect(audit.record).toHaveBeenCalled();
    });

    it('rejects duplicate template name', async () => {
      prisma.onboardingChecklistTemplate.findFirst.mockResolvedValue({ id: 't1', name: 'Developer Onboarding', deletedAt: null });
      await expect(service.createOnboardingTemplate({ name: 'Developer Onboarding', appliesTo: 'PERMANENT', items: [] } as any, actor)).rejects.toThrow(ConflictException);
    });
  });

  describe('getOnboardingTemplate', () => {
    it('returns template by id with items', async () => {
      prisma.onboardingChecklistTemplate.findUnique.mockResolvedValue({ id: 't1', name: 'Developer Onboarding', deletedAt: null });
      prisma.onboardingTemplateItem.findMany.mockResolvedValue([{ id: 'ti1', templateId: 't1', title: 'Setup Workspace', sortOrder: 1, isRequired: true }]);
      const result = await service.getOnboardingTemplate('t1', actor);
      expect(result.id).toBe('t1');
      expect(result.items).toHaveLength(1);
    });

    it('throws NotFoundException for non-existent template', async () => {
      prisma.onboardingChecklistTemplate.findUnique.mockResolvedValue(null);
      await expect(service.getOnboardingTemplate('t1', actor)).rejects.toThrow(NotFoundException);
    });
  });

  describe('createOnboardingChecklist', () => {
    it('creates onboarding checklist for employee', async () => {
      prisma.employee.findUnique.mockResolvedValue({ id: 'emp-a', companyId: 'company-a', deletedAt: null });
      prisma.onboardingChecklistTemplate.findUnique.mockResolvedValue({ id: 't1', name: 'Developer Onboarding', appliesTo: 'PERMANENT' });
      prisma.onboardingChecklist.findFirst.mockResolvedValue(null);
      prisma.onboardingChecklist.create.mockResolvedValue({ id: 'c1', employeeId: 'emp-a', templateId: 't1', status: 'NOT_STARTED' });
      prisma.onboardingTemplateItem.findMany.mockResolvedValue([{ id: 'ti1', title: 'Setup Workspace', isRequired: true }]);
      prisma.onboardingChecklistItem.create.mockResolvedValue({ id: 'ci1', checklistId: 'c1', title: 'Setup Workspace', status: 'PENDING' });
      const result = await service.createOnboardingChecklist({ employeeId: 'emp-a', templateId: 't1' } as any, actor);
      expect(result.employeeId).toBe('emp-a');
      expect(result.status).toBe('NOT_STARTED');
      expect(audit.record).toHaveBeenCalled();
    });

    it('rejects duplicate onboarding checklist', async () => {
      prisma.employee.findUnique.mockResolvedValue({ id: 'emp-a', companyId: 'company-a', deletedAt: null });
      prisma.onboardingChecklistTemplate.findUnique.mockResolvedValue({ id: 't1', name: 'Developer Onboarding', appliesTo: 'PERMANENT' });
      prisma.onboardingChecklist.findFirst.mockResolvedValue({ id: 'c1', employeeId: 'emp-a', templateId: 't1' });
      await expect(service.createOnboardingChecklist({ employeeId: 'emp-a', templateId: 't1' } as any, actor)).rejects.toThrow(ConflictException);
    });
  });

  describe('getOnboardingChecklist', () => {
    it('returns checklist by id with items', async () => {
      prisma.onboardingChecklist.findUnique.mockResolvedValue({ id: 'c1', employeeId: 'emp-a', templateId: 't1', status: 'IN_PROGRESS', deletedAt: null });
      prisma.onboardingChecklistItem.findMany.mockResolvedValue([{ id: 'ci1', checklistId: 'c1', title: 'Setup Workspace', status: 'PENDING' }]);
      const result = await service.getOnboardingChecklist('c1', actor);
      expect(result.id).toBe('c1');
      expect(result.items).toHaveLength(1);
    });

    it('throws NotFoundException for non-existent checklist', async () => {
      prisma.onboardingChecklist.findUnique.mockResolvedValue(null);
      await expect(service.getOnboardingChecklist('c1', actor)).rejects.toThrow(NotFoundException);
    });
  });

  describe('completeOnboardingItem', () => {
    it('completes onboarding checklist item', async () => {
      prisma.onboardingChecklistItem.findUnique.mockResolvedValue({ id: 'ci1', checklistId: 'c1', status: 'PENDING', completedById: null });
      prisma.onboardingChecklistItem.update.mockResolvedValue({ id: 'ci1', status: 'DONE', completedById: 'actor-a', completedAt: new Date() });
      const result = await service.completeOnboardingItem('ci1', { note: 'Completed successfully' } as any, actor);
      expect(result.status).toBe('DONE');
      expect(result.completedById).toBe('actor-a');
    });

    it('rejects completing already done item', async () => {
      prisma.onboardingChecklistItem.findUnique.mockResolvedValue({ id: 'ci1', checklistId: 'c1', status: 'DONE', completedById: 'actor-a' });
      await expect(service.completeOnboardingItem('ci1', { note: 'Again' } as any, actor)).rejects.toThrow(BadRequestException);
    });
  });

  describe('createOffboardingChecklist', () => {
    it('creates offboarding checklist for terminating employee', async () => {
      prisma.employee.findUnique.mockResolvedValue({ id: 'emp-a', companyId: 'company-a', deletedAt: null, status: 'TERMINATED' });
      prisma.offboardingChecklist.create.mockResolvedValue({ id: 'oc1', employeeId: 'emp-a', terminationDate: '2026-01-15', status: 'NOT_STARTED' });
      const result = await service.createOffboardingChecklist({ employeeId: 'emp-a', reason: 'Resignation', terminationDate: '2026-01-15' } as any, actor);
      expect(result.employeeId).toBe('emp-a');
      expect(result.reason).toBe('Resignation');
      expect(audit.record).toHaveBeenCalled();
    });

    it('rejects offboarding for active employee', async () => {
      prisma.employee.findUnique.mockResolvedValue({ id: 'emp-a', companyId: 'company-a', deletedAt: null, status: 'ACTIVE' });
      await expect(service.createOffboardingChecklist({ employeeId: 'emp-a', reason: 'Resignation', terminationDate: '2026-01-15' } as any, actor)).rejects.toThrow(BadRequestException);
    });
  });

  describe('createTerminationRequest', () => {
    it('creates termination request', async () => {
      prisma.employee.findUnique.mockResolvedValue({ id: 'emp-a', companyId: 'company-a', deletedAt: null, status: 'ACTIVE' });
      prisma.terminationRequest.create.mockResolvedValue({ id: 'tr1', employeeId: 'emp-a', reason: 'Resignation', terminationDate: '2026-01-15', status: 'REQUESTED' });
      const result = await service.createTerminationRequest({ employeeId: 'emp-a', reason: 'Resignation', terminationDate: '2026-01-15' } as any, actor);
      expect(result.reason).toBe('Resignation');
      expect(result.status).toBe('REQUESTED');
    });

    it('rejects termination for already terminated employee', async () => {
      prisma.employee.findUnique.mockResolvedValue({ id: 'emp-a', companyId: 'company-a', deletedAt: null, status: 'TERMINATED' });
      await expect(service.createTerminationRequest({ employeeId: 'emp-a', reason: 'Resignation', terminationDate: '2026-01-15' } as any, actor)).rejects.toThrow(BadRequestException);
    });
  });

  describe('approveTerminationRequest', () => {
    it('approves termination request', async () => {
      prisma.terminationRequest.findUnique.mockResolvedValue({ id: 'tr1', employeeId: 'emp-a', status: 'REQUESTED', approvedById: null });
      prisma.terminationRequest.update.mockResolvedValue({ id: 'tr1', status: 'APPROVED', approvedById: 'actor-a' });
      prisma.user.revokeSessionsAt = jest.fn().mockResolvedValue(undefined);
      const result = await service.approveTerminationRequest('tr1', actor);
      expect(result.status).toBe('APPROVED');
      expect(result.approvedById).toBe('actor-a');
    });

    it('rejects non-requested termination', async () => {
      prisma.terminationRequest.findUnique.mockResolvedValue({ id: 'tr1', employeeId: 'emp-a', status: 'APPROVED', approvedById: 'actor-a' });
      await expect(service.approveTerminationRequest('tr1', actor)).rejects.toThrow(BadRequestException);
    });
  });

  describe('deleteOnboardingTemplate', () => {
    it('soft deletes template', async () => {
      prisma.onboardingChecklistTemplate.findUnique.mockResolvedValue({ id: 't1', name: 'Template', isActive: true, deletedAt: null });
      prisma.onboardingChecklist.count.mockResolvedValue(0);
      prisma.onboardingChecklistTemplate.update.mockResolvedValue({ id: 't1', deletedAt: new Date() });
      const result = await service.deleteOnboardingTemplate('t1', actor);
      expect(result.success).toBe(true);
    });

    it('rejects template with active checklists', async () => {
      prisma.onboardingChecklistTemplate.findUnique.mockResolvedValue({ id: 't1', name: 'Template', isActive: true, deletedAt: null });
      prisma.onboardingChecklist.count.mockResolvedValue(3);
      await expect(service.deleteOnboardingTemplate('t1', actor)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getOnboardingStats', () => {
    it('returns onboarding statistics', async () => {
      prisma.onboardingChecklist.groupBy.mockResolvedValue([{ status: 'NOT_STARTED', _count: { _all: 5 } }, { status: 'IN_PROGRESS', _count: { _all: 3 } }, { status: 'COMPLETED', _count: { _all: 2 } }]);
      const result = await service.getOnboardingStats(actor);
      expect(result.byStatus).toHaveLength(3);
      expect(result.total).toBe(10);
    });
  });
});
