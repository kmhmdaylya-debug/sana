import { RecruitmentService } from './recruitment.service';
import { AccessService } from '../common/access/access.service';
import { AuditService } from '../common/audit/audit.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { NotFoundException, ConflictException, BadRequestException, ForbiddenException } from '@nestjs/common';

const actor = {
  id: 'actor-a', username: 'actor.a', fullName: 'Test Actor', email: 'actor@test.com',
  mobile: null, isSuperAdmin: false, employeeId: 'emp-a', roleIds: [], roleCodes: [],
  permissions: ['recruitment.view', 'recruitment.create', 'recruitment.update', 'recruitment.delete'],
  scope: { unrestricted: false, companyIds: ['company-a'], branchIds: [], orgUnitIds: [], employeeIds: [], ownEmployeeId: 'emp-a' },
} as unknown as AuthenticatedUser;

describe('RecruitmentService', () => {
  let prisma: any;
  let access: any;
  let audit: any;
  let service: RecruitmentService;

  beforeEach(() => {
    prisma = {
      jobRequisition: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), create: jest.fn(), update: jest.fn() },
      jobOpening: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), create: jest.fn(), update: jest.fn() },
      applicant: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), create: jest.fn(), update: jest.fn() },
      applicantDocument: { create: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
      interview: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]), create: jest.fn(), update: jest.fn() },
      interviewFeedback: { create: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
      offer: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]), create: jest.fn(), update: jest.fn() },
      employee: { findUnique: jest.fn().mockResolvedValue({ id: 'emp-a', companyId: 'company-a', deletedAt: null }) },
      $transaction: jest.fn(work => work(prisma)),
    };
    access = { allowedCompanyIds: jest.fn().mockResolvedValue(['company-a']), assertCompanyAccess: jest.fn().mockResolvedValue(undefined) };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    service = new RecruitmentService(prisma, access, audit);
  });

  describe('listJobRequisitions', () => {
    it('returns paginated job requisitions', async () => {
      prisma.jobRequisition.count.mockResolvedValue(2);
      prisma.jobRequisition.findMany.mockResolvedValue([{ id: 'jr1', title: 'Software Engineer', status: 'DRAFT', headcount: 2 }, { id: 'jr2', title: 'Product Manager', status: 'OPEN', headcount: 1 }]);
      const result = await service.listJobRequisitions({ page: 1, limit: 10, skip: 0 } as any, actor);
      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
    });

    it('filters by status', async () => {
      await service.listJobRequisitions({ page: 1, limit: 10, skip: 0, status: 'OPEN' } as any, actor);
      const where = prisma.jobRequisition.findMany.mock.calls[0][0].where;
      expect(where.status).toBe('OPEN');
    });
  });

  describe('createJobRequisition', () => {
    it('creates job requisition', async () => {
      prisma.jobRequisition.create.mockResolvedValue({ id: 'jr1', title: 'Software Engineer', headcount: 2, companyId: 'company-a', requestedById: 'actor-a' });
      const result = await service.createJobRequisition({ title: 'Software Engineer', headcount: 2, reason: 'Growth', budget: 200000000 } as any, actor);
      expect(result.title).toBe('Software Engineer');
      expect(result.headcount).toBe(2);
      expect(audit.record).toHaveBeenCalled();
    });

    it('rejects negative headcount', async () => {
      await expect(service.createJobRequisition({ title: 'Engineer', headcount: -1 } as any, actor)).rejects.toThrow(BadRequestException);
    });

    it('rejects negative budget', async () => {
      await expect(service.createJobRequisition({ title: 'Engineer', headcount: 1, budget: -1000 } as any, actor)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getJobRequisition', () => {
    it('returns job requisition by id', async () => {
      prisma.jobRequisition.findUnique.mockResolvedValue({ id: 'jr1', title: 'Software Engineer', deletedAt: null });
      const result = await service.getJobRequisition('jr1', actor);
      expect(result.id).toBe('jr1');
    });

    it('throws NotFoundException for non-existent requisition', async () => {
      prisma.jobRequisition.findUnique.mockResolvedValue(null);
      await expect(service.getJobRequisition('jr1', actor)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateJobRequisition', () => {
    it('updates job requisition', async () => {
      prisma.jobRequisition.findUnique.mockResolvedValue({ id: 'jr1', title: 'Old Title', status: 'DRAFT', deletedAt: null });
      prisma.jobRequisition.update.mockResolvedValue({ id: 'jr1', title: 'New Title', status: 'OPEN' });
      const result = await service.updateJobRequisition('jr1', { title: 'New Title', status: 'OPEN' } as any, actor);
      expect(result.title).toBe('New Title');
      expect(result.status).toBe('OPEN');
    });

    it('rejects updating non-draft requisition', async () => {
      prisma.jobRequisition.findUnique.mockResolvedValue({ id: 'jr1', title: 'Title', status: 'OPEN', deletedAt: null });
      await expect(service.updateJobRequisition('jr1', { title: 'New Title' } as any, actor)).rejects.toThrow(BadRequestException);
    });
  });

  describe('createJobOpening', () => {
    it('creates job opening', async () => {
      prisma.jobRequisition.findUnique.mockResolvedValue({ id: 'jr1', companyId: 'company-a', deletedAt: null });
      prisma.jobOpening.create.mockResolvedValue({ id: 'jo1', title: 'Software Engineer', requisitionId: 'jr1', status: 'OPEN' });
      const result = await service.createJobOpening({ requisitionId: 'jr1', title: 'Software Engineer', description: 'We are hiring', employmentType: 'PERMANENT', salaryMin: 50000000, salaryMax: 100000000 } as any, actor);
      expect(result.title).toBe('Software Engineer');
      expect(result.status).toBe('OPEN');
    });

    it('rejects opening for non-existent requisition', async () => {
      prisma.jobRequisition.findUnique.mockResolvedValue(null);
      await expect(service.createJobOpening({ requisitionId: 'jr1', title: 'Engineer' } as any, actor)).rejects.toThrow(NotFoundException);
    });

    it('rejects min salary greater than max', async () => {
      prisma.jobRequisition.findUnique.mockResolvedValue({ id: 'jr1', companyId: 'company-a', deletedAt: null });
      await expect(service.createJobOpening({ requisitionId: 'jr1', title: 'Engineer', salaryMin: 100000000, salaryMax: 50000000 } as any, actor)).rejects.toThrow(BadRequestException);
    });
  });

  describe('createApplicant', () => {
    it('creates applicant for job opening', async () => {
      prisma.jobOpening.findUnique.mockResolvedValue({ id: 'jo1', status: 'OPEN', requisitionId: 'jr1' });
      prisma.applicant.create.mockResolvedValue({ id: 'ap1', firstName: 'Ali', lastName: 'Rezaei', email: 'ali@example.com', openingId: 'jo1', status: 'APPLIED' });
      const result = await service.createApplicant({ openingId: 'jo1', firstName: 'Ali', lastName: 'Rezaei', email: 'ali@example.com', mobile: '09121112233', nationalId: '0012345678' } as any, actor);
      expect(result.firstName).toBe('Ali');
      expect(result.lastName).toBe('Rezaei');
      expect(result.status).toBe('APPLIED');
    });

    it('rejects applicant for closed opening', async () => {
      prisma.jobOpening.findUnique.mockResolvedValue({ id: 'jo1', status: 'CLOSED', requisitionId: 'jr1' });
      await expect(service.createApplicant({ openingId: 'jo1', firstName: 'Ali', lastName: 'Rezaei' } as any, actor)).rejects.toThrow(BadRequestException);
    });

    it('rejects duplicate national ID for same opening', async () => {
      prisma.jobOpening.findUnique.mockResolvedValue({ id: 'jo1', status: 'OPEN', requisitionId: 'jr1' });
      prisma.applicant.findFirst.mockResolvedValue({ id: 'ap1', nationalId: '0012345678', openingId: 'jo1' });
      await expect(service.createApplicant({ openingId: 'jo1', firstName: 'Ali', lastName: 'Rezaei', nationalId: '0012345678' } as any, actor)).rejects.toThrow(ConflictException);
    });
  });

  describe('getApplicant', () => {
    it('returns applicant by id', async () => {
      prisma.applicant.findUnique.mockResolvedValue({ id: 'ap1', firstName: 'Ali', lastName: 'Rezaei', deletedAt: null });
      const result = await service.getApplicant('ap1', actor);
      expect(result.id).toBe('ap1');
    });

    it('throws NotFoundException for non-existent applicant', async () => {
      prisma.applicant.findUnique.mockResolvedValue(null);
      await expect(service.getApplicant('ap1', actor)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateApplicantStatus', () => {
    it('updates applicant status', async () => {
      prisma.applicant.findUnique.mockResolvedValue({ id: 'ap1', firstName: 'Ali', lastName: 'Rezaei', status: 'APPLIED', deletedAt: null });
      prisma.applicant.update.mockResolvedValue({ id: 'ap1', status: 'SCREENING', stageNote: 'Passed initial screening' });
      const result = await service.updateApplicantStatus('ap1', { status: 'SCREENING', stageNote: 'Passed initial screening' } as any, actor);
      expect(result.status).toBe('SCREENING');
    });

    it('rejects invalid status transition', async () {
      prisma.applicant.findUnique.mockResolvedValue({ id: 'ap1', firstName: 'Ali', lastName: 'Rezaei', status: 'HIRED', deletedAt: null });
      await expect(service.updateApplicantStatus('ap1', { status: 'APPLIED' } as any, actor)).rejects.toThrow(BadRequestException);
    });
  });

  describe('scheduleInterview', () => {
    it('schedules interview for applicant', async () => {
      prisma.applicant.findUnique.mockResolvedValue({ id: 'ap1', openingId: 'jo1', status: 'SCREENING' });
      prisma.jobOpening.findUnique.mockResolvedValue({ id: 'jo1', status: 'OPEN' });
      prisma.interview.create.mockResolvedValue({ id: 'int1', applicantId: 'ap1', interviewerId: 'actor-a', scheduledAt: '2026-01-15T10:00:00Z', status: 'SCHEDULED' });
      const result = await service.scheduleInterview({ applicantId: 'ap1', interviewerId: 'actor-a', scheduledAt: '2026-01-15T10:00:00Z', mode: 'ONSITE' } as any, actor);
      expect(result.applicantId).toBe('ap1');
      expect(result.status).toBe('SCHEDULED');
      expect(audit.record).toHaveBeenCalled();
    });

    it('rejects interview for non-screening applicant', async () => {
      prisma.applicant.findUnique.mockResolvedValue({ id: 'ap1', openingId: 'jo1', status: 'APPLIED' });
      await expect(service.scheduleInterview({ applicantId: 'ap1', interviewerId: 'actor-a', scheduledAt: '2026-01-15T10:00:00Z' } as any, actor)).rejects.toThrow(BadRequestException);
    });
  });

  describe('createOffer', () => {
    it('creates job offer for applicant', async () => {
      prisma.applicant.findUnique.mockResolvedValue({ id: 'ap1', openingId: 'jo1', status: 'FINAL_REVIEW' });
      prisma.offer.create.mockResolvedValue({ id: 'of1', applicantId: 'ap1', salary: 80000000, status: 'DRAFT', version: 1 });
      const result = await service.createOffer({ applicantId: 'ap1', salary: 80000000, startDate: '2026-02-01' } as any, actor);
      expect(result.salary).toBe(80000000);
      expect(result.status).toBe('DRAFT');
    });

    it('rejects offer for non-final review applicant', async () => {
      prisma.applicant.findUnique.mockResolvedValue({ id: 'ap1', openingId: 'jo1', status: 'APPLIED' });
      await expect(service.createOffer({ applicantId: 'ap1', salary: 80000000 } as any, actor)).rejects.toThrow(BadRequestException);
    });
  });

  describe('deleteJobRequisition', () => {
    it('soft deletes draft job requisition', async () => {
      prisma.jobRequisition.findUnique.mockResolvedValue({ id: 'jr1', title: 'Engineer', status: 'DRAFT', deletedAt: null });
      prisma.jobOpening.count.mockResolvedValue(0);
      prisma.jobRequisition.update.mockResolvedValue({ id: 'jr1', deletedAt: new Date() });
      const result = await service.deleteJobRequisition('jr1', actor);
      expect(result.success).toBe(true);
    });

    it('rejects deleting requisition with openings', async () => {
      prisma.jobRequisition.findUnique.mockResolvedValue({ id: 'jr1', title: 'Engineer', status: 'DRAFT', deletedAt: null });
      prisma.jobOpening.count.mockResolvedValue(2);
      await expect(service.deleteJobRequisition('jr1', actor)).rejects.toThrow(BadRequestException);
    });
  });
});
