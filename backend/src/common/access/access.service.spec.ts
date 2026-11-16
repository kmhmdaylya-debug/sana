import { ForbiddenException } from '@nestjs/common';
import { AccessService } from './access.service';
import { AuthenticatedUser } from '../decorators/current-user.decorator';

export const scopedActor = (changes: Partial<AuthenticatedUser> = {}): AuthenticatedUser => ({
  id: 'manager-a', username: 'manager.a', fullName: 'Test manager', email: null, mobile: null,
  isSuperAdmin: false, employeeId: 'employee-a', roleIds: [], roleCodes: [], permissions: ['employees.view'],
  scope: { unrestricted: false, companyIds: ['company-a'], branchIds: [], orgUnitIds: [], employeeIds: [], ownEmployeeId: 'employee-a' }, ...changes,
});

describe('Access policy boundaries', () => {
  let db: any;
  let service: AccessService;
  beforeEach(() => {
    db = {
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'manager-a', employeeId: 'employee-a', isSuperAdmin: false }) },
      userRole: { findMany: jest.fn().mockResolvedValue([]) },
      scopeAssignment: { findMany: jest.fn().mockResolvedValue([]) },
      orgUnit: { findUnique: jest.fn().mockResolvedValue({ companyId: 'company-a' }), findMany: jest.fn().mockResolvedValue([]) },
      branch: { findMany: jest.fn().mockResolvedValue([]) },
      employee: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([{ companyId: 'company-a' }]) },
      role: { findMany: jest.fn().mockResolvedValue([]) },
    };
    service = new AccessService(db);
  });
  it('does not turn organization scope anchors into a company-wide grant', async () => {
    db.scopeAssignment.findMany.mockResolvedValue([{ scopeType: 'ORG_UNIT', companyId: 'company-a', branchId: 'branch-a', orgUnitId: 'unit-a' }]);
    const scope = await service.getScope('manager-a');
    expect(scope.companyIds).toEqual([]);
    expect(scope.branchIds).toEqual([]);
    expect(scope.orgUnitIds).toEqual(['unit-a']);
    expect(db.scopeAssignment.findMany.mock.calls[0][0].where.validFrom.lte).toBeInstanceOf(Date);
    expect(db.orgUnit.findMany.mock.calls[0][0].where.companyId).toBe('company-a');
  });
  it('ignores inactive and deleted roles and queries only currently effective assignments', async () => {
    const role = (code: string, isActive = true, deletedAt: Date | null = null) => ({ role: { isActive, deletedAt, rolePermissions: [{ permission: { code } }] } });
    db.userRole.findMany.mockResolvedValue([role('employees.view'), role('*', false), role('users.manage.roles', true, new Date())]);
    expect(await service.getEffectivePermissions('manager-a')).toEqual(['employees.view']);
    expect(db.userRole.findMany.mock.calls[0][0].where.validFrom.lte).toBeInstanceOf(Date);
  });
  it('does not give an ordinary employee automatic access to direct reports', () => {
    const ordinary = scopedActor({ permissions: [], scope: { ...scopedActor().scope, companyIds: [] } });
    expect(JSON.stringify(service.employeeWhereFor(ordinary))).not.toContain('managerId');
    expect(JSON.stringify(service.employeeWhereFor({ ...ordinary, permissions: ['dashboard.view.management'] }))).toContain('managerId');
  });
  it('denies other-company access and never falls back to an arbitrary company for an unscoped user', async () => {
    await expect(service.assertCompanyAccess(scopedActor(), 'company-b')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.resolveCompanyId(scopedActor({ employeeId: null, scope: { ...scopedActor().scope, companyIds: [] } }))).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('intersects an employee identifier with the actor scope', async () => {
    expect(await service.canAccessEmployee(scopedActor(), 'employee-b')).toBe(false);
    expect(db.employee.findFirst.mock.calls[0][0].where.AND).toEqual([{ id: 'employee-b' }, service.employeeWhereFor(scopedActor())]);
  });
  it.each(['*', 'users.manage.superadmin', 'payroll.approve'])('cannot delegate a role containing %s', async permission => {
    db.role.findMany.mockResolvedValue([{ code: 'CUSTOM', rolePermissions: [{ permission: { code: permission } }] }]);
    await expect(service.assertGrantableRoles(scopedActor(), ['role'])).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('can delegate an existing active role containing only permissions the actor owns', async () => {
    db.role.findMany.mockResolvedValue([{ code: 'EMPLOYEE', rolePermissions: [{ permission: { code: 'employees.view' } }] }]);
    await expect(service.assertGrantableRoles(scopedActor(), ['role'])).resolves.toBeUndefined();
  });
  it('rejects ALL and broader company delegation from a narrow organization grant', async () => {
    const actor = scopedActor({ scope: { ...scopedActor().scope, companyIds: [], orgUnitIds: ['unit-a'] } });
    await expect(service.assertGrantableScopes(actor, [{ scopeType: 'ALL' }])).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.assertGrantableScopes(actor, [{ scopeType: 'COMPANY', companyId: 'company-a' }])).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('rejects a company/branch mismatch even for a superadmin', async () => {
    db.branch.findUnique = jest.fn().mockResolvedValue({ id: 'branch-b', companyId: 'company-b' });
    await expect(service.assertGrantableScopes(scopedActor({ isSuperAdmin: true }), [{ scopeType: 'BRANCH', branchId: 'branch-b', companyId: 'company-a' }])).rejects.toThrow();
  });
});
