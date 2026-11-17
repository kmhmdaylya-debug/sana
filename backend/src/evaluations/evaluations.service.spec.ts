import { EvaluationsService } from './evaluations.service';
import { AccessService } from '../common/access/access.service';
import { AuditService } from '../common/audit/audit.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { NotFoundException, ConflictException, BadRequestException, ForbiddenException } from '@nestjs/common';

const actor = {
  id: 'actor-a', username: 'actor.a', fullName: 'Test Actor', email: 'actor@test.com',
  mobile: null, isSuperAdmin: false, employeeId: 'emp-a', roleIds: [], roleCodes: [],
  permissions: ['evaluations.view', 'evaluations.create', 'evaluations.update', 'evaluations.rate'],
  scope: { unrestricted: false, companyIds: ['company-a'], branchIds: [], orgUnitIds: [], employeeIds: [], ownEmployeeId: 'emp-a' },
} as unknown as AuthenticatedUser;

describe('EvaluationsService', () => {
  let prisma: any;
  let access: any;
  let audit: any;
  let service: EvaluationsService;

  beforeEach(() => {
    prisma = {
      evaluationForm: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), create: jest.fn(), update: jest.fn() },
      evaluationItem: { findMany: jest.fn().mockResolvedValue([]), create: jest.fn(), findUnique: jest.fn() },
      evaluationCycle: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]), create: jest.fn(), update: jest.fn() },
      evaluation: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), create: jest.fn(), update: jest.fn() },
      evaluationScore: { create: jest.fn(), findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn() },
      employee: { findUnique: jest.fn().mockResolvedValue({ id: 'emp-a', companyId: 'company-a', deletedAt: null }) },
      $transaction: jest.fn(work => work(prisma)),
    };
    access = { allowedCompanyIds: jest.fn().mockResolvedValue(['company-a']), canAccessEmployee: jest.fn().mockResolvedValue(true), assertCompanyAccess: jest.fn().mockResolvedValue(undefined), assertEmployeeAccess: jest.fn().mockResolvedValue(undefined) };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    service = new EvaluationsService(prisma, access, audit);
  });

  describe('listEvaluationForms', () => {
    it('returns paginated evaluation forms', async () => {
      prisma.evaluationForm.count.mockResolvedValue(2);
      prisma.evaluationForm.findMany.mockResolvedValue([{ id: 'f1', name: 'Annual Review', version: 1 }, { id: 'f2', name: 'Quarterly Review', version: 1 }]);
      const result = await service.listEvaluationForms({ page: 1, limit: 10, skip: 0 } as any, actor);
      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
    });
  });

  describe('createEvaluationForm', () => {
    it('creates evaluation form with items', async () => {
      prisma.evaluationForm.findFirst.mockResolvedValue(null);
      prisma.evaluationForm.create.mockResolvedValue({ id: 'f1', name: 'Annual Review', version: 1, companyId: 'company-a' });
      prisma.evaluationItem.create.mockResolvedValue({ id: 'i1', title: 'Quality', weight: 10 });
      const result = await service.createEvaluationForm({ name: 'Annual Review', items: [{ title: 'Quality', weight: 10, scaleType: 'NUMERIC', minScore: 1, maxScore: 5 }] } as any, actor);
      expect(result.name).toBe('Annual Review');
      expect(audit.record).toHaveBeenCalled();
    });

    it('rejects duplicate form name', async () => {
      prisma.evaluationForm.findFirst.mockResolvedValue({ id: 'f1', name: 'Annual Review', deletedAt: null });
      await expect(service.createEvaluationForm({ name: 'Annual Review', items: [] } as any, actor)).rejects.toThrow(ConflictException);
    });
  });

  describe('getEvaluationForm', () => {
    it('returns form by id with items', async () => {
      prisma.evaluationForm.findUnique.mockResolvedValue({ id: 'f1', name: 'Annual Review', deletedAt: null });
      prisma.evaluationItem.findMany.mockResolvedValue([{ id: 'i1', title: 'Quality', formId: 'f1' }]);
      const result = await service.getEvaluationForm('f1', actor);
      expect(result.id).toBe('f1');
      expect(result.items).toHaveLength(1);
    });

    it('throws NotFoundException for non-existent form', async () => {
      prisma.evaluationForm.findUnique.mockResolvedValue(null);
      await expect(service.getEvaluationForm('f1', actor)).rejects.toThrow(NotFoundException);
    });
  });

  describe('createEvaluationCycle', () => {
    it('creates evaluation cycle', async () => {
      prisma.evaluationCycle.findFirst.mockResolvedValue(null);
      prisma.evaluationCycle.create.mockResolvedValue({ id: 'c1', name: 'Q1 2026', companyId: 'company-a', formId: 'f1' });
      const result = await service.createEvaluationCycle({ name: 'Q1 2026', formId: 'f1', periodType: 'QUARTERLY', startDate: '2026-01-01', endDate: '2026-03-31' } as any, actor);
      expect(result.name).toBe('Q1 2026');
    });
  });

  describe('createEvaluation', () => {
    it('creates evaluation for employee', async () => {
      prisma.evaluationCycle.findUnique.mockResolvedValue({ id: 'c1', companyId: 'company-a', formId: 'f1', deletedAt: null });
      prisma.employee.findUnique.mockResolvedValue({ id: 'emp-a', companyId: 'company-a', deletedAt: null });
      prisma.evaluation.findFirst.mockResolvedValue(null);
      prisma.evaluation.create.mockResolvedValue({ id: 'e1', employeeId: 'emp-a', status: 'PENDING' });
      prisma.evaluationItem.findMany.mockResolvedValue([{ id: 'i1', title: 'Quality' }]);
      const result = await service.createEvaluation({ cycleId: 'c1', employeeId: 'emp-a', evaluationType: 'SUPERVISOR' } as any, actor);
      expect(result.employeeId).toBe('emp-a');
      expect(audit.record).toHaveBeenCalled();
    });

    it('rejects duplicate evaluation for same cycle/employee/type', async () => {
      prisma.evaluationCycle.findUnique.mockResolvedValue({ id: 'c1', companyId: 'company-a', formId: 'f1', deletedAt: null });
      prisma.employee.findUnique.mockResolvedValue({ id: 'emp-a', companyId: 'company-a', deletedAt: null });
      prisma.evaluation.findFirst.mockResolvedValue({ id: 'e1', cycleId: 'c1', employeeId: 'emp-a', evaluationType: 'SUPERVISOR' });
      await expect(service.createEvaluation({ cycleId: 'c1', employeeId: 'emp-a', evaluationType: 'SUPERVISOR' } as any, actor)).rejects.toThrow(ConflictException);
    });
  });

  describe('submitEvaluationScore', () => {
    it('submits evaluation score', async () => {
      prisma.evaluation.findUnique.mockResolvedValue({ id: 'e1', cycleId: 'c1', employeeId: 'emp-a', evaluatorId: 'actor-a', status: 'PENDING', deletedAt: null });
      prisma.evaluationItem.findUnique.mockResolvedValue({ id: 'i1', evaluationId: 'e1', itemId: 'item1' });
      prisma.evaluationScore.findUnique.mockResolvedValue(null);
      prisma.evaluationScore.create.mockResolvedValue({ id: 's1', score: 4, evaluationId: 'e1', itemId: 'item1' });
      const result = await service.submitEvaluationScore('e1', 'item1', { score: 4, comment: 'Good work' } as any, actor);
      expect(result.score).toBe(4);
    });

    it('rejects score outside valid range', async () => {
      prisma.evaluation.findUnique.mockResolvedValue({ id: 'e1', cycleId: 'c1', employeeId: 'emp-a', evaluatorId: 'actor-a', status: 'PENDING', deletedAt: null });
      prisma.evaluationItem.findUnique.mockResolvedValue({ id: 'i1', minScore: 1, maxScore: 5 });
      await expect(service.submitEvaluationScore('e1', 'item1', { score: 10 } as any, actor)).rejects.toThrow(BadRequestException);
    });
  });

  describe('deleteEvaluation', () => {
    it('soft deletes evaluation', async () => {
      prisma.evaluation.findUnique.mockResolvedValue({ id: 'e1', cycleId: 'c1', employeeId: 'emp-a', status: 'PENDING', deletedAt: null });
      prisma.evaluation.update.mockResolvedValue({ id: 'e1', deletedAt: new Date() });
      const result = await service.deleteEvaluation('e1', actor);
      expect(result.success).toBe(true);
    });

    it('rejects deleting locked evaluation', async () => {
      prisma.evaluation.findUnique.mockResolvedValue({ id: 'e1', cycleId: 'c1', employeeId: 'emp-a', status: 'LOCKED', deletedAt: null });
      await expect(service.deleteEvaluation('e1', actor)).rejects.toThrow(BadRequestException);
    });
  });
});
