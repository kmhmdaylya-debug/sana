import { AdminService } from './admin.service';
import { AccessService } from '../common/access/access.service';
import { AuditService } from '../common/audit/audit.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';

const actor = {
  id: 'actor-a', username: 'actor.a', fullName: 'Test Actor', email: 'actor@test.com',
  mobile: null, isSuperAdmin: false, employeeId: null, roleIds: [], roleCodes: [],
  permissions: ['admin.view', 'admin.manage'],
  scope: { unrestricted: false, companyIds: ['company-a'], branchIds: [], orgUnitIds: [], employeeIds: [], ownEmployeeId: null },
} as unknown as AuthenticatedUser;

describe('AdminService', () => {
  let prisma: any;
  let access: any;
  let audit: any;
  let service: AdminService;

  beforeEach(() => {
    prisma = {
      correspondence: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), create: jest.fn(), update: jest.fn() },
      correspondenceAttachment: { create: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
      correspondenceReferral: { create: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
      meeting: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), create: jest.fn(), update: jest.fn() },
      meetingParticipant: { create: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
      meetingAction: { create: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
      survey: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), create: jest.fn(), update: jest.fn() },
      surveyQuestion: { create: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
      surveyResponse: { create: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
      company: { findUnique: jest.fn() },
      employee: { findUnique: jest.fn().mockResolvedValue({ id: 'emp-a', companyId: 'company-a', deletedAt: null }) },
      $transaction: jest.fn(work => work(prisma)),
    };
    access = { allowedCompanyIds: jest.fn().mockResolvedValue(['company-a']), assertCompanyAccess: jest.fn().mockResolvedValue(undefined) };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    service = new AdminService(prisma, access, audit);
  });

  describe('listCorrespondences', () => {
    it('returns paginated correspondences', async () => {
      prisma.correspondence.count.mockResolvedValue(2);
      prisma.correspondence.findMany.mockResolvedValue([{ id: 'c1', referenceNo: 'REF-001', direction: 'INCOMING' }, { id: 'c2', referenceNo: 'REF-002', direction: 'OUTGOING' }]);
      const result = await service.listCorrespondences({ page: 1, limit: 10, skip: 0 } as any, actor);
      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
    });

    it('filters by direction', async () => {
      await service.listCorrespondences({ page: 1, limit: 10, skip: 0, direction: 'INCOMING' } as any, actor);
      const where = prisma.correspondence.findMany.mock.calls[0][0].where;
      expect(where.direction).toBe('INCOMING');
    });

    it('filters by company', async () => {
      await service.listCorrespondences({ page: 1, limit: 10, skip: 0, companyId: 'company-a' } as any, actor);
      const where = prisma.correspondence.findMany.mock.calls[0][0].where;
      expect(where.companyId).toBe('company-a');
    });
  });

  describe('createCorrespondence', () => {
    it('creates correspondence', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'company-a', deletedAt: null });
      prisma.correspondence.create.mockResolvedValue({ id: 'c1', referenceNo: 'REF-001', subject: 'Test', companyId: 'company-a' });
      const result = await service.createCorrespondence({ referenceNo: 'REF-001', direction: 'INCOMING', subject: 'Test', senderName: 'Sender', companyId: 'company-a' } as any, actor);
      expect(result.referenceNo).toBe('REF-001');
      expect(audit.record).toHaveBeenCalled();
    });

    it('rejects duplicate reference number', async () => {
      prisma.correspondence.findFirst.mockResolvedValue({ id: 'c1', referenceNo: 'REF-001', deletedAt: null });
      await expect(service.createCorrespondence({ referenceNo: 'REF-001', direction: 'INCOMING', subject: 'Test' } as any, actor)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getCorrespondence', () => {
    it('returns correspondence by id', async () => {
      prisma.correspondence.findUnique.mockResolvedValue({ id: 'c1', referenceNo: 'REF-001', deletedAt: null });
      const result = await service.getCorrespondence('c1', actor);
      expect(result.id).toBe('c1');
    });

    it('throws NotFoundException for non-existent correspondence', async () => {
      prisma.correspondence.findUnique.mockResolvedValue(null);
      await expect(service.getCorrespondence('c1', actor)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateCorrespondence', () => {
    it('updates correspondence', async () => {
      prisma.correspondence.findUnique.mockResolvedValue({ id: 'c1', referenceNo: 'REF-001', subject: 'Old', deletedAt: null });
      prisma.correspondence.update.mockResolvedValue({ id: 'c1', referenceNo: 'REF-001', subject: 'New' });
      const result = await service.updateCorrespondence('c1', { subject: 'New' } as any, actor);
      expect(result.subject).toBe('New');
    });
  });

  describe('deleteCorrespondence', () => {
    it('soft deletes correspondence', async () => {
      prisma.correspondence.findUnique.mockResolvedValue({ id: 'c1', referenceNo: 'REF-001', deletedAt: null });
      prisma.correspondence.update.mockResolvedValue({ id: 'c1', deletedAt: new Date() });
      const result = await service.deleteCorrespondence('c1', actor);
      expect(result.success).toBe(true);
    });
  });

  describe('createMeeting', () => {
    it('creates meeting with participants', async () => {
      prisma.meeting.create.mockResolvedValue({ id: 'm1', title: 'Team Meeting', companyId: 'company-a', organizerId: 'actor-a' });
      prisma.meetingParticipant.create.mockResolvedValue({ id: 'mp1', meetingId: 'm1', employeeId: 'emp-a' });
      const result = await service.createMeeting({ title: 'Team Meeting', scheduledAt: '2026-01-15T10:00:00Z', companyId: 'company-a', participantIds: ['emp-a'] } as any, actor);
      expect(result.title).toBe('Team Meeting');
      expect(audit.record).toHaveBeenCalled();
    });

    it('rejects past meeting time', async () => {
      await expect(service.createMeeting({ title: 'Meeting', scheduledAt: '2020-01-01T10:00:00Z' } as any, actor)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getMeeting', () => {
    it('returns meeting by id', async () => {
      prisma.meeting.findUnique.mockResolvedValue({ id: 'm1', title: 'Team Meeting', deletedAt: null });
      const result = await service.getMeeting('m1', actor);
      expect(result.id).toBe('m1');
    });

    it('throws NotFoundException for non-existent meeting', async () => {
      prisma.meeting.findUnique.mockResolvedValue(null);
      await expect(service.getMeeting('m1', actor)).rejects.toThrow(NotFoundException);
    });
  });

  describe('createSurvey', () => {
    it('creates survey with questions', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'company-a', deletedAt: null });
      prisma.survey.create.mockResolvedValue({ id: 's1', title: 'Employee Survey', isAnonymous: true, companyId: 'company-a' });
      prisma.surveyQuestion.create.mockResolvedValue({ id: 'q1', surveyId: 's1', text: 'How satisfied are you?' });
      const result = await service.createSurvey({ title: 'Employee Survey', isAnonymous: true, questions: [{ text: 'How satisfied are you?', questionType: 'SCALE' }] } as any, actor);
      expect(result.title).toBe('Employee Survey');
      expect(result.isAnonymous).toBe(true);
    });
  });

  describe('submitSurveyResponse', () => {
    it('submits survey response', async () => {
      prisma.survey.findUnique.mockResolvedValue({ id: 's1', status: 'OPEN', isAnonymous: true, deletedAt: null });
      prisma.surveyResponse.create.mockResolvedValue({ id: 'sr1', surveyId: 's1', respondentId: 'actor-a' });
      const result = await service.submitSurveyResponse('s1', { answersJson: JSON.stringify({ q1: 5 }) } as any, actor);
      expect(result.surveyId).toBe('s1');
      expect(result.respondentId).toBe('actor-a');
    });

    it('rejects closed survey', async () => {
      prisma.survey.findUnique.mockResolvedValue({ id: 's1', status: 'CLOSED', isAnonymous: true, deletedAt: null });
      await expect(service.submitSurveyResponse('s1', { answersJson: '{}' } as any, actor)).rejects.toThrow(BadRequestException);
    });
  });

  describe('deleteSurvey', () => {
    it('soft deletes survey', async () => {
      prisma.survey.findUnique.mockResolvedValue({ id: 's1', title: 'Survey', status: 'DRAFT', deletedAt: null });
      prisma.survey.update.mockResolvedValue({ id: 's1', deletedAt: new Date() });
      const result = await service.deleteSurvey('s1', actor);
      expect(result.success).toBe(true);
    });

    it('rejects deleting open survey', async () => {
      prisma.survey.findUnique.mockResolvedValue({ id: 's1', title: 'Survey', status: 'OPEN', deletedAt: null });
      await expect(service.deleteSurvey('s1', actor)).rejects.toThrow(BadRequestException);
    });
  });
});