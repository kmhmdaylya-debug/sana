import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, AssetStatus, AssetHandoverType, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { AccessService } from '../common/access/access.service';
import { AuditService } from '../common/audit/audit.service';
import { NotificationService } from '../common/notifications/notification.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';
import {
  CreateAssetDto,
  CreateDepreciationDto,
  CreateHandoverDto,
  CreateMaintenanceDto,
  AssetQueryDto,
  UpdateAssetDto,
} from './dto/assets.dto';

@Injectable()
export class AssetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationService,
  ) {}

  private async scope(user: AuthenticatedUser): Promise<Prisma.AssetWhereInput> {
    if (user.isSuperAdmin || user.scope.unrestricted) return {};
    const companyIds = await this.access.allowedCompanyIds(user);
    return { companyId: { in: companyIds ?? [] }, OR: [
      { companyId: { in: user.scope.companyIds } },
      { orgUnitId: { in: user.scope.orgUnitIds } },
      { orgUnit: { is: { branchId: { in: user.scope.branchIds } } } },
      { currentHolder: { is: this.access.employeeWhereFor(user) } },
    ] };
  }

  async list(query: AssetQueryDto, pagination: PaginationDto, user: AuthenticatedUser) {
    const where: Prisma.AssetWhereInput = {
      AND: [await this.scope(user)],
      deletedAt: null,
      ...(query.companyId ? { companyId: query.companyId } : {}),
      ...(query.orgUnitId ? { orgUnitId: query.orgUnitId } : {}),
      ...(query.holderId ? { currentHolderId: query.holderId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.category ? { category: { contains: query.category, mode: 'insensitive' } } : {}),
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search, mode: 'insensitive' } },
              { name: { contains: query.search, mode: 'insensitive' } },
              { serialNumber: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const [total, rows] = await Promise.all([
      this.prisma.asset.count({ where }),
      this.prisma.asset.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { code: 'asc' },
        include: {
          orgUnit: { select: { id: true, name: true } },
          currentHolder: { select: { id: true, code: true, firstName: true, lastName: true } },
          _count: { select: { handovers: true, maintenances: true } },
        },
      }),
    ]);

    return {
      data: rows.map((a) => ({ ...a, purchasePrice: Number(a.purchasePrice) })),
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

  async get(id: string, user: AuthenticatedUser) {
    const row = await this.prisma.asset.findFirst({
      where: { id, deletedAt: null, AND: [await this.scope(user)] },
      include: {
        orgUnit: { select: { id: true, name: true } },
        currentHolder: { select: { id: true, code: true, firstName: true, lastName: true } },
        handovers: {
          orderBy: { handoverAt: 'desc' },
          include: {
            fromEmployee: { select: { code: true, firstName: true, lastName: true } },
            toEmployee: { select: { code: true, firstName: true, lastName: true } },
          },
        },
        maintenances: { orderBy: { performedAt: 'desc' } },
        depreciations: { orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }] },
      },
    });
    if (!row) throw new NotFoundException('دارایی موردنظر یافت نشد.');
    return {
      data: {
        ...row,
        purchasePrice: Number(row.purchasePrice),
        maintenances: row.maintenances.map((m) => ({ ...m, cost: Number(m.cost) })),
        depreciations: row.depreciations.map((d) => ({ ...d, amount: Number(d.amount), bookValue: Number(d.bookValue) })),
      },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  async create(dto: CreateAssetDto, user: AuthenticatedUser) {
    await this.access.assertOrganizationAccess(user, dto.companyId, null, dto.orgUnitId);
    const duplicate = await this.prisma.asset.findUnique({ where: { code: dto.code.trim() } });
    if (duplicate) throw new BadRequestException(`کد دارایی «${dto.code}» قبلاً ثبت شده است.`);

    const row = await this.prisma.asset.create({
      data: {
        companyId: dto.companyId,
        orgUnitId: dto.orgUnitId ?? null,
        code: dto.code.trim(),
        name: dto.name.trim(),
        category: dto.category.trim(),
        brand: dto.brand ?? null,
        model: dto.model ?? null,
        serialNumber: dto.serialNumber ?? null,
        purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : null,
        purchasePrice: BigInt(dto.purchasePrice ?? 0),
        warrantyEnd: dto.warrantyEnd ? new Date(dto.warrantyEnd) : null,
        status: dto.status ?? AssetStatus.IN_STOCK,
        condition: dto.condition ?? null,
        note: dto.note ?? null,
      },
    });

    await this.audit.record(user.id, {
      action: AuditAction.CREATE,
      entity: 'Asset',
      entityId: row.id,
      after: { code: row.code, name: row.name },
    });

    return {
      data: { id: row.id },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  async update(id: string, dto: UpdateAssetDto, user: AuthenticatedUser) {
    const asset = await this.getEntity(id, user);
    if (dto.orgUnitId !== undefined) await this.access.assertOrganizationAccess(user, asset.companyId, null, dto.orgUnitId);
    if (dto.status !== undefined && dto.status !== asset.status && (dto.status === AssetStatus.ASSIGNED || asset.currentHolderId)) throw new BadRequestException('وضعیت تحویل دارایی را از عملیات تحویل و عودت تغییر دهید.');
    const row = await this.prisma.asset.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.category !== undefined ? { category: dto.category.trim() } : {}),
        ...(dto.brand !== undefined ? { brand: dto.brand } : {}),
        ...(dto.model !== undefined ? { model: dto.model } : {}),
        ...(dto.serialNumber !== undefined ? { serialNumber: dto.serialNumber } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.condition !== undefined ? { condition: dto.condition } : {}),
        ...(dto.note !== undefined ? { note: dto.note } : {}),
        ...(dto.orgUnitId !== undefined ? { orgUnitId: dto.orgUnitId } : {}),
      },
    });
    await this.audit.record(user.id, {
      action: AuditAction.UPDATE,
      entity: 'Asset',
      entityId: id,
      after: { status: row.status, condition: row.condition },
    });
    return {
      data: { id: row.id },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  async remove(id: string, user: AuthenticatedUser) {
    const asset = await this.getEntity(id, user);
    if (asset.status === AssetStatus.ASSIGNED) {
      throw new BadRequestException('دارایی در اختیار نیروست؛ ابتدا آن را بازپس‌گیری کنید.');
    }
    await this.prisma.asset.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit.record(user.id, {
      action: AuditAction.DELETE,
      entity: 'Asset',
      entityId: id,
      before: { code: asset.code },
    });
    return { success: true, timestamp: new Date().toISOString() };
  }

  private async getEntity(id: string, user: AuthenticatedUser, db: Prisma.TransactionClient = this.prisma) {
    const asset = await db.asset.findFirst({
      where: { id, deletedAt: null, AND: [await this.scope(user)] },
      include: { currentHolder: { select: { id: true, userId: true } } },
    });
    if (!asset) throw new NotFoundException('دارایی موردنظر یافت نشد.');
    return asset;
  }

  // =========================================================================
  // تحویل / بازپس‌گیری / انتقال
  // =========================================================================

  async handover(dto: CreateHandoverDto, user: AuthenticatedUser) {
    const asset = await this.getEntity(dto.assetId, user);
    await this.access.assertEmployeeRelations(asset.companyId, { managerId: dto.toEmployeeId });
    if (dto.fromEmployeeId && dto.fromEmployeeId !== asset.currentHolderId) throw new BadRequestException('تحویل‌دهنده با دارندهٔ فعلی دارایی یکسان نیست.');
    if (asset.currentHolderId) await this.access.assertEmployeeAccess(user, asset.currentHolderId);

    if (dto.handoverType === AssetHandoverType.DELIVER || dto.handoverType === AssetHandoverType.TRANSFER) {
      if (!dto.toEmployeeId) throw new BadRequestException('تحویل‌گیرنده الزامی است.');
      const ok = await this.access.canAccessEmployee(user, dto.toEmployeeId);
      if (!ok) throw new ForbiddenException('به پرونده تحویل‌گیرنده دسترسی ندارید.');
    }

    if (dto.handoverType === AssetHandoverType.DELIVER && asset.status === AssetStatus.ASSIGNED) {
      throw new BadRequestException('این دارایی هم‌اکنون در اختیار نیروی دیگری است.');
    }

    const handover = await this.prisma.$transaction(async db => {
      await db.$queryRaw`SELECT id FROM "Asset" WHERE id = ${asset.id}::uuid FOR UPDATE`;
      const current = await this.getEntity(asset.id, user, db);
      if (current.currentHolderId !== asset.currentHolderId || current.status !== asset.status) throw new BadRequestException('دارایی هم‌زمان تغییر کرده است؛ دوباره تلاش کنید.');
      if (dto.handoverType !== AssetHandoverType.DELIVER && !current.currentHolderId) throw new BadRequestException('دارایی در اختیار کارمندی نیست.');
      const handover = await db.assetHandover.create({
      data: {
        assetId: asset.id,
        fromEmployeeId: dto.handoverType === AssetHandoverType.RETURN ? asset.currentHolderId : (dto.fromEmployeeId ?? asset.currentHolderId),
        toEmployeeId: dto.handoverType === AssetHandoverType.RETURN ? null : (dto.toEmployeeId ?? null),
        handoverType: dto.handoverType,
        condition: dto.condition ?? null,
        note: dto.note ?? null,
      },
    });

    // به‌روزرسانی وضعیت دارایی
    if (dto.handoverType === AssetHandoverType.RETURN) {
      await db.asset.update({
        where: { id: asset.id },
        data: { status: AssetStatus.IN_STOCK, currentHolderId: null },
      });
    } else if (dto.toEmployeeId) {
      await db.asset.update({
        where: { id: asset.id },
        data: { status: AssetStatus.ASSIGNED, currentHolderId: dto.toEmployeeId },
      });
    }
      await this.audit.recordInTransaction(db, user.id, {
        action: AuditAction.UPDATE,
        entity: 'AssetHandover',
        entityId: handover.id,
        after: { assetId: asset.id, handoverType: dto.handoverType },
      });
      return handover;
    });

    // اطلاع به تحویل‌گیرنده
    if (dto.toEmployeeId) {
      const emp = await this.prisma.employee.findUnique({
        where: { id: dto.toEmployeeId },
        select: { userId: true },
      });
      if (emp?.userId && emp.userId !== user.id) {
        await this.notifications.notify(emp.userId, {
          type: 'ASSET_DUE',
          title: 'دارایی جدید به شما تحویل شد',
          body: asset.name,
          link: `/assets/${asset.id}`,
        });
      }
    }

    return {
      data: { id: handover.id, assetId: asset.id },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  // =========================================================================
  // تعمیرات و استهلاک
  // =========================================================================

  async addMaintenance(id: string, dto: CreateMaintenanceDto, user: AuthenticatedUser) {
    await this.getEntity(id, user);
    const row = await this.prisma.assetMaintenance.create({
      data: {
        assetId: id,
        maintenanceType: dto.maintenanceType,
        performedAt: new Date(dto.performedAt),
        cost: BigInt(dto.cost ?? 0),
        description: dto.description ?? null,
        vendor: dto.vendor ?? null,
        nextDueDate: dto.nextDueDate ? new Date(dto.nextDueDate) : null,
      },
    });
    await this.audit.record(user.id, {
      action: AuditAction.CREATE,
      entity: 'AssetMaintenance',
      entityId: row.id,
      after: { assetId: id, maintenanceType: dto.maintenanceType },
    });
    return {
      data: { id: row.id },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  async addDepreciation(id: string, dto: CreateDepreciationDto, user: AuthenticatedUser) {
    const asset = await this.getEntity(id, user);
    const duplicate = await this.prisma.assetDepreciation.findUnique({
      where: { assetId_periodYear_periodMonth: { assetId: id, periodYear: dto.periodYear, periodMonth: dto.periodMonth } },
    });
    if (duplicate) throw new BadRequestException('استهلاک این دوره قبلاً ثبت شده است.');

    const row = await this.prisma.assetDepreciation.create({
      data: {
        assetId: id,
        periodYear: dto.periodYear,
        periodMonth: dto.periodMonth,
        amount: BigInt(dto.amount),
        bookValue: BigInt(dto.bookValue),
      },
    });
    await this.audit.record(user.id, {
      action: AuditAction.CREATE,
      entity: 'AssetDepreciation',
      entityId: row.id,
      after: { assetId: id, period: `${dto.periodYear}/${dto.periodMonth}` },
    });
    void asset;
    return {
      data: { id: row.id },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }
}
