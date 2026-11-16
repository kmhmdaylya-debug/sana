import { TasksService } from './tasks.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';

describe('Task assignments', () => {
  const actor = {
    id: 'actor', employeeId: null, isSuperAdmin: false,
    scope: { unrestricted: false, companyIds: [], branchIds: [], orgUnitIds: [], employeeIds: [] },
  } as unknown as AuthenticatedUser;
  let prisma: any;
  let notifications: any;
  let service: TasksService;

  beforeEach(() => {
    prisma = {
      task: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), create: jest.fn(), update: jest.fn(), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      user: { findMany: jest.fn() },
      taskComment: { create: jest.fn() },
      taskAssignee: { updateMany: jest.fn() },
      $transaction: jest.fn(work => work(prisma)),
    };
    notifications = { notify: jest.fn().mockResolvedValue(undefined) };
    service = new TasksService(prisma, {} as any, { record: jest.fn().mockResolvedValue(undefined) } as any, notifications);
  });

  it('allows a user-only assignee to read their task', async () => {
    const task = { id: 'task', assignees: [{ userId: actor.id, employeeId: null }] };
    prisma.task.findUnique.mockResolvedValue(task);
    await expect(service.get('task', actor)).resolves.toMatchObject({ data: task });
  });

  it('keeps search and user-only access filters together without an empty UUID', async () => {
    await service.list({ search: 'needle' } as any, new PaginationDto(), actor);
    const where = prisma.task.findMany.mock.calls[0][0].where;
    expect(where.OR).toContainEqual({ title: { contains: 'needle', mode: 'insensitive' } });
    expect(where.AND[0].OR).toContainEqual({ assignees: { some: { userId: actor.id } } });
    expect(JSON.stringify(where)).not.toContain('"employeeId":""');
  });

  it('notifies the assigned user even when no employee profile exists', async () => {
    prisma.user.findMany.mockResolvedValue([{ id: 'recipient', employeeId: null }]);
    prisma.task.create.mockResolvedValue({ id: 'task', title: 'New task', assignees: [{ userId: 'recipient', employeeId: null }] });
    await service.create({ companyId: 'company', title: 'New task', assigneeUserIds: ['recipient'] }, { ...actor, isSuperAdmin: true });
    expect(notifications.notify).toHaveBeenCalledWith('recipient', expect.objectContaining({ type: 'TASK_ASSIGNED', link: '/tasks' }));
  });

  it('rejects unavailable assignees before changing a task', async () => {
    prisma.task.findUnique.mockResolvedValue({ id: 'task', createdById: actor.id, assignees: [] });
    prisma.user.findMany.mockResolvedValue([]);
    await expect(service.update('task', { assigneeUserIds: ['missing'] }, actor)).rejects.toThrow();
    expect(prisma.task.update).not.toHaveBeenCalled();
  });

  it('replaces assignees in the same task update, including clearing them', async () => {
    prisma.task.findUnique.mockResolvedValue({ id: 'task', createdById: actor.id, assignees: [{ userId: 'old' }] });
    prisma.task.update.mockResolvedValue({ id: 'task', title: 'Task' });
    await service.update('task', { assigneeUserIds: [] }, actor);
    expect(prisma.task.update.mock.calls[0][0].data.assignees).toEqual({ deleteMany: {}, create: [] });
  });

  it('records manager status changes in the same update', async () => {
    prisma.task.findUnique.mockResolvedValue({ id: 'task', createdById: actor.id, status: 'NEW', assignees: [] });
    prisma.task.update.mockResolvedValue({ id: 'task' });
    await service.update('task', { status: 'DONE' as any }, actor);
    expect(prisma.task.update.mock.calls[0][0].data).toMatchObject({ delayReason: null, comments: { create: { authorId: actor.id, content: 'وضعیت کار تغییر کرد: انجام‌شده' } } });
  });

  const pending = () => ({ id: 'task', title: 'Task', createdById: actor.id, status: 'IN_PROGRESS', delayReason: 'Problem', retryStatus: 'PENDING', retryRequestedAt: new Date(), retryRequestedById: 'recipient', assignees: [{ userId: 'recipient' }] });

  it('approves a retry atomically and notifies its assignee once', async () => {
    prisma.task.findUnique.mockResolvedValue(pending());
    await service.reviewRetry('task', { approved: true }, actor);
    expect(prisma.task.updateMany.mock.calls[0][0]).toMatchObject({ where: { retryStatus: 'PENDING' }, data: { retryStatus: 'APPROVED', status: 'NEW', delayReason: null, completedAt: null, progress: 0 } });
    expect(prisma.taskAssignee.updateMany).toHaveBeenCalledWith({ where: { taskId: 'task' }, data: { completedAt: null, dismissedAt: null } });
    expect(prisma.taskComment.create).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledTimes(1);
  });

  it('rejects a retry with a required trimmed reason and retains the failed state', async () => {
    prisma.task.findUnique.mockResolvedValue(pending());
    await expect(service.reviewRetry('task', { approved: false, reason: '   ' }, actor)).rejects.toThrow();
    expect(prisma.task.updateMany).not.toHaveBeenCalled();
    await service.reviewRetry('task', { approved: false, reason: ' Not ready ' }, actor);
    expect(prisma.task.updateMany.mock.calls[0][0].data).toEqual({ retryStatus: 'REJECTED' });
    expect(prisma.taskAssignee.updateMany).not.toHaveBeenCalled();
    expect(prisma.taskComment.create.mock.calls[0][0].data.content).toContain('Not ready');
  });

  it('rejects concurrent reviews without duplicate history', async () => {
    prisma.task.findUnique.mockResolvedValue(pending());
    prisma.task.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.reviewRetry('task', { approved: true }, actor)).rejects.toThrow();
    expect(prisma.taskComment.create).not.toHaveBeenCalled();
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('denies a review outside the manager task scope', async () => {
    prisma.task.findUnique.mockResolvedValue({ ...pending(), createdById: 'other', assignees: [] });
    await expect(service.reviewRetry('task', { approved: true }, actor)).rejects.toThrow();
    expect(prisma.task.updateMany).not.toHaveBeenCalled();
  });

  it.each(['APPROVED', 'REJECTED', null])('does not review a request that is no longer pending: %s', async retryStatus => {
    prisma.task.findUnique.mockResolvedValue({ ...pending(), retryStatus });
    await expect(service.reviewRetry('task', { approved: true }, actor)).rejects.toThrow();
    expect(prisma.task.updateMany).not.toHaveBeenCalled();
  });

  it('preserves a pending request and assignees when only its category changes', async () => {
    prisma.task.findUnique.mockResolvedValue(pending());
    prisma.user.findMany.mockResolvedValue([{ id: 'recipient', employeeId: null }]);
    prisma.task.update.mockResolvedValue({ id: 'task' });
    await service.update('task', { category: 'DESIGN', assigneeUserIds: ['recipient'] }, { ...actor, isSuperAdmin: true });
    const data = prisma.task.update.mock.calls[0][0].data;
    expect(data.category).toBe('DESIGN');
    expect(data.retryStatus).toBeUndefined();
    expect(data.delayReason).toBeUndefined();
    expect(data.assignees).toBeUndefined();
  });

  it('saves and filters shared category keys', async () => {
    prisma.task.create.mockResolvedValue({ id: 'task', title: 'Task', assignees: [] });
    await service.create({ title: 'Task', companyId: 'company', category: 'DEVELOPMENT' }, actor);
    expect(prisma.task.create.mock.calls[0][0].data.category).toBe('DEVELOPMENT');
    await service.list({ category: 'DEVELOPMENT' } as any, new PaginationDto(), actor);
    expect(prisma.task.findMany.mock.calls[0][0].where.category).toBe('DEVELOPMENT');
  });
});
