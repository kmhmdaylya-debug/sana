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
import { archiveChecksum, decryptArchive } from '../../backup/backup-archive';

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
  const records: Record<string, [string, string]> = {};
  const backupPassword = randomBytes(32).toString('hex');
  const backupKey = randomBytes(48).toString('hex');
  const backupDir = path.resolve(process.cwd(), 'tmp', `audit-backup-${randomUUID()}`);
  let backupId: string;
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
      };
      for (const [key, record] of Object.entries(entries)) (records[key] ??= ['', ''])[suffix === 'a' ? 0 : 1] = record.id;
      await db.contract.create({ data: { id: randomUUID(), employeeId, companyId, versions: { create: { version: 1, contractType: 'TEST', startDate: new Date(), effectiveDate: new Date(), baseSalary: BigInt(987654), housingAllowance: BigInt(50), foodAllowance: BigInt(40), childAllowance: BigInt(30), seniorityPay: BigInt(20), changeReason: 'PRIVATE-CONTRACT-REASON', terms: 'PRIVATE-CONTRACT-TERMS', createdById: userId } } } });
    }
    baseActor = { id: userA, username: 'test.a', fullName: 'Synthetic user', email: null, mobile: null, employeeId: null, isSuperAdmin: false, roleIds: [], roleCodes: [], permissions: ['org.view', 'org.manage', 'training.view', 'training.manage', 'admin.view', 'admin.manage', 'confidential-reports.manage', 'contracts.view', 'reports.view', 'reports.export', 'employees.view', 'attendance.view'], scope: { unrestricted: false, companyIds: [a], branchIds: [], orgUnitIds: [], employeeIds: [], ownEmployeeId: null } };
    actor = structuredClone(baseActor);
    const module = await Test.createTestingModule({
      controllers: [OrgController, TrainingController, AdminController, ContractsController, ReportsController, BackupController],
      providers: [OrgService, TrainingService, AdminService, ContractsService, ReportsService, BackupService, AccessService, AuditService, { provide: PrismaService, useValue: db }, { provide: ConfigService, useValue: new ConfigService({ app: { database: { url: databaseUrl }, backup: { encryptionKey: backupKey, dir: backupDir, pgDumpPath: process.env.PG_DUMP_PATH || 'pg_dump', pgRestorePath: process.env.PG_RESTORE_PATH || 'pg_restore', restoreDatabaseUrl: process.env.SANA_RESTORE_TEST_URL } } }) }, { provide: NotificationService, useValue: { notify: jest.fn(), notifyMany: jest.fn() } }],
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
      expect(await restored.company.count()).toBe(2);
      expect(await restored.employee.count()).toBe(2);
      expect(await restored.contract.count()).toBe(2);
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
