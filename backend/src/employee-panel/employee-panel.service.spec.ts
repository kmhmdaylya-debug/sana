import { EmployeePanelService } from './employee-panel.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';

describe('Employee panel tasks', () => {
  const user = { id: 'user', employeeId: 'employee', isSuperAdmin: true } as AuthenticatedUser;
  let prisma: any;
  let service: EmployeePanelService;
  beforeEach(() => {
    prisma = {
      task: { findMany: jest.fn().mockResolvedValue([{ id: 'task' }]), findFirst: jest.fn().mockResolvedValue({ id: 'task', status: 'NEW', createdById: null }), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      taskAssignee: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      taskComment: { create: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn((work) => work(prisma)),
    };
    service = new EmployeePanelService(prisma, { record: jest.fn() } as any, { notify: jest.fn() } as any);
  });

  it('restricts tasks to the current user or employee even for an administrator', async () => {
    await service.myTasks(new PaginationDto(), user);
    expect(prisma.task.findMany.mock.calls[0][0].where).toEqual({
      assignees: { some: { OR: [{ userId: 'user' }, { employeeId: 'employee' }] } },
      OR: [{ status: { not: 'DONE' } }, { assignees: { some: { dismissedAt: null, OR: [{ userId: 'user' }, { employeeId: 'employee' }] } } }],
    });
  });

  it('combines personal scope with search and returns all tasks without pagination', async () => {
    const query = Object.assign(new PaginationDto(), { page: 2, limit: 3, search: 'report' });
    const result = await service.myTasks(query, user);
    const args = prisma.task.findMany.mock.calls[0][0];
    expect(args).toMatchObject({ where: { title: { contains: 'report', mode: 'insensitive' } } });
    expect(args.skip).toBeUndefined();
    expect(args.take).toBeUndefined();
    expect(result.meta).toEqual({ total: 1, page: 1, limit: 1, totalPages: 1 });
  });

  it('requires an employee profile before querying tasks', async () => {
    await expect(service.myTasks(new PaginationDto(), { ...user, employeeId: null })).rejects.toThrow();
    expect(prisma.task.findMany).not.toHaveBeenCalled();
  });

  it('dismisses only completed work assigned to this employee without deleting the task', async () => {
    await service.dismissTask('task', user);
    expect(prisma.taskAssignee.updateMany).toHaveBeenCalledWith({
      where: { taskId: 'task', OR: [{ userId: 'user' }, { employeeId: 'employee' }], task: { status: 'DONE' } },
      data: { dismissedAt: expect.any(Date) },
    });
    expect(prisma.task.updateMany).not.toHaveBeenCalled();
    expect(prisma.taskComment.create).not.toHaveBeenCalled();
  });

  it('rejects dismissal of unfinished or unassigned work', async () => {
    prisma.taskAssignee.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.dismissTask('task', user)).rejects.toThrow();
  });

  it('requires a profile before dismissing work', async () => {
    await expect(service.dismissTask('task', { ...user, employeeId: null })).rejects.toThrow();
    expect(prisma.taskAssignee.updateMany).not.toHaveBeenCalled();
  });

  it('requires a nonblank reason for an unable result before any write', async () => {
    await expect(service.taskResult('task', { result: 'UNABLE', reason: '   ' }, user)).rejects.toThrow();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('denies reporting an unassigned task even for an administrator', async () => {
    prisma.task.findFirst.mockResolvedValue(null);
    await expect(service.taskResult('task', { result: 'DONE' }, user)).rejects.toThrow();
    expect(prisma.task.updateMany).not.toHaveBeenCalled();
  });

  it('completes the task with progress and completion timestamps atomically', async () => {
    await service.taskResult('task', { result: 'DONE' }, user);
    expect(prisma.task.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'DONE', progress: 100, delayReason: null, completedAt: expect.any(Date) }) }));
    expect(prisma.taskAssignee.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { completedAt: expect.any(Date) } }));
    expect(prisma.taskComment.create).toHaveBeenCalled();
  });

  it('stores a trimmed inability reason without marking the task done', async () => {
    await service.taskResult('task', { result: 'UNABLE', reason: '  Missing access  ' }, user);
    expect(prisma.task.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'IN_PROGRESS', delayReason: 'Missing access', completedAt: null } }));
  });

  it('starts a new task and records its author in history', async () => {
    await service.taskResult('task', { result: 'START' }, user);
    expect(prisma.task.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: 'NEW', delayReason: null }),
      data: { status: 'IN_PROGRESS', delayReason: null, completedAt: null },
    }));
    expect(prisma.taskComment.create).toHaveBeenCalledWith({ data: { taskId: 'task', authorId: 'user', content: 'کار شروع شد.' } });
  });

  it('resumes blocked work without deleting its previous comments', async () => {
    prisma.task.findFirst.mockResolvedValue({ status: 'IN_PROGRESS', delayReason: 'No access' });
    await service.taskResult('task', { result: 'START' }, user);
    expect(prisma.task.updateMany.mock.calls[0][0]).toMatchObject({ where: { status: 'IN_PROGRESS', delayReason: 'No access' }, data: { delayReason: null } });
    expect(prisma.taskComment.create.mock.calls[0][0].data.content).toContain('از سر گرفته');
  });

  it('rejects a duplicate start without adding history', async () => {
    prisma.task.findFirst.mockResolvedValue({ status: 'IN_PROGRESS', delayReason: null });
    await expect(service.taskResult('task', { result: 'START' }, user)).rejects.toThrow();
    expect(prisma.task.updateMany).not.toHaveBeenCalled();
    expect(prisma.taskComment.create).not.toHaveBeenCalled();
  });

  it('rejects a concurrent start without adding history', async () => {
    prisma.task.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.taskResult('task', { result: 'START' }, user)).rejects.toThrow();
    expect(prisma.taskComment.create).not.toHaveBeenCalled();
  });

  it('rejects a stale result after the task has been finalized', async () => {
    prisma.task.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.taskResult('task', { result: 'DONE' }, user)).rejects.toThrow();
    expect(prisma.taskComment.create).not.toHaveBeenCalled();
  });

  it.each(['DONE', 'CANCELLED'])('does not reopen a %s task', async (status) => {
    prisma.task.findFirst.mockResolvedValue({ status });
    await expect(service.taskResult('task', { result: 'UNABLE', reason: 'Blocked' }, user)).rejects.toThrow();
    expect(prisma.task.updateMany).not.toHaveBeenCalled();
  });
});
