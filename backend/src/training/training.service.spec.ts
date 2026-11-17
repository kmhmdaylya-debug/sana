import { TrainingService } from './training.service';
import { AccessService } from '../common/access/access.service';
import { AuditService } from '../common/audit/audit.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { NotFoundException, ConflictException, BadRequestException, ForbiddenException } from '@nestjs/common';

const actor = {
  id: 'actor-a', username: 'actor.a', fullName: 'Test Actor', email: 'actor@test.com',
  mobile: null, isSuperAdmin: false, employeeId: 'emp-a', roleIds: [], roleCodes: [],
  permissions: ['training.view', 'training.create', 'training.update', 'training.delete'],
  scope: { unrestricted: false, companyIds: ['company-a'], branchIds: [], orgUnitIds: [], employeeIds: [], ownEmployeeId: 'emp-a' },
} as unknown as AuthenticatedUser;

describe('TrainingService', () => {
  let prisma: any;
  let access: any;
  let audit: any;
  let service: TrainingService;

  beforeEach(() => {
    prisma = {
      trainingCourse: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), create: jest.fn(), update: jest.fn() },
      trainingRecord: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), create: jest.fn(), update: jest.fn() },
      certificate: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
      employee: { findUnique: jest.fn().mockResolvedValue({ id: 'emp-a', companyId: 'company-a', deletedAt: null }) },
      $transaction: jest.fn(work => work(prisma)),
    };
    access = { allowedCompanyIds: jest.fn().mockResolvedValue(['company-a']), canAccessEmployee: jest.fn().mockResolvedValue(true), assertCompanyAccess: jest.fn().mockResolvedValue(undefined), assertEmployeeAccess: jest.fn().mockResolvedValue(undefined) };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    service = new TrainingService(prisma, access, audit);
  });

  describe('listTrainingCourses', () => {
    it('returns paginated training courses', async () => {
      prisma.trainingCourse.count.mockResolvedValue(2);
      prisma.trainingCourse.findMany.mockResolvedValue([{ id: 'tc1', code: 'TC-001', title: 'Safety Training', isActive: true }, { id: 'tc2', code: 'TC-002', title: 'Leadership', isActive: true }]);
      const result = await service.listTrainingCourses({ page: 1, limit: 10, skip: 0 } as any, actor);
      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
    });

    it('filters by active status', async () => {
      await service.listTrainingCourses({ page: 1, limit: 10, skip: 0, isActive: true } as any, actor);
      const where = prisma.trainingCourse.findMany.mock.calls[0][0].where;
      expect(where.isActive).toBe(true);
    });
  });

  describe('createTrainingCourse', () => {
    it('creates training course', async () => {
      prisma.trainingCourse.findFirst.mockResolvedValue(null);
      prisma.trainingCourse.create.mockResolvedValue({ id: 'tc1', code: 'TC-001', title: 'Safety Training', companyId: 'company-a' });
      const result = await service.createTrainingCourse({ code: 'TC-001', title: 'Safety Training', durationHours: 8, cost: 500000 } as any, actor);
      expect(result.code).toBe('TC-001');
      expect(audit.record).toHaveBeenCalled();
    });

    it('rejects duplicate course code', async () => {
      prisma.trainingCourse.findFirst.mockResolvedValue({ id: 'tc1', code: 'TC-001', deletedAt: null });
      await expect(service.createTrainingCourse({ code: 'TC-001', title: 'Safety Training' } as any, actor)).rejects.toThrow(ConflictException);
    });
  });

  describe('getTrainingCourse', () => {
    it('returns course by id', async () => {
      prisma.trainingCourse.findUnique.mockResolvedValue({ id: 'tc1', code: 'TC-001', deletedAt: null });
      const result = await service.getTrainingCourse('tc1', actor);
      expect(result.id).toBe('tc1');
    });

    it('throws NotFoundException for non-existent course', async () => {
      prisma.trainingCourse.findUnique.mockResolvedValue(null);
      await expect(service.getTrainingCourse('tc1', actor)).rejects.toThrow(NotFoundException);
    });
  });

  describe('createTrainingRecord', () => {
    it('creates training record for employee', async () => {
      prisma.trainingCourse.findUnique.mockResolvedValue({ id: 'tc1', companyId: 'company-a', deletedAt: null });
      prisma.employee.findUnique.mockResolvedValue({ id: 'emp-a', companyId: 'company-a', deletedAt: null });
      prisma.trainingRecord.findFirst.mockResolvedValue(null);
      prisma.trainingRecord.create.mockResolvedValue({ id: 'tr1', courseId: 'tc1', employeeId: 'emp-a', status: 'COMPLETED' });
      const result = await service.createTrainingRecord({ courseId: 'tc1', employeeId: 'emp-a', attendanceDate: '2026-01-01', score: 85 } as any, actor);
      expect(result.courseId).toBe('tc1');
      expect(audit.record).toHaveBeenCalled();
    });

    it('rejects duplicate training record', async () => {
      prisma.trainingCourse.findUnique.mockResolvedValue({ id: 'tc1', companyId: 'company-a', deletedAt: null });
      prisma.employee.findUnique.mockResolvedValue({ id: 'emp-a', companyId: 'company-a', deletedAt: null });
      prisma.trainingRecord.findFirst.mockResolvedValue({ id: 'tr1', courseId: 'tc1', employeeId: 'emp-a' });
      await expect(service.createTrainingRecord({ courseId: 'tc1', employeeId: 'emp-a', attendanceDate: '2026-01-01' } as any, actor)).rejects.toThrow(ConflictException);
    });
  });

  describe('issueCertificate', () => {
    it('issues certificate for employee', async () => {
      prisma.employee.findUnique.mockResolvedValue({ id: 'emp-a', companyId: 'company-a', deletedAt: null });
      prisma.certificate.create.mockResolvedValue({ id: 'cert1', employeeId: 'emp-a', name: 'Safety Certificate' });
      const result = await service.issueCertificate({ employeeId: 'emp-a', name: 'Safety Certificate', issuingBody: 'Safety Board', issueDate: '2026-01-01' } as any, actor);
      expect(result.name).toBe('Safety Certificate');
      expect(audit.record).toHaveBeenCalled();
    });

    it('rejects certificate for non-existent employee', async () => {
      prisma.employee.findUnique.mockResolvedValue(null);
      await expect(service.issueCertificate({ employeeId: 'emp-other', name: 'Certificate' } as any, actor)).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteTrainingCourse', () => {
    it('soft deletes course', async () => {
      prisma.trainingCourse.findUnique.mockResolvedValue({ id: 'tc1', code: 'TC-001', isActive: true, deletedAt: null });
      prisma.trainingCourse.update.mockResolvedValue({ id: 'tc1', deletedAt: new Date() });
      const result = await service.deleteTrainingCourse('tc1', actor);
      expect(result.success).toBe(true);
    });

    it('rejects course with active records', async () => {
      prisma.trainingCourse.findUnique.mockResolvedValue({ id: 'tc1', code: 'TC-001', isActive: true, deletedAt: null });
      prisma.trainingRecord.count.mockResolvedValue(3);
      await expect(service.deleteTrainingCourse('tc1', actor)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getTrainingRecordsByEmployee', () => {
    it('returns training records for employee', async () => {
      prisma.trainingRecord.findMany.mockResolvedValue([{ id: 'tr1', courseId: 'tc1', employeeId: 'emp-a', status: 'COMPLETED' }]);
      const result = await service.getTrainingRecordsByEmployee('emp-a', actor);
      expect(result).toHaveLength(1);
    });
  });
});
