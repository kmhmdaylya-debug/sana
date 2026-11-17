import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PayrollService } from './payroll.service';
import { AccessService } from '../common/access/access.service';
import { AuditService } from '../common/audit/audit.service';
import { NotificationService } from '../common/notifications/notification.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';

const databaseUrl = process.env.SANA_INTEGRATION_DATABASE_URL;
const integration = databaseUrl ? describe : describe.skip;

integration('Payroll transactions and concurrency with PostgreSQL', () => {
  let db: PrismaClient;
  let service: PayrollService;
  let actor: AuthenticatedUser;
  const companyId = randomUUID();
  const employeeId = randomUUID();
  const userId = randomUUID();
  let periodId: string;
  beforeAll(async () => {
    if (!/^\/sana_audit_test_[a-f0-9]{16}$/.test(new URL(databaseUrl!).pathname)) throw new Error('Unsafe database target');
    db = new PrismaClient({ datasources: { db: { url: databaseUrl } }, log: [] });
    await db.company.create({ data: { id: companyId, code: `PAY-${companyId.slice(0, 8)}`, name: 'Synthetic payroll company' } });
    await db.employee.create({ data: { id: employeeId, companyId, code: 'PAY-TEST', firstName: 'Synthetic', lastName: 'Payroll', hireDate: new Date('2020-01-01'), monthlyBaseSalary: BigInt(1000000) } });
    await db.user.create({ data: { id: userId, username: `pay-${userId}`, fullName: 'Synthetic payroll operator', passwordHash: 'synthetic-unusable-hash', employeeId } });
    await db.employee.update({ where: { id: employeeId }, data: { userId } });
    actor = { id: userId, username: 'payroll.test', fullName: 'Synthetic payroll operator', email: null, mobile: null, isSuperAdmin: false, employeeId: null, roleIds: [], roleCodes: [], permissions: ['payroll.view', 'payroll.create', 'payroll.update', 'payroll.review', 'payroll.approve', 'payroll.publish'], scope: { unrestricted: false, companyIds: [companyId], branchIds: [], orgUnitIds: [], employeeIds: [], ownEmployeeId: null } };
    const prisma = db as PrismaService;
    service = new PayrollService(prisma, new AuditService(prisma), new AccessService(prisma), new NotificationService(prisma), new ConfigService({ app: { payroll: { workingDaysPerMonth: 30, defaultWorkHoursPerDay: 8 } } }));
    periodId = (await db.payrollPeriod.create({ data: { companyId, year: 1405, month: 8 } })).id;
  });
  afterAll(async () => { await db?.$disconnect(); });

  it('serializes simultaneous generation and does not duplicate payroll items or payslips', async () => {
    await Promise.all([service.generate(periodId, userId, actor), service.generate(periodId, userId, actor)]);
    const items = await db.payrollItem.findMany({ where: { periodId } });
    const codes = new Set(items.map(row => row.componentId));
    expect(codes.size).toBe(items.length);
    expect(items.length).toBeGreaterThan(0);
    expect(await db.payslip.count({ where: { periodId } })).toBe(1);
    const before = await db.payslip.findFirstOrThrow({ where: { periodId } });
    await service.generate(periodId, userId, actor);
    const after = await db.payslip.findFirstOrThrow({ where: { periodId } });
    expect(after.grossAmount).toBe(before.grossAmount);
    expect(after.netAmount).toBe(before.netAmount);
    expect(after.netAmount).toBe(after.grossAmount - after.deductionAmount);
    expect(after.grossAmount).toBe(BigInt(1000000));
  }, 30000);
  it('serializes review decisions and rejects publication before the period is locked', async () => {
    const outcomes = await Promise.allSettled([service.review(periodId, userId, actor), service.review(periodId, userId, actor)]);
    expect(outcomes.filter(row => row.status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.filter(row => row.status === 'rejected')).toHaveLength(1);
    await expect(service.publish(periodId, userId, actor)).rejects.toThrow();
    await service.lock(periodId, userId, actor);
    await expect(service.generate(periodId, userId, actor)).rejects.toThrow();
  });
  it('publishes once under concurrent requests and does not duplicate employee notifications', async () => {
    const outcomes = await Promise.all([service.publish(periodId, userId, actor), service.publish(periodId, userId, actor)]);
    expect(outcomes.map(row => row.data.published).sort()).toEqual([0, 1]);
    expect(await db.notification.count({ where: { userId, type: 'PAYSLIP_PUBLISHED' } })).toBe(1);
    expect((await db.payslip.findFirstOrThrow({ where: { periodId } })).status).toBe('PUBLISHED');
  });
  it('rolls back generated money rows if the mandatory financial audit write fails', async () => {
    const failed = await db.payrollPeriod.create({ data: { companyId, year: 1405, month: 9 } });
    const suffix = randomUUID().replaceAll('-', '');
    const functionName = `audit_fail_${suffix}`;
    const triggerName = `audit_trigger_${suffix}`;
    try {
      await db.$executeRawUnsafe(`CREATE FUNCTION ${functionName}() RETURNS trigger AS $$ BEGIN IF NEW."entityId" = '${failed.id}' THEN RAISE EXCEPTION 'Synthetic audit failure'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql`);
      await db.$executeRawUnsafe(`CREATE TRIGGER ${triggerName} BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION ${functionName}()`);
      await expect(service.generate(failed.id, userId, actor)).rejects.toThrow();
      expect(await db.payrollItem.count({ where: { periodId: failed.id } })).toBe(0);
      expect(await db.payslip.count({ where: { periodId: failed.id } })).toBe(0);
      expect((await db.payrollPeriod.findUniqueOrThrow({ where: { id: failed.id } })).generatedAt).toBeNull();
    } finally {
      await db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${triggerName} ON "AuditLog"`);
      await db.$executeRawUnsafe(`DROP FUNCTION IF EXISTS ${functionName}()`);
    }
  }, 30000);
  it('prevents other-company access to generation and amendment detail', async () => {
    const outsider = { ...actor, scope: { ...actor.scope, companyIds: [] } };
    await expect(service.generate(periodId, userId, outsider)).rejects.toThrow();
    const amendment = await db.payrollAmendment.create({ data: { periodId, employeeId, reason: 'Synthetic amendment', createdById: userId } });
    await expect(service.getAmendment(amendment.id, outsider)).rejects.toThrow();
  });

  it('does not promote an employee-only scope into company-wide payroll access', async () => {
    const narrow = { ...actor, employeeId, scope: { ...actor.scope, companyIds: [], employeeIds: [employeeId], ownEmployeeId: employeeId } };
    await expect(service.getPeriod(periodId, narrow)).rejects.toThrow();
    await expect(service.generate(periodId, userId, narrow)).rejects.toThrow();
    const periods = await service.listPeriods({} as never, { page: 1, limit: 20, skip: 0 } as never, narrow);
    expect(periods.data).toEqual([]);
  });
});
