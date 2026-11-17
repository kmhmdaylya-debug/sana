import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { AccessService } from '../common/access/access.service';
import { AuditService } from '../common/audit/audit.service';
import { NotificationService } from '../common/notifications/notification.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { PERMISSIONS } from '../common/constants/permissions';
import { PaginationDto } from '../common/dto/pagination.dto';
import { employeeVisibility, privateEmployee } from './employee-privacy';
import {
  CreateBankAccountDto,
  CreateEmployeeDto,
  CreateDependentDto,
  CreateEmploymentEventDto,
  CreateSkillDto,
  EmployeeQueryDto,
  UpdateEmployeeDto,
} from './dto/employees.dto';

const EMPLOYEE_SUMMARY = {
  id: true,
  code: true,
  firstName: true,
  lastName: true,
  status: true,
  orgUnit: { select: { id: true, name: true } },
  position: { select: { id: true, title: true } },
} as const;

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationService,
  ) {}

  /** فهرست نیروها با فیلتر و محدوده دسترسی ABAC */
  async list(query: EmployeeQueryDto, pagination: PaginationDto, user: AuthenticatedUser) {
    const where: Prisma.EmployeeWhereInput = {
      AND: [this.access.employeeWhereFor(user)],
      ...(query.companyId ? { companyId: query.companyId } : {}),
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.orgUnitId ? { orgUnitId: query.orgUnitId } : {}),
      ...(query.positionId ? { positionId: query.positionId } : {}),
      ...(query.managerId ? { managerId: query.managerId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.employmentType ? { employmentType: query.employmentType } : {}),
      ...(query.hasUser !== undefined ? { userId: query.hasUser ? { not: null } : null } : {}),
      ...(!query.includeDeleted ? { deletedAt: null } : {}),
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search, mode: 'insensitive' } },
              { firstName: { contains: query.search } },
              { lastName: { contains: query.search } },
              ...(employeeVisibility(user).personal ? [{ nationalId: { contains: query.search } }, { mobile: { contains: query.search } }] : []),
            ],
          }
        : {}),
    };

    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const [total, rows] = await Promise.all([
      this.prisma.employee.count({ where }),
      this.prisma.employee.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { code: 'asc' },
        select: {
          ...EMPLOYEE_SUMMARY,
          companyId: true,
          branchId: true,
          orgUnitId: true,
          positionId: true,
          managerId: true,
          employmentType: true,
          hireDate: true,
          version: true,
          ...(employeeVisibility(user).personal ? { nationalId: true, mobile: true, email: true } : {}),
          company: { select: { id: true, code: true, name: true } },
          branch: { select: { id: true, name: true } },
          orgUnit: { select: { id: true, name: true } },
          position: { select: { id: true, title: true } },
          manager: { select: { id: true, code: true, firstName: true, lastName: true } },
          user: { select: { id: true, username: true, status: true } },
          _count: { select: { contracts: true, documents: true } },
        },
      }),
    ]);

    return {
      data: rows,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  /** جزئیات نیرو — فیلدهای حساس فقط با مجوز ویژه */
  async get(id: string, user: AuthenticatedUser) {
    const employee = await this.prisma.employee.findFirst({
      where: { id, AND: [this.access.employeeWhereFor(user)] },
      include: {
        company: { select: { id: true, code: true, name: true } },
        branch: { select: { id: true, name: true } },
        workLocation: { select: { id: true, name: true } },
        costCenter: { select: { id: true, name: true } },
        orgUnit: { select: { id: true, name: true } },
        position: { select: { id: true, title: true, grade: true } },
        manager: { select: { id: true, code: true, firstName: true, lastName: true } },
        directReports: { select: { id: true, code: true, firstName: true, lastName: true } },
        user: { select: { id: true, username: true, status: true } },
        positionsHistory: {
          orderBy: { startDate: 'desc' },
          include: {
            position: { select: { id: true, title: true } },
            orgUnit: { select: { id: true, name: true } },
          },
        },
        dependents: true,
        skills: true,
        bankAccounts: true,
        employmentEvents: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!employee) throw new NotFoundException('نیروی موردنظر یافت نشد یا به حوزه دسترسی شما تعلق ندارد.');

    const visibility = employeeVisibility(user,id);
    const canViewSensitive = visibility.personal || visibility.bank || visibility.salary;
    await this.audit.record(user.id, {
      action: AuditAction.VIEW_SENSITIVE,
      entity: 'Employee',
      entityId: id,
      note: canViewSensitive ? 'مشاهده پرونده پرسنلی (شامل داده حساس)' : 'مشاهده پرونده پرسنلی',
    });

    return {
      data: privateEmployee({
        ...employee,
        monthlyBaseSalary: visibility.salary ? Number(employee.monthlyBaseSalary) : null,
      },user),
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  /** ایجاد نیرو + ثبت سابقه سمت */
  async create(dto: CreateEmployeeDto, user: AuthenticatedUser) {
    await this.access.assertCompanyAccess(user,dto.companyId);
    await this.access.assertEmployeeRelations(dto.companyId,dto);
    const duplicate = await this.prisma.employee.findUnique({
      where: { companyId_code: { companyId: dto.companyId, code: dto.code.trim() } },
    });
    if (duplicate) throw new BadRequestException(`کد پرسنلی «${dto.code}» در این شرکت قبلاً ثبت شده است.`);

    if (dto.nationalId) {
      const dupNational = await this.prisma.employee.findFirst({
        where: { nationalId: dto.nationalId, deletedAt: null },
      });
      if (dupNational) throw new BadRequestException('کد ملی قبلاً برای نیروی دیگری ثبت شده است.');
    }

    const employee = await this.prisma.employee.create({
      data: {
        companyId: dto.companyId,
        branchId: dto.branchId ?? null,
        workLocationId: dto.workLocationId ?? null,
        costCenterId: dto.costCenterId ?? null,
        orgUnitId: dto.orgUnitId ?? null,
        positionId: dto.positionId ?? null,
        managerId: dto.managerId ?? null,
        userId: dto.userId ?? null,
        code: dto.code.trim(),
        nationalId: dto.nationalId ?? null,
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        fatherName: dto.fatherName ?? null,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : null,
        birthPlace: dto.birthPlace ?? null,
        gender: dto.gender ?? null,
        maritalStatus: dto.maritalStatus ?? null,
        mobile: dto.mobile ?? null,
        email: dto.email ?? null,
        address: dto.address ?? null,
        emergencyName: dto.emergencyName ?? null,
        emergencyPhone: dto.emergencyPhone ?? null,
        employmentType: dto.employmentType,
        hireDate: new Date(dto.hireDate),
        monthlyBaseSalary: BigInt(dto.monthlyBaseSalary ?? 0),
        isContractor: dto.isContractor ?? false,
      },
    });

    await this.prisma.employeePosition.create({
      data: {
        employeeId: employee.id,
        companyId: employee.companyId,
        positionId: employee.positionId,
        orgUnitId: employee.orgUnitId,
        managerId: employee.managerId,
        startDate: employee.hireDate,
        changeType: 'HIRE',
      },
    });

    await this.audit.record(user.id, {
      action: AuditAction.CREATE,
      entity: 'Employee',
      entityId: employee.id,
      after: { code: employee.code, name: `${employee.firstName} ${employee.lastName}` },
    });

    return {
      data: { id: employee.id, code: employee.code },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  /** ویرایش نیرو + ثبت سابقه در تغییر سمت/واحد */
  async update(id: string, dto: UpdateEmployeeDto, user: AuthenticatedUser) {
    const employee = await this.prisma.employee.findFirst({
      where: { id, AND: [this.access.employeeWhereFor(user)] },
    });
    if (!employee) throw new NotFoundException('نیروی موردنظر یافت نشد یا به حوزه دسترسی شما تعلق ندارد.');
    await this.access.assertEmployeeRelations(employee.companyId,dto);
    await this.access.assertEmployeeMutable(user, id);
    if (dto.userId !== undefined && !user.isSuperAdmin) throw new ForbiddenException('اتصال حساب ورود از بخش مدیریت کاربران انجام می‌شود.');

    const data: Prisma.EmployeeUpdateInput = {};
    if (dto.branchId !== undefined) data.branch = dto.branchId ? { connect: { id: dto.branchId } } : { disconnect: true };
    if (dto.workLocationId !== undefined) data.workLocation = dto.workLocationId ? { connect: { id: dto.workLocationId } } : { disconnect: true };
    if (dto.costCenterId !== undefined) data.costCenter = dto.costCenterId ? { connect: { id: dto.costCenterId } } : { disconnect: true };
    if (dto.orgUnitId !== undefined) data.orgUnit = dto.orgUnitId ? { connect: { id: dto.orgUnitId } } : { disconnect: true };
    if (dto.positionId !== undefined) data.position = dto.positionId ? { connect: { id: dto.positionId } } : { disconnect: true };
    if (dto.managerId !== undefined) data.manager = dto.managerId ? { connect: { id: dto.managerId } } : { disconnect: true };
    if (dto.userId !== undefined) data.user = dto.userId ? { connect: { id: dto.userId } } : { disconnect: true };
    if (dto.firstName !== undefined) data.firstName = dto.firstName.trim();
    if (dto.lastName !== undefined) data.lastName = dto.lastName.trim();
    if (dto.nationalId !== undefined) data.nationalId = dto.nationalId;
    if (dto.fatherName !== undefined) data.fatherName = dto.fatherName;
    if (dto.birthDate !== undefined) data.birthDate = dto.birthDate ? new Date(dto.birthDate) : null;
    if (dto.birthPlace !== undefined) data.birthPlace = dto.birthPlace;
    if (dto.gender !== undefined) data.gender = dto.gender;
    if (dto.maritalStatus !== undefined) data.maritalStatus = dto.maritalStatus;
    if (dto.mobile !== undefined) data.mobile = dto.mobile;
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.address !== undefined) data.address = dto.address;
    if (dto.emergencyName !== undefined) data.emergencyName = dto.emergencyName;
    if (dto.emergencyPhone !== undefined) data.emergencyPhone = dto.emergencyPhone;
    if (dto.employmentType !== undefined) data.employmentType = dto.employmentType;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.terminationDate !== undefined) data.terminationDate = dto.terminationDate ? new Date(dto.terminationDate) : null;
    if (dto.monthlyBaseSalary !== undefined) data.monthlyBaseSalary = BigInt(dto.monthlyBaseSalary);
    if (dto.photoUrl !== undefined) data.photoUrl = dto.photoUrl;

    const positionChanged = (dto.positionId !== undefined && dto.positionId !== employee.positionId)
      || (dto.orgUnitId !== undefined && dto.orgUnitId !== employee.orgUnitId)
      || (dto.managerId !== undefined && dto.managerId !== employee.managerId);

    const [updated] = await this.prisma.$transaction([
      this.prisma.employee.update({
        where: { id },
        data: { ...data, version: { increment: 1 } },
        include: { position: true, orgUnit: true },
      }),
      ...(positionChanged
        ? [
            this.prisma.employeePosition.updateMany({
              where: { employeeId: id, endDate: null },
              data: { endDate: new Date() },
            }),
            this.prisma.employeePosition.create({
              data: {
                employeeId: id,
                companyId: employee.companyId,
                positionId: dto.positionId ?? employee.positionId,
                orgUnitId: dto.orgUnitId ?? employee.orgUnitId,
                managerId: dto.managerId ?? employee.managerId,
                startDate: new Date(),
                changeType: dto.positionId ? 'TRANSFER' : 'UPDATE',
                note: 'به‌روزرسانی مشخصات سازمانی',
              },
            }),
          ]
        : []),
    ]);

    await this.audit.record(user.id, {
      action: AuditAction.UPDATE,
      entity: 'Employee',
      entityId: id,
      before: { status: employee.status, positionId: employee.positionId },
      after: { status: dto.status ?? undefined, positionId: dto.positionId ?? undefined },
    });

    return {
      data: { id: updated.id, version: updated.version },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  /** حذف منطقی نیرو */
  async remove(id: string, reason: string | undefined, user: AuthenticatedUser) {
    await this.access.assertEmployeeAccess(user, id);
    await this.access.assertEmployeeMutable(user, id, true);
    const employee = await this.prisma.employee.findFirst({
      where: { id, AND: [this.access.employeeWhereFor(user)] },
    });
    if (!employee) throw new NotFoundException('نیروی موردنظر یافت نشد.');

    await this.prisma.employee.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'TERMINATED', isActive: undefined } as Prisma.EmployeeUpdateInput,
    });

    await this.audit.record(user.id, {
      action: AuditAction.DELETE,
      entity: 'Employee',
      entityId: id,
      before: { code: employee.code },
      note: reason,
    });

    return { success: true, timestamp: new Date().toISOString() };
  }

  // =========================================================================
  // زیرمجموعه‌های پرونده
  // =========================================================================

  async listDependents(employeeId: string, user: AuthenticatedUser) {
    await this.assertAccess(employeeId, user);
    if (!employeeVisibility(user,employeeId).personal) throw new ForbiddenException('مجوز مشاهدهٔ اطلاعات شخصی را ندارید.');
    await this.audit.recordView(user.id,'EmployeeDependent',employeeId,{});
    const rows = await this.prisma.employeeDependent.findMany({
      where: { employeeId },
      orderBy: { createdAt: 'asc' },
    });
    return {
      data: rows,
      meta: { total: rows.length, page: 1, limit: rows.length, totalPages: 1, hasNext: false, hasPrev: false },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  async addDependent(employeeId: string, dto: CreateDependentDto, user: AuthenticatedUser) {
    await this.assertAccess(employeeId, user);
    const row = await this.prisma.employeeDependent.create({
      data: {
        employeeId,
        relation: dto.relation,
        fullName: dto.fullName,
        nationalId: dto.nationalId ?? null,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : null,
        isUnderCover: dto.isUnderCover ?? false,
      },
    });
    await this.audit.record(user.id, {
      action: AuditAction.CREATE,
      entity: 'EmployeeDependent',
      entityId: row.id,
      after: { employeeId, fullName: dto.fullName },
    });
    return { data: row, success: true, timestamp: new Date().toISOString() };
  }

  async removeDependent(id: string, user: AuthenticatedUser) {
    const row = await this.prisma.employeeDependent.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('شخص تحت تکفل یافت نشد.');
    await this.assertAccess(row.employeeId, user);
    await this.prisma.employeeDependent.delete({ where: { id } });
    await this.audit.record(user.id, {
      action: AuditAction.DELETE,
      entity: 'EmployeeDependent',
      entityId: id,
      before: { fullName: row.fullName },
    });
    return { success: true, timestamp: new Date().toISOString() };
  }

  async listSkills(employeeId: string, user: AuthenticatedUser) {
    await this.assertAccess(employeeId, user);
    const rows = await this.prisma.employeeSkill.findMany({ where: { employeeId }, orderBy: { createdAt: 'asc' } });
    return {
      data: rows,
      meta: { total: rows.length, page: 1, limit: rows.length, totalPages: 1, hasNext: false, hasPrev: false },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  async addSkill(employeeId: string, dto: CreateSkillDto, user: AuthenticatedUser) {
    await this.assertAccess(employeeId, user);
    const row = await this.prisma.employeeSkill.create({
      data: { employeeId, skill: dto.skill.trim(), level: dto.level ?? 1, note: dto.note ?? null },
    });
    await this.audit.record(user.id, {
      action: AuditAction.CREATE,
      entity: 'EmployeeSkill',
      entityId: row.id,
      after: { employeeId, skill: dto.skill },
    });
    return { data: row, success: true, timestamp: new Date().toISOString() };
  }

  async removeSkill(id: string, user: AuthenticatedUser) {
    const row = await this.prisma.employeeSkill.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('مهارت یافت نشد.');
    await this.assertAccess(row.employeeId, user);
    await this.prisma.employeeSkill.delete({ where: { id } });
    await this.audit.record(user.id, {
      action: AuditAction.DELETE,
      entity: 'EmployeeSkill',
      entityId: id,
      before: { skill: row.skill },
    });
    return { success: true, timestamp: new Date().toISOString() };
  }

  async listBankAccounts(employeeId: string, user: AuthenticatedUser) {
    await this.assertAccess(employeeId, user);
    if (!employeeVisibility(user,employeeId).bank) throw new ForbiddenException('مجوز مشاهدهٔ اطلاعات بانکی را ندارید.');
    await this.audit.recordView(user.id,'BankAccount',employeeId,{});
    const rows = await this.prisma.bankAccount.findMany({ where: { employeeId }, orderBy: { createdAt: 'asc' } });
    return {
      data: rows,
      meta: { total: rows.length, page: 1, limit: rows.length, totalPages: 1, hasNext: false, hasPrev: false },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  async addBankAccount(employeeId: string, dto: CreateBankAccountDto, user: AuthenticatedUser) {
    await this.assertAccess(employeeId, user);
    if (!employeeVisibility(user,employeeId).bank) throw new ForbiddenException('مجوز مدیریت اطلاعات بانکی را ندارید.');
    if (dto.isPrimary) {
      await this.prisma.bankAccount.updateMany({ where: { employeeId }, data: { isPrimary: false } });
    }
    const row = await this.prisma.bankAccount.create({
      data: {
        employeeId,
        bankName: dto.bankName,
        accountNumber: dto.accountNumber,
        sheba: dto.sheba ?? null,
        cardNumber: dto.cardNumber ?? null,
        isPrimary: dto.isPrimary ?? false,
      },
    });
    await this.audit.record(user.id, {
      action: AuditAction.CREATE,
      entity: 'BankAccount',
      entityId: row.id,
      after: { employeeId, bankName: dto.bankName },
    });
    return { data: row, success: true, timestamp: new Date().toISOString() };
  }

  async removeBankAccount(id: string, user: AuthenticatedUser) {
    const row = await this.prisma.bankAccount.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('حساب بانکی یافت نشد.');
    await this.assertAccess(row.employeeId, user);
    if (!employeeVisibility(user,row.employeeId).bank) throw new ForbiddenException('مجوز مدیریت اطلاعات بانکی را ندارید.');
    await this.prisma.bankAccount.delete({ where: { id } });
    await this.audit.record(user.id, {
      action: AuditAction.DELETE,
      entity: 'BankAccount',
      entityId: id,
      before: { bankName: row.bankName },
    });
    return { success: true, timestamp: new Date().toISOString() };
  }

  async listEmploymentEvents(employeeId: string, user: AuthenticatedUser) {
    await this.assertAccess(employeeId, user);
    const rows = await this.prisma.employmentEvent.findMany({
      where: { employeeId },
      orderBy: { createdAt: 'desc' },
    });
    return {
      data: rows,
      meta: { total: rows.length, page: 1, limit: rows.length, totalPages: 1, hasNext: false, hasPrev: false },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  async addEmploymentEvent(employeeId: string, dto: CreateEmploymentEventDto, user: AuthenticatedUser) {
    await this.assertAccess(employeeId, user);
    const row = await this.prisma.employmentEvent.create({
      data: {
        employeeId,
        eventType: dto.eventType,
        fromDate: dto.fromDate ? new Date(dto.fromDate) : null,
        toDate: dto.toDate ? new Date(dto.toDate) : null,
        note: dto.note ?? null,
      },
    });
    await this.audit.record(user.id, {
      action: AuditAction.CREATE,
      entity: 'EmploymentEvent',
      entityId: row.id,
      after: { employeeId, eventType: dto.eventType },
    });
    return { data: row, success: true, timestamp: new Date().toISOString() };
  }

  /** برای ماژول‌های دیگر — چک دسترسی با پیام خطای استاندارد */
  private async assertAccess(employeeId: string, user: AuthenticatedUser): Promise<void> {
    const ok = await this.access.canAccessEmployee(user, employeeId);
    if (!ok) throw new ForbiddenException('به این پرونده دسترسی ندارید.');
  }

  /** خروجی سبک برای گزارش‌ها */
  async exportOptions(user: AuthenticatedUser) {
    const rows = await this.prisma.employee.findMany({
      where: { deletedAt: null, AND: [this.access.employeeWhereFor(user)] },
      select: EMPLOYEE_SUMMARY,
      orderBy: { code: 'asc' },
      take: 5000,
    });
    return {
      data: rows,
      meta: { total: rows.length, page: 1, limit: 5000, totalPages: 1, hasNext: false, hasPrev: false },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }
}
