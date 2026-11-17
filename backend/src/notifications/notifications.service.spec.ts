import { NotificationsService } from './notifications.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { NotFoundException, BadRequestException } from '@nestjs/common';

const actor = {
  id: 'actor-a', username: 'actor.a', fullName: 'Test Actor', email: 'actor@test.com',
  mobile: null, isSuperAdmin: false, employeeId: null, roleIds: [], roleCodes: [],
  permissions: ['notifications.view'],
  scope: { unrestricted: false, companyIds: ['company-a'], branchIds: [], orgUnitIds: [], employeeIds: [], ownEmployeeId: null },
} as unknown as AuthenticatedUser;

describe('NotificationsService', () => {
  let prisma: any;
  let service: NotificationsService;

  beforeEach(() => {
    prisma = {
      notification: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), create: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
      user: { findUnique: jest.fn() },
      $transaction: jest.fn(work => work(prisma)),
    };
    service = new NotificationsService(prisma);
  });

  describe('listNotifications', () => {
    it('returns paginated notifications for user', async () => {
      prisma.notification.count.mockResolvedValue(2);
      prisma.notification.findMany.mockResolvedValue([{ id: 'n1', type: 'TASK_ASSIGNED', status: 'PENDING', userId: 'actor-a' }, { id: 'n2', type: 'ANNOUNCEMENT', status: 'READ', userId: 'actor-a' }]);
      const result = await service.listNotifications('actor-a', { page: 1, limit: 10, skip: 0 } as any);
      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
    });

    it('filters by read status', async () => {
      await service.listNotifications('actor-a', { page: 1, limit: 10, skip: 0, status: 'PENDING' } as any);
      const where = prisma.notification.findMany.mock.calls[0][0].where;
      expect(where.status).toBe('PENDING');
    });

    it('filters by user id', async () => {
      await service.listNotifications('actor-a', { page: 1, limit: 10, skip: 0 } as any);
      const where = prisma.notification.findMany.mock.calls[0][0].where;
      expect(where.userId).toBe('actor-a');
    });
  });

  describe('getNotification', () => {
    it('returns notification by id', async () => {
      prisma.notification.findUnique.mockResolvedValue({ id: 'n1', type: 'TASK_ASSIGNED', status: 'PENDING', userId: 'actor-a' });
      const result = await service.getNotification('n1', actor);
      expect(result.id).toBe('n1');
    });

    it('throws NotFoundException for non-existent notification', async () => {
      prisma.notification.findUnique.mockResolvedValue(null);
      await expect(service.getNotification('n1', actor)).rejects.toThrow(NotFoundException);
    });

    it('rejects accessing other user notification', async () => {
      prisma.notification.findUnique.mockResolvedValue({ id: 'n1', type: 'TASK_ASSIGNED', status: 'PENDING', userId: 'other-user' });
      await expect(service.getNotification('n1', actor)).rejects.toThrow(NotFoundException);
    });
  });

  describe('createNotification', () => {
    it('creates notification for user', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'actor-a', status: 'ACTIVE', deletedAt: null });
      prisma.notification.create.mockResolvedValue({ id: 'n1', type: 'TASK_ASSIGNED', title: 'New Task', userId: 'actor-a' });
      const result = await service.createNotification({ userId: 'actor-a', type: 'TASK_ASSIGNED', title: 'New Task', body: 'You have a new task' } as any);
      expect(result.userId).toBe('actor-a');
      expect(result.type).toBe('TASK_ASSIGNED');
    });

    it('rejects notification for non-existent user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.createNotification({ userId: 'unknown', type: 'TASK_ASSIGNED', title: 'Task' } as any)).rejects.toThrow(NotFoundException);
    });

    it('rejects notification for inactive user', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'actor-a', status: 'INACTIVE', deletedAt: null });
      await expect(service.createNotification({ userId: 'actor-a', type: 'TASK_ASSIGNED', title: 'Task' } as any)).rejects.toThrow(BadRequestException);
    });
  });

  describe('markAsRead', () => {
    it('marks notification as read', async () => {
      prisma.notification.findUnique.mockResolvedValue({ id: 'n1', userId: 'actor-a', status: 'PENDING', readAt: null });
      prisma.notification.update.mockResolvedValue({ id: 'n1', status: 'READ', readAt: new Date() });
      const result = await service.markAsRead('n1', actor);
      expect(result.status).toBe('READ');
      expect(result.readAt).toBeDefined();
    });

    it('rejects marking other user notification', async () => {
      prisma.notification.findUnique.mockResolvedValue({ id: 'n1', userId: 'other-user', status: 'PENDING', readAt: null });
      await expect(service.markAsRead('n1', actor)).rejects.toThrow(NotFoundException);
    });
  });

  describe('markAllAsRead', () => {
    it('marks all notifications as read for user', async () => {
      prisma.notification.updateMany.mockResolvedValue({ count: 5 });
      const result = await service.markAllAsRead('actor-a');
      expect(result.count).toBe(5);
      expect(prisma.notification.updateMany.mock.calls[0][0].where.userId).toBe('actor-a');
    });
  });

  describe('deleteNotification', () => {
    it('deletes notification', async () => {
      prisma.notification.findUnique.mockResolvedValue({ id: 'n1', userId: 'actor-a', status: 'PENDING' });
      prisma.notification.delete.mockResolvedValue({ id: 'n1' });
      const result = await service.deleteNotification('n1', actor);
      expect(result.success).toBe(true);
    });

    it('rejects deleting other user notification', async () => {
      prisma.notification.findUnique.mockResolvedValue({ id: 'n1', userId: 'other-user', status: 'PENDING' });
      await expect(service.deleteNotification('n1', actor)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getUnreadCount', () => {
    it('returns unread notification count for user', async () => {
      prisma.notification.count.mockResolvedValue(3);
      const result = await service.getUnreadCount('actor-a');
      expect(result.count).toBe(3);
      expect(prisma.notification.count.mock.calls[0][0].where).toMatchObject({ userId: 'actor-a', status: 'PENDING', readAt: null });
    });
  });
});