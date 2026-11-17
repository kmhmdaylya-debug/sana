import { AnnouncementsService } from './announcements.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { NotFoundException, BadRequestException } from '@nestjs/common';

const actor = {
  id: 'actor-a', username: 'actor.a', fullName: 'Test Actor', email: 'actor@test.com',
  mobile: null, isSuperAdmin: false, employeeId: null, roleIds: [], roleCodes: [],
  permissions: ['announcements.view', 'announcements.create', 'announcements.update', 'announcements.delete'],
  scope: { unrestricted: false, companyIds: ['company-a'], branchIds: [], orgUnitIds: [], employeeIds: [], ownEmployeeId: null },
} as unknown as AuthenticatedUser;

describe('AnnouncementsService', () => {
  let prisma: any;
  let service: AnnouncementsService;

  beforeEach(() => {
    prisma = {
      announcement: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), create: jest.fn(), update: jest.fn() },
      announcementAck: { create: jest.fn(), findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
      user: { findUnique: jest.fn() },
      $transaction: jest.fn(work => work(prisma)),
    };
    service = new AnnouncementsService(prisma);
  });

  describe('listAnnouncements', () => {
    it('returns paginated announcements', async () => {
      prisma.announcement.count.mockResolvedValue(2);
      prisma.announcement.findMany.mockResolvedValue([{ id: 'a1', title: 'Announcement 1', targetType: 'ALL' }, { id: 'a2', title: 'Announcement 2', targetType: 'ORG_UNIT' }]);
      const result = await service.listAnnouncements({ page: 1, limit: 10, skip: 0 } as any, actor);
      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
    });

    it('filters by target type', async () => {
      await service.listAnnouncements({ page: 1, limit: 10, skip: 0, targetType: 'ALL' } as any, actor);
      const where = prisma.announcement.findMany.mock.calls[0][0].where;
      expect(where.targetType).toBe('ALL');
    });

    it('filters out expired announcements', async () => {
      await service.listAnnouncements({ page: 1, limit: 10, skip: 0 } as any, actor);
      const where = prisma.announcement.findMany.mock.calls[0][0].where;
      expect(where.deletedAt).toBeNull();
      expect(where.OR).toBeDefined();
    });
  });

  describe('createAnnouncement', () => {
    it('creates announcement', async () => {
      prisma.announcement.create.mockResolvedValue({ id: 'a1', title: 'Test Announcement', companyId: 'company-a', publishedById: 'actor-a' });
      const result = await service.createAnnouncement({ title: 'Test Announcement', body: 'Body content', targetType: 'ALL', requiresAck: false } as any, actor);
      expect(result.title).toBe('Test Announcement');
      expect(result.companyId).toBe('company-a');
    });

    it('rejects empty title', async () => {
      await expect(service.createAnnouncement({ title: '', body: 'Body' } as any, actor)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getAnnouncement', () => {
    it('returns announcement by id', async () => {
      prisma.announcement.findUnique.mockResolvedValue({ id: 'a1', title: 'Test Announcement', deletedAt: null });
      const result = await service.getAnnouncement('a1', actor);
      expect(result.id).toBe('a1');
    });

    it('throws NotFoundException for non-existent announcement', async () => {
      prisma.announcement.findUnique.mockResolvedValue(null);
      await expect(service.getAnnouncement('a1', actor)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateAnnouncement', () => {
    it('updates announcement', async () => {
      prisma.announcement.findUnique.mockResolvedValue({ id: 'a1', title: 'Old Title', deletedAt: null });
      prisma.announcement.update.mockResolvedValue({ id: 'a1', title: 'New Title' });
      const result = await service.updateAnnouncement('a1', { title: 'New Title' } as any, actor);
      expect(result.title).toBe('New Title');
    });
  });

  describe('deleteAnnouncement', () => {
    it('soft deletes announcement', async () => {
      prisma.announcement.findUnique.mockResolvedValue({ id: 'a1', title: 'Test Announcement', deletedAt: null });
      prisma.announcement.update.mockResolvedValue({ id: 'a1', deletedAt: new Date() });
      const result = await service.deleteAnnouncement('a1', actor);
      expect(result.success).toBe(true);
    });
  });

  describe('acknowledgeAnnouncement', () => {
    it('acknowledges announcement for user', async () => {
      prisma.announcement.findUnique.mockResolvedValue({ id: 'a1', requiresAck: true, deletedAt: null });
      prisma.announcementAck.findFirst.mockResolvedValue(null);
      prisma.announcementAck.create.mockResolvedValue({ id: 'ack1', announcementId: 'a1', userId: 'actor-a' });
      const result = await service.acknowledgeAnnouncement('a1', actor);
      expect(result.announcementId).toBe('a1');
      expect(result.userId).toBe('actor-a');
    });

    it('rejects duplicate acknowledgment', async () => {
      prisma.announcement.findUnique.mockResolvedValue({ id: 'a1', requiresAck: true, deletedAt: null });
      prisma.announcementAck.findFirst.mockResolvedValue({ id: 'ack1', announcementId: 'a1', userId: 'actor-a' });
      await expect(service.acknowledgeAnnouncement('a1', actor)).rejects.toThrow(BadRequestException);
    });

    it('rejects acknowledgment for non-ack-required announcement', async () => {
      prisma.announcement.findUnique.mockResolvedValue({ id: 'a1', requiresAck: false, deletedAt: null });
      await expect(service.acknowledgeAnnouncement('a1', actor)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getUnacknowledgedCount', () => {
    it('returns unacknowledged announcement count for user', async () => {
      prisma.announcementAck.count.mockResolvedValue(2);
      const result = await service.getUnacknowledgedCount('actor-a');
      expect(result.count).toBe(2);
    });
  });
});
