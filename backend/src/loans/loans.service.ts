import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, BenefitStatus, LoanStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { AccessService } from '../common/access/access.service';
import { AuditService } from '../common/audit/audit.service';
import { NotificationService } from '../common/notifications/notification.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';
import {
  AssignBenefitDto,
  BenefitTypeQueryDto,
  CreateBenefitPackageDto,
  CreateBenefitTypeDto,
  CreateLoanDto,
  DecideLoanDto,
  DisburseLoanDto,
  EmployeeBenefitQueryDto,
  LoanQueryDto,
  PayInstallmentDto,
  UpdateBenefitStatusDto,
  UpdateBenefitTypeDto,
} from './dto/loans.dto';

@Injectable()
export class LoansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationService,
  ) {}

  // =========================================================================
  // وام و مساعده
  // =========================================================================

  async listLoans(query: LoanQueryDto, pagination: PaginationDto, user: AuthenticatedUser) {
    const where: Prisma.LoanWhereInput = {
      employee: this.access.employeeWhereFor(user),
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      ...(query.status ? { status: query.status as LoanStatus } : {}),
      ...(query.loanType ? { loanType: query.loanType } : {}),
    };

    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const [total, rows] = await Promise.all([
      this.prisma.loan.count({ where }),
      this.prisma.loan.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          employee: { select: { id: true, code: true, firstName: true, lastName: true } },
          installments: { orderBy: { dueDate: 'asc' } },
        },
      }),
    ]);

    // نام تأییدکننده‌ها (مدل رابطه مستقیم ندارد)
    const approverIds = [...new Set(rows.map((r) => r.approvedById).filter(Boolean))] as string[];
    const approvers = approverIds.length
      ? await this.prisma.user.findMany({ where: { id: { in: approverIds } }, select: { id: true, fullName: true } })
      : [];

    return {
      data: rows.map((l) => ({
        ...l,
        approvedBy: approvers.find((u) => u.id === l.approvedById) ?? null,
        amount: Number(l.amount),
        monthlyAmount: Number(l.monthlyAmount),
        installments: l.installments.map((i) => ({
          ...i,
          amount: Number(i.amount),
          paidAmount: Number(i.paidAmount),
        })),
      })),
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

  async getLoan(id: string, user: AuthenticatedUser) {
    const loan = await this.prisma.loan.findFirst({
      where: { id, employee: this.access.employeeWhereFor(user) },
      include: {
        employee: { select: { id: true, code: true, firstName: true, lastName: true } },
        installments: { orderBy: { dueDate: 'asc' } },
      },
    });
    if (!loan) throw new NotFoundException('وام موردنظر یافت نشد.');
    const approver = loan.approvedById
      ? await this.prisma.user.findUnique({ where: { id: loan.approvedById }, select: { id: true, fullName: true } })
      : null;
    return {
      data: {
        ...loan,
        approvedBy: approver,
        amount: Number(loan.amount),
        monthlyAmount: Number(loan.monthlyAmount),
        installments: loan.installments.map((i) => ({ ...i, amount: Number(i.amount), paidAmount: Number(i.paidAmount) })),
      },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  /** ثبت درخواست وام + تولید خودکار اقساط */
  async createLoan(dto: CreateLoanDto, user: AuthenticatedUser) {
    const ok = await this.access.canAccessEmployee(user, dto.employeeId);
    if (!ok) throw new ForbiddenException('به پرونده این نیرو دسترسی ندارید.');

    if (dto.installmentCount > 60) throw new BadRequestException('حداکثر تعداد اقساط ۶۰ است.');

    const monthlyAmount = Math.floor(dto.amount / dto.installmentCount);
    if (monthlyAmount <= 0) throw new BadRequestException('مبلغ ماهانه محاسبه‌شده نامعتبر است.');

    // تاریخ شروع اقساط: ماه بعد اگر مشخص نشده باشد
    const first = dto.firstDueDate ? new Date(dto.firstDueDate) : new Date();
    if (!dto.firstDueDate) first.setMonth(first.getMonth() + 1);

    const loan = await this.prisma.loan.create({
      data: {
        employeeId: dto.employeeId,
        loanType: dto.loanType ?? 'LOAN',
        amount: BigInt(dto.amount),
        installmentCount: dto.installmentCount,
        monthlyAmount: BigInt(monthlyAmount),
        interestRate: dto.interestRate ?? 0,
        purpose: dto.purpose ?? null,
        status: LoanStatus.PENDING_APPROVAL,
        installments: {
          create: Array.from({ length: dto.installmentCount }, (_, index) => {
            const due = new Date(first);
            due.setMonth(due.getMonth() + index);
            const amount =
              index === dto.installmentCount - 1
                ? dto.amount - monthlyAmount * (dto.installmentCount - 1) // قسط آخر با باقی‌مانده دقیق
                : monthlyAmount;
            return { dueDate: due, amount: BigInt(amount) };
          }),
        },
      },
      include: { installments: true },
    });

    await this.audit.record(user.id, {
      action: AuditAction.CREATE,
      entity: 'Loan',
      entityId: loan.id,
      after: { employeeId: dto.employeeId, amount: dto.amount, installments: dto.installmentCount },
    });

    return {
      data: { id: loan.id, status: loan.status, monthlyAmount },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  /** تأیید/رد وام — قاعده سرور: هیچ‌کس وام خودش را تأیید نمی‌کند */
  async decideLoan(id: string, dto: DecideLoanDto, user: AuthenticatedUser) {
    const loan = await this.prisma.loan.findUnique({
      where: { id },
      include: { employee: { select: { id: true, userId: true } } },
    });
    if (!loan) throw new NotFoundException('وام موردنظر یافت نشد.');
    if (loan.status !== LoanStatus.PENDING_APPROVAL) {
      throw new BadRequestException('این درخواست در مرحله قابل تصمیم نیست.');
    }
    if (loan.employeeId === user.employeeId && !user.isSuperAdmin) {
      throw new ForbiddenException('هیچ‌کس اجازه تأیید وام خودش را ندارد.');
    }

    const approved = dto.decision === 'APPROVE';
    await this.prisma.loan.update({
      where: { id },
      data: {
        status: approved ? LoanStatus.APPROVED : LoanStatus.REJECTED,
        approvedById: approved ? user.id : null,
      },
    });

    if (loan.employee.userId) {
      await this.notifications.notify(loan.employee.userId, {
        type: 'REQUEST_RESULT',
        title: approved ? 'درخواست وام تأیید شد' : 'درخواست وام رد شد',
        body: dto.comment ?? undefined,
        link: `/loans/${id}`,
      });
    }

    await this.audit.record(user.id, {
      action: approved ? AuditAction.APPROVE : AuditAction.REJECT,
      entity: 'Loan',
      entityId: id,
      after: { decision: dto.decision, comment: dto.comment },
    });

    return {
      data: { id, status: approved ? LoanStatus.APPROVED : LoanStatus.REJECTED },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  /** ثبت پرداخت وام و فعال‌سازی فرآیند اقساط */
  async disburseLoan(id: string, dto: DisburseLoanDto, user: AuthenticatedUser) {
    const loan = await this.prisma.loan.findUnique({ where: { id } });
    if (!loan) throw new NotFoundException('وام موردنظر یافت نشد.');
    if (loan.status !== LoanStatus.APPROVED) {
      throw new BadRequestException('فقط وام تأییدشده قابل پرداخت است.');
    }

    await this.prisma.loan.update({
      where: { id },
      data: {
        status: LoanStatus.SETTLING,
        disbursedAt: new Date(dto.disbursedAt),
      },
    });

    await this.audit.record(user.id, {
      action: AuditAction.UPDATE,
      entity: 'Loan',
      entityId: id,
      after: { status: LoanStatus.SETTLING, disbursedAt: dto.disbursedAt },
    });

    return {
      data: { id, status: LoanStatus.SETTLING },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  /** ثبت کسر/پرداخت قسط در دوره حقوق */
  async payInstallment(installmentId: string, dto: PayInstallmentDto, user: AuthenticatedUser) {
    const installment = await this.prisma.loanInstallment.findUnique({
      where: { id: installmentId },
      include: { loan: { include: { employee: { select: { id: true } } } } },
    });
    if (!installment) throw new NotFoundException('قسط یافت نشد.');
    const ok = await this.access.canAccessEmployee(user, installment.loan.employeeId);
    if (!ok) throw new ForbiddenException('به پرونده این نیرو دسترسی ندارید.');
    if (installment.status === 'PAID') throw new BadRequestException('این قسط قبلاً تسویه شده است.');

    const newPaid = Number(installment.paidAmount) + dto.amount;
    if (newPaid > Number(installment.amount)) {
      throw new BadRequestException('مبلغ پرداختی بیش از مبلغ قسط است.');
    }

    const paid = newPaid === Number(installment.amount);
    await this.prisma.loanInstallment.update({
      where: { id: installmentId },
      data: {
        paidAmount: BigInt(newPaid),
        payrollPeriodId: dto.payrollPeriodId,
        status: paid ? 'PAID' : 'PARTIAL',
        paidAt: paid ? new Date() : null,
      },
    });

    // اگر همه اقساط پرداخت شد، وام تسویه‌شده می‌شود
    if (paid) {
      const remaining = await this.prisma.loanInstallment.count({
        where: { loanId: installment.loanId, status: { not: 'PAID' } },
      });
      if (remaining === 0) {
        await this.prisma.loan.update({
          where: { id: installment.loanId },
          data: { status: LoanStatus.SETTLED, settledAt: new Date() },
        });
      }
    }

    await this.audit.record(user.id, {
      action: AuditAction.UPDATE,
      entity: 'LoanInstallment',
      entityId: installmentId,
      after: { paidAmount: newPaid, status: paid ? 'PAID' : 'PARTIAL' },
    });

    return {
      data: { id: installmentId, paidAmount: newPaid, fullyPaid: paid },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  // =========================================================================
  // انواع مزایا
  // =========================================================================

  async listBenefitTypes(query: BenefitTypeQueryDto, pagination: PaginationDto) {
    const where: Prisma.BenefitTypeWhereInput = {
      ...(query.companyId ? { companyId: query.companyId } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { code: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const [total, rows] = await Promise.all([
      this.prisma.benefitType.count({ where }),
      this.prisma.benefitType.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { name: 'asc' },
        include: { company: { select: { id: true, code: true, name: true } } },
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

  async createBenefitType(dto: CreateBenefitTypeDto, user: AuthenticatedUser) {
    const duplicate = await this.prisma.benefitType.findUnique({
      where: { companyId_code: { companyId: dto.companyId, code: dto.code.trim() } },
    });
    if (duplicate) throw new BadRequestException(`کد مزایا «${dto.code}» قبلاً ثبت شده است.`);

    const row = await this.prisma.benefitType.create({
      data: {
        companyId: dto.companyId,
        code: dto.code.trim(),
        name: dto.name.trim(),
        description: dto.description ?? null,
      },
    });

    await this.audit.record(user.id, {
      action: AuditAction.CREATE,
      entity: 'BenefitType',
      entityId: row.id,
      after: { code: row.code, name: row.name },
    });

    return {
      data: { id: row.id },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  async updateBenefitType(id: string, dto: UpdateBenefitTypeDto, user: AuthenticatedUser) {
    const type = await this.prisma.benefitType.findUnique({ where: { id } });
    if (!type) throw new NotFoundException('نوع مزایا یافت نشد.');

    const row = await this.prisma.benefitType.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });

    await this.audit.record(user.id, {
      action: AuditAction.UPDATE,
      entity: 'BenefitType',
      entityId: id,
      after: { isActive: row.isActive },
    });

    return {
      data: { id: row.id },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  // =========================================================================
  // بسته‌های مزایا
  // =========================================================================

  async listPackages(pagination: PaginationDto, companyId?: string) {
    const where: Prisma.BenefitPackageWhereInput = {
      ...(companyId ? { companyId } : {}),
    };

    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const [total, rows] = await Promise.all([
      this.prisma.benefitPackage.count({ where }),
      this.prisma.benefitPackage.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          items: {
            include: { benefitType: { select: { id: true, code: true, name: true } } },
          },
          _count: { select: { benefits: true } },
        },
      }),
    ]);

    return {
      data: rows.map((p) => ({
        ...p,
        items: p.items.map((i) => ({
          ...i,
          companyShare: Number(i.companyShare),
          employeeShare: Number(i.employeeShare),
          capAmount: i.capAmount === null ? null : Number(i.capAmount),
        })),
      })),
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

  async createPackage(dto: CreateBenefitPackageDto, user: AuthenticatedUser) {
    const ids = dto.items.map((i) => i.benefitTypeId);
    const unique = new Set(ids);
    if (unique.size !== ids.length) {
      throw new BadRequestException('هر نوع مزایا فقط یک‌بار در بسته می‌تواند باشد.');
    }

    const row = await this.prisma.benefitPackage.create({
      data: {
        companyId: dto.companyId,
        name: dto.name.trim(),
        description: dto.description ?? null,
        items: {
          create: dto.items.map((i) => ({
            benefitTypeId: i.benefitTypeId,
            companyShare: BigInt(i.companyShare ?? 0),
            employeeShare: BigInt(i.employeeShare ?? 0),
            capAmount: i.capAmount !== undefined && i.capAmount !== null ? BigInt(i.capAmount) : null,
            period: i.period ?? null,
          })),
        },
      },
      include: { items: true },
    });

    await this.audit.record(user.id, {
      action: AuditAction.CREATE,
      entity: 'BenefitPackage',
      entityId: row.id,
      after: { name: row.name, items: row.items.length },
    });

    return {
      data: { id: row.id },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  // =========================================================================
  // مزایای نیرو
  // =========================================================================

  async listEmployeeBenefits(query: EmployeeBenefitQueryDto, pagination: PaginationDto, user: AuthenticatedUser) {
    const where: Prisma.EmployeeBenefitWhereInput = {
      employee: this.access.employeeWhereFor(user),
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const [total, rows] = await Promise.all([
      this.prisma.employeeBenefit.count({ where }),
      this.prisma.employeeBenefit.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          employee: { select: { id: true, code: true, firstName: true, lastName: true } },
          benefitType: { select: { id: true, code: true, name: true } },
          package: { select: { id: true, name: true } },
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

  /** واگذاری مزایا (نوع مستقیم یا بسته کامل) */
  async assignBenefit(dto: AssignBenefitDto, user: AuthenticatedUser) {
    const ok = await this.access.canAccessEmployee(user, dto.employeeId);
    if (!ok) throw new ForbiddenException('به پرونده این نیرو دسترسی ندارید.');
    if (!dto.benefitTypeId && !dto.packageId) {
      throw new BadRequestException('یکی از benefitTypeId یا packageId الزامی است.');
    }

    const created: string[] = [];
    if (dto.benefitTypeId) {
      const row = await this.prisma.employeeBenefit.create({
        data: {
          employeeId: dto.employeeId,
          benefitTypeId: dto.benefitTypeId,
          startDate: dto.startDate ? new Date(dto.startDate) : null,
          endDate: dto.endDate ? new Date(dto.endDate) : null,
          note: dto.note ?? null,
        },
      });
      created.push(row.id);
    }

    if (dto.packageId) {
      const pkg = await this.prisma.benefitPackage.findUnique({
        where: { id: dto.packageId },
        include: { items: { select: { benefitTypeId: true } } },
      });
      if (!pkg || !pkg.isActive) throw new NotFoundException('بسته مزایا یافت نشد یا غیرفعال است.');

      const existing = await this.prisma.employeeBenefit.findMany({
        where: { employeeId: dto.employeeId, status: BenefitStatus.ACTIVE },
        select: { benefitTypeId: true },
      });
      const existingTypes = new Set(existing.map((b) => b.benefitTypeId));

      const rows = await this.prisma.$transaction(
        pkg.items
          .filter((i) => !existingTypes.has(i.benefitTypeId))
          .map((i) =>
            this.prisma.employeeBenefit.create({
              data: {
                employeeId: dto.employeeId,
                packageId: pkg.id,
                benefitTypeId: i.benefitTypeId,
                startDate: dto.startDate ? new Date(dto.startDate) : null,
                endDate: dto.endDate ? new Date(dto.endDate) : null,
                note: dto.note ?? null,
              },
            }),
          ),
      );
      created.push(...rows.map((r) => r.id));
    }

    await this.audit.record(user.id, {
      action: AuditAction.CREATE,
      entity: 'EmployeeBenefit',
      after: { employeeId: dto.employeeId, createdCount: created.length },
    });

    return {
      data: { createdIds: created },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  async updateBenefitStatus(id: string, dto: UpdateBenefitStatusDto, user: AuthenticatedUser) {
    const benefit = await this.prisma.employeeBenefit.findUnique({
      where: { id },
      include: { employee: { select: { id: true } } },
    });
    if (!benefit) throw new NotFoundException('مزایا یافت نشد.');
    const ok = await this.access.canAccessEmployee(user, benefit.employeeId);
    if (!ok) throw new ForbiddenException('به پرونده این نیرو دسترسی ندارید.');

    await this.prisma.employeeBenefit.update({ where: { id }, data: { status: dto.status } });

    await this.audit.record(user.id, {
      action: AuditAction.UPDATE,
      entity: 'EmployeeBenefit',
      entityId: id,
      after: { status: dto.status },
    });

    return {
      data: { id, status: dto.status },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }
}
