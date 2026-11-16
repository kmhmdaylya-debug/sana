import { privateEmployee } from './employee-privacy';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';

describe('Employee response privacy', () => {
  const actor = { employeeId: 'other', isSuperAdmin: false, permissions: [] } as unknown as AuthenticatedUser;
  const row = { id: 'employee', firstName: 'Test', nationalId: 'TEST-ID', mobile: 'TEST-MOBILE', monthlyBaseSalary: 123, bankAccounts: [{ sheba: 'TEST-IBAN' }], dependents: [{ nationalId: 'TEST-DEPENDENT' }], employmentEvents: [{ note: 'private' }] };
  it('does not leak confidential fields through an employee detail response', () => {
    const output = privateEmployee(row, actor);
    expect(output.nationalId).toBeNull();
    expect(output.mobile).toBeNull();
    expect(output.monthlyBaseSalary).toBeNull();
    expect(output.bankAccounts).toEqual([]);
    expect(output.dependents).toEqual([]);
    expect(output.employmentEvents).toEqual([]);
    expect(row.nationalId).toBe('TEST-ID');
  });
  it('does not bundle salary or banking into the personal-data permission', () => {
    const output = privateEmployee(row, { ...actor, permissions: ['employees.view.sensitive'] });
    expect(output.nationalId).toBe('TEST-ID');
    expect(output.monthlyBaseSalary).toBeNull();
    expect(output.bankAccounts).toEqual([]);
  });
  it('keeps bank and salary permissions independent', () => {
    expect(privateEmployee(row, { ...actor, permissions: ['employees.view.bank'] }).bankAccounts).toHaveLength(1);
    expect(privateEmployee(row, { ...actor, permissions: ['employees.view.salary'] }).monthlyBaseSalary).toBe(123);
    expect(privateEmployee(row, { ...actor, permissions: ['employees.view.salary'] }).nationalId).toBeNull();
  });
  it('allows self-service of the employees own information', () => {
    expect(privateEmployee(row, { ...actor, employeeId: row.id }).bankAccounts).toHaveLength(1);
  });
});
