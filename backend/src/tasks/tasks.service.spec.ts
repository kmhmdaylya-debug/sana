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
      task: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), create: jest.fn(), update: jest.fn() },
      user: { findMany: jest.fn() },
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
    prisma.task.findUnique.mockResolvedValue({ id: 'task', createdById: actor.id, assignees: [] });
    prisma.task.update.mockResolvedValue({ id: 'task', title: 'Task' });
    await service.update('task', { assigneeUserIds: [] }, actor);
    expect(prisma.task.update.mock.calls[0][0].data.assignees).toEqual({ deleteMany: {}, create: [] });
  });
});
