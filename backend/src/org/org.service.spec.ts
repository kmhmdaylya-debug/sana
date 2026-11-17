import { OrgService } from './org.service';
import { AccessService } from '../common/access/access.service';
import { AuditService } from '../common/audit/audit.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { NotFoundException, ConflictException, BadRequestException, ForbiddenException } from '@nestjs/common';

const actor = {
  id: 'actor-a',
  username: 'actor.a',
  fullName: 'Test Actor',
  email: 'actor@test.com',
  mobile: null,
  isSuperAdmin: false,
  employeeId: null,
  roleIds: [],
  roleCodes: [],
  permissions: ['org.view', 'org.manage'],
  scope: { unrestricted: false, companyIds: ['company-a'], branchIds: [], orgUnitIds: [], employeeIds: [], ownEmployeeId: null },
} as unknown as AuthenticatedUser;

const superAdmin = { ...actor, id: 'super-a', isSuperAdmin: true, scope: { ...actor.scope, unrestricted: true } } as unknown as AuthenticatedUser;

describe('OrgService', () => {
  let prisma: any;
  let access: any;
  let audit: any;
  let service: OrgService;

  beforeEach(() => {
    prisma = {
      company: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), create: jest.fn(), update: jest.fn(), findFirst: jest.fn() },
      branch: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), create: jest.fn(), update: jest.fn(), findFirst: jest.fn() },
      workLocation: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), create: jest.fn(), update: jest.fn(), findFirst: jest.fn() },
      costCenter: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), create: jest.fn(), update: jest.fn(), findFirst: jest.fn() },
      orgUnit: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), create: jest.fn(), update: jest.fn(), findFirst: jest.fn(), count: jest.fn().mockResolvedValue(0) },
      position: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), create: jest.fn(), update: jest.fn(), findFirst: jest.fn() },
      calendar: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), create: jest.fn(), update: jest.fn(), findFirst: jest.fn() },
      holiday: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), createMany: jest.fn(), delete: jest.fn(), findFirst: jest.fn() },
      $transaction: jest.fn(work => work(prisma)),
    };
    access = {
      assertCompanyAccess: jest.fn().mockResolvedValue(undefined),
      companyWhereFor: jest.fn().mockResolvedValue({}),
      allowedCompanyIds: jest.fn().mockResolvedValue(['company-a']),
      assertEmployeeRelations: jest.fn().mockResolvedValue(undefined),
    };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    service = new OrgService(prisma, audit, access);
  });

  describe('listCompanies', () => {
    it('returns paginated company list with super admin', async () => {
      prisma.company.count.mockResolvedValue(2);
      prisma.company.findMany.mockResolvedValue([{ id: 'c1', code: 'C1' }, { id: 'c2', code: 'C2' }]);
      const result = await service.listCompanies({ page: 1, limit: 10, skip: 0 } as any, superAdmin);
      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
    });

    it('applies search filter', async () => {
      prisma.company.count.mockResolvedValue(1);
      prisma.company.findMany.mockResolvedValue([{ id: 'c1', code: 'C1', name: 'Test Company' }]);
      await service.listCompanies({ page: 1, limit: 10, skip: 0, search: 'Test' } as any, actor);
      const where = prisma.company.findMany.mock.calls[0][0].where;
      expect(where.OR).toContainEqual({ name: { contains: 'Test', mode: 'insensitive' } });
    });

    it('filters by company code', async () => {
      await service.listCompanies({ page: 1, limit: 10, skip: 0, code: 'SANA' } as any, actor);
      const where = prisma.company.findMany.mock.calls[0][0].where;
      expect(where.code).toEqual({ contains: 'SANA', mode: 'insensitive' });
    });

    it('filters by isActive', async () => {
      await service.listCompanies({ page: 1, limit: 10, skip: 0, isActive: true } as any, actor);
      const where = prisma.company.findMany.mock.calls[0][0].where;
      expect(where.isActive).toBe(true);
    });
  });

  describe('companyOptions', () => {
    it('returns active companies only', async () => {
      prisma.company.findMany.mockResolvedValue([{ id: 'c1', code: 'C1', name: 'Company 1' }]);
      const result = await service.companyOptions(actor);
      expect(result).toHaveLength(1);
      expect(prisma.company.findMany.mock.calls[0][0].where.isActive).toBe(true);
    });
  });

  describe('getCompany', () => {
    it('returns company by id for authorized company', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'c1', code: 'C1', deletedAt: null });
      const result = await service.getCompany('c1', actor);
      expect(result.id).toBe('c1');
      expect(access.assertCompanyAccess).toHaveBeenCalledWith(actor, 'c1');
    });

    it('throws NotFoundException for deleted company', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'c1', code: 'C1', deletedAt: new Date() });
      await expect(service.getCompany('c1', actor)).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException for non-existent company', async () => {
      prisma.company.findUnique.mockResolvedValue(null);
      await expect(service.getCompany('c1', actor)).rejects.toThrow(NotFoundException);
    });
  });

  describe('createCompany', () => {
    it('creates company for super admin', async () => {
      prisma.company.findFirst.mockResolvedValue(null);
      prisma.company.create.mockResolvedValue({ id: 'c1', code: 'SANA', name: 'Sana Company' });
      const dto = { code: 'SANA', name: 'Sana Company', legalName: null, nationalId: null, registrationNo: null, address: null, phone: null, email: null, timezone: 'Asia/Tehran', currency: 'IRR', isHolding: false, isActive: true };
      const result = await service.createCompany(dto, superAdmin);
      expect(result.code).toBe('SANA');
      expect(prisma.company.create).toHaveBeenCalled();
      expect(audit.record).toHaveBeenCalled();
    });

    it('rejects non-super admin', async () => {
      await expect(service.createCompany({ code: 'SANA', name: 'Test' } as any, actor)).rejects.toThrow(ForbiddenException);
    });

    it('rejects duplicate company code', async () => {
      prisma.company.findFirst.mockResolvedValue({ id: 'c1', code: 'SANA', deletedAt: null });
      await expect(service.createCompany({ code: 'SANA', name: 'Test' } as any, superAdmin)).rejects.toThrow(ConflictException);
    });
  });

  describe('updateCompany', () => {
    it('updates company with audit trail', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'c1', code: 'C1', name: 'Old Name', deletedAt: null });
      prisma.company.findFirst.mockResolvedValue(null);
      prisma.company.update.mockResolvedValue({ id: 'c1', code: 'C1', name: 'New Name', isActive: true });
      const result = await service.updateCompany('c1', { name: 'New Name' } as any, superAdmin);
      expect(result.name).toBe('New Name');
      expect(audit.record).toHaveBeenCalled();
    });

    it('rejects duplicate code on update', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'c1', code: 'C1', name: 'Old Name', deletedAt: null });
      prisma.company.findFirst.mockResolvedValue({ id: 'c2', code: 'DUP', deletedAt: null });
      await expect(service.updateCompany('c1', { code: 'DUP' } as any, superAdmin)).rejects.toThrow(ConflictException);
    });
  });

  describe('deleteCompany', () => {
    it('soft deletes company', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'c1', code: 'C1', name: 'Test', deletedAt: null });
      prisma.company.update.mockResolvedValue({ id: 'c1', deletedAt: new Date() });
      const result = await service.deleteCompany('c1', superAdmin);
      expect(result.success).toBe(true);
      expect(prisma.company.update).toHaveBeenCalledWith({ where: { id: 'c1' }, data: { deletedAt: expect.any(Date), isActive: false } });
      expect(audit.record).toHaveBeenCalled();
    });
  });

  describe('createBranch', () => {
    it('creates branch for valid company', async () => {
      prisma.company.findFirst.mockResolvedValue({ id: 'company-a', deletedAt: null });
      prisma.branch.findFirst.mockResolvedValue(null);
      prisma.branch.create.mockResolvedValue({ id: 'b1', code: 'B1', name: 'Branch 1' });
      const result = await service.createBranch({ companyId: 'company-a', code: 'B1', name: 'Branch 1' } as any, superAdmin);
      expect(result.code).toBe('B1');
      expect(access.assertCompanyAccess).toHaveBeenCalledWith(superAdmin, 'company-a');
    });

    it('rejects duplicate branch code', async () => {
      prisma.company.findFirst.mockResolvedValue({ id: 'company-a', deletedAt: null });
      prisma.branch.findFirst.mockResolvedValue({ id: 'b1', code: 'B1', deletedAt: null });
      await expect(service.createBranch({ companyId: 'company-a', code: 'B1', name: 'Branch 1' } as any, superAdmin)).rejects.toThrow(ConflictException);
    });
  });

  describe('createOrgUnit', () => {
    it('creates org unit with parent validation', async () => {
      prisma.company.findFirst.mockResolvedValue({ id: 'company-a', deletedAt: null });
      prisma.orgUnit.findFirst.mockResolvedValue(null);
      prisma.orgUnit.findUnique.mockResolvedValue(null);
      prisma.orgUnit.create.mockResolvedValue({ id: 'u1', code: 'U1', name: 'Unit 1' });
      const result = await service.createOrgUnit({ companyId: 'company-a', code: 'U1', name: 'Unit 1' } as any, superAdmin);
      expect(result.code).toBe('U1');
    });

    it('detects parent cycle', async () => {
      prisma.company.findFirst.mockResolvedValue({ id: 'company-a', deletedAt: null });
      prisma.orgUnit.findFirst.mockResolvedValue(null);
      prisma.orgUnit.findUnique.mockResolvedValue(null);
      prisma.orgUnit.findMany.mockResolvedValue([{ id: 'u1', parentId: null }, { id: 'u2', parentId: 'u1' }]);
      await expect(service.createOrgUnit({ companyId: 'company-a', code: 'U1', name: 'Unit 1', parentId: 'u2' } as any, superAdmin)).rejects.toThrow(BadRequestException);
    });
  });

  describe('createPosition', () => {
    it('creates position with org unit validation', async () => {
      prisma.company.findFirst.mockResolvedValue({ id: 'company-a', deletedAt: null });
      prisma.position.findFirst.mockResolvedValue(null);
      prisma.orgUnit.findFirst.mockResolvedValue({ id: 'unit-a', companyId: 'company-a', deletedAt: null });
      prisma.position.create.mockResolvedValue({ id: 'p1', code: 'P1', title: 'Position 1' });
      const result = await service.createPosition({ companyId: 'company-a', orgUnitId: 'unit-a', code: 'P1', title: 'Position 1' } as any, superAdmin);
      expect(result.code).toBe('P1');
    });
  });

  describe('createCalendar', () => {
    it('creates calendar for company', async () => {
      prisma.company.findFirst.mockResolvedValue({ id: 'company-a', deletedAt: null });
      prisma.calendar.findFirst.mockResolvedValue(null);
      prisma.calendar.create.mockResolvedValue({ id: 'cal1', name: 'Calendar 1', companyId: 'company-a' });
      const result = await service.createCalendar({ companyId: 'company-a', name: 'Calendar 1' } as any, superAdmin);
      expect(result.name).toBe('Calendar 1');
    });

    it('rejects duplicate calendar name', async () => {
      prisma.company.findFirst.mockResolvedValue({ id: 'company-a', deletedAt: null });
      prisma.calendar.findFirst.mockResolvedValue({ id: 'cal1', name: 'Calendar 1', deletedAt: null });
      await expect(service.createCalendar({ companyId: 'company-a', name: 'Calendar 1' } as any, superAdmin)).rejects.toThrow(ConflictException);
    });
  });

  describe('bulkCreateHolidays', () => {
    it('creates holidays and skips duplicates', async () => {
      prisma.calendar.findUnique.mockResolvedValue({ id: 'cal1', companyId: 'company-a' });
      prisma.holiday.findMany.mockResolvedValue([]);
      prisma.holiday.createMany.mockResolvedValue({ count: 2 });
      prisma.holiday.findMany.mockResolvedValue([{ id: 'h1', date: new Date() }, { id: 'h2', date: new Date() }]);
      const result = await service.bulkCreateHolidays({ calendarId: 'cal1', holidays: [{ date: '2026-01-01', name: 'Holiday 1' }, { date: '2026-01-02', name: 'Holiday 2' }] } as any, superAdmin);
      expect(result.created).toBe(2);
    });

    it('throws NotFoundException for non-existent calendar', async () => {
      prisma.calendar.findUnique.mockResolvedValue(null);
      await expect(service.bulkCreateHolidays({ calendarId: 'cal1', holidays: [] } as any, superAdmin)).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteOrgUnit', () => {
    it('rejects org unit with children', async () => {
      prisma.orgUnit.findUnique.mockResolvedValue({ id: 'u1', code: 'U1', name: 'Unit 1', deletedAt: null });
      prisma.orgUnit.count.mockResolvedValue(1);
      await expect(service.deleteOrgUnit('u1', actor)).rejects.toThrow(BadRequestException);
    });

    it('soft deletes org unit without children', async () => {
      prisma.orgUnit.findUnique.mockResolvedValue({ id: 'u1', code: 'U1', name: 'Unit 1', deletedAt: null });
      prisma.orgUnit.count.mockResolvedValue(0);
      prisma.orgUnit.update.mockResolvedValue({ id: 'u1', deletedAt: new Date() });
      const result = await service.deleteOrgUnit('u1', actor);
      expect(result.success).toBe(true);
    });
  });

  describe('page helper', () => {
    it('calculates pagination correctly', () => {
      const result = (service as any).page([{ id: 1 }, { id: 2 }], 5, { page: 1, limit: 2, skip: 0 });
      expect(result.meta.total).toBe(5);
      expect(result.meta.totalPages).toBe(3);
      expect(result.meta.hasNext).toBe(true);
      expect(result.meta.hasPrev).toBe(false);
    });
  });
});