import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { PERMISSIONS } from '../common/constants/permissions';

export function employeeVisibility(user: AuthenticatedUser, employeeId?: string) {
  const own = !!employeeId && user.employeeId === employeeId;
  const has = (permission: string) => user.isSuperAdmin || user.permissions.includes('*') || user.permissions.includes(permission);
  return { personal:own || has(PERMISSIONS.EMPLOYEES_VIEW_SENSITIVE), bank:own || has(PERMISSIONS.EMPLOYEES_VIEW_BANK), salary:own || has(PERMISSIONS.EMPLOYEES_VIEW_SALARY) || has(PERMISSIONS.PAYROLL_VIEW) };
}

export function privateEmployee<T extends Record<string, unknown>>(employee: T, user: AuthenticatedUser): T & { canViewSensitive: boolean } {
  const visibility = employeeVisibility(user,String(employee.id));
  const result: Record<string, unknown> = { ...employee, canViewSensitive:visibility.personal };
  if (!visibility.personal) {
    for (const key of ['nationalId','fatherName','birthDate','birthPlace','gender','maritalStatus','maritalStatusNote','address','emergencyName','emergencyPhone','mobile','email']) result[key]=null;
    result.dependents=[];
    result.employmentEvents=[];
  }
  if (!visibility.salary) result.monthlyBaseSalary=null;
  if (!visibility.bank) result.bankAccounts=[];
  return result as T & { canViewSensitive:boolean };
}
