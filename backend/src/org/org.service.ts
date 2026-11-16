import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { AccessService } from '../common/access/access.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { AuditService } from '../common/audit/audit.service';
import {
  BranchQueryDto,
  BulkCreateHolidayDto,
  CalendarQueryDto,
  CompanyQueryDto,
  CostCenterQueryDto,
  CreateBranchDto,
  CreateCalendarDto,
  CreateCompanyDto,
  CreateCostCenterDto,
  CreateOrgUnitDto,
  CreatePositionDto,
  CreateWorkLocationDto,
  HolidayQueryDto,
  OrgTreeQueryDto,
  OrgUnitQueryDto,
  PositionQueryDto,
  UpdateBranchDto,
  UpdateCalendarDto,
  UpdateCompanyDto,
  UpdateCostCenterDto,
  UpdateOrgUnitDto,
  UpdatePositionDto,
  UpdateWorkLocationDto,
  WorkLocationQueryDto,
} from './dto/org.dto';

interface OrgListQuery {
  search?: string;
  page: number;
  limit: number;
  skip: number;
}

@Injectable()
export class OrgService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly access: AccessService,
  ) {}

  // =========================================================================
  // شرکت
  // =========================================================================

  async listCompanies(query: CompanyQueryDto, user: AuthenticatedUser) {
    const where: Prisma.CompanyWhereInput = {
      AND: [await this.companyFilter(user)],
      deletedAt: null,
      ...(query.code ? { code: { contains: query.code, mode: 'insensitive' } } : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { code: { contains: query.search, mode: 'insensitive' } },
              { legalName: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.company.count({ where }),
      this.prisma.company.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { name: 'asc' },
        include: { _count: { select: { branches: true, employees: true, orgUnits: true } } },
      }),
    ]);

    return this.page(rows, total, query);
  }

  /** فهرست سبک شرکت‌ها برای dropdown */
  async companyOptions(user: AuthenticatedUser) {
    const rows = await this.prisma.company.findMany({
      where: { deletedAt: null, isActive: true, AND: [await this.companyFilter(user)] },
      orderBy: { name: 'asc' },
      select: { id: true, code: true, name: true },
    });
    return rows;
  }

  async getCompany(id: string, user: AuthenticatedUser) {
    await this.access.assertCompanyAccess(user, id);
    const company = await this.prisma.company.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            branches: true,
            workLocations: true,
            costCenters: true,
            orgUnits: true,
            positions: true,
            employees: true,
            calendars: true,
          },
        },
      },
    });
    if (!company || company.deletedAt) throw new NotFoundException('شرکت موردنظر یافت نشد.');
    return company;
  }

  async createCompany(dto: CreateCompanyDto, user: AuthenticatedUser) {
    const actorId = user.id;
    if (!user.isSuperAdmin) throw new ForbiddenException('ایجاد شرکت فقط برای مدیر ارشد مجاز است.');
    const code = dto.code.trim();
    const duplicate = await this.prisma.company.findFirst({ where: { code, deletedAt: null } });
    if (duplicate) throw new ConflictException(`کد شرکت «${code}» قبلاً ثبت شده است.`);

    const company = await this.prisma.company.create({
      data: {
        code,
        name: dto.name.trim(),
        legalName: dto.legalName ?? null,
        nationalId: dto.nationalId ?? null,
        registrationNo: dto.registrationNo ?? null,
        address: dto.address ?? null,
        phone: dto.phone ?? null,
        email: dto.email ?? null,
        timezone: dto.timezone ?? 'Asia/Tehran',
        currency: dto.currency ?? 'IRR',
        isHolding: dto.isHolding ?? false,
        isActive: dto.isActive ?? true,
      },
    });

    await this.audit.record(actorId, {
      action: AuditAction.CREATE,
      entity: 'Company',
      entityId: company.id,
      after: { code: company.code, name: company.name },
    });

    return company;
  }

  async updateCompany(id: string, dto: UpdateCompanyDto, user: AuthenticatedUser) {
    const actorId = user.id;
    const company = await this.getCompany(id, user);

    if (dto.code && dto.code.trim() !== company.code) {
      const duplicate = await this.prisma.company.findFirst({
        where: { code: dto.code.trim(), deletedAt: null, NOT: { id } },
      });
      if (duplicate) throw new ConflictException(`کد شرکت «${dto.code.trim()}» قبلاً ثبت شده است.`);
    }

    const updated = await this.prisma.company.update({
      where: { id },
      data: {
        ...(dto.code !== undefined ? { code: dto.code.trim() } : {}),
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.legalName !== undefined ? { legalName: dto.legalName } : {}),
        ...(dto.nationalId !== undefined ? { nationalId: dto.nationalId } : {}),
        ...(dto.registrationNo !== undefined ? { registrationNo: dto.registrationNo } : {}),
        ...(dto.address !== undefined ? { address: dto.address } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.email !== undefined ? { email: dto.email } : {}),
        ...(dto.timezone !== undefined ? { timezone: dto.timezone } : {}),
        ...(dto.currency !== undefined ? { currency: dto.currency } : {}),
        ...(dto.isHolding !== undefined ? { isHolding: dto.isHolding } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });

    await this.audit.record(actorId, {
      action: AuditAction.UPDATE,
      entity: 'Company',
      entityId: id,
      before: { code: company.code, name: company.name, isActive: company.isActive },
      after: { code: updated.code, name: updated.name, isActive: updated.isActive },
    });

    return updated;
  }

  /** حذف منطقی شرکت */
  async deleteCompany(id: string, user: AuthenticatedUser) {
    const actorId = user.id;
    const company = await this.getCompany(id, user);
    await this.prisma.company.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
    await this.audit.record(actorId, {
      action: AuditAction.DELETE,
      entity: 'Company',
      entityId: id,
      before: { code: company.code, name: company.name },
    });
    return { success: true };
  }

  // =========================================================================
  // شعبه
  // =========================================================================

  async listBranches(query: BranchQueryDto, user: AuthenticatedUser) {
    const where: Prisma.BranchWhereInput = {
      AND: [await this.access.companyWhereFor(user)],
      deletedAt: null,
      ...(query.companyId ? { companyId: query.companyId } : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { code: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.branch.count({ where }),
      this.prisma.branch.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { name: 'asc' },
        include: { company: { select: { id: true, code: true, name: true } }, _count: { select: { employees: true } } },
      }),
    ]);

    return this.page(rows, total, query);
  }

  async branchOptions(user: AuthenticatedUser) {
    return this.prisma.branch.findMany({
      where: { deletedAt: null, isActive: true, AND: [await this.access.companyWhereFor(user)] },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        code: true,
        name: true,
        companyId: true,
        company: { select: { id: true, code: true, name: true } },
      },
    });
  }

  async getBranch(id: string, user: AuthenticatedUser) {
    const branch = await this.prisma.branch.findUnique({
      where: { id },
      include: {
        company: { select: { id: true, code: true, name: true } },
        _count: { select: { employees: true, orgUnits: true, workLocations: true } },
      },
    });
    if (!branch || branch.deletedAt) throw new NotFoundException('شعبه موردنظر یافت نشد.');
    await this.access.assertCompanyAccess(user, branch.companyId);
    return branch;
  }

  async createBranch(dto: CreateBranchDto, user: AuthenticatedUser) {
    const actorId = user.id;
    await this.ensureCompany(dto.companyId, user);
    const code = dto.code.trim();
    const duplicate = await this.prisma.branch.findFirst({
      where: { companyId: dto.companyId, code, deletedAt: null },
    });
    if (duplicate) {
      throw new ConflictException(`کد شعبه «${code}» در این شرکت قبلاً ثبت شده است.`);
    }

    const branch = await this.prisma.branch.create({
      data: {
        companyId: dto.companyId,
        code,
        name: dto.name.trim(),
        kind: dto.kind ?? 'BRANCH',
        timezone: dto.timezone ?? 'Asia/Tehran',
        address: dto.address ?? null,
        phone: dto.phone ?? null,
        isActive: dto.isActive ?? true,
      },
    });

    await this.audit.record(actorId, {
      action: AuditAction.CREATE,
      entity: 'Branch',
      entityId: branch.id,
      after: { code: branch.code, name: branch.name, companyId: branch.companyId },
    });

    return branch;
  }

  async updateBranch(id: string, dto: UpdateBranchDto, user: AuthenticatedUser) {
    const actorId = user.id;
    const branch = await this.getBranch(id, user);
    if ('companyId' in dto && dto.companyId && dto.companyId !== branch.companyId) throw new BadRequestException('انتقال رکورد سازمانی بین شرکت‌ها از این مسیر مجاز نیست.');

    if (dto.companyId && dto.companyId !== branch.companyId) await this.ensureCompany(dto.companyId, user);

    const targetCompanyId = dto.companyId ?? branch.companyId;
    if (dto.code && dto.code.trim() !== branch.code) {
      const duplicate = await this.prisma.branch.findFirst({
        where: { companyId: targetCompanyId, code: dto.code.trim(), deletedAt: null, NOT: { id } },
      });
      if (duplicate) {
        throw new ConflictException(`کد شعبه «${dto.code.trim()}» در این شرکت قبلاً ثبت شده است.`);
      }
    }

    const updated = await this.prisma.branch.update({
      where: { id },
      data: {
        ...(dto.companyId !== undefined ? { companyId: dto.companyId } : {}),
        ...(dto.code !== undefined ? { code: dto.code.trim() } : {}),
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.kind !== undefined ? { kind: dto.kind } : {}),
        ...(dto.timezone !== undefined ? { timezone: dto.timezone } : {}),
        ...(dto.address !== undefined ? { address: dto.address } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });

    await this.audit.record(actorId, {
      action: AuditAction.UPDATE,
      entity: 'Branch',
      entityId: id,
      before: { code: branch.code, name: branch.name, isActive: branch.isActive },
      after: { code: updated.code, name: updated.name, isActive: updated.isActive },
    });

    return updated;
  }

  async deleteBranch(id: string, user: AuthenticatedUser) {
    const actorId = user.id;
    const branch = await this.getBranch(id, user);
    await this.prisma.branch.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
    await this.audit.record(actorId, {
      action: AuditAction.DELETE,
      entity: 'Branch',
      entityId: id,
      before: { code: branch.code, name: branch.name },
    });
    return { success: true };
  }

  // =========================================================================
  // محل کار
  // =========================================================================

  async listWorkLocations(query: WorkLocationQueryDto, user: AuthenticatedUser) {
    const where: Prisma.WorkLocationWhereInput = {
      AND: [await this.access.companyWhereFor(user)],
      ...(query.companyId ? { companyId: query.companyId } : {}),
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { code: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.workLocation.count({ where }),
      this.prisma.workLocation.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { name: 'asc' },
        include: {
          company: { select: { id: true, code: true, name: true } },
          branch: { select: { id: true, code: true, name: true } },
          _count: { select: { employees: true } },
        },
      }),
    ]);

    return this.page(rows, total, query);
  }

  async getWorkLocation(id: string, user: AuthenticatedUser) {
    const row = await this.prisma.workLocation.findUnique({
      where: { id },
      include: {
        company: { select: { id: true, code: true, name: true } },
        branch: { select: { id: true, code: true, name: true } },
      },
    });
    if (!row) throw new NotFoundException('محل کار موردنظر یافت نشد.');
    await this.access.assertCompanyAccess(user, row.companyId);
    return row;
  }

  async createWorkLocation(dto: CreateWorkLocationDto, user: AuthenticatedUser) {
    const actorId = user.id;
    await this.ensureCompany(dto.companyId, user);
    if (dto.branchId) await this.ensureBranch(dto.branchId, dto.companyId);
    const code = dto.code.trim();
    const duplicate = await this.prisma.workLocation.findFirst({
      where: { companyId: dto.companyId, code },
    });
    if (duplicate) {
      throw new ConflictException(`کد محل کار «${code}» در این شرکت قبلاً ثبت شده است.`);
    }

    const row = await this.prisma.workLocation.create({
      data: {
        companyId: dto.companyId,
        branchId: dto.branchId ?? null,
        code,
        name: dto.name.trim(),
        address: dto.address ?? null,
        latitude: dto.latitude ?? null,
        longitude: dto.longitude ?? null,
        radiusMeters: dto.radiusMeters ?? 100,
        timezone: dto.timezone ?? 'Asia/Tehran',
        isActive: dto.isActive ?? true,
      },
    });

    await this.audit.record(actorId, {
      action: AuditAction.CREATE,
      entity: 'WorkLocation',
      entityId: row.id,
      after: { code: row.code, name: row.name, companyId: row.companyId },
    });

    return row;
  }

  async updateWorkLocation(id: string, dto: UpdateWorkLocationDto, user: AuthenticatedUser) {
    const actorId = user.id;
    const row = await this.getWorkLocation(id, user);
    if ('companyId' in dto && dto.companyId && dto.companyId !== row.companyId) throw new BadRequestException('انتقال رکورد سازمانی بین شرکت‌ها از این مسیر مجاز نیست.');
    if (dto.companyId) await this.ensureCompany(dto.companyId, user);
    if (dto.branchId) await this.ensureBranch(dto.branchId, dto.companyId ?? row.companyId);

    const targetCompanyId = dto.companyId ?? row.companyId;
    if (dto.code && dto.code.trim() !== row.code) {
      const duplicate = await this.prisma.workLocation.findFirst({
        where: { companyId: targetCompanyId, code: dto.code.trim(), NOT: { id } },
      });
      if (duplicate) {
        throw new ConflictException(`کد محل کار «${dto.code.trim()}» در این شرکت قبلاً ثبت شده است.`);
      }
    }

    const updated = await this.prisma.workLocation.update({
      where: { id },
      data: {
        ...(dto.companyId !== undefined ? { companyId: dto.companyId } : {}),
        ...(dto.branchId !== undefined ? { branchId: dto.branchId } : {}),
        ...(dto.code !== undefined ? { code: dto.code.trim() } : {}),
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.address !== undefined ? { address: dto.address } : {}),
        ...(dto.latitude !== undefined ? { latitude: dto.latitude } : {}),
        ...(dto.longitude !== undefined ? { longitude: dto.longitude } : {}),
        ...(dto.radiusMeters !== undefined ? { radiusMeters: dto.radiusMeters } : {}),
        ...(dto.timezone !== undefined ? { timezone: dto.timezone } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });

    await this.audit.record(actorId, {
      action: AuditAction.UPDATE,
      entity: 'WorkLocation',
      entityId: id,
      before: { code: row.code, name: row.name, isActive: row.isActive },
      after: { code: updated.code, name: updated.name, isActive: updated.isActive },
    });

    return updated;
  }

  async deleteWorkLocation(id: string, user: AuthenticatedUser) {
    const actorId = user.id;
    const row = await this.getWorkLocation(id, user);
    await this.prisma.workLocation.update({ where: { id }, data: { isActive: false } });
    await this.audit.record(actorId, {
      action: AuditAction.DELETE,
      entity: 'WorkLocation',
      entityId: id,
      before: { code: row.code, name: row.name },
    });
    return { success: true };
  }

  // =========================================================================
  // مرکز هزینه
  // =========================================================================

  async listCostCenters(query: CostCenterQueryDto, user: AuthenticatedUser) {
    const where: Prisma.CostCenterWhereInput = {
      AND: [await this.access.companyWhereFor(user)],
      ...(query.companyId ? { companyId: query.companyId } : {}),
      ...(query.parentId ? { parentId: query.parentId } : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { code: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.costCenter.count({ where }),
      this.prisma.costCenter.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { name: 'asc' },
        include: {
          company: { select: { id: true, code: true, name: true } },
          parent: { select: { id: true, code: true, name: true } },
          _count: { select: { employees: true, children: true } },
        },
      }),
    ]);

    return this.page(rows, total, query);
  }

  async getCostCenter(id: string, user: AuthenticatedUser) {
    const row = await this.prisma.costCenter.findUnique({
      where: { id },
      include: {
        company: { select: { id: true, code: true, name: true } },
        parent: { select: { id: true, code: true, name: true } },
        _count: { select: { employees: true, children: true } },
      },
    });
    if (!row) throw new NotFoundException('مرکز هزینه موردنظر یافت نشد.');
    await this.access.assertCompanyAccess(user, row.companyId);
    return row;
  }

  async createCostCenter(dto: CreateCostCenterDto, user: AuthenticatedUser) {
    const actorId = user.id;
    await this.ensureCompany(dto.companyId, user);
    const code = dto.code.trim();
    const duplicate = await this.prisma.costCenter.findFirst({
      where: { companyId: dto.companyId, code },
    });
    if (duplicate) {
      throw new ConflictException(`کد مرکز هزینه «${code}» در این شرکت قبلاً ثبت شده است.`);
    }
    if (dto.parentId) {
      const parent = await this.prisma.costCenter.findUnique({ where: { id: dto.parentId } });
      if (!parent) throw new NotFoundException('مرکز هزینه والد یافت نشد.');
      if (parent.companyId !== dto.companyId) {
        throw new BadRequestException('مرکز هزینه والد باید متعلق به همان شرکت باشد.');
      }
    }

    const row = await this.prisma.costCenter.create({
      data: {
        companyId: dto.companyId,
        parentId: dto.parentId ?? null,
        code,
        name: dto.name.trim(),
        isActive: dto.isActive ?? true,
      },
    });

    await this.audit.record(actorId, {
      action: AuditAction.CREATE,
      entity: 'CostCenter',
      entityId: row.id,
      after: { code: row.code, name: row.name, companyId: row.companyId },
    });

    return row;
  }

  async updateCostCenter(id: string, dto: UpdateCostCenterDto, user: AuthenticatedUser) {
    const actorId = user.id;
    const row = await this.getCostCenter(id, user);
    if ('companyId' in dto && dto.companyId && dto.companyId !== row.companyId) throw new BadRequestException('انتقال رکورد سازمانی بین شرکت‌ها از این مسیر مجاز نیست.');
    const targetCompanyId = dto.companyId ?? row.companyId;
    if (dto.companyId) await this.ensureCompany(dto.companyId, user);

    if (dto.code && dto.code.trim() !== row.code) {
      const duplicate = await this.prisma.costCenter.findFirst({
        where: { companyId: targetCompanyId, code: dto.code.trim(), NOT: { id } },
      });
      if (duplicate) {
        throw new ConflictException(`کد مرکز هزینه «${dto.code.trim()}» در این شرکت قبلاً ثبت شده است.`);
      }
    }

    if (dto.parentId) {
      if (dto.parentId === id) {
        throw new BadRequestException('مرکز هزینه نمی‌تواند والد خودش باشد.');
      }
      const parent = await this.prisma.costCenter.findUnique({ where: { id: dto.parentId } });
      if (!parent) throw new NotFoundException('مرکز هزینه والد یافت نشد.');
      if (parent.companyId !== targetCompanyId) {
        throw new BadRequestException('مرکز هزینه والد باید متعلق به همان شرکت باشد.');
      }
      const children = await this.prisma.costCenter.findMany({
        where: { parentId: id },
        select: { id: true },
      });
      if (children.some((c) => c.id === dto.parentId)) {
        throw new BadRequestException('انتخاب والد باعث ایجاد حلقه در ساختار مرکز هزینه می‌شود.');
      }
    }

    const updated = await this.prisma.costCenter.update({
      where: { id },
      data: {
        ...(dto.companyId !== undefined ? { companyId: dto.companyId } : {}),
        ...(dto.parentId !== undefined ? { parentId: dto.parentId } : {}),
        ...(dto.code !== undefined ? { code: dto.code.trim() } : {}),
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });

    await this.audit.record(actorId, {
      action: AuditAction.UPDATE,
      entity: 'CostCenter',
      entityId: id,
      before: { code: row.code, name: row.name, parentId: row.parentId },
      after: { code: updated.code, name: updated.name, parentId: updated.parentId },
    });

    return updated;
  }

  async deleteCostCenter(id: string, user: AuthenticatedUser) {
    const actorId = user.id;
    const row = await this.getCostCenter(id, user);
    await this.prisma.costCenter.update({ where: { id }, data: { isActive: false } });
    await this.audit.record(actorId, {
      action: AuditAction.DELETE,
      entity: 'CostCenter',
      entityId: id,
      before: { code: row.code, name: row.name },
    });
    return { success: true };
  }

  // =========================================================================
  // واحد سازمانی
  // =========================================================================

  async listOrgUnits(query: OrgUnitQueryDto, user: AuthenticatedUser) {
    const where: Prisma.OrgUnitWhereInput = {
      AND: [await this.access.companyWhereFor(user)],
      deletedAt: null,
      ...(query.companyId ? { companyId: query.companyId } : {}),
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.parentId ? { parentId: query.parentId } : {}),
      ...(query.managerId ? { managerId: query.managerId } : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { code: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.orgUnit.count({ where }),
      this.prisma.orgUnit.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { name: 'asc' },
        include: {
          company: { select: { id: true, code: true, name: true } },
          branch: { select: { id: true, code: true, name: true } },
          parent: { select: { id: true, code: true, name: true } },
          _count: { select: { employees: true, children: true, positions: true } },
        },
      }),
    ]);

    return this.page(rows, total, query);
  }

  /** فهرست سبک واحدهای سازمانی برای dropdown */
  async orgUnitOptions(user: AuthenticatedUser) {
    const rows = await this.prisma.orgUnit.findMany({
      where: { deletedAt: null, isActive: true, AND: [await this.access.companyWhereFor(user)] },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        code: true,
        name: true,
        companyId: true,
        branchId: true,
        company: { select: { id: true, code: true, name: true } },
        branch: { select: { id: true, code: true, name: true } },
      },
    });
    return rows;
  }

  /** درخت سازمانی — واحدها به‌صورت تودرتو */
  async orgTree(query: OrgTreeQueryDto, user: AuthenticatedUser) {
    const where: Prisma.OrgUnitWhereInput = {
      AND: [await this.access.companyWhereFor(user)],
      deletedAt: null,
      ...(query.companyId ? { companyId: query.companyId } : {}),
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.includeInactive ? {} : { isActive: true }),
    };

    const rows = await this.prisma.orgUnit.findMany({
      where,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        code: true,
        name: true,
        kind: true,
        parentId: true,
        companyId: true,
        branchId: true,
        managerId: true,
        isActive: true,
        company: { select: { id: true, code: true, name: true } },
        branch: { select: { id: true, code: true, name: true } },
        _count: { select: { employees: true } },
      },
    });

    const nodes = new Map<string, any>();
    for (const row of rows) {
      nodes.set(row.id, { ...row, children: [] });
    }

    const roots: any[] = [];
    for (const node of nodes.values()) {
      if (node.parentId && nodes.has(node.parentId)) {
        nodes.get(node.parentId).children.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  }

  async getOrgUnit(id: string, user: AuthenticatedUser) {
    const row = await this.prisma.orgUnit.findUnique({
      where: { id },
      include: {
        company: { select: { id: true, code: true, name: true } },
        branch: { select: { id: true, code: true, name: true } },
        parent: { select: { id: true, code: true, name: true } },
        _count: { select: { employees: true, children: true, positions: true } },
      },
    });
    if (!row || row.deletedAt) throw new NotFoundException('واحد سازمانی موردنظر یافت نشد.');
    await this.access.assertCompanyAccess(user, row.companyId);
    return row;
  }

  async createOrgUnit(dto: CreateOrgUnitDto, user: AuthenticatedUser) {
    const actorId = user.id;
    await this.ensureCompany(dto.companyId, user);
    await this.access.assertEmployeeRelations(dto.companyId, dto);
    const code = dto.code.trim();
    const duplicate = await this.prisma.orgUnit.findFirst({
      where: { companyId: dto.companyId, code, deletedAt: null },
    });
    if (duplicate) {
      throw new ConflictException(`کد واحد سازمانی «${code}» در این شرکت قبلاً ثبت شده است.`);
    }
    if (dto.parentId) await this.ensureParentUnit(dto.parentId, dto.companyId);

    const row = await this.prisma.orgUnit.create({
      data: {
        companyId: dto.companyId,
        branchId: dto.branchId ?? null,
        parentId: dto.parentId ?? null,
        code,
        name: dto.name.trim(),
        kind: dto.kind ?? 'UNIT',
        managerId: dto.managerId ?? null,
        isActive: dto.isActive ?? true,
      },
    });

    await this.audit.record(actorId, {
      action: AuditAction.CREATE,
      entity: 'OrgUnit',
      entityId: row.id,
      after: { code: row.code, name: row.name, companyId: row.companyId, parentId: row.parentId },
    });

    return row;
  }

  async updateOrgUnit(id: string, dto: UpdateOrgUnitDto, user: AuthenticatedUser) {
    const actorId = user.id;
    const row = await this.getOrgUnit(id, user);
    if ('companyId' in dto && dto.companyId && dto.companyId !== row.companyId) throw new BadRequestException('انتقال رکورد سازمانی بین شرکت‌ها از این مسیر مجاز نیست.');
    const targetCompanyId = dto.companyId ?? row.companyId;
    await this.access.assertEmployeeRelations(targetCompanyId, { branchId: dto.branchId ?? row.branchId, managerId: dto.managerId ?? row.managerId });
    if (dto.companyId) await this.ensureCompany(dto.companyId, user);

    if (dto.code && dto.code.trim() !== row.code) {
      const duplicate = await this.prisma.orgUnit.findFirst({
        where: { companyId: targetCompanyId, code: dto.code.trim(), deletedAt: null, NOT: { id } },
      });
      if (duplicate) {
        throw new ConflictException(`کد واحد سازمانی «${dto.code.trim()}» در این شرکت قبلاً ثبت شده است.`);
      }
    }

    if (dto.parentId !== undefined && dto.parentId !== null) {
      if (dto.parentId === id) {
        throw new BadRequestException('واحد سازمانی نمی‌تواند والد خودش باشد.');
      }
      await this.ensureParentUnit(dto.parentId, targetCompanyId);
      await this.assertNoCycle(id, dto.parentId);
    }

    const updated = await this.prisma.orgUnit.update({
      where: { id },
      data: {
        ...(dto.companyId !== undefined ? { companyId: dto.companyId } : {}),
        ...(dto.branchId !== undefined ? { branchId: dto.branchId } : {}),
        ...(dto.parentId !== undefined ? { parentId: dto.parentId } : {}),
        ...(dto.code !== undefined ? { code: dto.code.trim() } : {}),
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.kind !== undefined ? { kind: dto.kind } : {}),
        ...(dto.managerId !== undefined ? { managerId: dto.managerId } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });

    await this.audit.record(actorId, {
      action: AuditAction.UPDATE,
      entity: 'OrgUnit',
      entityId: id,
      before: { code: row.code, name: row.name, parentId: row.parentId, managerId: row.managerId },
      after: { code: updated.code, name: updated.name, parentId: updated.parentId, managerId: updated.managerId },
    });

    return updated;
  }

  async deleteOrgUnit(id: string, user: AuthenticatedUser) {
    const actorId = user.id;
    const row = await this.getOrgUnit(id, user);
    const children = await this.prisma.orgUnit.count({ where: { parentId: id, deletedAt: null } });
    if (children > 0) {
      throw new BadRequestException('این واحد سازمانی زیرمجموعه دارد و قابل حذف نیست.');
    }
    await this.prisma.orgUnit.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
    await this.audit.record(actorId, {
      action: AuditAction.DELETE,
      entity: 'OrgUnit',
      entityId: id,
      before: { code: row.code, name: row.name },
    });
    return { success: true };
  }

  // =========================================================================
  // سمت سازمانی
  // =========================================================================

  async listPositions(query: PositionQueryDto, user: AuthenticatedUser) {
    const where: Prisma.PositionWhereInput = {
      AND: [await this.access.companyWhereFor(user)],
      ...(query.companyId ? { companyId: query.companyId } : {}),
      ...(query.orgUnitId ? { orgUnitId: query.orgUnitId } : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { code: { contains: query.search, mode: 'insensitive' } },
              { grade: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.position.count({ where }),
      this.prisma.position.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { title: 'asc' },
        include: {
          company: { select: { id: true, code: true, name: true } },
          orgUnit: { select: { id: true, code: true, name: true } },
          _count: { select: { employees: true } },
        },
      }),
    ]);

    return this.page(rows, total, query);
  }

  /** فهرست سبک سمت‌ها برای dropdown */
  async positionOptions(user: AuthenticatedUser) {
    const rows = await this.prisma.position.findMany({
      where: { isActive: true, AND: [await this.access.companyWhereFor(user)] },
      orderBy: { title: 'asc' },
      select: {
        id: true,
        code: true,
        title: true,
        companyId: true,
        orgUnitId: true,
        company: { select: { id: true, code: true, name: true } },
        orgUnit: { select: { id: true, code: true, name: true } },
      },
    });
    return rows;
  }

  async getPosition(id: string, user: AuthenticatedUser) {
    const row = await this.prisma.position.findUnique({
      where: { id },
      include: {
        company: { select: { id: true, code: true, name: true } },
        orgUnit: { select: { id: true, code: true, name: true } },
        _count: { select: { employees: true } },
      },
    });
    if (!row) throw new NotFoundException('سمت سازمانی موردنظر یافت نشد.');
    await this.access.assertCompanyAccess(user, row.companyId);
    return row;
  }

  async createPosition(dto: CreatePositionDto, user: AuthenticatedUser) {
    const actorId = user.id;
    await this.ensureCompany(dto.companyId, user);
    const code = dto.code.trim();
    const duplicate = await this.prisma.position.findFirst({
      where: { companyId: dto.companyId, code },
    });
    if (duplicate) {
      throw new ConflictException(`کد سمت «${code}» در این شرکت قبلاً ثبت شده است.`);
    }
    if (dto.orgUnitId) await this.ensureParentUnit(dto.orgUnitId, dto.companyId);

    const row = await this.prisma.position.create({
      data: {
        companyId: dto.companyId,
        orgUnitId: dto.orgUnitId ?? null,
        code,
        title: dto.title.trim(),
        grade: dto.grade ?? null,
        description: dto.description ?? null,
        isActive: dto.isActive ?? true,
      },
    });

    await this.audit.record(actorId, {
      action: AuditAction.CREATE,
      entity: 'Position',
      entityId: row.id,
      after: { code: row.code, title: row.title, companyId: row.companyId },
    });

    return row;
  }

  async updatePosition(id: string, dto: UpdatePositionDto, user: AuthenticatedUser) {
    const actorId = user.id;
    const row = await this.getPosition(id, user);
    if ('companyId' in dto && dto.companyId && dto.companyId !== row.companyId) throw new BadRequestException('انتقال رکورد سازمانی بین شرکت‌ها از این مسیر مجاز نیست.');
    const targetCompanyId = dto.companyId ?? row.companyId;
    if (dto.companyId) await this.ensureCompany(dto.companyId, user);

    if (dto.code && dto.code.trim() !== row.code) {
      const duplicate = await this.prisma.position.findFirst({
        where: { companyId: targetCompanyId, code: dto.code.trim(), NOT: { id } },
      });
      if (duplicate) {
        throw new ConflictException(`کد سمت «${dto.code.trim()}» در این شرکت قبلاً ثبت شده است.`);
      }
    }
    if (dto.orgUnitId) await this.ensureParentUnit(dto.orgUnitId, targetCompanyId);

    const updated = await this.prisma.position.update({
      where: { id },
      data: {
        ...(dto.companyId !== undefined ? { companyId: dto.companyId } : {}),
        ...(dto.orgUnitId !== undefined ? { orgUnitId: dto.orgUnitId } : {}),
        ...(dto.code !== undefined ? { code: dto.code.trim() } : {}),
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.grade !== undefined ? { grade: dto.grade } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });

    await this.audit.record(actorId, {
      action: AuditAction.UPDATE,
      entity: 'Position',
      entityId: id,
      before: { code: row.code, title: row.title, grade: row.grade },
      after: { code: updated.code, title: updated.title, grade: updated.grade },
    });

    return updated;
  }

  async deletePosition(id: string, user: AuthenticatedUser) {
    const actorId = user.id;
    const row = await this.getPosition(id, user);
    await this.prisma.position.update({ where: { id }, data: { isActive: false } });
    await this.audit.record(actorId, {
      action: AuditAction.DELETE,
      entity: 'Position',
      entityId: id,
      before: { code: row.code, title: row.title },
    });
    return { success: true };
  }

  // =========================================================================
  // تقویم کاری
  // =========================================================================

  async listCalendars(query: CalendarQueryDto, user: AuthenticatedUser) {
    const where: Prisma.CalendarWhereInput = {
      AND: [await this.access.companyWhereFor(user)],
      ...(query.companyId ? { companyId: query.companyId } : {}),
      ...(query.search ? { name: { contains: query.search, mode: 'insensitive' } } : {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.calendar.count({ where }),
      this.prisma.calendar.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { name: 'asc' },
        include: {
          company: { select: { id: true, code: true, name: true } },
          _count: { select: { holidays: true } },
        },
      }),
    ]);

    return this.page(rows, total, query);
  }

  async getCalendar(id: string, user: AuthenticatedUser) {
    const row = await this.prisma.calendar.findUnique({
      where: { id },
      include: {
        company: { select: { id: true, code: true, name: true } },
        _count: { select: { holidays: true } },
      },
    });
    if (!row) throw new NotFoundException('تقویم کاری موردنظر یافت نشد.');
    await this.access.assertCompanyAccess(user, row.companyId);
    return row;
  }

  async createCalendar(dto: CreateCalendarDto, user: AuthenticatedUser) {
    const actorId = user.id;
    await this.ensureCompany(dto.companyId, user);
    const name = dto.name.trim();
    const duplicate = await this.prisma.calendar.findFirst({
      where: { companyId: dto.companyId, name },
    });
    if (duplicate) {
      throw new ConflictException(`تقویم «${name}» در این شرکت قبلاً ثبت شده است.`);
    }

    const row = await this.prisma.calendar.create({
      data: {
        companyId: dto.companyId,
        name,
        timezone: dto.timezone ?? 'Asia/Tehran',
        weekendDays: dto.weekendDays ?? '0,6',
      },
    });

    await this.audit.record(actorId, {
      action: AuditAction.CREATE,
      entity: 'Calendar',
      entityId: row.id,
      after: { name: row.name, companyId: row.companyId },
    });

    return row;
  }

  async updateCalendar(id: string, dto: UpdateCalendarDto, user: AuthenticatedUser) {
    const actorId = user.id;
    const row = await this.getCalendar(id, user);
    if ('companyId' in dto && dto.companyId && dto.companyId !== row.companyId) throw new BadRequestException('انتقال رکورد سازمانی بین شرکت‌ها از این مسیر مجاز نیست.');
    const targetCompanyId = dto.companyId ?? row.companyId;
    if (dto.companyId) await this.ensureCompany(dto.companyId, user);

    if (dto.name && dto.name.trim() !== row.name) {
      const duplicate = await this.prisma.calendar.findFirst({
        where: { companyId: targetCompanyId, name: dto.name.trim(), NOT: { id } },
      });
      if (duplicate) {
        throw new ConflictException(`تقویم «${dto.name.trim()}» در این شرکت قبلاً ثبت شده است.`);
      }
    }

    const updated = await this.prisma.calendar.update({
      where: { id },
      data: {
        ...(dto.companyId !== undefined ? { companyId: dto.companyId } : {}),
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.timezone !== undefined ? { timezone: dto.timezone } : {}),
        ...(dto.weekendDays !== undefined ? { weekendDays: dto.weekendDays } : {}),
      },
    });

    await this.audit.record(actorId, {
      action: AuditAction.UPDATE,
      entity: 'Calendar',
      entityId: id,
      before: { name: row.name, weekendDays: row.weekendDays },
      after: { name: updated.name, weekendDays: updated.weekendDays },
    });

    return updated;
  }

  async deleteCalendar(id: string, user: AuthenticatedUser) {
    const actorId = user.id;
    const row = await this.getCalendar(id, user);
    await this.prisma.calendar.delete({ where: { id } });
    await this.audit.record(actorId, {
      action: AuditAction.DELETE,
      entity: 'Calendar',
      entityId: id,
      before: { name: row.name },
    });
    return { success: true };
  }

  // =========================================================================
  // تعطیلات
  // =========================================================================

  async listHolidays(query: HolidayQueryDto, user: AuthenticatedUser) {
    const where: Prisma.HolidayWhereInput = {
      AND: [{ calendar: await this.access.companyWhereFor(user) }],
      ...(query.calendarId ? { calendarId: query.calendarId } : {}),
      ...(query.from || query.to
        ? {
            date: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
      ...(query.search ? { name: { contains: query.search, mode: 'insensitive' } } : {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.holiday.count({ where }),
      this.prisma.holiday.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { date: 'asc' },
        include: { calendar: { select: { id: true, name: true, companyId: true } } },
      }),
    ]);

    return this.page(rows, total, query);
  }

  /** ثبت گروهی تعطیلات */
  async bulkCreateHolidays(dto: BulkCreateHolidayDto, user: AuthenticatedUser) {
    const actorId = user.id;
    const calendar = await this.prisma.calendar.findUnique({ where: { id: dto.calendarId } });
    if (!calendar) throw new NotFoundException('تقویم کاری موردنظر یافت نشد.');
    await this.access.assertCompanyAccess(user, calendar.companyId);

    const existing = await this.prisma.holiday.findMany({
      where: { calendarId: dto.calendarId },
      select: { date: true },
    });
    const existingKeys = new Set(existing.map((h) => this.dateKey(h.date)));

    const toCreate: Prisma.HolidayCreateManyInput[] = [];
    const skipped: { date: string; name: string }[] = [];

    for (const item of dto.holidays) {
      const date = new Date(item.date);
      const key = this.dateKey(date);
      if (existingKeys.has(key)) {
        skipped.push({ date: item.date, name: item.name });
        continue;
      }
      existingKeys.add(key);
      toCreate.push({
        calendarId: dto.calendarId,
        date,
        name: item.name.trim(),
        isOfficial: item.isOfficial ?? true,
      });
    }

    if (toCreate.length) {
      await this.prisma.holiday.createMany({ data: toCreate });
    }

    await this.audit.record(actorId, {
      action: AuditAction.CREATE,
      entity: 'Holiday',
      entityId: dto.calendarId,
      after: { created: toCreate.length, skipped: skipped.length, calendar: calendar.name },
    });

    return {
      created: toCreate.length,
      skipped: skipped.length,
      data: toCreate.length ? await this.prisma.holiday.findMany({ where: { calendarId: dto.calendarId }, orderBy: { date: 'asc' } }) : [],
    };
  }

  async deleteHoliday(id: string, user: AuthenticatedUser) {
    const actorId = user.id;
    const holiday = await this.prisma.holiday.findUnique({ where: { id } });
    if (!holiday) throw new NotFoundException('تعطیلی موردنظر یافت نشد.');
    await this.getCalendar(holiday.calendarId, user);
    await this.prisma.holiday.delete({ where: { id } });
    await this.audit.record(actorId, {
      action: AuditAction.DELETE,
      entity: 'Holiday',
      entityId: id,
      before: { name: holiday.name, date: holiday.date },
    });
    return { success: true };
  }

  // =========================================================================
  // کمکی‌ها
  // =========================================================================

  private async companyFilter(user: AuthenticatedUser): Promise<Prisma.CompanyWhereInput> {
    const ids = await this.access.allowedCompanyIds(user);
    return ids === null ? {} : { id: { in: ids } };
  }

  private async ensureCompany(companyId: string, user: AuthenticatedUser) {
    await this.access.assertCompanyAccess(user, companyId);
    const company = await this.prisma.company.findFirst({
      where: { id: companyId, deletedAt: null },
      select: { id: true },
    });
    if (!company) throw new NotFoundException('شرکت موردنظر یافت نشد.');
  }

  private async ensureBranch(branchId: string, companyId: string) {
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, deletedAt: null },
      select: { id: true, companyId: true },
    });
    if (!branch) throw new NotFoundException('شعبه موردنظر یافت نشد.');
    if (branch.companyId !== companyId) {
      throw new BadRequestException('شعبه انتخاب‌شده متعلق به این شرکت نیست.');
    }
  }

  private async ensureParentUnit(parentId: string, companyId: string) {
    const parent = await this.prisma.orgUnit.findFirst({
      where: { id: parentId, deletedAt: null },
      select: { id: true, companyId: true },
    });
    if (!parent) throw new NotFoundException('واحد سازمانی والد یافت نشد.');
    if (parent.companyId !== companyId) {
      throw new BadRequestException('واحد سازمانی والد باید متعلق به همان شرکت باشد.');
    }
  }

  /** جلوگیری از ایجاد حلقه در درخت واحدهای سازمانی */
  private async assertNoCycle(unitId: string, newParentId: string) {
    const units = await this.prisma.orgUnit.findMany({
      where: { deletedAt: null },
      select: { id: true, parentId: true },
    });
    const parentMap = new Map(units.map((u) => [u.id, u.parentId]));

    let cursor: string | null = newParentId;
    const visited = new Set<string>();
    while (cursor) {
      if (cursor === unitId) {
        throw new BadRequestException(
          'انتخاب والد باعث ایجاد حلقه در ساختار واحد سازمانی می‌شود.',
        );
      }
      if (visited.has(cursor)) break;
      visited.add(cursor);
      cursor = parentMap.get(cursor) ?? null;
    }
  }

  private dateKey(date: Date): string {
    return new Date(date).toISOString().slice(0, 10);
  }

  private page(rows: unknown[], total: number, query: OrgListQuery) {
    return {
      data: rows,
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
        hasNext: query.page * query.limit < total,
        hasPrev: query.page > 1,
      },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }
}
