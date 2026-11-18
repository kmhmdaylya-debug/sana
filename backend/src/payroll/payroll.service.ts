import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AuditAction,
  EmployeeStatus,
  LeaveRequestStatus,
  NotificationType,
  PayCalculationType,
  PayComponentType,
  PayrollStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuditEntry, AuditService, AuditContext } from '../common/audit/audit.service';
import { stringifyAudit } from '../common/audit/audit-redaction';
import { AccessService } from '../common/access/access.service';
import { NotificationService } from '../common/notifications/notification.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { PERMISSIONS } from '../common/constants/permissions';
import { buildExportBuffer, contentTypeFor, ExportColumn } from '../common/utils/export.util';
import { PaginationDto } from '../common/dto/pagination.dto';
import {
  AmendmentItemDto,
  CreatePayComponentDto,
  CreatePayrollAmendmentDto,
  CreatePayrollPeriodDto,
  CreatePayRuleVersionDto,
  PayrollCompareQueryDto,
  PayrollPeriodQueryDto,
  PayrollReportQueryDto,
  PayComponentQueryDto,
  RejectPayrollAmendmentDto,
  UpdatePayComponentDto,
} from './dto/payroll.dto';

/** پیام ثابت قفل دوره حقوق */
export const PAYROLL_LOCKED_MESSAGE =
  'دوره حقوق قفل شده است؛ تغییر فقط از مسیر اصلاحیه ممکن است';

/** اجزای استاندارد موتور محاسبه حقوق (در صورت نبود، به‌صورت خودکار ساخته می‌شوند) */
const CANONICAL_COMPONENTS: {
  code: string;
  name: string;
  type: PayComponentType;
  calculationType: PayCalculationType;
  sortOrder: number;
}[] = [
  { code: 'BASE_SALARY', name: 'حقوق پایه', type: PayComponentType.EARNING, calculationType: PayCalculationType.FIXED, sortOrder: 10 },
  { code: 'HOUSING_ALLOWANCE', name: 'حق مسکن', type: PayComponentType.EARNING, calculationType: PayCalculationType.FIXED, sortOrder: 20 },
  { code: 'FOOD_ALLOWANCE', name: 'حق خواربار', type: PayComponentType.EARNING, calculationType: PayCalculationType.FIXED, sortOrder: 30 },
  { code: 'CHILD_ALLOWANCE', name: 'حق اولاد', type: PayComponentType.EARNING, calculationType: PayCalculationType.FIXED, sortOrder: 40 },
  { code: 'SENIORITY_PAY', name: 'پایه سنوات', type: PayComponentType.EARNING, calculationType: PayCalculationType.FIXED, sortOrder: 50 },
  { code: 'OVERTIME', name: 'اضافه‌کاری', type: PayComponentType.EARNING, calculationType: PayCalculationType.HOURLY, sortOrder: 60 },
  { code: 'LEAVE_PAY', name: 'حقوق مرخصی', type: PayComponentType.EARNING, calculationType: PayCalculationType.HOURLY, sortOrder: 70 },
  { code: 'LOAN_INSTALLMENT', name: 'اقساط وام و مساعده', type: PayComponentType.DEDUCTION, calculationType: PayCalculationType.FIXED, sortOrder: 80 },
  { code: 'INSURANCE', name: 'بیمه تأمین اجتماعی — سهم کارمند', type: PayComponentType.DEDUCTION, calculationType: PayCalculationType.PERCENT, sortOrder: 90 },
  { code: 'INSURANCE_EMPLOYER', name: 'بیمه تأمین اجتماعی — سهم کارفرما', type: PayComponentType.COMPANY_COST, calculationType: PayCalculationType.PERCENT, sortOrder: 100 },
];

const CANONICAL_CODES = CANONICAL_COMPONENTS.map((c) => c.code);

/** شروع اعتبار پیش‌فرض قاعده‌ها (برای اینکه همه دوره‌های گذشته قاعده داشته باشند) */
const DEFAULT_RULE_EFFECTIVE_FROM = new Date(Date.UTC(2000, 0, 1));

interface PeriodRange {
  /** ابتدای دوره (نیمه‌شب UTC روز اول) */
  startDate: Date;
  /** انتهای دوره (آخرین لحظه روز آخر) */
  end: Date;
  /** ابتدای روز بعد از دوره (برای فیلترهای بازه‌ای روی ستون‌های Date) */
  endExclusive: Date;
  /** نیمه‌شب UTC روز آخر دوره */
  endDate: Date;
  /** تعداد روز تقویمی ماه شمسی */
  daysInMonth: number;
}

