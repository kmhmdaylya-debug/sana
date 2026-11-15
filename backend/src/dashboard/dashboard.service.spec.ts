import { DashboardService } from './dashboard.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';

describe('Manager work scope', () => {
  let prisma: any;
  let access: any;
  let service: DashboardService;
  const actor = { id: 'manager', isSuperAdmin: false, scope: { unrestricted: false, companyIds: [], branchIds: [], orgUnitIds: [], employeeIds: [] } } as unknown as AuthenticatedUser;
  beforeEach(() => {
    prisma = { employee: { findMany: jest.fn().mockResolvedValue([{ id: 'scoped-employee' }]) }, task: { findMany: jest.fn().mockResolvedValue([]) } };
    access = { employeeWhereFor: jest.fn().mockReturnValue({ orgUnitId: 'team' }) };
    service = new DashboardService(prisma, access, {} as any);
  });
  it('limits tasks and their history to scoped employees, own work or creator', async () => {
    await service.teamWork(actor);
    expect(prisma.employee.findMany.mock.calls[0][0].where.AND).toEqual([{ orgUnitId: 'team' }]);
    expect(prisma.task.findMany.mock.calls[0][0].where).toEqual({ OR: [
      { createdById: 'manager' },
      { assignees: { some: { OR: [{ userId: 'manager' }, { employeeId: { in: ['scoped-employee'] } }] } } },
    ] });
    expect(prisma.task.findMany.mock.calls[0][0].select.comments.orderBy).toEqual([{ createdAt: 'asc' }, { id: 'asc' }]);
  });
  it('does not broaden an empty employee scope', async () => {
    access.employeeWhereFor.mockReturnValue({ id: '__none__' });
    prisma.employee.findMany.mockResolvedValue([]);
    await service.teamWork(actor);
    expect(JSON.stringify(prisma.task.findMany.mock.calls[0][0].where)).toContain('"in":[]');
  });
  it('includes explicitly scoped company work', async () => {
    await service.teamWork({ ...actor, scope: { ...actor.scope, companyIds: ['company'] } });
    expect(prisma.task.findMany.mock.calls[0][0].where.OR).toContainEqual({ companyId: { in: ['company'] } });
  });
  it('allows unrestricted administrators without a redundant employee query', async () => {
    await service.teamWork({ ...actor, scope: { ...actor.scope, unrestricted: true } });
    expect(prisma.task.findMany.mock.calls[0][0].where).toEqual({});
    expect(prisma.employee.findMany).not.toHaveBeenCalled();
  });
});
