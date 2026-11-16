import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, ContractStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { AccessService } from '../common/access/access.service';
import { AuditService } from '../common/audit/audit.service';
import { NotificationService } from '../common/notifications/notification.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';
import { employeeVisibility } from '../employees/employee-privacy';
import { CreateContractDto, CreateContractVersionDto, ContractQueryDto, UpdateContractDto } from './dto/contracts.dto';

const VERSION_MONEY_FIELDS = ['baseSalary', 'housingAllowance', 'foodAllowance', 'childAllowance', 'seniorityPay'] as const;
const NEXT_STATUS: Partial<Record<ContractStatus, ContractStatus>> = {
  DRAFT: ContractStatus.PENDING_APPROVAL,
  PENDING_APPROVAL: ContractStatus.READY_TO_SIGN,
  READY_TO_SIGN: ContractStatus.ACTIVE,
};

@Injectable()
export class ContractsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationService,
  ) {}

  async list(query: ContractQueryDto, pagination: PaginationDto, user: AuthenticatedUser) {
    const where: Prisma.ContractWhereInput = {
      deletedAt: null,
      employee: this.access.employeeWhereFor(user),
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      ...(query.companyId ? { companyId: query.companyId } : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const [total, rows] = await Promise.all([
      this.prisma.contract.count({ where }),
      this.prisma.contract.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          employee: { select: { id: true, code: true, firstName: true, lastName: true, employmentType: true } },
          versions: {
            orderBy: { version: 'desc' },
            take: 1,
          },
        },
      }),
    ]);

    return {
      data: rows.map((c) => ({ ...c, versions: c.versions.map((v) => this.versionPublic(v, user, c.employeeId)) })),
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

  /** قراردادهای در حال انقضا (۳۰ روز آینده) */
  async expiring(days: number, user: AuthenticatedUser) {
    const to = new Date();
    to.setDate(to.getDate() + days);
    const rows = await this.prisma.contract.findMany({
      where: {
        deletedAt: null,
        status: { in: [ContractStatus.ACTIVE, ContractStatus.EXPIRING] },
        employee: this.access.employeeWhereFor(user),
        versions: { some: { endDate: { gte: new Date(), lte: to } } },
      },
      include: {
        employee: { select: { id: true, code: true, firstName: true, lastName: true } },
        versions: { orderBy: { version: 'desc' }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
    });
    return {
      data: rows.map((c) => ({ ...c, versions: c.versions.map((v) => this.versionPublic(v, user, c.employeeId)) })),
      meta: { total: rows.length, page: 1, limit: rows.length, totalPages: 1, hasNext: false, hasPrev: false },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  async get(id: string, user: AuthenticatedUser) {
    const contract = await this.prisma.contract.findFirst({
      where: { id, deletedAt: null, employee: this.access.employeeWhereFor(user) },
      include: {
        employee: {
          select: { id: true, code: true, firstName: true, lastName: true, employmentType: true, status: true },
        },
        versions: { orderBy: { version: 'desc' } },
      },
    });
    if (!contract) throw new NotFoundException('قرارداد موردنظر یافت نشد.');
    await this.audit.recordView(user.id, 'Contract', id);
    return {
      data: { ...contract, versions: contract.versions.map((v) => this.versionPublic(v, user, contract.employeeId)) },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  /** ایجاد قرارداد با نسخه اول */
  async create(dto: CreateContractDto, user: AuthenticatedUser) {
    if (dto.endDate && new Date(dto.startDate) >= new Date(dto.endDate)) {
      throw new BadRequestException('تاریخ پایان قرارداد باید بعد از تاریخ شروع باشد.');
    }
    const employee = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, deletedAt: null, AND: [this.access.employeeWhereFor(user)] },
    });
    if (!employee) throw new NotFoundException('نیروی موردنظر یافت نشد.');

    const contract = await this.prisma.contract.create({
      data: {
        employeeId: employee.id,
        companyId: employee.companyId,
        status: ContractStatus.DRAFT,
        versions: {
          create: this.versionData(dto, 1, user.id, 'ایجاد قرارداد'),
        },
      },
    });

    await this.audit.record(user.id, {
      action: AuditAction.CREATE,
      entity: 'Contract',
      entityId: contract.id,
      after: { employeeId: employee.id, contractType: dto.contractType },
    });

    return {
      data: { id: contract.id },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  /** ایجاد نسخه جدید قرارداد (تمدید/تغییر شرایط) */
  async addVersion(id: string, dto: CreateContractVersionDto, user: AuthenticatedUser) {
    const contract = await this.getContract(id, user);
    const version = contract.currentVersion + 1;

    await this.prisma.contractVersion.create({
      data: this.versionData(dto, version, user.id, dto.changeReason),
    });
    await this.prisma.contract.update({
      where: { id },
      data: { currentVersion: version },
    });

    if (dto.endDate) {
      await this.prisma.contract.update({
        where: { id },
        data: { status: ContractStatus.RENEWED },
      });
    }

    await this.audit.record(user.id, {
      action: AuditAction.CREATE,
      entity: 'ContractVersion',
      entityId: id,
      after: { version, changeReason: dto.changeReason },
    });

    if (contract.employee.userId) {
      await this.notifications.notify(contract.employee.userId, {
        type: 'SYSTEM',
        title: 'نسخه جدید قرارداد ثبت شد',
        body: `نسخه ${version} قرارداد شما با دلیل «${dto.changeReason}» ثبت شد.`,
        link: `/contracts/${id}`,
      });
    }

    return {
      data: { id, version },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  /** تغییر وضعیت قرارداد (سرور قاعده تأیید را اعمال می‌کند) */
  async setStatus(id: string, dto: UpdateContractDto, user: AuthenticatedUser) {
    const contract = await this.getContract(id, user);
    const target = dto.status;
    if (!target) throw new BadRequestException('وضعیت مقصد ارسال نشده است.');

    // قاعده سرور: هیچ‌کس قرارداد خودش را تأیید نمی‌کند
    if (
      (target === ContractStatus.ACTIVE || target === ContractStatus.PENDING_APPROVAL || target === ContractStatus.READY_TO_SIGN)
      && contract.employeeId && user.employeeId === contract.employeeId && !user.isSuperAdmin
    ) {
      throw new BadRequestException('هیچ‌کس اجازه تأیید قرارداد خودش را ندارد.');
    }

    await this.prisma.contract.update({ where: { id }, data: { status: target } });
    await this.audit.record(user.id, {
      action: target === ContractStatus.ACTIVE ? AuditAction.APPROVE : AuditAction.UPDATE,
      entity: 'Contract',
      entityId: id,
      before: { status: contract.status },
      after: { status: target },
    });

    if (contract.employee.userId) {
      await this.notifications.notify(contract.employee.userId, {
        type: 'SYSTEM',
        title: 'وضعیت قرارداد تغییر کرد',
        body: `وضعیت قرارداد شما به «${target}» تغییر کرد.`,
        link: `/contracts/${id}`,
      });
    }

    return {
      data: { id, status: target },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  /** حذف منطقی */
  async remove(id: string, user: AuthenticatedUser) {
    const contract = await this.getContract(id, user);
    if (contract.status === ContractStatus.ACTIVE) {
      throw new BadRequestException('قرارداد فعال قابل حذف نیست؛ ابتدا آن را خاتمه دهید.');
    }
    await this.prisma.contract.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit.record(user.id, {
      action: AuditAction.DELETE,
      entity: 'Contract',
      entityId: id,
      before: { status: contract.status },
    });
    return { success: true, timestamp: new Date().toISOString() };
  }

  private async getContract(id: string, user: AuthenticatedUser) {
    const contract = await this.prisma.contract.findFirst({
      where: { id, deletedAt: null, employee: this.access.employeeWhereFor(user) },
      include: {
        employee: { select: { id: true, userId: true, code: true, firstName: true, lastName: true } },
      },
    });
    if (!contract) throw new NotFoundException('قرارداد موردنظر یافت نشد یا به حوزه دسترسی شما تعلق ندارد.');
    return contract;
  }

  private versionData(dto: CreateContractDto | CreateContractVersionDto, version: number, actorId: string, reason: string) {
    const data: Prisma.ContractVersionUncheckedCreateInput = {
      contractId: undefined as never,
      version,
      contractType: String((dto as CreateContractDto).contractType ?? 'CONTRACTUAL'),
      startDate: new Date((dto as CreateContractDto).startDate),
      endDate: (dto as CreateContractDto).endDate ? new Date((dto as CreateContractDto).endDate as string) : null,
      effectiveDate: new Date((dto as CreateContractDto).effectiveDate ?? (dto as CreateContractDto).startDate),
      workHoursPerDay: (dto as CreateContractDto).workHoursPerDay ?? 8,
      workHoursPerMonth: (dto as CreateContractDto).workHoursPerMonth ?? 220,
      terms: (dto as CreateContractDto).terms ?? null,
      changeReason: reason,
      createdById: actorId,
    };
    for (const f of VERSION_MONEY_FIELDS) {
      (data as any)[f] = BigInt((dto as any)[f] ?? 0);
    }
    return data;
  }

  private versionPublic(v: Prisma.ContractVersionGetPayload<Record<string, never>>, user: AuthenticatedUser, employeeId: string) {
    const visibility = employeeVisibility(user, employeeId);
    return {
      ...v,
      terms: visibility.personal ? v.terms : null,
      changeReason: visibility.personal ? v.changeReason : null,
      baseSalary: visibility.salary ? Number(v.baseSalary) : null,
      housingAllowance: visibility.salary ? Number(v.housingAllowance) : null,
      foodAllowance: visibility.salary ? Number(v.foodAllowance) : null,
      childAllowance: visibility.salary ? Number(v.childAllowance) : null,
      seniorityPay: visibility.salary ? Number(v.seniorityPay) : null,
    };
  }
}