@Injectable()
export class PayrollService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly access: AccessService,
    private readonly notifications: NotificationService,
    private readonly config: ConfigService,
  ) {}

  // ==========================================================================
  // اجزای حقوق (PayComponent)
  // ==========================================================================

  async listComponents(query: PayComponentQueryDto, pagination: PaginationDto, user: AuthenticatedUser) {
    const allowed = await this.allowedCompanyIds(user);
    
    // Validate query.companyId if provided
    if (query.companyId && allowed !== null && !allowed.includes(query.companyId)) {
      throw new ForbiddenException('به این شرکت دسترسی ندارید.');
    }
    
    const where: Prisma.PayComponentWhereInput = {
      AND: [allowed === null ? {} : { companyId: { in: allowed } }],
      ...(query.companyId ? { companyId: query.companyId } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search, mode: 'insensitive' } },
              { name: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.payComponent.count({ where }),
      this.prisma.payComponent.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
      }),
    ]);

    return {
      data: rows.map((c) => this.componentToPublic(c)),
      meta: {
        total,
        page: pagination.page,
        limit: pagination.limit,
        totalPages: Math.ceil(total / pagination.limit),
        hasNext: pagination.page * pagination.limit < total,
        hasPrev: pagination.page > 1,
      },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  /** فهرست سبک برای لیست‌های کشویی */
  async componentOptions(user: AuthenticatedUser) {
    const allowed = await this.allowedCompanyIds(user);
    const rows = await this.prisma.payComponent.findMany({
      where: {
        isActive: true,
        ...(allowed === null ? {} : { companyId: { in: allowed } }),
      },
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        calculationType: true,
        companyId: true,
        sortOrder: true,
      },
    });

    return {
      data: rows,
      meta: {
        total: rows.length,
        page: 1,
        limit: rows.length,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  async getComponent(id: string, user: AuthenticatedUser) {
    const component = await this.prisma.payComponent.findUnique({
      where: { id },
      include: { ruleVersions: { orderBy: { version: 'desc' } } },
    });
    if (!component) throw new NotFoundException('جزء حقوق موردنظر یافت نشد.');
    await this.assertCompanyAccess(user, component.companyId);
    return {
      ...this.componentToPublic(component),
      ruleVersions: (component.ruleVersions ?? []).map((rv) => ({
        id: rv.id,
        version: rv.version,
        effectiveFrom: rv.effectiveFrom,
        effectiveTo: rv.effectiveTo,
        configJson: rv.configJson ? this.safeParseJson(rv.configJson) : null,
        createdById: rv.createdById,
        createdAt: rv.createdAt,
      })),
    };
  }

  async createComponent(dto: CreatePayComponentDto, actorId: string, user: AuthenticatedUser) {
    let companyId = dto.companyId;
    if (!companyId) {
      const allowed = await this.allowedCompanyIds(user);
      if (allowed && allowed.length === 1) companyId = allowed[0];
    }
    await this.assertCompanyAccess(user, companyId);
    if (!companyId) {
      throw new BadRequestException('شناسه شرکت برای ایجاد جزء حقوق الزامی است.');
    }
    const existing = await this.prisma.payComponent.findFirst({
      where: { code: dto.code.trim().toUpperCase() },
    });
    if (existing) throw new BadRequestException('کد جزء حقوق قبلاً ثبت شده است.');

    const component = await this.prisma.payComponent.create({
      data: {
        companyId,
        code: dto.code.trim().toUpperCase(),
        name: dto.name.trim(),
        type: dto.type,
        calculationType: dto.calculationType ?? PayCalculationType.FIXED,
        amount: BigInt(Math.trunc(dto.amount ?? 0)),
        formula: dto.formula ?? null,
        isTaxable: dto.isTaxable ?? true,
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
    });

    await this.audit.record(actorId, {
      action: AuditAction.CREATE,
      entity: 'PayComponent',
      entityId: component.id,
      after: { code: component.code, name: component.name, type: component.type },
    });

    return this.componentToPublic(component);
  }

  async updateComponent(id: string, dto: UpdatePayComponentDto, actorId: string, user: AuthenticatedUser) {
    const component = await this.prisma.payComponent.findUnique({ where: { id } });
    if (!component) throw new NotFoundException('جزء حقوق موردنظر یافت نشد.');
    await this.assertCompanyAccess(user, component.companyId);

    const before = {
      name: component.name,
      type: component.type,
      amount: Number(component.amount),
      isActive: component.isActive,
    };

    const updated = await this.prisma.payComponent.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.calculationType !== undefined ? { calculationType: dto.calculationType } : {}),
        ...(dto.amount !== undefined ? { amount: BigInt(Math.trunc(dto.amount)) } : {}),
        ...(dto.formula !== undefined ? { formula: dto.formula } : {}),
        ...(dto.isTaxable !== undefined ? { isTaxable: dto.isTaxable } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      },
    });

    await this.audit.record(actorId, {
      action: AuditAction.UPDATE,
      entity: 'PayComponent',
      entityId: id,
      before,
      after: {
        name: updated.name,
        type: updated.type,
        amount: Number(updated.amount),
        isActive: updated.isActive,
      },
    });

    return this.componentToPublic(updated);
  }

  async deleteComponent(id: string, actorId: string, user: AuthenticatedUser) {
    const component = await this.prisma.payComponent.findUnique({ where: { id } });
    if (!component) throw new NotFoundException('جزء حقوق موردنظر یافت نشد.');
    await this.assertCompanyAccess(user, component.companyId);

    const usage = await this.prisma.payrollItem.count({ where: { componentId: id } });
    if (usage > 0) {
      await this.prisma.payComponent.update({ where: { id }, data: { isActive: false } });
      await this.audit.record(actorId, {
        action: AuditAction.DEACTIVATE,
        entity: 'PayComponent',
        entityId: id,
        note: 'جزء حقوق دارای سابقه محاسباتی بود و غیرفعال شد.',
      });
      return { success: true, deactivated: true };
    }

    await this.prisma.payComponent.delete({ where: { id } });
    await this.audit.record(actorId, {
      action: AuditAction.DELETE,
      entity: 'PayComponent',
      entityId: id,
      before: { code: component.code, name: component.name },
    });
    return { success: true, deactivated: false };
  }

  // ==========================================================================
  // نسخه‌های قاعده محاسبه (PayRuleVersion)
  // ==========================================================================

  async listRuleVersions(componentId: string, user: AuthenticatedUser) {
    const component = await this.prisma.payComponent.findUnique({ where: { id: componentId } });
    if (!component) throw new NotFoundException('جزء حقوق موردنظر یافت نشد.');
    await this.assertCompanyAccess(user, component.companyId);
    const rows = await this.prisma.payRuleVersion.findMany({
      where: { componentId },
      orderBy: { version: 'desc' },
    });
    return {
      data: rows.map((rv) => ({
        id: rv.id,
        componentId: rv.componentId,
        version: rv.version,
        effectiveFrom: rv.effectiveFrom,
        effectiveTo: rv.effectiveTo,
        configJson: rv.configJson ? this.safeParseJson(rv.configJson) : null,
        createdById: rv.createdById,
        createdAt: rv.createdAt,
      })),
      meta: {
        total: rows.length,
        page: 1,
        limit: rows.length,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * ایجاد نسخه جدید قاعده. نسخه‌های قبلی هرگز تغییر نمی‌کنند (اصل «نسخه‌بندی تغییرناپذیر»).
   */
  async createRuleVersion(componentId: string, dto: CreatePayRuleVersionDto, actorId: string, user: AuthenticatedUser) {
    const component = await this.prisma.payComponent.findUnique({ where: { id: componentId } });
    if (!component) throw new NotFoundException('جزء حقوق موردنظر یافت نشد.');
    await this.assertCompanyAccess(user, component.companyId);

    const effectiveFrom = this.parseDateOnly(dto.effectiveFrom, 'تاریخ شروع اعتبار');
    const effectiveTo = dto.effectiveTo ? this.parseDateOnly(dto.effectiveTo, 'تاریخ پایان اعتبار') : null;
    if (effectiveTo && effectiveTo < effectiveFrom) {
      throw new BadRequestException('تاریخ پایان اعتبار نمی‌تواند پیش از تاریخ شروع باشد.');
    }

    const last = await this.prisma.payRuleVersion.findFirst({
      where: { componentId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });

    const created = await this.prisma.payRuleVersion.create({
      data: {
        componentId,
        version: (last?.version ?? 0) + 1,
        effectiveFrom,
        effectiveTo,
        configJson: dto.configJson ? JSON.stringify(dto.configJson) : null,
        createdById: actorId,
      },
    });

    await this.audit.record(actorId, {
      action: AuditAction.CREATE,
      entity: 'PayRuleVersion',
      entityId: created.id,
      after: {
        componentId,
        code: component.code,
        version: created.version,
        effectiveFrom: created.effectiveFrom,
        effectiveTo: created.effectiveTo,
        configJson: created.configJson,
        note: dto.note ?? null,
      },
    });

    return {
      id: created.id,
      componentId: created.componentId,
      version: created.version,
      effectiveFrom: created.effectiveFrom,
      effectiveTo: created.effectiveTo,
      configJson: created.configJson ? this.safeParseJson(created.configJson) : null,
      createdById: created.createdById,
      createdAt: created.createdAt,
    };
  }

  // ==========================================================================
  // دوره حقوق (PayrollPeriod)
  // ==========================================================================

  async listPeriods(query: PayrollPeriodQueryDto, pagination: PaginationDto, user: AuthenticatedUser) {
    const allowed = await this.allowedCompanyIds(user);
    
    // Validate query.companyId if provided
    if (query.companyId && allowed !== null && !allowed.includes(query.companyId)) {
      throw new ForbiddenException('به این شرکت دسترسی ندارید.');
    }
    
    const where: Prisma.PayrollPeriodWhereInput = {
      AND: [allowed === null ? {} : { companyId: { in: allowed } }],
      ...(query.companyId ? { companyId: query.companyId } : {}),
      ...(query.year ? { year: query.year } : {}),
      ...(query.month ? { month: query.month } : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.payrollPeriod.count({ where }),
      this.prisma.payrollPeriod.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
        include: { company: { select: { id: true, name: true, code: true } } },
      }),
    ]);

    return {
      data: rows.map((p) => this.periodToPublic(p)),
      meta: {
        total,
        page: pagination.page,
        limit: pagination.limit,
        totalPages: Math.ceil(total / pagination.limit),
        hasNext: pagination.page * pagination.limit < total,
        hasPrev: pagination.page > 1,
      },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  async getPeriod(id: string, user: AuthenticatedUser) {
    const period = await this.prisma.payrollPeriod.findUnique({
      where: { id },
      include: { company: { select: { id: true, name: true, code: true } } },
    });
    if (!period) throw new NotFoundException('دوره حقوق موردنظر یافت نشد.');
    await this.assertCompanyAccess(user, period.companyId);
    return this.periodToPublic(period);
  }

  async createPeriod(dto: CreatePayrollPeriodDto, actorId: string, user: AuthenticatedUser) {
    await this.assertCompanyAccess(user, dto.companyId);
    const company = await this.prisma.company.findUnique({ where: { id: dto.companyId } });
    if (!company) throw new NotFoundException('شرکت موردنظر یافت نشد.');

    const existing = await this.prisma.payrollPeriod.findUnique({
      where: { companyId_year_month: { companyId: dto.companyId, year: dto.year, month: dto.month } },
    });
    if (existing) {
      throw new BadRequestException('برای این شرکت و این ماه شمسی قبلاً دوره حقوق ایجاد شده است.');
    }

    const period = await this.prisma.payrollPeriod.create({
      data: {
        companyId: dto.companyId,
        year: dto.year,
        month: dto.month,
        status: PayrollStatus.DRAFT,
      },
    });

    await this.audit.record(actorId, {
      action: AuditAction.CREATE,
      entity: 'PayrollPeriod',
      entityId: period.id,
      after: { companyId: dto.companyId, year: dto.year, month: dto.month, status: period.status },
    });

    return this.periodToPublic(period);
  }

  // ==========================================================================
  // موتور تولید لیست حقوق
  // ==========================================================================

  async generate(periodId: string, actorId: string, user: AuthenticatedUser) {
    return this.prisma.$transaction(async db => {
      await db.$queryRaw`SELECT id FROM "PayrollPeriod" WHERE id = ${periodId}::uuid FOR UPDATE`;
    const period = await this.getPeriodEntity(periodId, db);
    await this.assertCompanyAccess(user, period.companyId);
    await db.$queryRaw`SELECT id FROM "Company" WHERE id = ${period.companyId}::uuid FOR UPDATE`;

    if (period.status === PayrollStatus.LOCKED) {
      throw new BadRequestException(PAYROLL_LOCKED_MESSAGE);
    }
    if (period.status !== PayrollStatus.DRAFT) {
      throw new BadRequestException('تولید لیست حقوق تنها در وضعیت «پیش‌نویس» مجاز است.');
    }

    const range = this.periodRange(period.year, period.month);
    const settings = await this.loadPayrollSettings(db);
    const workingDaysPerMonth = this.config.get<number>('app.payroll.workingDaysPerMonth') ?? 30;
    const defaultMonthlyHours =
      this.config.get<number>('app.payroll.defaultWorkHoursPerDay') !== undefined
        ? (this.config.get<number>('app.payroll.defaultWorkHoursPerDay') as number) * 26
        : 220;

    const components = await this.ensureCanonicalComponents(period.companyId, range, db);

    // --- کارکنان فعال دوره ---
    const employees = await db.employee.findMany({
      where: {
        companyId: period.companyId,
        deletedAt: null,
        OR: [
          { status: EmployeeStatus.ACTIVE },
          {
            status: EmployeeStatus.TERMINATED,
            terminationDate: { gte: range.startDate, lte: range.endExclusive },
          },
        ],
      },
      select: {
        id: true,
        code: true,
        firstName: true,
        lastName: true,
        hireDate: true,
        terminationDate: true,
        status: true,
        monthlyBaseSalary: true,
      },
      orderBy: { code: 'asc' },
    });

    const employeeIds = employees.map((e) => e.id);

    // --- قرارداد فعال هر کارمند ---
    const contracts = await db.contract.findMany({
      where: {
        employeeId: { in: employeeIds }, companyId: period.companyId, deletedAt: null,
        status: { in: ['ACTIVE', 'EXPIRING', 'RENEWED', 'TERMINATED'] },
      },
      include: { versions: { where: { approvedAt: { not: null }, effectiveDate: { lte: range.end } }, orderBy: [{ effectiveDate: 'desc' }, { version: 'desc' }] } },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    });
    const contractByEmployee = new Map<string, any>();
    for (const contract of contracts) {
      if (contract.status === 'RENEWED' && !contract.versions.length) {
        throw new BadRequestException('قرارداد تمدیدشده قدیمی باید پیش از محاسبه حقوق، صریحاً تأیید شود.');
      }
      const active = (contract.versions ?? []).find(
        (v: any) =>
          v.startDate.getTime() <= range.end.getTime() &&
          (v.endDate === null || v.endDate.getTime() >= range.startDate.getTime()),
      );
      if (!active) continue;
      const selected = contractByEmployee.get(contract.employeeId);
      if (!selected || active.effectiveDate > selected.effectiveDate) contractByEmployee.set(contract.employeeId, active);
    }

    // --- اضافه‌کاری دوره ---
    const overtimeRows = await db.attendanceRecord.groupBy({
      by: ['employeeId'],
      where: {
        employeeId: { in: employeeIds },
        workDate: { gte: range.startDate, lt: range.endExclusive },
      },
      _sum: { overtimeMinutes: true },
    });
    const overtimeMap = new Map<string, number>();
    for (const row of overtimeRows) overtimeMap.set(row.employeeId, row._sum.overtimeMinutes ?? 0);

    // --- مرخصی‌های تأییدشده و حقوق‌دار ---
    const leaves = await db.leaveRequest.findMany({
      where: {
        employeeId: { in: employeeIds },
        status: LeaveRequestStatus.APPROVED,
        startAt: { lte: range.end },
        endAt: { gte: range.startDate },
        leaveType: { isPaid: true },
      },
      select: { employeeId: true, startAt: true, endAt: true, durationMinutes: true },
    });

    // --- اقساط وام سررسیدشده در دوره ---
    const installments = await db.loanInstallment.findMany({
      where: {
        dueDate: { gte: range.startDate, lt: range.endExclusive },
        status: 'PENDING',
        loan: { employeeId: { in: employeeIds } },
      },
      select: { id: true, amount: true, loan: { select: { employeeId: true } } },
    });

    // --- کارکنانی که اصلاحیه تأییدشده دارند (تولید مجدد نباید اصلاحیه را بازنویسی کند) ---
    const amendedEmployees = new Set(
      (
        await db.payrollAmendment.findMany({
          where: { periodId, status: 'APPROVED' },
          select: { employeeId: true },
        })
      ).map((a) => a.employeeId),
    );

    let itemCount = 0;
    const skipped: { employeeId: string; reason: string }[] = [];

    for (const employee of employees) {
      if (amendedEmployees.has(employee.id)) {
        skipped.push({
          employeeId: employee.id,
          reason: 'برای این کارمند اصلاحیه تأییدشده وجود دارد؛ اقلام اصلاحی دست‌نخورده باقی ماند.',
        });
        continue;
      }

      const contractVersion = contractByEmployee.get(employee.id) ?? null;
      const baseSalaryRaw = contractVersion
        ? Number(contractVersion.baseSalary)
        : Number(employee.monthlyBaseSalary);
      const monthlyHours = contractVersion?.workHoursPerMonth
        ? Number(contractVersion.workHoursPerMonth)
        : defaultMonthlyHours;

      const ratio = this.prorateRatio(
        employee.hireDate,
        employee.terminationDate,
        range,
        workingDaysPerMonth,
      );
      const baseSalary = Math.round(baseSalaryRaw * ratio);
      const hourlyRate = monthlyHours > 0 ? baseSalary / monthlyHours : 0;

      const drafts: {
        code: string;
        amount: number;
        quantity: number;
        note: string;
      }[] = [];

      // ۱) حقوق پایه (سهم از دوره بر اساس روز کارکرد)
      drafts.push({
        code: 'BASE_SALARY',
        amount: baseSalary,
        quantity: 1,
        note: `حقوق پایه — نسبت کارکرد ${this.ratioLabel(ratio)}`,
      });

      // ۲) مزایای قراردادی
      if (contractVersion) {
        const allowances: { code: string; label: string; value: bigint | number }[] = [
          { code: 'HOUSING_ALLOWANCE', label: 'حق مسکن', value: contractVersion.housingAllowance },
          { code: 'FOOD_ALLOWANCE', label: 'حق خواربار', value: contractVersion.foodAllowance },
          { code: 'CHILD_ALLOWANCE', label: 'حق اولاد', value: contractVersion.childAllowance },
          { code: 'SENIORITY_PAY', label: 'پایه سنوات', value: contractVersion.seniorityPay },
        ];
        for (const allowance of allowances) {
          const value = Number(allowance.value ?? 0);
          if (value > 0) {
            drafts.push({
              code: allowance.code,
              amount: value,
              quantity: 1,
              note: `${allowance.label} — قرارداد نسخه ${contractVersion.version ?? '—'}`,
            });
          }
        }
      }

      // ۳) اضافه‌کاری
      const overtimeMinutes = overtimeMap.get(employee.id) ?? 0;
      if (overtimeMinutes > 0 && hourlyRate > 0) {
        const hours = overtimeMinutes / 60;
        const amount = Math.round(hours * hourlyRate * settings.overtimeMultiplier);
        drafts.push({
          code: 'OVERTIME',
          amount,
          quantity: Number(hours.toFixed(4)),
          note: `${overtimeMinutes} دقیقه اضافه‌کاری با ضریب ${settings.overtimeMultiplier}`,
        });
      }

      // ۴) حقوق مرخصی استحقاقی/دارای حقوق
      const paidLeaveMinutes = this.paidLeaveMinutesFor(leaves, employee.id, range);
      if (paidLeaveMinutes > 0 && hourlyRate > 0) {
        const hours = paidLeaveMinutes / 60;
        const amount = Math.round(hours * hourlyRate);
        drafts.push({
          code: 'LEAVE_PAY',
          amount,
          quantity: Number(hours.toFixed(4)),
          note: `${paidLeaveMinutes} دقیقه مرخصی حقوق‌دار`,
        });
      }

      // ۵) کسورات: اقساط وام
      const loanTotal = installments
        .filter((i) => i.loan.employeeId === employee.id)
        .reduce((sum, i) => sum + Number(i.amount), 0);
      if (loanTotal > 0) {
        drafts.push({
          code: 'LOAN_INSTALLMENT',
          amount: loanTotal,
          quantity: 1,
          note: 'اقساط سررسیدشده وام/مساعده در این دوره',
        });
      }

      // ۶) جمع ناخالص و بیمه
      const gross =
        drafts
          .filter((d) => this.componentTypeOf(d.code) === PayComponentType.EARNING)
          .reduce((sum, d) => sum + d.amount, 0);

      const insuranceEmployee = Math.round((gross * settings.insuranceEmployeePercent) / 100);
      if (insuranceEmployee > 0) {
        drafts.push({
          code: 'INSURANCE',
          amount: insuranceEmployee,
          quantity: settings.insuranceEmployeePercent,
          note: `${settings.insuranceEmployeePercent} درصد بیمه سهم کارمند از ناخالص`,
        });
      }

      const insuranceEmployer = Math.round((gross * settings.insuranceEmployerPercent) / 100);
      if (insuranceEmployer > 0) {
        drafts.push({
          code: 'INSURANCE_EMPLOYER',
          amount: insuranceEmployer,
          quantity: settings.insuranceEmployerPercent,
          note: `${settings.insuranceEmployerPercent} درصد بیمه سهم کارفرما (هزینه شرکت)`,
        });
      }

      // --- ذخیره‌سازی (upsert ⇒ تولید دوباره رکورد تکراری نمی‌سازد) ---
      const desiredCodes = new Set<string>();
      for (const draft of drafts) {
        const component = components.get(draft.code);
        if (!component) continue;
        desiredCodes.add(draft.code);
        if (draft.amount <= 0) continue;

        await db.payrollItem.upsert({
          where: {
            periodId_employeeId_componentId: {
              periodId,
              employeeId: employee.id,
              componentId: component.componentId,
            },
          },
          create: {
            periodId,
            employeeId: employee.id,
            componentId: component.componentId,
            ruleVersionId: component.ruleVersionId,
            amount: BigInt(Math.trunc(draft.amount)),
            quantity: draft.quantity,
            note: draft.note.slice(0, 255),
          },
          update: {
            ruleVersionId: component.ruleVersionId,
            amount: BigInt(Math.trunc(draft.amount)),
            quantity: draft.quantity,
            note: draft.note.slice(0, 255),
          },
        });
        itemCount += 1;
      }

      // پاک‌سازی اقلام استانداردی که در این دوره دیگر وجود ندارند (مثلاً اضافه‌کاری اصلاح‌شده)
      await db.payrollItem.deleteMany({
        where: {
          periodId,
          employeeId: employee.id,
          component: { code: { in: CANONICAL_CODES } },
          componentId: { notIn: Array.from(desiredCodes).map((c) => components.get(c)!.componentId) },
        },
      });
    }

    // --- بازمحاسبه فیش‌های حقوقی و جمع دوره ---
    const summary = await this.recalculatePayslips(periodId, db);

    await db.payrollPeriod.update({
      where: { id: periodId },
      data: {
        generatedAt: new Date(),
        totalGross: summary.totalGross,
        totalDeductions: summary.totalDeductions,
        totalNet: summary.totalNet,
      },
    });

    await this.recordFinancialAudit(db, actorId, {
      action: AuditAction.UPDATE,
      entity: 'PayrollPeriod',
      entityId: periodId,
      after: {
        year: period.year,
        month: period.month,
        employees: employees.length,
        items: itemCount,
        totalGross: Number(summary.totalGross),
        totalDeductions: Number(summary.totalDeductions),
        totalNet: Number(summary.totalNet),
      },
      note: 'تولید لیست حقوق و دستمزد',
    });

    return {
      data: {
        periodId,
        year: period.year,
        month: period.month,
        employees: employees.length,
        items: itemCount,
        payslips: summary.payslips,
        skipped,
        totals: {
          gross: summary.totalGross,
          deductions: summary.totalDeductions,
          net: summary.totalNet,
        },
        parameters: {
          workingDaysPerMonth,
          overtimeMultiplier: settings.overtimeMultiplier,
          insuranceEmployeePercent: settings.insuranceEmployeePercent,
          insuranceEmployerPercent: settings.insuranceEmployerPercent,
        },
      },
      success: true,
      timestamp: new Date().toISOString(),
    };
  
    }, { maxWait: 10000, timeout: 300000 });
  }

  // ==========================================================================
  // گردش کار: بررسی / قفل / انتشار
  // ==========================================================================

  async review(periodId: string, actorId: string, user: AuthenticatedUser) {
    return this.prisma.$transaction(async db => {
      await db.$queryRaw`SELECT id FROM "PayrollPeriod" WHERE id = ${periodId}::uuid FOR UPDATE`;
    const period = await this.getPeriodEntity(periodId, db);
    await this.assertCompanyAccess(user, period.companyId);
    if (period.status === PayrollStatus.LOCKED) {
      throw new BadRequestException(PAYROLL_LOCKED_MESSAGE);
    }
    if (period.status === PayrollStatus.REVIEWED) {
      throw new BadRequestException('این دوره قبلاً بررسی شده است.');
    }

    const updated = await db.payrollPeriod.update({
      where: { id: periodId },
      data: { status: PayrollStatus.REVIEWED },
    });

    await this.recordFinancialAudit(db, actorId, {
      action: AuditAction.APPROVE,
      entity: 'PayrollPeriod',
      entityId: periodId,
      before: { status: period.status },
      after: { status: updated.status },
      note: 'بررسی دوره حقوق توسط حسابدار',
    });

    return this.periodToPublic(updated);
  
    }, { maxWait: 10000, timeout: 300000 });
  }

  async lock(periodId: string, actorId: string, user: AuthenticatedUser, transaction?: Prisma.TransactionClient) {
    const run = async (db: Prisma.TransactionClient) => {
      await db.$queryRaw`SELECT id FROM "PayrollPeriod" WHERE id = ${periodId}::uuid FOR UPDATE`;
    const period = await this.getPeriodEntity(periodId, db);
    await this.assertCompanyAccess(user, period.companyId);
    if (period.status === PayrollStatus.LOCKED) {
      throw new BadRequestException('این دوره قبلاً قفل شده است.');
    }
    if (period.status !== PayrollStatus.REVIEWED) {
      throw new BadRequestException('ابتدا باید دوره توسط حسابدار بررسی شود.');
    }

    const updated = await db.payrollPeriod.update({
      where: { id: periodId },
      data: { status: PayrollStatus.LOCKED, lockedAt: new Date(), lockedById: actorId },
    });

    await this.recordFinancialAudit(db, actorId, {
      action: AuditAction.APPROVE,
      entity: 'PayrollPeriod',
      entityId: periodId,
      before: { status: period.status },
      after: { status: updated.status, lockedAt: updated.lockedAt, lockedById: actorId },
      note: 'قفل دوره حقوق',
    });

    return this.periodToPublic(updated);
  
    };
    return transaction ? run(transaction) : this.prisma.$transaction(run, { maxWait: 10000, timeout: 300000 });
  }

  async publish(periodId: string, actorId: string, user: AuthenticatedUser) {
    return this.prisma.$transaction(async db => {
      await db.$queryRaw`SELECT id FROM "PayrollPeriod" WHERE id = ${periodId}::uuid FOR UPDATE`;
    const period = await this.getPeriodEntity(periodId, db);
    await this.assertCompanyAccess(user, period.companyId);
    if (period.status === PayrollStatus.DRAFT) {
      throw new BadRequestException('ابتدا دوره باید بررسی شود.');
    }

    if (period.status !== PayrollStatus.LOCKED) throw new BadRequestException('ابتدا دوره حقوق را قفل کنید.');
    const payslips = await db.payslip.findMany({ where: { periodId, status: { not: 'PUBLISHED' } } });
    const publishedAt = new Date();
    await db.payslip.updateMany({
      where: { periodId, id: { in: payslips.map(item => item.id) }, status: { not: 'PUBLISHED' } },
      data: { status: 'PUBLISHED', publishedAt },
    });

    const employees = await db.employee.findMany({
      where: { id: { in: payslips.map((p) => p.employeeId) } },
      select: { id: true, firstName: true, lastName: true, userId: true },
    });
    const userIds = employees.map((e) => e.userId).filter((v): v is string => !!v);
    if (userIds.length) {
      await db.notification.createMany({ data: [...new Set(userIds)].map(userId => ({
        userId, status: 'SENT', sentAt: publishedAt,
        type: NotificationType.PAYSLIP_PUBLISHED,
        title: 'فیش حقوقی شما منتشر شد',
        body: `فیش حقوقی دوره ${period.year}/${period.month} آماده مشاهده است.`,
        link: `/payroll/payslips/${periodId}/mine`,
        senderId: actorId,
      })) });
    }

    await this.recordFinancialAudit(db, actorId, {
      action: AuditAction.APPROVE,
      entity: 'PayrollPeriod',
      entityId: periodId,
      before: { status: period.status },
      after: { status: period.status, published: payslips.length, publishedAt },
      note: 'انتشار فیش‌های حقوقی و اطلاع‌رسانی به کارکنان',
    });

    return {
      data: {
        periodId,
        published: payslips.length,
        publishedAt,
        notified: userIds.length,
      },
      success: true,
      timestamp: new Date().toISOString(),
    };
  
    }, { maxWait: 10000, timeout: 300000 });
  }

  // ==========================================================================
  // اصلاحیه‌ها (PayrollAmendment)
  // ==========================================================================

  async listAmendments(query: PaginationDto, user: AuthenticatedUser) {
    const employeeWhere = this.access.employeeWhereFor(user);
    const where: Prisma.PayrollAmendmentWhereInput = {
      employee: employeeWhere,
    };

    const [total, rows] = await Promise.all([
      this.prisma.payrollAmendment.count({ where }),
      this.prisma.payrollAmendment.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          period: { select: { id: true, year: true, month: true, status: true } },
          employee: { select: { id: true, code: true, firstName: true, lastName: true } },
        },
      }),
    ]);

    return {
      data: rows.map((a) => this.amendmentToPublic(a)),
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

  async getAmendment(id: string, user: AuthenticatedUser) {
    const amendment = await this.prisma.payrollAmendment.findUnique({
      where: { id },
      include: {
        period: { select: { id: true, year: true, month: true, status: true } },
        employee: { select: { id: true, code: true, firstName: true, lastName: true } },
      },
    });
    if (!amendment) throw new NotFoundException('اصلاحیه موردنظر یافت نشد.');
    await this.access.assertEmployeeAccess(user, amendment.employeeId);
    return this.amendmentToPublic(amendment);
  }

  async createAmendment(dto: CreatePayrollAmendmentDto, actorId: string, user: AuthenticatedUser) {
    const period = await this.getPeriodEntity(dto.periodId);
    await this.assertCompanyAccess(user, period.companyId);

    const allowed = await this.access.canAccessEmployee(user, dto.employeeId);
    if (!allowed) throw new ForbiddenException('به پرونده پرسنلی موردنظر دسترسی ندارید.');
    const employee = await this.prisma.employee.findFirst({ where: { id: dto.employeeId, companyId: period.companyId, deletedAt: null }, select: { id: true } });
    if (!employee) throw new BadRequestException('کارمند و دوره حقوق باید متعلق به یک شرکت باشند.');

    const componentIds = dto.items.map((i) => i.componentId);
    const components = await this.prisma.payComponent.findMany({
      where: { id: { in: componentIds }, companyId: period.companyId },
      select: { id: true, companyId: true },
    });
    if (components.length !== componentIds.length) {
      throw new BadRequestException('یک یا چند جزء حقوق نامعتبر است.');
    }

    const amendment = await this.prisma.payrollAmendment.create({
      data: {
        periodId: dto.periodId,
        employeeId: dto.employeeId,
        reason: dto.reason.trim(),
        itemsJson: JSON.stringify(dto.items),
        status: 'PENDING',
        createdById: actorId,
      },
    });

    await this.audit.record(actorId, {
      action: AuditAction.CREATE,
      entity: 'PayrollAmendment',
      entityId: amendment.id,
      after: {
        periodId: dto.periodId,
        employeeId: dto.employeeId,
        items: dto.items,
        status: 'PENDING',
      },
      note: 'ثبت اصلاحیه حقوق (متصل به دوره اصلی)',
    });

    return this.amendmentToPublic(amendment);
  }

  async approveAmendment(id: string, actorId: string, user: AuthenticatedUser) {
    const lockTarget = await this.prisma.payrollAmendment.findUnique({ where: { id }, select: { periodId: true } });
    if (!lockTarget) throw new NotFoundException('اصلاحیه موردنظر یافت نشد.');
    return this.prisma.$transaction(async db => {
      await db.$queryRaw`SELECT id FROM "PayrollPeriod" WHERE id = ${lockTarget.periodId}::uuid FOR UPDATE`;
      await db.$queryRaw`SELECT id FROM "PayrollAmendment" WHERE id = ${id}::uuid FOR UPDATE`;
    const amendment = await db.payrollAmendment.findUnique({
      where: { id },
      include: { period: true },
    });
    if (!amendment) throw new NotFoundException('اصلاحیه موردنظر یافت نشد.');
    if (amendment.status !== 'PENDING') {
      throw new BadRequestException('این اصلاحیه قبلاً بررسی شده است.');
    }
    await this.assertCompanyAccess(user, amendment.period.companyId);

    await this.access.assertEmployeeAccess(user, amendment.employeeId);
    if (!user.isSuperAdmin && (amendment.createdById === actorId || amendment.employeeId === user.employeeId)) throw new ForbiddenException('تأیید اصلاحیه خودتان مجاز نیست.');

    const items: AmendmentItemDto[] = amendment.itemsJson
      ? this.safeParseJson(amendment.itemsJson)
      : [];
    if (!Array.isArray(items) || items.length === 0) {
      throw new BadRequestException('اقلام اصلاحیه نامعتبر است.');
    }
    if (items.some(item => !item || typeof item.componentId !== 'string' || !Number.isSafeInteger(item.amount))) throw new BadRequestException('اقلام اصلاحیه نامعتبر است.');
    const componentIds = [...new Set(items.map(item => item.componentId))];
    const count = await db.payComponent.count({ where: { id: { in: componentIds }, companyId: amendment.period.companyId } });
    const employee = await db.employee.findFirst({ where: { id: amendment.employeeId, companyId: amendment.period.companyId, deletedAt: null }, select: { id: true } });
    if (count !== componentIds.length || !employee) throw new BadRequestException('اقلام و کارمند اصلاحیه باید به شرکت دوره تعلق داشته باشند.');

    const range = this.periodRange(amendment.period.year, amendment.period.month);

    // اعمال اقلام روی دوره اصلی (بدون ایجاد دوره یا تغییر خودکار)
    for (const item of items) {
      const existing = await db.payrollItem.findUnique({
        where: {
          periodId_employeeId_componentId: {
            periodId: amendment.periodId,
            employeeId: amendment.employeeId,
            componentId: item.componentId,
          },
        },
      });
      const ruleVersionId =
        existing?.ruleVersionId ??
        (await this.resolveRuleVersion(item.componentId, range.startDate, range.end, db));

      await db.payrollItem.upsert({
        where: {
          periodId_employeeId_componentId: {
            periodId: amendment.periodId,
            employeeId: amendment.employeeId,
            componentId: item.componentId,
          },
        },
        create: {
          periodId: amendment.periodId,
          employeeId: amendment.employeeId,
          componentId: item.componentId,
          ruleVersionId,
          amount: BigInt(Math.trunc(item.amount)),
          quantity: 1,
          note: (item.note ?? 'اصلاحیه تأییدشده').slice(0, 255),
        },
        update: {
          ruleVersionId,
          amount: BigInt(Math.trunc(item.amount)),
          note: (item.note ?? 'اصلاحیه تأییدشده').slice(0, 255),
        },
      });
    }

    const summary = await this.recalculatePayslips(amendment.periodId, db);
    await db.payrollPeriod.update({
      where: { id: amendment.periodId },
      data: {
        totalGross: summary.totalGross,
        totalDeductions: summary.totalDeductions,
        totalNet: summary.totalNet,
      },
    });

    const updated = await db.payrollAmendment.update({
      where: { id },
      data: { status: 'APPROVED', approvedById: actorId, decidedAt: new Date() },
    });

    await this.recordFinancialAudit(db, actorId, {
      action: AuditAction.APPROVE,
      entity: 'PayrollAmendment',
      entityId: id,
      before: { status: amendment.status },
      after: { status: 'APPROVED', items, periodId: amendment.periodId },
      note: 'تأیید و اعمال اصلاحیه روی دوره اصلی',
    });

    return this.amendmentToPublic(updated);
  
    }, { maxWait: 10000, timeout: 300000 });
  }

  async rejectAmendment(id: string, dto: RejectPayrollAmendmentDto, actorId: string, user: AuthenticatedUser) {
    const lockTarget = await this.prisma.payrollAmendment.findUnique({ where: { id }, select: { periodId: true } });
    if (!lockTarget) throw new NotFoundException('اصلاحیه موردنظر یافت نشد.');
    return this.prisma.$transaction(async db => {
      await db.$queryRaw`SELECT id FROM "PayrollPeriod" WHERE id = ${lockTarget.periodId}::uuid FOR UPDATE`;
      await db.$queryRaw`SELECT id FROM "PayrollAmendment" WHERE id = ${id}::uuid FOR UPDATE`;
    const amendment = await db.payrollAmendment.findUnique({
      where: { id },
      include: { period: true },
    });
    if (!amendment) throw new NotFoundException('اصلاحیه موردنظر یافت نشد.');
    if (amendment.status !== 'PENDING') {
      throw new BadRequestException('این اصلاحیه قبلاً بررسی شده است.');
    }
    await this.assertCompanyAccess(user, amendment.period.companyId);

    const updated = await db.payrollAmendment.update({
      where: { id },
      data: { status: 'REJECTED', approvedById: actorId, decidedAt: new Date() },
    });

    await this.recordFinancialAudit(db, actorId, {
      action: AuditAction.REJECT,
      entity: 'PayrollAmendment',
      entityId: id,
      before: { status: amendment.status },
      after: { status: 'REJECTED' },
      note: `علت رد: ${dto.reason.trim()}`,
    });

    return this.amendmentToPublic(updated);
  
    }, { maxWait: 10000, timeout: 300000 });
  }

  // ==========================================================================
  // فیش حقوقی
  // ==========================================================================

  /** فهرست فیش‌های یک دوره (با اعمال دامنه دسترسی) */
  async listPayslips(periodId: string, user: AuthenticatedUser, pagination: PaginationDto) {
    const period = await this.getPeriodEntity(periodId);
    await this.assertCompanyAccess(user, period.companyId);
    const employeeWhere = this.access.employeeWhereFor(user);

    const where: Prisma.PayslipWhereInput = { periodId, employee: employeeWhere };
    const [total, rows] = await Promise.all([
      this.prisma.payslip.count({ where }),
      this.prisma.payslip.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { employee: { code: 'asc' } },
        include: {
          employee: {
            select: {
              id: true,
              code: true,
              firstName: true,
              lastName: true,
              orgUnit: { select: { id: true, name: true } },
              position: { select: { id: true, title: true } },
            },
          },
        },
      }),
    ]);

    return {
      data: rows.map((p) => this.payslipToPublic(p)),
      meta: {
        total,
        page: pagination.page,
        limit: pagination.limit,
        totalPages: Math.ceil(total / pagination.limit),
        hasNext: pagination.page * pagination.limit < total,
        hasPrev: pagination.page > 1,
      },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  /** فیش حقوقی کارمند جاری در یک دوره (و ثبت لاگ مشاهده) */
  async myPayslip(periodId: string, user: AuthenticatedUser, ctx: AuditContext) {
    if (!user.employeeId) {
      throw new BadRequestException('برای کاربر جاری پرونده پرسنلی تعریف نشده است.');
    }
    const period = await this.getPeriodEntity(periodId);
    await this.assertCompanyAccess(user, period.companyId);

    const payslip = await this.prisma.payslip.findUnique({
      where: { periodId_employeeId: { periodId, employeeId: user.employeeId } },
      include: {
        period: { select: { id: true, year: true, month: true, status: true } },
        employee: {
          select: {
            id: true,
            code: true,
            firstName: true,
            lastName: true,
            orgUnit: { select: { id: true, name: true } },
            position: { select: { id: true, title: true } },
          },
        },
      },
    });
    if (!payslip) {
      throw new NotFoundException('برای شما در این دوره فیش حقوقی ایجاد نشده است.');
    }

    const items = await this.loadPayslipItems(periodId, payslip.employeeId);
    await this.logPayslipView(payslip.id, user.id, ctx);

    return {
      data: this.payslipToPublic({ ...payslip, items }, true),
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  /** یک فیش حقوقی به‌همراه اقلام آن (کنترل دامنه دسترسی) */
  async getPayslip(payslipId: string, user: AuthenticatedUser, ctx: AuditContext) {
    const payslip = await this.prisma.payslip.findUnique({
      where: { id: payslipId },
      include: {
        period: { select: { id: true, year: true, month: true, status: true } },
        employee: {
          select: {
            id: true,
            code: true,
            firstName: true,
            lastName: true,
            orgUnit: { select: { id: true, name: true } },
            position: { select: { id: true, title: true } },
          },
        },
      },
    });
    if (!payslip) throw new NotFoundException('فیش حقوقی موردنظر یافت نشد.');

    const items = await this.loadPayslipItems(payslip.periodId, payslip.employeeId);

    const allowed = await this.access.canAccessEmployee(user, payslip.employeeId);
    if (!allowed) throw new ForbiddenException('به این فیش حقوقی دسترسی ندارید.');

    if (user.employeeId === payslip.employeeId) {
      await this.logPayslipView(payslip.id, user.id, ctx);
    }

    await this.audit.recordView(user.id, 'Payslip', payslip.id, ctx);

    return {
      data: this.payslipToPublic({ ...payslip, items }, true),
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  // ==========================================================================
  // گزارش‌ها
  // ==========================================================================

  async report(
    periodId: string,
    query: PayrollReportQueryDto,
    user: AuthenticatedUser,
    ctx: AuditContext,
  ) {
    const period = await this.getPeriodEntity(periodId);
    await this.assertCompanyAccess(user, period.companyId);
    const employeeWhere = this.access.employeeWhereFor(user);

    const payslips = await this.prisma.payslip.findMany({
      where: {
        periodId,
        employee: employeeWhere,
        ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      },
      include: {
        employee: {
          select: {
            id: true,
            code: true,
            firstName: true,
            lastName: true,
            orgUnit: { select: { id: true, name: true } },
            position: { select: { id: true, title: true } },
          },
        },
      },
      orderBy: { employee: { code: 'asc' } },
    });

    const allItems = await this.prisma.payrollItem.findMany({
      where: { periodId },
      include: { component: true },
      orderBy: { createdAt: 'asc' },
    });
    const itemsByEmployee = new Map<string, any[]>();
    for (const item of allItems) {
      const list = itemsByEmployee.get(item.employeeId) ?? [];
      list.push(item);
      itemsByEmployee.set(item.employeeId, list);
    }

    const rows = payslips.map((p) => this.reportRow({ ...p, items: itemsByEmployee.get(p.employeeId) ?? [] }));
    const totals = rows.reduce(
      (acc, r) => ({
        gross: acc.gross + r.gross,
        deductions: acc.deductions + r.deductions,
        net: acc.net + r.net,
        overtime: acc.overtime + r.overtime,
        loanDeduction: acc.loanDeduction + r.loanDeduction,
        employerCost: acc.employerCost + r.employerCost,
      }),
      { gross: 0, deductions: 0, net: 0, overtime: 0, loanDeduction: 0, employerCost: 0 },
    );

    if (query.format !== 'json') {
      if (!this.hasPermission(user, PERMISSIONS.PAYROLL_EXPORT)) {
        throw new ForbiddenException('برای خروجی گرفتن مجوز «payroll.export» لازم است.');
      }
      const columns: ExportColumn[] = [
        { header: 'کد پرسنلی', key: 'employeeCode', width: 14 },
        { header: 'نام و نام خانوادگی', key: 'employeeName', width: 28 },
        { header: 'واحد سازمانی', key: 'orgUnit', width: 22 },
        { header: 'حقوق پایه', key: 'baseSalary', width: 18 },
        { header: 'اضافه‌کاری', key: 'overtime', width: 18 },
        { header: 'حقوق مرخصی', key: 'leavePay', width: 18 },
        { header: 'جمع ناخالص', key: 'gross', width: 20 },
        { header: 'بیمه سهم کارمند', key: 'insurance', width: 18 },
        { header: 'اقساط وام', key: 'loanDeduction', width: 18 },
        { header: 'جمع کسورات', key: 'deductions', width: 18 },
        { header: 'خالص پرداختی', key: 'net', width: 20 },
        { header: 'هزینه سهم کارفرما', key: 'employerCost', width: 18 },
      ];
      const buffer = await buildExportBuffer(
        query.format,
        'گزارش حقوق و دستمزد',
        columns,
        rows as unknown as Record<string, unknown>[],
      );
      await this.audit.recordExport(user.id, 'PayrollPeriod', periodId, {
        ...ctx,
        note: `خروجی گزارش حقوق دوره ${period.year}/${period.month} (${query.format})`,
      });
      return {
        file: true,
        buffer,
        filename: `payroll-report-${period.year}-${String(period.month).padStart(2, '0')}.${query.format}`,
        contentType: contentTypeFor(query.format),
      };
    }

    await this.audit.record(user.id, {
      action: AuditAction.VIEW_SENSITIVE,
      entity: 'PayrollPeriod',
      entityId: periodId,
      note: 'مشاهده گزارش حقوق دوره',
    });

    return {
      data: {
        period: {
          id: period.id,
          year: period.year,
          month: period.month,
          status: period.status,
          totalGross: Number(period.totalGross),
          totalDeductions: Number(period.totalDeductions),
          totalNet: Number(period.totalNet),
        },
        rows,
        totals,
      },
      meta: {
        total: rows.length,
        page: 1,
        limit: rows.length,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  /** مقایسه دوره با دوره قبلی */
  async compare(periodId: string, query: PayrollCompareQueryDto, user: AuthenticatedUser) {
    const period = await this.getPeriodEntity(periodId);
    await this.assertCompanyAccess(user, period.companyId);
    const employeeWhere = this.access.employeeWhereFor(user);

    const previous = await this.prisma.payrollPeriod.findFirst({
      where: {
        companyId: period.companyId,
        OR: [
          { year: { lt: period.year } },
          { year: period.year, month: { lt: period.month } },
        ],
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });

    const currentPayslips = await this.prisma.payslip.findMany({
      where: {
        periodId,
        employee: employeeWhere,
        ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      },
      include: { employee: { select: { id: true, code: true, firstName: true, lastName: true } } },
      orderBy: { employee: { code: 'asc' } },
    });

    const previousPayslips = previous
      ? await this.prisma.payslip.findMany({
          where: {
            periodId: previous.id,
            employee: employeeWhere,
            ...(query.employeeId ? { employeeId: query.employeeId } : {}),
          },
        })
      : [];

    const previousMap = new Map(previousPayslips.map((p) => [p.employeeId, p]));

    const rows = currentPayslips.map((p) => {
      const prev = previousMap.get(p.employeeId);
      const currentGross = Number(p.grossAmount);
      const currentDeduction = Number(p.deductionAmount);
      const currentNet = Number(p.netAmount);
      const prevGross = prev ? Number(prev.grossAmount) : 0;
      const prevDeduction = prev ? Number(prev.deductionAmount) : 0;
      const prevNet = prev ? Number(prev.netAmount) : 0;
      return {
        employeeId: p.employeeId,
        employeeCode: p.employee.code,
        employeeName: `${p.employee.firstName} ${p.employee.lastName}`,
        current: { gross: currentGross, deductions: currentDeduction, net: currentNet },
        previous: { gross: prevGross, deductions: prevDeduction, net: prevNet },
        delta: {
          gross: currentGross - prevGross,
          deductions: currentDeduction - prevDeduction,
          net: currentNet - prevNet,
        },
        percent: {
          gross: prevGross === 0 ? null : Math.round(((currentGross - prevGross) / prevGross) * 10000) / 100,
          net: prevNet === 0 ? null : Math.round(((currentNet - prevNet) / prevNet) * 10000) / 100,
        },
      };
    });

    return {
      data: {
        current: { id: period.id, year: period.year, month: period.month, status: period.status },
        previous: previous
          ? { id: previous.id, year: previous.year, month: previous.month, status: previous.status }
          : null,
        rows,
        totals: {
          gross: rows.reduce((s, r) => s + r.current.gross, 0),
          deductions: rows.reduce((s, r) => s + r.current.deductions, 0),
          net: rows.reduce((s, r) => s + r.current.net, 0),
          deltaGross: rows.reduce((s, r) => s + r.delta.gross, 0),
          deltaDeductions: rows.reduce((s, r) => s + r.delta.deductions, 0),
          deltaNet: rows.reduce((s, r) => s + r.delta.net, 0),
        },
      },
      meta: {
        total: rows.length,
        page: 1,
        limit: rows.length,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  // ==========================================================================
  // متدهای داخلی
  // ==========================================================================

  private async recordFinancialAudit(db: Prisma.TransactionClient, userId: string, entry: AuditEntry) {
    await this.audit.recordInTransaction(db, userId, entry);
  }

  private async getPeriodEntity(id: string, db: Prisma.TransactionClient = this.prisma) {
    const period = await db.payrollPeriod.findUnique({ where: { id } });
    if (!period) throw new NotFoundException('دوره حقوق موردنظر یافت نشد.');
    return period;
  }

  /** شناسه شرکت‌هایی که کاربر به آن‌ها دسترسی دارد (null یعنی دسترسی کامل) */
  private async allowedCompanyIds(user: AuthenticatedUser): Promise<string[] | null> {
    // Whole-company periods and totals require an explicit company-wide grant.
    return user.isSuperAdmin || user.scope.unrestricted ? null : user.scope.companyIds;
  }

  private async assertCompanyAccess(user: AuthenticatedUser, companyId?: string): Promise<void> {
    if (user.scope?.unrestricted || user.isSuperAdmin) return;
    const allowed = await this.allowedCompanyIds(user);
    if (!allowed) return;
    if (companyId && !allowed.includes(companyId)) {
      throw new ForbiddenException('به این شرکت/دوره دسترسی ندارید.');
    }
  }

  private hasPermission(user: AuthenticatedUser, permission: string): boolean {
    if (user.isSuperAdmin) return true;
    const owned = user.permissions ?? [];
    return owned.includes(permission) || owned.includes('*');
  }

  /** تنظیمات سازمانی حقوق (خوانده‌شده از جدول Setting با مقادیر پیش‌فرض) */
  private async loadPayrollSettings(db: Prisma.TransactionClient = this.prisma) {
    const keys = [
      'payroll.overtime.multiplier',
      'payroll.insurance.employeePercent',
      'payroll.insurance.employerPercent',
    ];
    const rows = await db.setting.findMany({ where: { key: { in: keys } } });
    const map = new Map(rows.map((r) => [r.key, r.value]));
    const num = (key: string, fallback: number): number => {
      const raw = map.get(key);
      if (raw === null || raw === undefined || String(raw).trim() === '') return fallback;
      const value = Number(String(raw).replace(/[,٬\s]/g, ''));
      return Number.isFinite(value) ? value : fallback;
    };
    return {
      overtimeMultiplier: num('payroll.overtime.multiplier', 1.4),
      insuranceEmployeePercent: num('payroll.insurance.employeePercent', 7),
      insuranceEmployerPercent: num('payroll.insurance.employerPercent', 23),
    };
  }

  /** اطمینان از وجود اجزای استاندارد به‌همراه قاعده پایه */
  private async ensureCanonicalComponents(
    companyId: string,
    range: PeriodRange,
    db: Prisma.TransactionClient = this.prisma,
  ): Promise<Map<string, { componentId: string; ruleVersionId: string | null }>> {
    const result = new Map<string, { componentId: string; ruleVersionId: string | null }>();
    const existing = await db.payComponent.findMany({
      where: { companyId, code: { in: CANONICAL_CODES } },
    });
    const byCode = new Map(existing.map((c) => [c.code, c]));

    for (const def of CANONICAL_COMPONENTS) {
      let component = byCode.get(def.code);
      if (!component) {
        component = await db.payComponent.create({
          data: {
            companyId,
            code: def.code,
            name: def.name,
            type: def.type,
            calculationType: def.calculationType,
            amount: BigInt(0),
            isTaxable: def.type === PayComponentType.EARNING,
            isActive: true,
            sortOrder: def.sortOrder,
          },
        });
      }

      const ruleCount = await db.payRuleVersion.count({ where: { componentId: component.id } });
      if (ruleCount === 0) {
        await db.payRuleVersion.create({
          data: {
            componentId: component.id,
            version: 1,
            effectiveFrom: DEFAULT_RULE_EFFECTIVE_FROM,
            effectiveTo: null,
            configJson: JSON.stringify({ source: 'SYSTEM_DEFAULT' }),
          },
        });
      }

      result.set(def.code, {
        componentId: component.id,
        ruleVersionId: await this.resolveRuleVersion(component.id, range.startDate, range.end, db),
      });
    }

    return result;
  }

  /** نسخه قاعده معتبر در بازه دوره */
  private async resolveRuleVersion(
    componentId: string,
    start: Date,
    end: Date,
    db: Prisma.TransactionClient = this.prisma,
  ): Promise<string | null> {
    const rule = await db.payRuleVersion.findFirst({
      where: {
        componentId,
        effectiveFrom: { lte: end },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: start } }],
      },
      orderBy: [{ effectiveFrom: 'desc' }, { version: 'desc' }],
    });
    return rule?.id ?? null;
  }

  /** نسبت کارکرد کارمند در دوره (بر اساس روز کاری ماه) */
  private prorateRatio(
    hireDate: Date,
    terminationDate: Date | null,
    range: PeriodRange,
    workingDaysPerMonth: number,
  ): number {
    if (!workingDaysPerMonth) return 0;
    const start = Math.max(this.utcMidnight(hireDate).getTime(), range.startDate.getTime());
    const end = terminationDate
      ? Math.min(this.utcMidnight(terminationDate).getTime(), range.endDate.getTime())
      : range.endDate.getTime();
    if (end < start) return 0;
    const employedDays = Math.round((end - start) / 86_400_000) + 1;
    const workingDays = Math.round((employedDays * workingDaysPerMonth) / range.daysInMonth);
    return workingDays / workingDaysPerMonth;
  }

  private ratioLabel(ratio: number): string {
    const percent = Math.round(ratio * 100);
    return `${percent}٪ (${percent} از ${100})`.replace('٪ (', '٪ — ');
  }

  /** دقیقه مرخصی حقوق‌دار کارمند در بازه دوره */
  private paidLeaveMinutesFor(
    leaves: { employeeId: string; startAt: Date; endAt: Date; durationMinutes: number }[],
    employeeId: string,
    range: PeriodRange,
  ): number {
    let total = 0;
    for (const leave of leaves) {
      if (leave.employeeId !== employeeId) continue;
      const overlapStart = Math.max(leave.startAt.getTime(), range.startDate.getTime());
      const overlapEnd = Math.min(leave.endAt.getTime(), range.end.getTime());
      if (overlapEnd <= overlapStart) continue;
      const totalMs = leave.endAt.getTime() - leave.startAt.getTime();
      if (totalMs <= 0) {
        total += leave.durationMinutes;
        continue;
      }
      const overlapMs = overlapEnd - overlapStart;
      total += Math.round((leave.durationMinutes * overlapMs) / totalMs);
    }
    return total;
  }

  private componentTypeOf(code: string): PayComponentType {
    const found = CANONICAL_COMPONENTS.find((c) => c.code === code);
    return found ? found.type : PayComponentType.EARNING;
  }

  /** بازمحاسبه فیش‌های حقوقی و جمع دوره از روی اقلام */
  private async recalculatePayslips(periodId: string, db: Prisma.TransactionClient = this.prisma) {
    const items = await db.payrollItem.findMany({
      where: { periodId },
      include: { component: { select: { type: true, code: true } } },
    });

    const byEmployee = new Map<string, { gross: bigint; deduction: bigint }>();
    for (const item of items) {
      const bucket = byEmployee.get(item.employeeId) ?? { gross: BigInt(0), deduction: BigInt(0) };
      if (item.component.type === PayComponentType.EARNING) bucket.gross += item.amount;
      else if (item.component.type === PayComponentType.DEDUCTION) bucket.deduction += item.amount;
      byEmployee.set(item.employeeId, bucket);
    }

    let totalGross = BigInt(0);
    let totalDeductions = BigInt(0);
    let totalNet = BigInt(0);
    let payslips = 0;

    for (const [employeeId, bucket] of byEmployee.entries()) {
      const net = bucket.gross - bucket.deduction;
      const existing = await db.payslip.findUnique({
        where: { periodId_employeeId: { periodId, employeeId } },
      });
      await db.payslip.upsert({
        where: { periodId_employeeId: { periodId, employeeId } },
        create: {
          periodId,
          employeeId,
          grossAmount: bucket.gross,
          deductionAmount: bucket.deduction,
          netAmount: net,
          status: 'DRAFT',
        },
        update: {
          grossAmount: bucket.gross,
          deductionAmount: bucket.deduction,
          netAmount: net,
          ...(existing && existing.status === 'PUBLISHED' ? {} : { status: 'DRAFT' }),
        },
      });
      totalGross += bucket.gross;
      totalDeductions += bucket.deduction;
      totalNet += net;
      payslips += 1;
    }

    return {
      totalGross: Number(totalGross),
      totalDeductions: Number(totalDeductions),
      totalNet: Number(totalNet),
      payslips,
    };
  }

  private async loadPayslipItems(periodId: string, employeeId: string) {
    return this.prisma.payrollItem.findMany({
      where: { periodId, employeeId },
      include: { component: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  private async logPayslipView(payslipId: string, userId: string, ctx: AuditContext): Promise<void> {
    await this.prisma.payslipViewLog.create({
      data: { payslipId, userId, ip: ctx.ip ?? null, viewedAt: new Date() },
    });
  }

  private parseDateOnly(value: string, label: string): Date {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`${label} نامعتبر است.`);
    }
    return this.utcMidnight(parsed);
  }

  private utcMidnight(date: Date): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  }

  private safeParseJson(value: string): any {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  // --- تبدیل تقویم شمسی ---

  private jalCal(jy: number) {
    const breaks = [
      -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262,
      2324, 2394, 2456, 3178,
    ];
    const bl = breaks.length;
    const gy = jy + 621;
    let leapJ = -14;
    let jp = breaks[0];
    if (jy < jp || jy >= breaks[bl - 1]) {
      throw new BadRequestException('سال شمسی معتبر نیست.');
    }

    let jump = 0;
    for (let i = 1; i < bl; i += 1) {
      const jm = breaks[i];
      jump = jm - jp;
      if (jy < jm) break;
      leapJ = leapJ + Math.trunc(jump / 33) * 8 + Math.trunc((jump % 33) / 4);
      jp = jm;
    }

    let n = jy - jp;
    leapJ = leapJ + Math.trunc(n / 33) * 8 + Math.trunc(((n % 33) + 3) / 4);
    if (jump % 33 === 4 && jump - n === 4) leapJ += 1;

    const leapG = Math.trunc(gy / 4) - Math.trunc((Math.trunc(gy / 100) + 1) * 3 / 4) - 150;
    const march = 20 + leapJ - leapG;

    if (jump - n < 6) n = n - jump + Math.trunc((jump + 4) / 33) * 33;
    let leap = (((n + 1) % 33) % 4) + 0;
    leap = ((n + 1) % 33) % 4;
    if (leap === -1) leap = 4;

    return { leap, gy, march };
  }

  private g2d(gy: number, gm: number, gd: number): number {
    let d =
      Math.trunc(((gy + Math.trunc((gm - 8) / 6) + 100100) * 1461) / 4) +
      Math.trunc((153 * ((gm + 9) % 12) + 2) / 5) +
      gd -
      34840408;
    d = d - Math.trunc((Math.trunc((gy + 100100 + Math.trunc((gm - 8) / 6)) / 100) * 3) / 4) + 752;
    return d;
  }

  private d2g(jdn: number): { gy: number; gm: number; gd: number } {
    let j = 4 * jdn + 139361631;
    j = j + Math.trunc((4 * jdn + 183187720) / 146097) * 3 * 4 - 3908;
    const i = Math.trunc((j % 1461) / 4) * 5 + 308;
    const gd = Math.trunc((i % 153) / 5) + 1;
    const gm = (Math.trunc(i / 153) % 12) + 1;
    const gy = Math.trunc(j / 1461) - 100100 + Math.trunc((8 - gm) / 6);
    return { gy, gm, gd };
  }

  /** تبدیل تاریخ شمسی به تاریخ میلادی (نیمه‌شب UTC) */
  private jalaaliToUtcDate(jy: number, jm: number, jd: number): Date {
    const r = this.jalCal(jy);
    const jdn =
      this.g2d(r.gy, 3, r.march) +
      (jm - 1) * 31 -
      Math.trunc(jm / 7) * (jm - 7) +
      jd -
      1;
    const g = this.d2g(jdn);
    return new Date(Date.UTC(g.gy, g.gm - 1, g.gd));
  }

  /** تعداد روزهای ماه شمسی */
  private daysInJalaliMonth(jy: number, jm: number): number {
    if (jm <= 6) return 31;
    if (jm <= 11) return 30;
    return this.jalCal(jy).leap === 0 ? 30 : 29;
  }

  /** بازه زمانی دوره حقوق */
  private periodRange(jy: number, jm: number): PeriodRange {
    const daysInMonth = this.daysInJalaliMonth(jy, jm);
    const startDate = this.jalaaliToUtcDate(jy, jm, 1);
    const endDate = this.jalaaliToUtcDate(jy, jm, daysInMonth);
    const endExclusive = new Date(endDate.getTime() + 86_400_000);
    return {
      startDate,
      end: new Date(endExclusive.getTime() - 1),
      endExclusive,
      endDate,
      daysInMonth,
    };
  }

  // --- نگاشت خروجی‌ها ---

  private componentToPublic(c: any) {
    return {
      id: c.id,
      companyId: c.companyId,
      code: c.code,
      name: c.name,
      type: c.type,
      calculationType: c.calculationType,
      amount: Number(c.amount ?? 0),
      formula: c.formula ?? null,
      isTaxable: c.isTaxable,
      isActive: c.isActive,
      sortOrder: c.sortOrder,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    };
  }

  private periodToPublic(p: any) {
    return {
      id: p.id,
      companyId: p.companyId,
      company: p.company ?? null,
      year: p.year,
      month: p.month,
      status: p.status,
      lockedAt: p.lockedAt ?? null,
      lockedById: p.lockedById ?? null,
      generatedAt: p.generatedAt ?? null,
      totalGross: Number(p.totalGross ?? 0),
      totalDeductions: Number(p.totalDeductions ?? 0),
      totalNet: Number(p.totalNet ?? 0),
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  }

  private payslipToPublic(p: any, withItems = false) {
    const base = {
      id: p.id,
      periodId: p.periodId,
      employeeId: p.employeeId,
      employee: p.employee ?? null,
      grossAmount: Number(p.grossAmount ?? 0),
      deductionAmount: Number(p.deductionAmount ?? 0),
      netAmount: Number(p.netAmount ?? 0),
      status: p.status,
      publishedAt: p.publishedAt ?? null,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
    if (!withItems) return base;
    return {
      ...base,
      period: p.period ?? null,
      items: (p.items ?? []).map((i: any) => ({
        id: i.id,
        componentId: i.componentId,
        componentCode: i.component?.code,
        componentName: i.component?.name,
        componentType: i.component?.type,
        ruleVersionId: i.ruleVersionId ?? null,
        amount: Number(i.amount ?? 0),
        quantity: i.quantity,
        note: i.note ?? null,
      })),
    };
  }

  private amendmentToPublic(a: any) {
    return {
      id: a.id,
      periodId: a.periodId,
      period: a.period ?? null,
      employeeId: a.employeeId,
      employee: a.employee ?? null,
      reason: a.reason,
      items: a.itemsJson ? this.safeParseJson(a.itemsJson) : [],
      status: a.status,
      createdById: a.createdById ?? null,
      approvedById: a.approvedById ?? null,
      createdAt: a.createdAt,
      decidedAt: a.decidedAt ?? null,
    };
  }

  private reportRow(p: any) {
    const items = p.items ?? [];
    const sumByCode = (code: string) =>
      items
        .filter((i: any) => i.component?.code === code)
        .reduce((s: number, i: any) => s + Number(i.amount ?? 0), 0);

    return {
      employeeId: p.employeeId,
      employeeCode: p.employee?.code ?? '',
      employeeName: `${p.employee?.firstName ?? ''} ${p.employee?.lastName ?? ''}`.trim(),
      orgUnit: p.employee?.orgUnit?.name ?? '',
      position: p.employee?.position?.title ?? '',
      baseSalary: sumByCode('BASE_SALARY'),
      overtime: sumByCode('OVERTIME'),
      leavePay: sumByCode('LEAVE_PAY'),
      gross: Number(p.grossAmount ?? 0),
      insurance: sumByCode('INSURANCE'),
      loanDeduction: sumByCode('LOAN_INSTALLMENT'),
      deductions: Number(p.deductionAmount ?? 0),
      net: Number(p.netAmount ?? 0),
      employerCost: sumByCode('INSURANCE_EMPLOYER'),
    };
  }
}
