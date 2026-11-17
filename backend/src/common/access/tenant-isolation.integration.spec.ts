import { INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { randomBytes, randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';
import request = require('supertest');
import { AccessService } from './access.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationService } from '../notifications/notification.service';
import { AuthenticatedUser } from '../decorators/current-user.decorator';
import { PermissionsGuard } from '../guards/permissions.guard';
import { AppValidationPipe } from '../pipes/app-validation.pipe';
import { AllExceptionsFilter } from '../filters/all-exceptions.filter';
import { OrgController } from '../../org/org.controller';
import { OrgService } from '../../org/org.service';
import { TrainingController } from '../../training/training.controller';
import { TrainingService } from '../../training/training.service';
import { AdminController } from '../../admin/admin.controller';
import { AdminService } from '../../admin/admin.service';
import { ContractsController } from '../../contracts/contracts.controller';
import { ContractsService } from '../../contracts/contracts.service';
import { ReportsController } from '../../reports/reports.controller';
import { ReportsService } from '../../reports/reports.service';
import { BackupController } from '../../backup/backup.controller';
import { BackupService } from '../../backup/backup.service';
import { hashPassword } from '../utils/password.util';
import { hashToken } from '../utils/crypto.util';
import { archiveChecksum, decryptArchive } from '../../backup/backup-archive';
import { AnnouncementsController } from '../../announcements/announcements.controller';
import { AnnouncementsService } from '../../announcements/announcements.service';
import { NotificationsController } from '../../notifications/notifications.controller';
import { NotificationsService } from '../../notifications/notifications.service';
import { AttendanceController } from '../../attendance/attendance.controller';
import { AttendanceService } from '../../attendance/attendance.service';
import { DailyAttendanceService } from '../../attendance/daily-attendance.service';
import { LeavesController } from '../../leaves/leaves.controller';
import { LeavesService } from '../../leaves/leaves.service';
import { ShiftsController } from '../../shifts/shifts.controller';
import { ShiftsService } from '../../shifts/shifts.service';
import { LifecycleController } from '../../lifecycle/lifecycle.controller';
import { LifecycleService } from '../../lifecycle/lifecycle.service';
import { SettingsController } from '../../settings/settings.controller';
import { SettingsService } from '../../settings/settings.service';
import { RecruitmentController } from '../../recruitment/recruitment.controller';
import { RecruitmentService } from '../../recruitment/recruitment.service';
import { LoansController } from '../../loans/loans.controller';
import { LoansService } from '../../loans/loans.service';
import { EvaluationsController } from '../../evaluations/evaluations.controller';
import { EvaluationsService } from '../../evaluations/evaluations.service';
import { ApprovalsController } from '../../approvals/approvals.controller';
import { ApprovalsService } from '../../approvals/approvals.service';
import { MissionsController } from '../../missions/missions.controller';
import { MissionsService } from '../../missions/missions.service';
import { DocumentsController } from '../../documents/documents.controller';
import { DocumentsService } from '../../documents/documents.service';
import { EmployeesController } from '../../employees/employees.controller';
import { EmployeesService } from '../../employees/employees.service';
import { PayrollService } from '../../payroll/payroll.service';

const databaseUrl = process.env.SANA_INTEGRATION_DATABASE_URL;
const integration = databaseUrl ? describe : describe.skip;

integration('Tenant and confidential output API tests with real PostgreSQL', () => {
  let app: INestApplication;
  let db: PrismaClient;
  let actor: AuthenticatedUser;
  let baseActor: AuthenticatedUser;
  const a = randomUUID();
  const b = randomUUID();
  const employeeA = randomUUID();
  const employeeB = randomUUID();
  const userA = randomUUID();
  const userB = randomUUID();
  const requesterId = randomUUID();
  const records: Record<string, [string, string]> = {};
  const backupPassword = randomBytes(32).toString('hex');
  const backupKey = randomBytes(48).toString('hex');
  const backupDir = path.resolve(process.cwd(), 'tmp', `audit-backup-${randomUUID()}`);
  let backupId: string;
  const uploadedTestFiles: string[] = [];
  async function workflowFixture(stepCount = 1) {
    const leave = await db.leaveRequest.create({ data: { employeeId: employeeA, leaveTypeId: records['leave-types'][0], startAt: new Date('2030-01-01T08:00:00Z'), endAt: new Date('2030-01-01T09:00:00Z'), durationMinutes: 60, status: 'PENDING_HR' } });
    await db.leaveTransaction.create({ data: { employeeId: employeeA, leaveTypeId: records['leave-types'][0], sourceType: 'LeaveRequest', sourceId: leave.id, type: 'RESERVE', minutes: 60, occurredAt: leave.startAt } });
    const flow = await db.approvalFlow.create({ data: { companyId: a, code: `TEST-${randomUUID()}`, name: 'Synthetic approval flow', subjectType: 'LEAVE', steps: { create: Array.from({ length: stepCount }, (_, index) => ({ stepOrder: index + 1, name: `Step ${index + 1}`, approverType: 'USER', approverUserId: requesterId, conditionJson: index === 0 ? JSON.stringify({ field: 'durationMinutes', operator: 'gte', value: 60 }) : null })) } } });
    return { leave, flow };
  }
  beforeAll(async () => {
    if (!/^\/sana_audit_test_[a-f0-9]{16}$/.test(new URL(databaseUrl!).pathname)) throw new Error('Tests require a separately provisioned synthetic database');
    db = new PrismaClient({ datasources: { db: { url: databaseUrl } }, log: [] });
    for (const [companyId, employeeId, userId, suffix] of [[a, employeeA, userA, 'a'], [b, employeeB, userB, 'b']]) {
      await db.company.create({ data: { id: companyId, code: `TEST-${suffix}`, name: `Synthetic company ${suffix}` } });
      await db.employee.create({ data: { id: employeeId, companyId, code: `E-${suffix}`, firstName: 'Synthetic', lastName: suffix, hireDate: new Date(), nationalId: `PRIVATE-TEST-${suffix}`, mobile: `TEST-MOBILE-${suffix}`, monthlyBaseSalary: BigInt(123456) } });
      await db.user.create({ data: { id: userId, username: `test.${suffix}`, fullName: 'Synthetic user', employeeId, passwordHash: 'synthetic-unusable-hash' } });
      await db.employee.update({ where: { id: employeeId }, data: { userId } });
      const entries = {
        branches: await db.branch.create({ data: { companyId, code: suffix, name: suffix } }),
        'work-locations': await db.workLocation.create({ data: { companyId, code: suffix, name: suffix } }),
        'cost-centers': await db.costCenter.create({ data: { companyId, code: suffix, name: suffix } }),
        units: await db.orgUnit.create({ data: { companyId, code: suffix, name: suffix } }),
        positions: await db.position.create({ data: { companyId, code: suffix, title: suffix } }),
        calendars: await db.calendar.create({ data: { companyId, name: suffix } }),
        courses: await db.trainingCourse.create({ data: { companyId, code: suffix, title: suffix } }),
        correspondences: await db.correspondence.create({ data: { companyId, referenceNo: suffix, subject: suffix, letterDate: new Date() } }),
        meetings: await db.meeting.create({ data: { companyId, title: suffix, scheduledAt: new Date(), organizerId: userId } }),
        surveys: await db.survey.create({ data: { companyId, title: suffix, createdById: userId } }),
        suggestions: await db.suggestion.create({ data: { companyId, title: suffix } }),
        'confidential-reports': await db.confidentialReport.create({ data: { companyId, title: suffix, description: 'private synthetic report' } }),
        announcements: await db.announcement.create({ data: { companyId, title: suffix, body: 'Synthetic announcement', publishedById: userId } }),
        devices: await db.attendanceDevice.create({ data: { companyId, code: `DEVICE-${suffix}`, name: suffix } }),
        'leave-types': await db.leaveType.create({ data: { companyId, code: 'ANNUAL', name: suffix } }),
        shifts: await db.shift.create({ data: { companyId, code: suffix, name: suffix, startTime: '08:00', endTime: '16:00', durationMinutes: 480 } }),
        templates: await db.onboardingChecklistTemplate.create({ data: { companyId, name: suffix } }),
        'custom-fields': await db.customFieldDefinition.create({ data: { companyId, entity: 'EMPLOYEE', code: suffix, label: suffix, dataType: 'text' } }),
        missions: await db.mission.create({ data: { employeeId, title: suffix, destination: 'Synthetic destination', startAt: new Date('2026-12-15T08:00:00Z'), endAt: new Date('2026-12-15T10:00:00Z') } }),
        documents: await db.employeeDocument.create({ data: { employeeId, title: suffix, docType: 'OTHER' } }),
        'private-documents': await db.employeeDocument.create({ data: { employeeId, title: suffix, docType: 'NATIONAL_ID' } }),
        'secret-documents': await db.employeeDocument.create({ data: { employeeId, title: suffix, docType: 'OTHER', confidentiality: 'SECRET' } }),
      };
      for (const [key, record] of Object.entries(entries)) (records[key] ??= ['', ''])[suffix === 'a' ? 0 : 1] = record.id;
      const requisition = await db.jobRequisition.create({ data: { companyId, title: suffix, status: 'APPROVED' } });
      const opening = await db.jobOpening.create({ data: { requisitionId: requisition.id, title: suffix } });
      const applicant = await db.applicant.create({ data: { openingId: opening.id, firstName: 'Synthetic', lastName: suffix, nationalId: `TEST-APPLICANT-${suffix}`, mobile: `TEST-CONTACT-${suffix}`, email: `${suffix}@example.invalid`, stageNote: 'Synthetic confidential note', resumePath: 'private/synthetic-resume.pdf' } });
      await db.applicantDocument.create({ data: { applicantId: applicant.id, docType: 'RESUME', fileName: 'synthetic.pdf', filePath: 'private/synthetic.pdf' } });
      const form = await db.evaluationForm.create({ data: { companyId, name: suffix, items: { create: { title: suffix, weight: 100 } } }, include: { items: true } });
      const cycle = await db.evaluationCycle.create({ data: { companyId, formId: form.id, name: suffix, startDate: new Date('2026-11-01'), endDate: new Date('2026-12-01') } });
      const leave = await db.leaveRequest.create({ data: { employeeId, leaveTypeId: entries['leave-types'].id, startAt: new Date('2026-12-10T08:00:00Z'), endAt: new Date('2026-12-10T09:00:00Z'), durationMinutes: 60, status: 'PENDING_HR' } });
      const flow = await db.approvalFlow.create({ data: { companyId, code: `FLOW-${suffix}`, name: suffix, subjectType: 'LEAVE', steps: { create: { stepOrder: 1, name: 'Synthetic step', approverType: 'USER', approverUserId: userId } } }, include: { steps: true } });
      const instance = await db.approvalInstance.create({ data: { flowId: flow.id, subjectType: 'LEAVE', subjectId: leave.id, initiatedById: userA, payloadJson: JSON.stringify({ employeeId: employeeA }), tasks: { create: { stepId: flow.steps[0].id, stepOrder: 1, assigneeUserId: userA } } }, include: { tasks: true } });
      const extra = {
        requisitions: requisition, openings: opening, applicants: applicant,
        interviews: await db.interview.create({ data: { applicantId: applicant.id, openingId: opening.id, interviewerId: userId, scheduledAt: new Date('2026-12-01') } }),
        offers: await db.offer.create({ data: { applicantId: applicant.id, salary: BigInt(1000000) } }),
        'benefit-types': await db.benefitType.create({ data: { companyId, code: suffix, name: suffix } }),
        packages: await db.benefitPackage.create({ data: { companyId, name: suffix } }),
        loans: await db.loan.create({ data: { employeeId, amount: BigInt(1000000), status: 'PENDING_APPROVAL' } }),
        forms: form, cycles: cycle, 'evaluation-items': form.items[0],
        evaluations: await db.evaluation.create({ data: { cycleId: cycle.id, employeeId, supervisorScore: 4 } }),
        'approval-flows': flow, 'approval-instances': instance, 'approval-tasks': instance.tasks[0],
      };
      for (const [key, record] of Object.entries(extra)) (records[key] ??= ['', ''])[suffix === 'a' ? 0 : 1] = record.id;
      await db.contract.create({ data: { id: randomUUID(), employeeId, companyId, versions: { create: { version: 1, contractType: 'TEST', startDate: new Date(), effectiveDate: new Date(), baseSalary: BigInt(987654), housingAllowance: BigInt(50), foodAllowance: BigInt(40), childAllowance: BigInt(30), seniorityPay: BigInt(20), changeReason: 'PRIVATE-CONTRACT-REASON', terms: 'PRIVATE-CONTRACT-TERMS', createdById: userId } } } });
    }
    await db.user.create({ data: { id: requesterId, username: 'correction.requester', fullName: 'Synthetic requester', passwordHash: 'synthetic-unusable-hash' } });
    const approverRole = await db.role.create({ data: { code: 'TEST_WORKFLOW_APPROVER', name: 'Synthetic approver' } });
    for (const code of ['leaves.approve', 'approvals.decide', 'missions.approve', 'loans.approve', 'attendance.approve', 'lifecycle.manage', 'shifts.approve', 'payroll.approve']) {
      const permission = await db.permission.upsert({ where: { code }, create: { code, label: 'Synthetic permission', group: 'test' }, update: {} });
      await db.rolePermission.create({ data: { roleId: approverRole.id, permissionId: permission.id } });
    }
    await db.userRole.create({ data: { userId: requesterId, roleId: approverRole.id } });
    await db.scopeAssignment.create({ data: { userId: requesterId, scopeType: 'COMPANY', companyId: a } });
    baseActor = { id: userA, username: 'test.a', fullName: 'Synthetic user', email: null, mobile: null, employeeId: null, isSuperAdmin: false, roleIds: [], roleCodes: [], permissions: ['org.view', 'org.manage', 'training.view', 'training.manage', 'admin.view', 'admin.manage', 'confidential-reports.manage', 'contracts.view', 'reports.view', 'reports.export', 'employees.view', 'attendance.view'], scope: { unrestricted: false, companyIds: [a], branchIds: [], orgUnitIds: [], employeeIds: [], ownEmployeeId: null } };
    actor = structuredClone(baseActor);
    const module = await Test.createTestingModule({
      controllers: [EmployeesController, OrgController, TrainingController, AdminController, ContractsController, ReportsController, BackupController, AnnouncementsController, NotificationsController, AttendanceController, LeavesController, ShiftsController, LifecycleController, SettingsController, RecruitmentController, LoansController, EvaluationsController, ApprovalsController, MissionsController, DocumentsController],
      providers: [EmployeesService, PayrollService, OrgService, TrainingService, AdminService, ContractsService, ReportsService, BackupService, AnnouncementsService, NotificationsService, AttendanceService, DailyAttendanceService, LeavesService, ShiftsService, LifecycleService, SettingsService, RecruitmentService, LoansService, EvaluationsService, ApprovalsService, MissionsService, DocumentsService, AccessService, AuditService, { provide: PrismaService, useValue: db }, { provide: ConfigService, useValue: new ConfigService({ app: { database: { url: databaseUrl }, backup: { encryptionKey: backupKey, dir: backupDir, pgDumpPath: process.env.PG_DUMP_PATH || 'pg_dump', pgRestorePath: process.env.PG_RESTORE_PATH || 'pg_restore', restoreDatabaseUrl: process.env.SANA_RESTORE_TEST_URL } } }) }, { provide: NotificationService, useValue: new NotificationService(db as PrismaService) }],
    }).compile();
    app = module.createNestApplication();
    app.use((req: any, _res: any, next: () => void) => { req.user = actor; next(); });
    app.useGlobalGuards(new PermissionsGuard(module.get(Reflector)));
    app.useGlobalPipes(new AppValidationPipe());
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  }, 30000);
  beforeEach(() => { actor = structuredClone(baseActor); });
  afterAll(async () => {
    await app?.close();
    await db?.$disconnect();
    if (path.dirname(backupDir) !== path.resolve(process.cwd(), 'tmp') || !path.basename(backupDir).startsWith('audit-backup-')) throw new Error('Unsafe fixture cleanup path');
    for (const file of await fs.readdir(backupDir).catch(() => [])) await fs.unlink(path.join(backupDir, file));
    await fs.rmdir(backupDir).catch(() => {});
    for (const file of uploadedTestFiles) {
      const absolute = path.resolve('uploads', file);
      if (path.dirname(absolute) !== path.resolve('uploads', 'documents') || !/^[a-z0-9]+-[a-f0-9]{12}\.pdf$/.test(path.basename(absolute))) throw new Error('Unsafe uploaded fixture cleanup path');
      await fs.unlink(absolute);
    }
  });

  it('applies the last workflow decision to the real leave once, using record-derived conditions', async () => {
    const { leave, flow } = await workflowFixture();
    actor.permissions.push('approvals.view', 'approvals.decide');
    const api = request(app.getHttpServer());
    const started = await api.post('/approvals/instances').send({ flowCode: flow.code, subjectType: 'LEAVE', subjectId: leave.id, payloadJson: { employeeId: employeeA, durationMinutes: 0, days: 0 } }).expect(201);
    const instance = started.body.data ?? started.body;
    expect(JSON.parse(instance.payloadJson).durationMinutes).toBe(60);
    expect(instance.tasks).toHaveLength(1);
    const taskId = instance.tasks[0].id;
    await api.post(`/approvals/tasks/${taskId}/decide`).send({ decision: 'APPROVE' }).expect(403);
    actor.id = requesterId;
    const decisions = await Promise.all([api.post(`/approvals/tasks/${taskId}/decide`).send({ decision: 'APPROVE' }), api.post(`/approvals/tasks/${taskId}/decide`).send({ decision: 'APPROVE' })]);
    expect(decisions.map(r => r.status).sort()).toEqual([201, 400]);
    expect((await db.approvalInstance.findUniqueOrThrow({ where: { id: instance.id } })).status).toBe('APPROVED');
    expect((await db.leaveRequest.findUniqueOrThrow({ where: { id: leave.id } })).status).toBe('APPROVED');
    expect(await db.leaveTransaction.count({ where: { sourceId: leave.id, type: 'CONSUME' } })).toBe(1);
    expect(await db.leaveTransaction.count({ where: { sourceId: leave.id, type: 'RESERVE' } })).toBe(0);
    expect(await db.auditLog.count({ where: { entityId: leave.id, action: 'APPROVE' } })).toBe(1);
  }, 30000);
  it('advances intermediate steps without completing the subject prematurely', async () => {
    const { leave, flow } = await workflowFixture(2);
    actor.permissions.push('approvals.view', 'approvals.decide');
    const api = request(app.getHttpServer());
    const response = await api.post('/approvals/instances').send({ flowCode: flow.code, subjectType: 'LEAVE', subjectId: leave.id }).expect(201);
    const instance = response.body.data ?? response.body;
    actor.id = requesterId;
    await api.post(`/approvals/tasks/${instance.tasks[0].id}/decide`).send({ decision: 'APPROVE' }).expect(201);
    expect((await db.approvalInstance.findUniqueOrThrow({ where: { id: instance.id } })).currentStepOrder).toBe(2);
    expect((await db.leaveRequest.findUniqueOrThrow({ where: { id: leave.id } })).status).toBe('PENDING_HR');
    const next = await db.approvalTask.findFirstOrThrow({ where: { instanceId: instance.id, stepOrder: 2 } });
    await api.post(`/approvals/tasks/${next.id}/decide`).send({ decision: 'APPROVE' }).expect(201);
    expect((await db.leaveRequest.findUniqueOrThrow({ where: { id: leave.id } })).status).toBe('APPROVED');
  });
  it('rolls back task, workflow, notification and balance writes if subject audit fails', async () => {
    const { leave, flow } = await workflowFixture();
    actor.permissions.push('approvals.view', 'approvals.decide');
    const api = request(app.getHttpServer());
    const response = await api.post('/approvals/instances').send({ flowCode: flow.code, subjectType: 'LEAVE', subjectId: leave.id }).expect(201);
    const instance = response.body.data ?? response.body;
    actor.id = requesterId;
    const suffix = randomUUID().replaceAll('-', '');
    const name = `workflow_fail_${suffix}`;
    const before = await db.notification.count();
    try {
      await db.$executeRawUnsafe(`CREATE FUNCTION ${name}() RETURNS trigger AS $$ BEGIN IF NEW."entityId" = '${leave.id}' AND NEW."action" = 'APPROVE' THEN RAISE EXCEPTION 'Synthetic workflow failure'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql`);
      await db.$executeRawUnsafe(`CREATE TRIGGER ${name} BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION ${name}()`);
      await api.post(`/approvals/tasks/${instance.tasks[0].id}/decide`).send({ decision: 'APPROVE' }).expect(400);
      expect((await db.approvalInstance.findUniqueOrThrow({ where: { id: instance.id } })).status).toBe('PENDING');
      expect((await db.approvalTask.findUniqueOrThrow({ where: { id: instance.tasks[0].id } })).status).toBe('PENDING');
      expect((await db.leaveRequest.findUniqueOrThrow({ where: { id: leave.id } })).status).toBe('PENDING_HR');
      expect(await db.leaveTransaction.count({ where: { sourceId: leave.id, type: 'RESERVE' } })).toBe(1);
      expect(await db.leaveTransaction.count({ where: { sourceId: leave.id, type: 'CONSUME' } })).toBe(0);
      expect(await db.notification.count()).toBe(before);
    } finally {
      await db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${name} ON "AuditLog"`);
      await db.$executeRawUnsafe(`DROP FUNCTION IF EXISTS ${name}()`);
    }
    await api.post(`/approvals/tasks/${instance.tasks[0].id}/decide`).send({ decision: 'APPROVE' }).expect(201);
  });
  it('does not expose employee personal, salary or bank fields to a general viewer', async () => {
    const api = request(app.getHttpServer());
    await db.bankAccount.create({ data: { employeeId: employeeA, bankName: 'Synthetic', accountNumber: 'PRIVATE-BANK-TEST', sheba: 'PRIVATE-IBAN-TEST' } });
    const listed = await api.get('/employees').expect(200);
    expect(JSON.stringify(listed.body)).not.toContain('PRIVATE-TEST');
    expect(listed.body.data.find((r: { id: string }) => r.id === employeeA).monthlyBaseSalary ?? null).toBeNull();
    await api.get(`/employees/${employeeA}/bank-accounts`).expect(403);
    actor.permissions.push('employees.view.bank');
    expect(JSON.stringify((await api.get(`/employees/${employeeA}/bank-accounts`).expect(200)).body)).toContain('PRIVATE-IBAN-TEST');
  });
  it.each(['MISSION', 'LOAN', 'ATTENDANCE_CORRECTION', 'TERMINATION', 'PAYROLL', 'SHIFT_SWAP'] as const)('applies %s workflow outcomes to the domain record', async subjectType => {
    const api = request(app.getHttpServer());
    actor.permissions.push('approvals.view', 'approvals.decide');
    let subjectId: string;
    let assignmentId: string | undefined;
    let targetEmployeeId: string | undefined;
    if (subjectType === 'MISSION') subjectId = records.missions[0];
    else if (subjectType === 'LOAN') subjectId = records.loans[0];
    else if (subjectType === 'ATTENDANCE_CORRECTION') subjectId = (await db.attendanceCorrection.create({ data: { employeeId: employeeA, workDate: new Date('2030-01-02'), field: 'firstIn', newValue: '2030-01-02T04:30:00Z', reason: 'Synthetic workflow correction', requestedById: userA } })).id;
    else if (subjectType === 'TERMINATION') subjectId = (await db.terminationRequest.create({ data: { employeeId: employeeA, reason: 'Synthetic workflow termination', terminationDate: new Date('2030-01-02') } })).id;
    else if (subjectType === 'PAYROLL') subjectId = (await db.payrollPeriod.create({ data: { companyId: a, year: 1406, month: 1, status: 'REVIEWED', generatedAt: new Date() } })).id;
    else {
      targetEmployeeId = (await db.employee.create({ data: { companyId: a, code: 'WORKFLOW-SWAP', firstName: 'Synthetic', lastName: 'Swap', hireDate: new Date('2026-01-01') } })).id;
      assignmentId = (await db.shiftAssignment.create({ data: { shiftId: records.shifts[0], employeeId: employeeA, workDate: new Date('2030-01-02') } })).id;
      subjectId = (await db.shiftSwapRequest.create({ data: { sourceAssignmentId: assignmentId, fromEmployeeId: employeeA, toEmployeeId: targetEmployeeId, reason: 'Synthetic workflow swap' } })).id;
    }
    const flow = await db.approvalFlow.create({ data: { companyId: a, code: `TEST-${randomUUID()}`, name: 'Synthetic domain workflow', subjectType, steps: { create: { stepOrder: 1, name: 'Review', approverType: 'USER', approverUserId: requesterId } } } });
    const response = await api.post('/approvals/instances').send({ flowCode: flow.code, subjectType, subjectId }).expect(201);
    const instance = response.body.data ?? response.body;
    actor.id = requesterId;
    await api.post(`/approvals/tasks/${instance.tasks[0].id}/decide`).send({ decision: 'APPROVE' }).expect(201);
    expect((await db.approvalInstance.findUniqueOrThrow({ where: { id: instance.id } })).status).toBe('APPROVED');
    if (subjectType === 'MISSION') expect((await db.mission.findUniqueOrThrow({ where: { id: subjectId } })).status).toBe('APPROVED');
    if (subjectType === 'LOAN') expect((await db.loan.findUniqueOrThrow({ where: { id: subjectId } })).status).toBe('APPROVED');
    if (subjectType === 'TERMINATION') expect((await db.terminationRequest.findUniqueOrThrow({ where: { id: subjectId } })).status).toBe('APPROVED');
    if (subjectType === 'PAYROLL') expect((await db.payrollPeriod.findUniqueOrThrow({ where: { id: subjectId } })).status).toBe('LOCKED');
    if (subjectType === 'ATTENDANCE_CORRECTION') expect((await db.attendanceRecord.findUniqueOrThrow({ where: { employeeId_workDate: { employeeId: employeeA, workDate: new Date('2030-01-02') } } })).firstIn).toEqual(new Date('2030-01-02T04:30:00Z'));
    if (subjectType === 'SHIFT_SWAP') expect((await db.shiftAssignment.findUniqueOrThrow({ where: { id: assignmentId! } })).employeeId).toBe(targetEmployeeId);
  }, 30000);
  it('protects a global administrator through employee edit and delete APIs too', async () => {
    actor.permissions.push('employees.update', 'employees.delete');
    await db.user.update({ where: { id: userA }, data: { isSuperAdmin: true } });
    try {
      const api = request(app.getHttpServer());
      await api.patch(`/employees/${employeeA}`).send({ status: 'TERMINATED' }).expect(403);
      await api.delete(`/employees/${employeeA}`).expect(403);
      expect((await db.employee.findUniqueOrThrow({ where: { id: employeeA } })).deletedAt).toBeNull();
    } finally { await db.user.update({ where: { id: userA }, data: { isSuperAdmin: false } }); }
  });

  it('blocks every foreign mission write and cross-company organization reference', async () => {
    actor.permissions.push('missions.view', 'missions.create', 'missions.approve');
    const api = request(app.getHttpServer());
    const id = records.missions[1];
    await api.patch(`/missions/${id}`).send({ title: 'Blocked' }).expect(403);
    await api.post(`/missions/${id}/approve`).expect(403);
    await api.post(`/missions/${id}/start`).expect(403);
    await api.post(`/missions/${id}/complete`).send({ report: 'Blocked' }).expect(403);
    await api.delete(`/missions/${id}`).expect(403);
    await api.post(`/missions/${id}/expenses`).send({ description: 'Blocked', amount: 100, spentAt: '2026-12-15' }).expect(403);
    const expense = await db.missionExpense.create({ data: { missionId: id, description: 'Synthetic expense', amount: BigInt(100), spentAt: new Date('2026-12-15') } });
    await api.post(`/missions/expenses/${expense.id}/decide`).send({ decision: 'APPROVE' }).expect(403);
    await api.post('/missions').send({ employeeId: employeeA, orgUnitId: records.units[1], title: 'Blocked', destination: 'Synthetic', startAt: '2027-01-15T08:00:00Z', endAt: '2027-01-15T09:00:00Z' }).expect(400);
    expect((await db.mission.findUniqueOrThrow({ where: { id } })).status).toBe('REQUESTED');
  });
  it('serializes mission overlaps and concurrent approval, and rejects reversed dates', async () => {
    actor.permissions.push('missions.view', 'missions.create', 'missions.approve');
    const api = request(app.getHttpServer());
    const payload = { employeeId: employeeA, title: 'Synthetic mission', destination: 'Synthetic', startAt: '2027-01-16T08:00:00Z', endAt: '2027-01-16T09:00:00Z' };
    const created = await Promise.all([api.post('/missions').send(payload), api.post('/missions').send(payload)]);
    expect(created.map(r => r.status).sort()).toEqual([201, 400]);
    const id = created.find(r => r.status === 201)!.body.data.id;
    await api.patch(`/missions/${id}`).send({ endAt: '2027-01-16T07:00:00Z' }).expect(400);
    actor.isSuperAdmin = true;
    const decisions = await Promise.all([api.post(`/missions/${id}/approve`), api.post(`/missions/${id}/approve`)]);
    expect(decisions.map(r => r.status).sort()).toEqual([201, 400]);
    expect(await db.auditLog.count({ where: { entity: 'Mission', entityId: id, action: 'APPROVE' } })).toBe(1);
  });
  it('requires dedicated contract approval permission and commits only one concurrent transition', async () => {
    const contract = await db.contract.create({ data: { companyId: a, employeeId: employeeA, status: 'PENDING_APPROVAL' } });
    actor.permissions.push('contracts.update');
    const api = request(app.getHttpServer());
    await api.patch(`/contracts/${contract.id}`).send({ status: 'READY_TO_SIGN' }).expect(403);
    actor.permissions.push('contracts.approve');
    await api.patch(`/contracts/${contract.id}`).send({ status: 'ACTIVE' }).expect(400);
    const results = await Promise.all([api.patch(`/contracts/${contract.id}`).send({ status: 'READY_TO_SIGN' }), api.patch(`/contracts/${contract.id}`).send({ status: 'READY_TO_SIGN' })]);
    expect(results.map(r => r.status).sort()).toEqual([200, 400]);
    expect(await db.auditLog.count({ where: { entity: 'Contract', entityId: contract.id } })).toBe(1);
    await api.patch(`/contracts/${contract.id}`).send({ status: 'ACTIVE' }).expect(200);
    expect((await db.contract.findUniqueOrThrow({ where: { id: contract.id } })).status).toBe('ACTIVE');
    await db.contract.delete({ where: { id: contract.id } });
  });
  it('creates consistent sequential contract versions under concurrent requests', async () => {
    actor.permissions.push('contracts.create');
    const contract = await db.contract.findFirstOrThrow({ where: { employeeId: employeeA } });
    const api = request(app.getHttpServer());
    const payload = { contractType: 'PERMANENT', startDate: '2027-01-01', changeReason: 'Synthetic renewal', baseSalary: 987654 };
    await api.post(`/contracts/${contract.id}/versions`).send({ ...payload, endDate: '2026-01-01' }).expect(400);
    const responses = await Promise.all([api.post(`/contracts/${contract.id}/versions`).send(payload), api.post(`/contracts/${contract.id}/versions`).send(payload)]);
    expect(responses.map(r => r.status)).toEqual([201, 201]);
    expect(responses.map(r => r.body.data.version).sort()).toEqual([2, 3]);
    expect((await db.contract.findUniqueOrThrow({ where: { id: contract.id } })).currentVersion).toBe(3);
    expect(await db.contractVersion.count({ where: { contractId: contract.id } })).toBe(3);
  });
  it('records partial installment payments idempotently and prevents unauthorized or conflicting writes', async () => {
    const api = request(app.getHttpServer());
    const period = await db.payrollPeriod.create({ data: { companyId: a, year: 1405, month: 7 } });
    const foreignPeriod = await db.payrollPeriod.create({ data: { companyId: b, year: 1405, month: 7 } });
    const loan = await db.loan.create({ data: { employeeId: employeeA, amount: BigInt(1000), status: 'SETTLING' } });
    const installment = await db.loanInstallment.create({ data: { loanId: loan.id, amount: BigInt(1000), dueDate: new Date('2026-11-01') } });
    const payload = { amount: 400, payrollPeriodId: period.id, idempotencyKey: randomUUID() };
    actor.permissions.push('loans.create');
    await api.post(`/loans/installments/${installment.id}/pay`).send(payload).expect(403);
    actor.permissions.push('loans.approve');
    await api.post(`/loans/installments/${installment.id}/pay`).send({ ...payload, payrollPeriodId: foreignPeriod.id }).expect(400);
    const responses = await Promise.all([api.post(`/loans/installments/${installment.id}/pay`).send(payload), api.post(`/loans/installments/${installment.id}/pay`).send(payload)]);
    expect(responses.map(r => r.body.message)).toEqual([undefined, undefined]);
    expect(responses.map(r => r.status)).toEqual([201, 201]);
    expect(responses.map(r => r.body.data.paidAmount)).toEqual([400, 400]);
    expect(await db.loanInstallmentPayment.count({ where: { installmentId: installment.id } })).toBe(1);
    expect((await db.loanInstallment.findUniqueOrThrow({ where: { id: installment.id } })).paidAmount).toBe(BigInt(400));
    await api.post(`/loans/installments/${installment.id}/pay`).send({ ...payload, amount: 401 }).expect(409);
    const remaining = { ...payload, amount: 600, idempotencyKey: randomUUID() };
    await api.post(`/loans/installments/${installment.id}/pay`).send(remaining).expect(201);
    expect((await db.loan.findUniqueOrThrow({ where: { id: loan.id } })).status).toBe('SETTLED');
    await db.payrollPeriod.update({ where: { id: period.id }, data: { status: 'LOCKED' } });
    await api.post(`/loans/installments/${installment.id}/pay`).send(remaining).expect(201);
    expect(await db.loanInstallmentPayment.count({ where: { installmentId: installment.id } })).toBe(2);
  });
  it('filters private documents consistently, validates upload contents and downloads the real file', async () => {
    actor.permissions.push('documents.view', 'documents.create');
    const api = request(app.getHttpServer());
    let response = await api.get('/documents').expect(200);
    const ids = response.body.data.map((r: { id: string }) => r.id);
    expect(ids).toContain(records.documents[0]);
    expect(ids).not.toContain(records.documents[1]);
    expect(ids).not.toContain(records['private-documents'][0]);
    expect(ids).not.toContain(records['secret-documents'][0]);
    await api.get(`/documents/${records.documents[1]}`).expect(404);
    await api.get(`/documents/${records['private-documents'][0]}`).expect(403);
    await api.post(`/documents/${records.documents[0]}/versions`).attach('file', Buffer.from('<html>not a PDF</html>'), { filename: 'invalid.pdf', contentType: 'application/pdf' }).expect(400);
    const pdf = Buffer.from('%PDF-1.4\nSynthetic fixture content\n%%EOF');
    const uploaded = await api.post(`/documents/${records.documents[0]}/versions`).attach('file', pdf, { filename: 'synthetic.pdf', contentType: 'application/pdf' }).expect(201);
    const version = await db.employeeDocumentVersion.findFirstOrThrow({ where: { documentId: records.documents[0], version: uploaded.body.data.version } });
    uploadedTestFiles.push(version.filePath);
    const downloaded = await api.get(`/documents/versions/${version.id}/download`).expect(200);
    expect(downloaded.headers['cache-control']).toBe('no-store');
    expect(downloaded.body).toEqual(pdf);
    response = await api.get('/documents').expect(200);
    expect(JSON.stringify(response.body)).not.toContain(version.filePath);
    const traversal = await db.employeeDocumentVersion.create({ data: { documentId: records.documents[0], version: 999, filePath: '../../.env', fileName: 'blocked.pdf', size: 1 } });
    await api.get(`/documents/versions/${traversal.id}/download`).expect(404);
  });

  it.each(['requisitions', 'openings', 'applicants', 'interviews', 'offers'])('recruitment/%s excludes other company records', async entity => {
    actor.permissions.push('recruitment.view');
    const response = await request(app.getHttpServer()).get(`/recruitment/${entity}`).expect(200);
    expect(response.body.data.map((r: { id: string }) => r.id)).toContain(records[entity][0]);
    expect(response.body.data.map((r: { id: string }) => r.id)).not.toContain(records[entity][1]);
  });
  it('masks applicant personal fields and offer salary independently of recruitment viewing', async () => {
    actor.permissions.push('recruitment.view');
    const api = request(app.getHttpServer());
    const list = await api.get('/recruitment/applicants').expect(200);
    expect(list.body.data[0]).toMatchObject({ nationalId: null, mobile: null, email: null, resumePath: null, stageNote: null });
    const hiddenSearch = await api.get('/recruitment/applicants').query({ search: 'TEST-APPLICANT-a' }).expect(200);
    expect(hiddenSearch.body.data).toHaveLength(0);
    const detail = await api.get(`/recruitment/applicants/${records.applicants[0]}`).expect(200);
    expect(detail.body.data.documents).toEqual([]);
    expect(detail.body.data.offers[0].salary).toBeNull();
    const offers = await api.get('/recruitment/offers').expect(200);
    expect(offers.body.data[0].salary).toBeNull();
  });
  it('audits authorized applicant views without exposing storage paths or granting salary access', async () => {
    actor.permissions.push('recruitment.view', 'employees.view.sensitive');
    const api = request(app.getHttpServer());
    const detail = await api.get(`/recruitment/applicants/${records.applicants[0]}`).expect(200);
    expect(detail.body.data.nationalId).toBe('TEST-APPLICANT-a');
    expect(detail.body.data.resumePath).toBeNull();
    expect(detail.body.data.documents[0].filePath).toBeUndefined();
    expect(detail.body.data.offers[0].salary).toBeNull();
    expect(await db.auditLog.count({ where: { entity: 'Applicant', entityId: records.applicants[0], action: 'VIEW_SENSITIVE', userId: userA } })).toBeGreaterThan(0);
    actor.permissions = actor.permissions.filter(p => p !== 'employees.view.sensitive');
    actor.permissions.push('employees.view.salary');
    const salaryView = await api.get(`/recruitment/applicants/${records.applicants[0]}`).expect(200);
    expect(salaryView.body.data.nationalId).toBeNull();
    expect(salaryView.body.data.offers[0].salary).toBe(1000000);
  });
  it('blocks recruitment cross-company details, mutations and interviewer assignment', async () => {
    actor.permissions.push('recruitment.view', 'recruitment.manage', 'recruitment.interview');
    const api = request(app.getHttpServer());
    await api.get(`/recruitment/applicants/${records.applicants[1]}`).expect(403);
    await api.patch(`/recruitment/requisitions/${records.requisitions[1]}/status`).send({ status: 'CLOSED' }).expect(403);
    await api.patch(`/recruitment/applicants/${records.applicants[1]}/status`).send({ status: 'REJECTED' }).expect(403);
    await api.patch(`/recruitment/interviews/${records.interviews[1]}`).send({ status: 'CANCELLED' }).expect(403);
    await api.patch(`/recruitment/offers/${records.offers[1]}/status`).send({ status: 'ACCEPTED' }).expect(403);
    await api.post('/recruitment/requisitions').send({ companyId: b, title: 'Blocked', headcount: 1 }).expect(403);
    await api.post('/recruitment/interviews').send({ applicantId: records.applicants[0], openingId: records.openings[0], interviewerId: userB, scheduledAt: '2026-12-01T08:00:00Z' }).expect(400);
    expect((await db.applicant.findUniqueOrThrow({ where: { id: records.applicants[1] } })).status).toBe('APPLIED');
  });
  it('isolates benefits, packages and loan approval/disbursement operations', async () => {
    actor.permissions.push('loans.view', 'loans.create', 'loans.approve');
    const api = request(app.getHttpServer());
    for (const entity of ['benefit-types', 'packages']) expect((await api.get(`/loans/${entity}`).query({ companyId: b }).expect(200)).body.data).toEqual([]);
    await api.post('/loans/benefit-types').send({ companyId: b, code: 'Blocked', name: 'Blocked' }).expect(403);
    await api.patch(`/loans/benefit-types/${records['benefit-types'][1]}`).send({ name: 'Blocked' }).expect(403);
    await api.post('/loans/packages').send({ companyId: a, name: 'Blocked', items: [{ benefitTypeId: records['benefit-types'][1] }] }).expect(400);
    await api.post('/loans/employee-benefits').send({ employeeId: employeeA, benefitTypeId: records['benefit-types'][1] }).expect(400);
    await api.post('/loans/employee-benefits').send({ employeeId: employeeA, packageId: records.packages[1] }).expect(400);
    await api.post(`/loans/${records.loans[1]}/decide`).send({ decision: 'APPROVE' }).expect(403);
    await api.post(`/loans/${records.loans[1]}/disburse`).send({ disbursedAt: '2026-11-16T08:00:00Z' }).expect(403);
    expect((await db.loan.findUniqueOrThrow({ where: { id: records.loans[1] } })).status).toBe('PENDING_APPROVAL');
  });
  it('isolates evaluation forms, items, cycles, finalization and cycle startup', async () => {
    actor.permissions.push('evaluations.view', 'evaluations.manage', 'evaluations.approve');
    const api = request(app.getHttpServer());
    for (const entity of ['forms', 'cycles']) {
      const response = await api.get(`/evaluations/${entity}`).expect(200);
      expect(response.body.data.map((r: { id: string }) => r.id)).not.toContain(records[entity][1]);
      await api.get(`/evaluations/${entity}/${records[entity][1]}`).expect(403);
      await api.patch(`/evaluations/${entity}/${records[entity][1]}`).send({ name: 'Blocked' }).expect(403);
      await api.delete(`/evaluations/${entity}/${records[entity][1]}`).expect(403);
    }
    await api.post('/evaluations/forms').send({ companyId: b, name: 'Blocked' }).expect(403);
    await api.patch(`/evaluations/items/${records['evaluation-items'][1]}`).send({ title: 'Blocked' }).expect(403);
    await api.delete(`/evaluations/items/${records['evaluation-items'][1]}`).expect(403);
    await api.post(`/evaluations/cycles/${records.cycles[1]}/start`).send({ employeeIds: [employeeB] }).expect(403);
    await api.post(`/evaluations/${records.evaluations[1]}/finalize`).expect(403);
    expect((await db.evaluation.findUniqueOrThrow({ where: { id: records.evaluations[1] } })).lockedAt).toBeNull();
  });
  it('refuses foreign employees in an otherwise authorized evaluation cycle without partial writes', async () => {
    actor.permissions.push('evaluations.manage');
    const cycle = await db.evaluationCycle.create({ data: { companyId: a, formId: records.forms[0], name: 'Synthetic scope validation', startDate: new Date('2031-01-01'), endDate: new Date('2031-02-01') } });
    await request(app.getHttpServer()).post(`/evaluations/cycles/${cycle.id}/start`).send({ employeeIds: [employeeA, employeeB] }).expect(400);
    expect(await db.evaluation.count({ where: { cycleId: cycle.id } })).toBe(0);
    expect((await db.evaluationCycle.findUniqueOrThrow({ where: { id: cycle.id } })).status).toBe('PLANNED');
  });
  it('serializes cycle starts, creates only scoped employees and does not repeat notifications', async () => {
    actor.permissions.push('evaluations.manage');
    actor.scope.companyIds = [];
    actor.scope.employeeIds = [employeeA];
    const cycle = await db.evaluationCycle.create({ data: { companyId: a, formId: records.forms[0], name: 'Synthetic concurrent startup', startDate: new Date('2031-01-01'), endDate: new Date('2031-02-01') } });
    const api = request(app.getHttpServer());
    const responses = await Promise.all([api.post(`/evaluations/cycles/${cycle.id}/start`).send({}), api.post(`/evaluations/cycles/${cycle.id}/start`).send({})]);
    expect(responses.map(r => r.status)).toEqual([201, 201]);
    const rows = await db.evaluation.findMany({ where: { cycleId: cycle.id } });
    expect(rows).toHaveLength(2);
    expect(rows.every(row => row.employeeId === employeeA)).toBe(true);
    expect(await db.notification.count({ where: { userId: userA, link: `/evaluations/cycles/${cycle.id}` } })).toBe(1);
  });
  it('serializes evaluation finalization and refuses subsequent score edits', async () => {
    actor.permissions.push('evaluations.approve', 'evaluations.rate');
    const evaluation = await db.evaluation.create({ data: { cycleId: records.cycles[0], employeeId: employeeA, evaluationType: 'PEER', status: 'SUPERVISOR_ASSESSED', supervisorScore: 4, weightedScore: 4, evaluatorId: requesterId } });
    const api = request(app.getHttpServer());
    const responses = await Promise.all([api.post(`/evaluations/${evaluation.id}/finalize`), api.post(`/evaluations/${evaluation.id}/finalize`)]);
    expect(responses.map(r => r.status).sort()).toEqual([201, 400]);
    expect(await db.auditLog.count({ where: { entityId: evaluation.id, action: 'APPROVE' } })).toBe(1);
    await api.post(`/evaluations/${evaluation.id}/supervisor-assess`).send({ scores: [{ itemId: records['evaluation-items'][0], score: 1 }] }).expect(400);
    expect((await db.evaluation.findUniqueOrThrow({ where: { id: evaluation.id } })).finalScore).toBe(4);
  });
  it('enforces shift capacity under concurrent assignment and handles a retry without duplication', async () => {
    actor.permissions.push('shifts.manage');
    const employees = await Promise.all([1, 2].map(i => db.employee.create({ data: { companyId: a, code: `CAP-${i}`, firstName: 'Synthetic', lastName: 'Capacity', hireDate: new Date() } })));
    const shift = await db.shift.create({ data: { companyId: a, code: 'CAP', name: 'Synthetic capacity', startTime: '08:00', endTime: '16:00', durationMinutes: 480, capacity: 1 } });
    const api = request(app.getHttpServer());
    const results = await Promise.all(employees.map(employee => api.post('/shifts/assignments/bulk').send({ assignments: [{ employeeId: employee.id, shiftId: shift.id, workDate: '2032-01-01' }] })));
    expect(results.map(r => r.status)).toEqual([201, 201]);
    expect(results.map(r => r.body.data.created).sort()).toEqual([0, 1]);
    const assigned = await db.shiftAssignment.findMany({ where: { shiftId: shift.id } });
    expect(assigned).toHaveLength(1);
    const retry = await api.post('/shifts/assignments/bulk').send({ assignments: [{ employeeId: assigned[0].employeeId, shiftId: shift.id, workDate: '2032-01-01' }] }).expect(201);
    expect(retry.body.data.results[0].status).toBe('DUPLICATE');
  });
  it('requires a current certificate and sufficient rest after an overnight shift', async () => {
    actor.permissions.push('shifts.manage');
    const employee = await db.employee.create({ data: { companyId: a, code: 'CERT', firstName: 'Synthetic', lastName: 'Rest', hireDate: new Date() } });
    const shift = await db.shift.create({ data: { companyId: a, code: 'NIGHT', name: 'Synthetic night', startTime: '22:00', endTime: '06:00', crossMidnight: true, durationMinutes: 480, restAfterMinutes: 600, requiredCertificate: 'Synthetic safety' } });
    const api = request(app.getHttpServer());
    const assign = (shiftId: string, workDate: string) => api.post('/shifts/assignments/bulk').send({ assignments: [{ employeeId: employee.id, shiftId, workDate }] });
    const missing = await assign(shift.id, '2032-01-01').expect(201);
    expect(missing.body.data.failed).toBe(1);
    await db.certificate.create({ data: { employeeId: employee.id, name: 'Synthetic safety', issueDate: new Date('2031-01-01'), expiryDate: new Date('2033-01-01') } });
    const valid = await assign(shift.id, '2032-01-01').expect(201);
    expect(valid.body.data.created).toBe(1);
    const noRest = await assign(records.shifts[0], '2032-01-02').expect(201);
    expect(noRest.body.data.failed).toBe(1);
    const withRest = await assign(records.shifts[0], '2032-01-03').expect(201);
    expect(withRest.body.data.created).toBe(1);
    expect(await db.shiftAssignment.count({ where: { employeeId: employee.id } })).toBe(2);
  });
  it('serializes onboarding creation and completion of separate checklist items', async () => {
    actor.permissions.push('lifecycle.manage');
    const employee = await db.employee.create({ data: { companyId: a, code: 'ONBOARD', firstName: 'Synthetic', lastName: 'Checklist', hireDate: new Date() } });
    const template = await db.onboardingChecklistTemplate.create({ data: { companyId: a, name: 'Synthetic concurrency', items: { create: [{ title: 'First' }, { title: 'Second' }] } } });
    const api = request(app.getHttpServer());
    const responses = await Promise.all([api.post('/lifecycle/onboarding').send({ employeeId: employee.id, templateId: template.id }), api.post('/lifecycle/onboarding').send({ employeeId: employee.id, templateId: template.id })]);
    expect(responses.map(r => r.status).sort()).toEqual([201, 400]);
    const checklist = await db.onboardingChecklist.findFirstOrThrow({ where: { employeeId: employee.id }, include: { items: true } });
    const updates = await Promise.all(checklist.items.map(item => api.patch(`/lifecycle/onboarding/items/${item.id}`).send({ status: 'DONE' })));
    expect(updates.map(r => r.status)).toEqual([200, 200]);
    expect((await db.onboardingChecklist.findUniqueOrThrow({ where: { id: checklist.id } })).status).toBe('COMPLETED');
  });
  it('does not grant the same active benefit twice under concurrent requests', async () => {
    actor.permissions.push('loans.create');
    const api = request(app.getHttpServer());
    const payload = { employeeId: employeeA, benefitTypeId: records['benefit-types'][0] };
    const results = await Promise.all([api.post('/loans/employee-benefits').send(payload), api.post('/loans/employee-benefits').send(payload)]);
    expect(results.map(r => r.status)).toEqual([201, 201]);
    expect(results.map(r => r.body.data.createdIds.length).sort()).toEqual([0, 1]);
    expect(await db.employeeBenefit.count({ where: { employeeId: employeeA, benefitTypeId: payload.benefitTypeId, status: 'ACTIVE' } })).toBe(1);
    await api.post('/loans/employee-benefits').send({ ...payload, packageId: records.packages[0] }).expect(400);
    await api.post('/loans/employee-benefits').send({ ...payload, startDate: '2032-01-03', endDate: '2032-01-01' }).expect(400);
  });
  it('preserves historical evaluation scores when attempting to replace used questions', async () => {
    actor.permissions.push('evaluations.manage');
    const score = await db.evaluationScore.create({ data: { evaluationId: records.evaluations[0], itemId: records['evaluation-items'][0], score: 4 } });
    await request(app.getHttpServer()).put(`/evaluations/forms/${records.forms[0]}/items`).send({ items: [{ title: 'Replacement', weight: 100 }] }).expect(400);
    expect(await db.evaluationScore.findUnique({ where: { id: score.id } })).not.toBeNull();
  });
  it('blocks approval payload spoofing and foreign instances even when assigned to the actor', async () => {
    actor.permissions.push('approvals.view', 'approvals.manage', 'approvals.decide');
    const api = request(app.getHttpServer());
    const flows = await api.get('/approvals/flows').expect(200);
    expect(flows.body.data.map((r: { id: string }) => r.id)).not.toContain(records['approval-flows'][1]);
    await api.get(`/approvals/flows/${records['approval-flows'][1]}`).expect(403);
    await api.patch(`/approvals/flows/${records['approval-flows'][1]}`).send({ name: 'Blocked' }).expect(403);
    await api.delete(`/approvals/flows/${records['approval-flows'][1]}`).expect(403);
    await api.post('/approvals/flows/seed-defaults').expect(403);
    const foreign = await db.approvalInstance.findUniqueOrThrow({ where: { id: records['approval-instances'][1] } });
    await api.get(`/approvals/instances/${foreign.id}`).expect(403);
    await api.post('/approvals/instances').send({ flowCode: 'FLOW-a', subjectType: 'LEAVE', subjectId: foreign.subjectId, payloadJson: { employeeId: employeeA } }).expect(403);
    await api.post(`/approvals/tasks/${records['approval-tasks'][1]}/decide`).send({ decision: 'APPROVE' }).expect(403);
    const inbox = await api.get('/approvals/inbox').expect(200);
    expect(inbox.body.data.map((r: { id: string }) => r.id)).not.toContain(records['approval-tasks'][1]);
    expect((await db.approvalTask.findUniqueOrThrow({ where: { id: records['approval-tasks'][1] } })).status).toBe('PENDING');
  });

  it('isolates leave types and policies in list, creation and mutation APIs', async () => {
    actor.permissions.push('leaves.view', 'leaves.manage.types');
    const api = request(app.getHttpServer());
    expect((await api.get('/leaves/types').query({ companyId: b }).expect(200)).body.data).toEqual([]);
    await api.post('/leaves/types').send({ companyId: b, code: 'CUSTOM', name: 'Blocked' }).expect(403);
    await api.patch(`/leaves/types/${records['leave-types'][1]}`).send({ name: 'Blocked' }).expect(403);
    await api.get(`/leaves/types/${records['leave-types'][1]}/policies`).expect(403);
    await api.post('/leaves/policies').send({ leaveTypeId: records['leave-types'][1], employmentType: 'PERMANENT' }).expect(403);
    expect((await db.leaveType.findUniqueOrThrow({ where: { id: records['leave-types'][1] } })).name).toBe('b');
  });
  it('rejects cross-company leave relations and foreign decisions without a write', async () => {
    actor.permissions.push('leaves.create', 'leaves.approve', 'leaves.manage.types');
    const api = request(app.getHttpServer());
    await api.post('/leaves/requests').send({ employeeId: employeeA, leaveTypeId: records['leave-types'][1], startAt: '2026-11-18T08:00:00Z', endAt: '2026-11-18T09:00:00Z' }).expect(400);
    await api.post('/leaves/transactions').send({ employeeId: employeeA, leaveTypeId: records['leave-types'][1], type: 'GRANT', minutes: 600 }).expect(400);
    const foreign = await db.leaveRequest.create({ data: { employeeId: employeeB, leaveTypeId: records['leave-types'][1], startAt: new Date('2026-11-18T08:00:00Z'), endAt: new Date('2026-11-18T09:00:00Z'), durationMinutes: 60, status: 'PENDING_HR' } });
    await api.post(`/leaves/requests/${foreign.id}/decide`).send({ decision: 'APPROVE' }).expect(403);
    expect((await db.leaveRequest.findUniqueOrThrow({ where: { id: foreign.id } })).status).toBe('PENDING_HR');
  });
  it('serializes concurrent overlapping leave requests and consumes the reservation only once', async () => {
    actor.permissions.push('leaves.view', 'leaves.create', 'leaves.approve');
    const api = request(app.getHttpServer());
    const payload = { employeeId: employeeA, leaveTypeId: records['leave-types'][0], startAt: '2026-11-19T08:00:00Z', endAt: '2026-11-19T09:00:00Z' };
    const responses = await Promise.all([api.post('/leaves/requests').send(payload), api.post('/leaves/requests').send(payload)]);
    expect(responses.map(r => r.status).sort()).toEqual([201, 400]);
    const id = responses.find(r => r.status === 201)!.body.data.id;
    expect(await db.leaveTransaction.count({ where: { sourceId: id, type: 'RESERVE' } })).toBe(1);
    const decisions = await Promise.all([api.post(`/leaves/requests/${id}/decide`).send({ decision: 'APPROVE' }), api.post(`/leaves/requests/${id}/decide`).send({ decision: 'APPROVE' })]);
    expect(decisions.map(r => r.status).sort()).toEqual([201, 400]);
    expect(await db.leaveTransaction.count({ where: { sourceId: id, type: 'CONSUME' } })).toBe(1);
    expect(await db.leaveTransaction.count({ where: { sourceId: id, type: 'RESERVE' } })).toBe(0);
    const balance = (await api.get('/leaves/balance').query({ employeeId: employeeA }).expect(200)).body.data;
    expect(balance.year).toBeLessThan(1600);
    expect(balance.balances.find((r: { leaveType: { id: string } }) => r.leaveType.id === records['leave-types'][0]).used).toBe(60);
  });
  it('does not allow an ordinary viewer to cancel another employees leave', async () => {
    actor.permissions.push('leaves.view');
    const row = await db.leaveRequest.create({ data: { employeeId: employeeA, leaveTypeId: records['leave-types'][0], startAt: new Date('2026-12-02T08:00:00Z'), endAt: new Date('2026-12-02T09:00:00Z'), durationMinutes: 60, status: 'PENDING_HR' } });
    await request(app.getHttpServer()).delete(`/leaves/requests/${row.id}`).expect(403);
    expect((await db.leaveRequest.findUniqueOrThrow({ where: { id: row.id } })).status).toBe('PENDING_HR');
  });
  it('keeps simultaneous device events for different employees and preserves single-event fields', async () => {
    const secret = randomBytes(32).toString('hex');
    const device = await db.attendanceDevice.update({ where: { id: records.devices[0] }, data: { secret: hashToken(secret) } });
    const other = await db.employee.create({ data: { companyId: a, code: 'EVENT', firstName: 'Synthetic', lastName: 'Events', hireDate: new Date() } });
    const api = request(app.getHttpServer());
    const eventTime = new Date().toISOString();
    const post = (employeeId: string) => api.post('/attendance/events').set('x-device-code', device.code).set('x-device-secret', secret).send({ employeeId, eventTime, type: 'IN', source: 'MANUAL', latitude: 35.7, locationName: 'Synthetic location' });
    const responses = await Promise.all([post(employeeA), post(other.id)]);
    expect(responses.map(r => r.status)).toEqual([201, 201]);
    expect(responses.map(r => r.body.data.ingested)).toEqual([1, 1]);
    const rows = await db.attendanceEvent.findMany({ where: { deviceId: device.id, eventTime: new Date(eventTime) } });
    expect(rows).toHaveLength(2);
    expect(rows.every(row => row.latitude === 35.7 && row.locationName === 'Synthetic location')).toBe(true);
    const retry = await post(employeeA).expect(201);
    expect(retry.body.data.results[0].status).toBe('DUPLICATE');
    const foreign = await post(employeeB).expect(201);
    expect(foreign.body.data.results[0].status).toBe('FORBIDDEN');
    expect(await db.attendanceEvent.count({ where: { employeeId: employeeB, deviceId: device.id } })).toBe(0);
  });
  it('makes clock-adjusted device retries stable and refuses changed payloads with the same key', async () => {
    const secret = randomBytes(32).toString('hex');
    const device = await db.attendanceDevice.update({ where: { id: records.devices[0] }, data: { secret: hashToken(secret) } });
    const api = request(app.getHttpServer());
    const key = randomUUID();
    const payload = { employeeId: employeeA, eventTime: '2000-01-01T08:00:00Z', type: 'IN', source: 'MANUAL', idempotencyKey: key };
    const post = (body: typeof payload) => api.post('/attendance/events').set('x-device-code', device.code).set('x-device-secret', secret).send(body);
    const results = await Promise.all([post(payload), post(payload)]);
    expect(results.map(r => r.body.data.results[0].status).sort()).toEqual(['CREATED', 'DUPLICATE']);
    const changed = await post({ ...payload, type: 'OUT' }).expect(201);
    expect(changed.body.data.results[0].status).toBe('CONFLICT');
  });
  it('filters leave types by the actual selected employees company', async () => {
    actor.permissions.push('leaves.view');
    const api = request(app.getHttpServer());
    const own = await api.get('/leaves/types').query({ employeeId: employeeA }).expect(200);
    expect(own.body.data.map((row: { id: string }) => row.id)).toContain(records['leave-types'][0]);
    await api.get('/leaves/types').query({ employeeId: employeeB }).expect(403);
    const contradictory = await api.get('/leaves/types').query({ employeeId: employeeA, companyId: b }).expect(200);
    expect(contradictory.body.data).toEqual([]);
  });
  it('recalculates an approved time correction and never overwrites corrected or locked records during compute', async () => {
    actor.permissions.push('attendance.create', 'attendance.approve');
    const employee = await db.employee.create({ data: { companyId: a, code: 'METRIC', firstName: 'Synthetic', lastName: 'Correction', hireDate: new Date() } });
    const day = new Date('2033-01-03');
    await db.shiftAssignment.create({ data: { employeeId: employee.id, shiftId: records.shifts[0], workDate: day } });
    const record = await db.attendanceRecord.create({ data: { employeeId: employee.id, workDate: day, firstIn: new Date('2033-01-03T04:30:00Z'), lastOut: new Date('2033-01-03T12:30:00Z'), workMinutes: 420, status: 'COMPLETE' } });
    const correction = await db.attendanceCorrection.create({ data: { employeeId: employee.id, attendanceRecordId: record.id, workDate: day, field: 'lastOut', newValue: '2033-01-03T13:30:00Z', reason: 'Synthetic time correction', requestedById: requesterId } });
    const api = request(app.getHttpServer());
    await api.post(`/attendance/corrections/${correction.id}/decide`).send({ decision: 'APPROVE' }).expect(201);
    const corrected = await db.attendanceRecord.findUniqueOrThrow({ where: { id: record.id } });
    expect(corrected.workMinutes).toBe(480);
    expect(corrected.earlyLeaveMinutes).toBe(0);
    const locked = await db.attendanceRecord.create({ data: { employeeId: employee.id, workDate: new Date('2033-01-04'), workMinutes: 777, status: 'COMPLETE', lockedAt: new Date() } });
    for (const date of ['2033-01-03', '2033-01-04']) {
      for (const type of ['IN', 'OUT'] as const) await db.attendanceEvent.create({ data: { employeeId: employee.id, eventTime: new Date(`${date}T${type === 'IN' ? '04' : '10'}:30:00Z`), type, source: 'MANUAL', idempotencyKey: randomUUID() } });
    }
    await api.post('/attendance/compute').send({ employeeIds: [employee.id], from: '2033-01-03', to: '2033-01-04' }).expect(201);
    expect((await db.attendanceRecord.findUniqueOrThrow({ where: { id: record.id } })).workMinutes).toBe(480);
    expect((await db.attendanceRecord.findUniqueOrThrow({ where: { id: locked.id } })).workMinutes).toBe(777);
  });
  it('isolates shift definitions and rejects foreign assignment and swap linkage', async () => {
    actor.permissions.push('shifts.view', 'shifts.manage', 'shifts.swap', 'shifts.approve');
    const api = request(app.getHttpServer());
    expect((await api.get('/shifts').query({ companyId: b }).expect(200)).body.data).toEqual([]);
    await api.get(`/shifts/${records.shifts[1]}`).expect(403);
    await api.patch(`/shifts/${records.shifts[1]}`).send({ name: 'Blocked' }).expect(403);
    await api.post('/shifts').send({ companyId: b, code: 'BLOCKED', name: 'Blocked', startTime: '08:00', endTime: '16:00' }).expect(403);
    const result = await api.post('/shifts/assignments/bulk').send({ assignments: [{ shiftId: records.shifts[1], employeeId: employeeA, workDate: '2026-11-16' }] }).expect(201);
    expect(result.body.data.failed).toBe(1);
    expect(await db.shiftAssignment.count({ where: { employeeId: employeeA, shiftId: records.shifts[1] } })).toBe(0);
    const source = await db.shiftAssignment.create({ data: { shiftId: records.shifts[0], employeeId: employeeA, workDate: new Date('2026-11-18') } });
    await api.post('/shifts/swaps').send({ sourceAssignmentId: source.id, toEmployeeId: employeeB, reason: 'Blocked' }).expect(403);
    const foreignSource = await db.shiftAssignment.create({ data: { shiftId: records.shifts[1], employeeId: employeeB, workDate: new Date('2026-11-18') } });
    const foreignSwap = await db.shiftSwapRequest.create({ data: { sourceAssignmentId: foreignSource.id, fromEmployeeId: employeeB, toEmployeeId: employeeA, reason: 'Legacy invalid request' } });
    await api.post(`/shifts/swaps/${foreignSwap.id}/decide`).send({ decision: 'APPROVE' }).expect(403);
    expect((await db.shiftSwapRequest.findUniqueOrThrow({ where: { id: foreignSwap.id } })).status).toBe('PENDING');
  });
  it('isolates lifecycle templates, onboarding relations and termination decisions', async () => {
    actor.permissions.push('lifecycle.view', 'lifecycle.manage');
    const api = request(app.getHttpServer());
    expect((await api.get('/lifecycle/templates').query({ companyId: b }).expect(200)).body.data).toEqual([]);
    await api.post('/lifecycle/templates').send({ companyId: b, name: 'Blocked', items: [] }).expect(403);
    await api.post('/lifecycle/onboarding').send({ employeeId: employeeA, templateId: records.templates[1] }).expect(403);
    const row = await db.terminationRequest.create({ data: { employeeId: employeeB, reason: 'Synthetic', terminationDate: new Date('2026-12-01'), status: 'REQUESTED' } });
    actor.permissions.push('lifecycle.approve');
    await api.post(`/lifecycle/terminations/${row.id}/decide`).send({ decision: 'APPROVE' }).expect(403);
    expect((await db.terminationRequest.findUniqueOrThrow({ where: { id: row.id } })).status).toBe('REQUESTED');
  });
  it('blocks protected administrator termination through the HR lifecycle alternate API', async () => {
    actor.permissions.push('lifecycle.manage');
    await db.user.update({ where: { id: userA }, data: { isSuperAdmin: true } });
    try {
      const api = request(app.getHttpServer());
      await api.post('/lifecycle/terminations').send({ employeeId: employeeA, reason: 'Blocked', terminationDate: '2026-12-01' }).expect(403);
      await api.post('/lifecycle/offboarding').send({ employeeId: employeeA, reason: 'Blocked', terminationDate: '2026-12-01' }).expect(403);
      expect((await db.employee.findUniqueOrThrow({ where: { id: employeeA } })).status).toBe('ACTIVE');
    } finally { await db.user.update({ where: { id: userA }, data: { isSuperAdmin: false } }); }
  });
  it('isolates custom fields and prevents scoped administrators changing global settings', async () => {
    actor.permissions.push('settings.view', 'settings.manage');
    const api = request(app.getHttpServer());
    expect((await api.get('/settings/custom-fields').query({ companyId: b }).expect(200)).body.data).toEqual([]);
    await api.post('/settings/custom-fields').send({ companyId: b, entity: 'EMPLOYEE', code: 'blocked', label: 'Blocked' }).expect(403);
    await api.delete(`/settings/custom-fields/${records['custom-fields'][1]}`).expect(403);
    await api.get('/settings').expect(403);
    await api.patch('/settings/insuranceRate').send({ value: '0' }).expect(403);
    actor.isSuperAdmin = true;
    await api.patch('/settings/insuranceRate').send({ value: { nested: 'invalid' } }).expect(400);
  });

  it.each(['companies', 'branches', 'work-locations', 'cost-centers', 'units', 'positions', 'calendars', 'tree'])('org/%s cannot expand tenant through query filters', async entity => {
    const response = await request(app.getHttpServer()).get(`/org/${entity}`).query({ companyId: b, search: 'b' }).expect(200);
    expect(response.body.data ?? response.body).toEqual([]);
  });
  it.each(['companies', 'branches', 'units', 'positions'])('org/%s options exclude the other company', async entity => {
    const response = await request(app.getHttpServer()).get(`/org/${entity}/options`).expect(200);
    const rows = response.body.data ?? response.body;
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(entity === 'companies' ? a : records[entity][0]);
  });
  it.each(['branches', 'work-locations', 'cost-centers', 'units', 'positions', 'calendars'])('blocks foreign org/%s detail, update and delete before a write', async entity => {
    const api = request(app.getHttpServer());
    await api.get(`/org/${entity}/${records[entity][1]}`).expect(403);
    await api.patch(`/org/${entity}/${records[entity][1]}`).send(entity === 'positions' ? { title: 'unauthorized' } : { name: 'unauthorized' }).expect(403);
    await api.delete(`/org/${entity}/${records[entity][1]}`).expect(403);
  });
  it('blocks creating a company and foreign branch without a global administrator', async () => {
    await request(app.getHttpServer()).post('/org/companies').send({ code: 'new', name: 'not allowed' }).expect(403);
    await request(app.getHttpServer()).post('/org/branches').send({ companyId: b, code: 'new', name: 'not allowed' }).expect(403);
  });
  it('validates organizational cross-company references', async () => {
    await request(app.getHttpServer()).post('/org/units').send({ companyId: a, code: 'mixed', name: 'mixed', branchId: records.branches[1] }).expect(400);
  });
  it('allows an authorized in-company edit and persists an audit entry', async () => {
    await request(app.getHttpServer()).patch(`/org/branches/${records.branches[0]}`).send({ name: 'Updated synthetic branch' }).expect(200);
    expect((await db.branch.findUniqueOrThrow({ where: { id: records.branches[0] } })).name).toBe('Updated synthetic branch');
    expect(await db.auditLog.count({ where: { userId: userA, entityId: records.branches[0], action: 'UPDATE' } })).toBe(1);
  });
  it('isolates holidays through their calendar relation', async () => {
    await request(app.getHttpServer()).post('/org/holidays').send({ calendarId: records.calendars[1], holidays: [{ date: '2026-11-16', name: 'Synthetic holiday' }] }).expect(403);
  });
  it.each(['correspondences', 'meetings', 'surveys', 'suggestions', 'confidential-reports'])('admin/%s applies tenant filtering to lists and updates', async entity => {
    const api = request(app.getHttpServer());
    const response = await api.get(`/admin/${entity}`).query({ companyId: b }).expect(200);
    expect(response.body.data).toEqual([]);
    const status = entity === 'surveys' ? 'OPEN' : entity === 'suggestions' ? 'REJECTED' : entity === 'confidential-reports' ? 'CLOSED' : 'CANCELLED';
    await api.patch(`/admin/${entity}/${records[entity][1]}`).send({ status }).expect(403);
  });
  it('requires the dedicated confidential-report permission, not admin.manage alone', async () => {
    actor.permissions = ['admin.manage'];
    await request(app.getHttpServer()).get('/admin/confidential-reports').expect(403);
  });
  it('rejects a cross-company meeting participant before creating the meeting', async () => {
    const before = await db.meeting.count();
    await request(app.getHttpServer()).post('/admin/meetings').send({ companyId: a, title: 'Mixed meeting', scheduledAt: '2026-11-16T08:00:00Z', participants: [{ employeeId: employeeB }] }).expect(403);
    expect(await db.meeting.count()).toBe(before);
  });
  it('isolates training reads and writes, including prerequisite linkage', async () => {
    const api = request(app.getHttpServer());
    expect((await api.get('/training/courses').query({ companyId: b }).expect(200)).body.data).toEqual([]);
    await api.get(`/training/courses/${records.courses[1]}`).expect(403);
    await api.patch(`/training/courses/${records.courses[1]}`).send({ title: 'unauthorized' }).expect(403);
    await api.put(`/training/courses/${records.courses[0]}/prerequisites`).send({ prerequisiteIds: [records.courses[1]] }).expect(400);
    await api.put(`/training/courses/${records.courses[0]}/prerequisites`).send({ prerequisiteIds: ['not-a-uuid'] }).expect(400);
    await api.post('/training/courses').send({ companyId: b, code: 'new', title: 'unauthorized' }).expect(403);
  });
  it('does not expose contract salary or private terms through ordinary contract viewing', async () => {
    const response = await request(app.getHttpServer()).get('/contracts').expect(200);
    expect(response.body.data).toHaveLength(1);
    const version = response.body.data[0].versions[0];
    expect(version.baseSalary).toBeNull();
    expect(version.housingAllowance).toBeNull();
    expect(version.terms).toBeNull();
    expect(version.changeReason).toBeNull();
    actor.permissions.push('employees.view.salary');
    const authorized = await request(app.getHttpServer()).get('/contracts').expect(200);
    expect(authorized.body.data[0].versions[0].baseSalary).toBe(987654);
  });
  it('export output omits private employee identifiers without the specific permission', async () => {
    const response = await request(app.getHttpServer()).post('/reports/run').send({ reportCode: 'employees.directory', format: 'csv' }).expect(201);
    expect(response.text).not.toContain('PRIVATE-TEST');
    expect(response.text).not.toContain('TEST-MOBILE');
    expect(response.text).toContain('Synthetic');
    actor.permissions.push('employees.view.sensitive');
    const authorized = await request(app.getHttpServer()).post('/reports/run').send({ reportCode: 'employees.directory', format: 'csv' }).expect(201);
    expect(authorized.text).toContain('PRIVATE-TEST-a');
    expect(authorized.text).not.toContain('PRIVATE-TEST-b');
  });
  it('reports.export does not bypass the underlying module permission', async () => {
    actor.permissions = ['reports.export'];
    await request(app.getHttpServer()).post('/reports/run').send({ reportCode: 'employees.directory', format: 'csv' }).expect(403);
  });
  it('validates Jalali report dates instead of silently defaulting to a Gregorian year', async () => {
    const api = request(app.getHttpServer());
    await api.post('/reports/run').send({ reportCode: 'attendance.monthly' }).expect(400);
    await api.post('/reports/run').send({ reportCode: 'attendance.monthly', year: 2026, month: 13 }).expect(400);
    await api.post('/reports/run').send({ reportCode: 'attendance.monthly', year: 1405, month: 8 }).expect(201);
  });

  it('isolates announcement reads, acknowledgements, targets and notification recipients', async () => {
    actor.permissions.push('announcements.view', 'announcements.manage');
    const api = request(app.getHttpServer());
    expect((await api.get('/announcements').query({ companyId: b }).expect(200)).body.data).toEqual([]);
    await api.get(`/announcements/${records.announcements[1]}`).expect(404);
    await api.post(`/announcements/${records.announcements[1]}/acknowledge`).expect(404);
    await api.post('/announcements').send({ companyId: b, title: 'Blocked', body: 'Synthetic content' }).expect(403);
    await api.post('/announcements').send({ companyId: a, title: 'Invalid audience', body: 'Synthetic content', targetType: 'BRANCH', targetId: records.branches[1] }).expect(400);
    await api.post('/announcements').send({ companyId: a, title: 'Tenant A only', body: 'Synthetic content' }).expect(201);
    expect(await db.notification.count({ where: { userId: userB, title: 'Tenant A only' } })).toBe(0);
  });
  it('persists notification reads, filters them correctly and denies another users notification', async () => {
    actor.permissions.push('notifications.view');
    const own = await db.notification.create({ data: { userId: userA, type: 'SYSTEM', title: 'FIXTURE-NOTIFICATION-A', status: 'SENT' } });
    const foreign = await db.notification.create({ data: { userId: userB, type: 'SYSTEM', title: 'FIXTURE-NOTIFICATION-B', status: 'SENT' } });
    const api = request(app.getHttpServer());
    expect((await api.get('/notifications').query({ isRead: 'false', search: 'FIXTURE-NOTIFICATION' }).expect(200)).body.data.map((row: { id: string }) => row.id)).toEqual([own.id]);
    await api.post(`/notifications/${foreign.id}/read`).expect(404);
    await api.post(`/notifications/${own.id}/read`).expect(201);
    const first = (await db.notification.findUniqueOrThrow({ where: { id: own.id } })).readAt;
    await api.post(`/notifications/${own.id}/read`).expect(201);
    expect((await db.notification.findUniqueOrThrow({ where: { id: own.id } })).readAt).toEqual(first);
    const result = await api.get('/notifications').query({ isRead: 'true', search: 'FIXTURE-NOTIFICATION' }).expect(200);
    expect(result.body.data).toHaveLength(1);
    expect(result.body.data[0].isRead).toBe(true);
    expect((await api.get('/notifications').query({ isRead: 'false', search: 'FIXTURE-NOTIFICATION' }).expect(200)).body.data).toEqual([]);
  });
  it('isolates attendance devices in every CRUD operation', async () => {
    actor.permissions.push('attendance.view', 'attendance.create', 'attendance.update');
    const api = request(app.getHttpServer());
    expect((await api.get('/attendance/devices').query({ companyId: b }).expect(200)).body.data).toEqual([]);
    await api.get(`/attendance/devices/${records.devices[1]}`).expect(403);
    await api.patch(`/attendance/devices/${records.devices[1]}`).send({ name: 'Blocked' }).expect(403);
    await api.delete(`/attendance/devices/${records.devices[1]}`).expect(403);
    await api.post('/attendance/devices').send({ companyId: b, code: 'BLOCKED', name: 'Blocked' }).expect(403);
  });
  it('validates corrections, applies approval atomically and rejects concurrent duplicate decisions', async () => {
    const api = request(app.getHttpServer());
    actor = { ...baseActor, id: requesterId, employeeId: employeeA };
    await api.post('/attendance/corrections').send({ employeeId: employeeB, workDate: '2026-11-16', field: 'firstIn', newValue: '2026-11-16T04:30:00Z', reason: 'Synthetic correction' }).expect(403);
    await api.post('/attendance/corrections').send({ employeeId: employeeA, workDate: '2026-11-16', field: 'firstIn', newValue: 'bad-time', reason: 'Synthetic correction' }).expect(400);
    const response = await api.post('/attendance/corrections').send({ employeeId: employeeA, workDate: '2026-11-16', field: 'firstIn', newValue: '2026-11-16T04:30:00Z', reason: 'Synthetic correction' }).expect(201);
    const id = response.body.id;
    actor = { ...baseActor, permissions: [...baseActor.permissions, 'attendance.approve'] };
    const outcomes = await Promise.all([api.post(`/attendance/corrections/${id}/decide`).send({ decision: 'APPROVE' }), api.post(`/attendance/corrections/${id}/decide`).send({ decision: 'APPROVE' })]);
    expect(outcomes.map(row => row.status).sort()).toEqual([201, 400]);
    const record = await db.attendanceRecord.findUniqueOrThrow({ where: { employeeId_workDate: { employeeId: employeeA, workDate: new Date('2026-11-16') } } });
    expect(record.firstIn?.toISOString()).toBe('2026-11-16T04:30:00.000Z');
    expect((await db.attendanceCorrection.findUniqueOrThrow({ where: { id } })).status).toBe('APPROVED');
    expect(await db.auditLog.count({ where: { entityId: id, action: 'APPROVE' } })).toBe(1);
  });
  it('never leaves a correction approved when its value cannot be applied', async () => {
    actor.permissions.push('attendance.approve');
    const invalid = await db.attendanceCorrection.create({ data: { employeeId: employeeA, workDate: new Date('2026-11-17'), field: 'firstIn', newValue: 'invalid-legacy-value', reason: 'Synthetic invalid legacy record', requestedById: requesterId } });
    await request(app.getHttpServer()).post(`/attendance/corrections/${invalid.id}/decide`).send({ decision: 'APPROVE' }).expect(400);
    expect((await db.attendanceCorrection.findUniqueOrThrow({ where: { id: invalid.id } })).status).toBe('PENDING');
  });

  it('never allows a tenant administrator to download the full database', async () => {
    actor.permissions.push('backup.manage');
    await request(app.getHttpServer()).get('/backup/history').expect(403);
    await request(app.getHttpServer()).post('/backup/run').expect(403);
  });
  it('creates and downloads an authenticated full PostgreSQL archive, not a JSON response', async () => {
    actor.isSuperAdmin = true;
    await db.user.update({ where: { id: userA }, data: { isSuperAdmin: true, passwordHash: await hashPassword(backupPassword) } });
    await db.userSession.create({ data: { id: randomUUID(), userId: userA } });
    const response = await request(app.getHttpServer()).post('/backup/run').expect(201);
    backupId = response.body.data.id;
    expect(response.body.data.fileName).toMatch(/\.pgdump\.enc$/);
    expect(response.body.data).not.toHaveProperty('location');
    const download = await request(app.getHttpServer()).get(`/backup/${backupId}/download`).expect(200);
    expect(download.headers['content-type']).toContain('application/octet-stream');
    expect(download.headers['content-disposition']).toContain('.pgdump.enc');
    expect(archiveChecksum(download.body)).toBe(response.body.data.checksum);
    expect(decryptArchive(download.body, backupKey).subarray(0, 5).toString()).toBe('PGDMP');
  }, 30000);
  it('restores into a separately configured empty database and invalidates copied sessions', async () => {
    actor.isSuperAdmin = true;
    const targetUrl = process.env.SANA_RESTORE_TEST_URL!;
    const confirmationDatabase = new URL(targetUrl).pathname.slice(1);
    const api = request(app.getHttpServer());
    await api.post('/backup/restore').send({ backupId, currentPassword: 'wrong', confirmationDatabase }).expect(403);
    const response = await api.post('/backup/restore').send({ backupId, currentPassword: backupPassword, confirmationDatabase }).expect(201);
    expect(response.body.data.safetyBackupId).toBeTruthy();
    const restored = new PrismaClient({ datasources: { db: { url: targetUrl } }, log: [] });
    try {
      expect(await restored.company.count({ where: { id: { in: [a, b] } } })).toBe(2);
      expect(await restored.employee.count({ where: { id: { in: [employeeA, employeeB] } } })).toBe(2);
      expect(await restored.contract.count({ where: { employeeId: { in: [employeeA, employeeB] } } })).toBe(2);
      expect(await restored.userSession.count({ where: { revokedAt: null } })).toBe(0);
      expect(await restored.$queryRaw`SELECT 1`).toBeTruthy();
    } finally { await restored.$disconnect(); }
    await api.post('/backup/restore').send({ backupId, currentPassword: backupPassword, confirmationDatabase }).expect(400);
  }, 60000);
  it('rejects a corrupted backup download instead of sending a success file', async () => {
    actor.isSuperAdmin = true;
    const row = await db.backupHistory.findUniqueOrThrow({ where: { id: backupId } });
    const file = path.join(backupDir, row.fileName);
    const bytes = await fs.readFile(file);
    bytes[bytes.length - 1] ^= 1;
    await fs.writeFile(file, bytes);
    await request(app.getHttpServer()).get(`/backup/${backupId}/download`).expect(400);
  });
});
