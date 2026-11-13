import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { AttendanceEventType, AttendanceRecordStatus, AttendanceSource, AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { AccessService } from '../common/access/access.service';
import { AuditService } from '../common/audit/audit.service';
import { NotificationService } from '../common/notifications/notification.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { PERMISSIONS } from '../common/constants/permissions';
import { attendanceIdempotencyKey, hashToken } from '../common/utils/crypto.util';
import { PaginationDto } from '../common/dto/pagination.dto';
import {
  AttendanceRecordQueryDto,
  ComputeAttendanceDto,
  CorrectionQueryDto,
  CreateCorrectionDto,
  CreateDeviceDto,
  DecideCorrectionDto,
  DeviceQueryDto,
  IngestEventsDto,
  MonthlySheetDto,
  MyAttendanceQueryDto,
  UpdateDeviceDto,
} from './dto/attendance.dto';
import { asLocalDate, dayBounds, dateOnlyKey, jalaliMonthRange, jalaliToGregorian, minutesBetween, toDateOnly } from './jalali.util';

const DEFAULT_WORK_MINUTES = 480;
const DEFAULT_START_MINUTES = 8 * 60; // 08:00
const DEFAULT_END_MINUTES = 16 * 60; // 16:00

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationService,
    private readonly config: ConfigService,
  ) {}

  /** حذف کلید دستگاه از پاسخ‌ها — کلید هرگز برگردانده نمی‌شود */
  private publicDevice<T extends { secret?: string | null }>(row: T): Omit<T, 'secret'> & { hasSecret: boolean } {
    const { secret, ...rest } = row;
    return { ...rest, hasSecret: !!secret };
  }

  // =========================================================================
  // دستگاه‌ها
  // =========================================================================

  async listDevices(query: DeviceQueryDto, pagination: PaginationDto, user: AuthenticatedUser) {
    const where: Prisma.AttendanceDeviceWhereInput = {
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

    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const [total, rows] = await Promise.all([
      this.prisma.attendanceDevice.count({ where }),
      this.prisma.attendanceDevice.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { name: 'asc' },
        include: {
          company: { select: { id: true, code: true, name: true } },
          branch: { select: { id: true, code: true, name: true } },
          _count: { select: { events: true } },
        },
      }),
    ]);

    return {
      data: rows.map((r) => this.publicDevice(r)),
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

  async getDevice(id: string) {
    const row = await this.prisma.attendanceDevice.findUnique({
      where: { id },
      include: {
        company: { select: { id: true, code: true, name: true } },
        branch: { select: { id: true, code: true, name: true } },
        _count: { select: { events: true } },
      },
    });
    if (!row) throw new NotFoundException('دستگاه حضور موردنظر یافت نشد.');
    return this.publicDevice(row);
  }

  async createDevice(dto: CreateDeviceDto, actorId: string) {
    const duplicate = await this.prisma.attendanceDevice.findUnique({ where: { code: dto.code } });
    if (duplicate) throw new BadRequestException(`کد دستگاه «${dto.code}» قبلاً ثبت شده است.`);

    const row = await this.prisma.attendanceDevice.create({
      data: {
        companyId: dto.companyId,
        branchId: dto.branchId ?? null,
        code: dto.code.trim(),
        name: dto.name.trim(),
        deviceType: dto.deviceType ?? 'CARD_READER',
        apiUrl: dto.apiUrl ?? null,
        // کلید دستگاه فقط به‌صورت هش ذخیره می‌شود
        secret: dto.secret ? hashToken(dto.secret) : null,
      },
    });
    await this.audit.record(actorId, {
      action: AuditAction.CREATE,
      entity: 'AttendanceDevice',
      entityId: row.id,
      after: { code: row.code, name: row.name },
    });
    return this.publicDevice(row);
  }

  async updateDevice(id: string, dto: UpdateDeviceDto, actorId: string) {
    await this.getDevice(id);
    const row = await this.prisma.attendanceDevice.update({
      where: { id },
      data: {
        ...(dto.branchId !== undefined ? { branchId: dto.branchId } : {}),
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.deviceType !== undefined ? { deviceType: dto.deviceType } : {}),
        ...(dto.apiUrl !== undefined ? { apiUrl: dto.apiUrl } : {}),
        ...(dto.secret !== undefined ? { secret: dto.secret ? hashToken(dto.secret) : null } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
    await this.audit.record(actorId, {
      action: AuditAction.UPDATE,
      entity: 'AttendanceDevice',
      entityId: id,
      after: { code: row.code, isActive: row.isActive },
    });
    return this.publicDevice(row);
  }

  async deleteDevice(id: string, actorId: string) {
    const row = await this.getDevice(id);
    await this.prisma.attendanceDevice.update({ where: { id }, data: { isActive: false } });
    await this.audit.record(actorId, {
      action: AuditAction.DEACTIVATE,
      entity: 'AttendanceDevice',
      entityId: id,
      before: { code: row.code },
    });
    return { success: true };
  }

  // =========================================================================
  // دریافت رویدادها (idempotent)
  // =========================================================================

  /**
   * ورود رویدادها از دستگاه حضور: دستگاه با کد و کلید خود احراز هویت می‌شود.
   * دامنهٔ ثبت فقط شرکت همان دستگاه است و زمان رویداد طبق سیاست سرور کنترل می‌شود.
   */
  async ingestFromDevice(dto: IngestEventsDto, deviceCode: string | undefined, deviceSecret: string | undefined) {
    if (!deviceCode || !deviceSecret) throw new UnauthorizedException('مشخصات دستگاه ارسال نشده است.');
    const device = await this.prisma.attendanceDevice.findUnique({ where: { code: deviceCode } });
    if (!device || !device.isActive || !device.secret) throw new UnauthorizedException('دستگاه نامعتبر است.');

    const given = Buffer.from(hashToken(deviceSecret));
    const expected = Buffer.from(device.secret);
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
      throw new UnauthorizedException('دستگاه نامعتبر است.');
    }

    const deviceScope: AuthenticatedUser = {
      id: `device:${device.id}`,
      username: device.code,
      fullName: device.name,
      email: null,
      mobile: null,
      isSuperAdmin: false,
      employeeId: null,
      roleIds: [],
      roleCodes: [],
      permissions: [],
      scope: {
        unrestricted: false,
        companyIds: [device.companyId],
        branchIds: [],
        orgUnitIds: [],
        employeeIds: [],
        ownEmployeeId: null,
      },
    };

    const forced: IngestEventsDto = {
      ...dto,
      events: dto.events?.map((e) => ({ ...e, deviceId: device.id })),
      ...(dto.events?.length ? {} : { deviceId: device.id }),
    } as IngestEventsDto;
    return this.ingestEvents(forced, deviceScope);
  }

  async ingestEvents(dto: IngestEventsDto, user: AuthenticatedUser) {
    const items: IngestEventsDto[] = [];
    if (dto.events?.length) {
      for (const e of dto.events) items.push(e as any);
    } else if (dto.employeeId && dto.type && dto.eventTime && dto.source) {
      items.push({
        employeeId: dto.employeeId,
        type: dto.type,
        eventTime: dto.eventTime,
        source: dto.source,
      });
    } else {
      throw new BadRequestException('رویداد حضور ناقص است؛ employeeId، type، eventTime و source الزامی است.');
    }

    const employeeIds = [...new Set(items.map((i) => i.employeeId))];
    const allowed = await this.prisma.employee.findMany({
      where: { id: { in: employeeIds }, deletedAt: null, AND: [this.access.employeeWhereFor(user)] },
      select: { id: true },
    });
    const allowedIds = new Set(allowed.map((a) => a.id));

    const results: Array<{ employeeId: string; type: string; status: 'CREATED' | 'DUPLICATE' | 'FORBIDDEN' }> = [];
    for (const item of items) {
      if (!allowedIds.has(item.employeeId)) {
        results.push({ employeeId: item.employeeId, type: item.type, status: 'FORBIDDEN' });
        continue;
      }
      const eventTime = this.resolveEventTime(item.eventTime);
      const idem =
        item.idempotencyKey ??
        attendanceIdempotencyKey(item.deviceId ?? 'manual', eventTime, item.type);
      try {
        await this.prisma.attendanceEvent.create({
          data: {
            employeeId: item.employeeId,
            deviceId: item.deviceId ?? null,
            type: item.type,
            eventTime,
            source: item.source,
            idempotencyKey: idem,
            rawPayload: item.rawPayload ?? null,
            latitude: item.latitude ?? null,
            longitude: item.longitude ?? null,
            locationName: item.locationName ?? null,
          },
        });
        results.push({ employeeId: item.employeeId, type: item.type, status: 'CREATED' });
      } catch {
        results.push({ employeeId: item.employeeId, type: item.type, status: 'DUPLICATE' });
      }
    }

    return {
      data: { ingested: results.filter((r) => r.status === 'CREATED').length, results },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * زمان رویداد: اگر ATTENDANCE_TIME_SOURCE=SERVER باشد و ساعت دستگاه بیش از
   * DEVICE_CLOCK_SKEW_SECONDS از ساعت سرور فاصله داشته باشد، زمان سرور ثبت می‌شود.
   */
  private resolveEventTime(raw: string | Date): Date {
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) throw new BadRequestException('زمان رویداد نامعتبر است.');
    const now = Date.now();
    const source = this.config.get<string>('app.security.attendanceTimeSource') ?? 'SERVER';
    const skewMs = (this.config.get<number>('app.security.deviceClockSkewSeconds') ?? 120) * 1000;
    if (source === 'SERVER' && Math.abs(parsed.getTime() - now) > skewMs) {
      return new Date(now);
    }
    return parsed;
  }

  // =========================================================================
  // محاسبه کارکرد
  // =========================================================================

  async compute(dto: ComputeAttendanceDto, user: AuthenticatedUser) {
    if (new Date(dto.from) > new Date(dto.to)) {
      throw new BadRequestException('بازه تاریخ نامعتبر است.');
    }
    const from = toDateOnly(new Date(dto.from));
    const to = toDateOnly(new Date(dto.to));
    if ((to.getTime() - from.getTime()) / 86_400_000 > 92) {
      throw new BadRequestException('بازه محاسبه حداکثر ۹۲ روز است.');
    }

    const employeeWhere: Prisma.EmployeeWhereInput = {
      status: { not: 'TERMINATED' },
      AND: [this.access.employeeWhereFor(user)],
      ...(dto.orgUnitId ? { orgUnitId: dto.orgUnitId } : {}),
      ...(dto.employeeIds?.length ? { id: { in: dto.employeeIds } } : {}),
    };
    const employees = await this.prisma.employee.findMany({
      where: employeeWhere,
      select: { id: true },
    });
    if (!employees.length) return { data: { processed: 0, records: 0 }, success: true, timestamp: new Date().toISOString() };

    let processed = 0;
    for (const employee of employees) {
      await this.computeEmployeeRange(employee.id, from, to);
      processed += 1;
    }
    return {
      data: { processed, range: { from: dateOnlyKey(from), to: dateOnlyKey(to) } },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  /** محاسبه رکورد روزانه برای یک نیرو در بازه مشخص */
  private async computeEmployeeRange(employeeId: string, from: Date, to: Date): Promise<void> {
    const events = await this.prisma.attendanceEvent.findMany({
      where: { employeeId, eventTime: { gte: dayBounds(asLocalDate(from)).start, lte: dayBounds(asLocalDate(to)).end } },
      orderBy: { eventTime: 'asc' },
    });
    if (!events.length) return;

    const assignments = await this.prisma.shiftAssignment.findMany({
      where: { employeeId, workDate: { gte: from, lte: to } },
      include: { shift: true },
    });
    const assignmentByDate = new Map<string, (typeof assignments)[number]>();
    for (const a of assignments) assignmentByDate.set(dateOnlyKey(a.workDate), a);

    const leaves = await this.prisma.leaveRequest.findMany({
      where: {
        employeeId,
        status: 'APPROVED',
        startAt: { lte: dayBounds(asLocalDate(to)).end },
        endAt: { gte: dayBounds(asLocalDate(from)).start },
      },
      select: { startAt: true, endAt: true },
    });

    const byDay = new Map<string, { ins: Date[]; outs: Date[] }>();
    for (const ev of events) {
      const key = dateOnlyKey(toDateOnly(ev.eventTime));
      const bucket = byDay.get(key) ?? { ins: [], outs: [] };
      (ev.type === AttendanceEventType.IN ? bucket.ins : bucket.outs).push(ev.eventTime);
      byDay.set(key, bucket);
    }

    for (const [dayKey, bucket] of byDay.entries()) {
      const workDate = new Date(`${dayKey}T00:00:00.000Z`);
      const firstIn = bucket.ins.length ? bucket.ins[0] : null;
      const lastOut = bucket.outs.length ? bucket.outs[bucket.outs.length - 1] : null;

      const assignment = assignmentByDate.get(dayKey);
      const shift = assignment?.shift;
      const startMinutes = shift ? this.timeToMin(shift.startTime) : DEFAULT_START_MINUTES;
      const endMinutes = shift ? this.timeToMin(shift.endTime) : DEFAULT_END_MINUTES;
      const planned = shift ? shift.durationMinutes : DEFAULT_WORK_MINUTES;
      const breakMinutes = shift?.breakMinutes ?? 0;

      let workMinutes = 0;
      let overtimeMinutes = 0;
      let lateMinutes = 0;
      let earlyLeaveMinutes = 0;
      let status: AttendanceRecordStatus = AttendanceRecordStatus.COMPLETE;

      if (firstIn && lastOut) {
        workMinutes = Math.max(0, minutesBetween(firstIn, lastOut) - breakMinutes);
        overtimeMinutes = Math.max(0, workMinutes - planned);
        const inLocal = firstIn.getHours() * 60 + firstIn.getMinutes();
        lateMinutes = Math.max(0, inLocal - startMinutes);
        const outLocal = lastOut.getHours() * 60 + lastOut.getMinutes();
        earlyLeaveMinutes = Math.max(0, endMinutes - outLocal);
      } else {
        status = AttendanceRecordStatus.INCOMPLETE;
      }

      const isLeave = leaves.some((l) => l.startAt <= dayBounds(workDate).end && l.endAt >= dayBounds(workDate).start);
      if (isLeave && !firstIn) status = AttendanceRecordStatus.LEAVE;

      const data = {
        firstIn,
        lastOut,
        workMinutes,
        overtimeMinutes,
        lateMinutes,
        earlyLeaveMinutes,
        status,
        shiftAssignmentId: assignment?.id ?? null,
      };

      await this.prisma.attendanceRecord.upsert({
        where: { employeeId_workDate: { employeeId, workDate } },
        create: { employeeId, workDate, ...data },
        update: data,
      });
    }
  }

  private timeToMin(time: string): number {
    const [h, m] = String(time).split(':');
    return Number(h) * 60 + Number(m ?? 0);
  }

  // =========================================================================
  // گزارش‌ها
  // =========================================================================

  async listRecords(query: AttendanceRecordQueryDto, pagination: PaginationDto, user: AuthenticatedUser) {
    const where: Prisma.AttendanceRecordWhereInput = {
      employee: this.access.employeeWhereFor(user),
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      ...(query.orgUnitId ? { employee: { orgUnitId: query.orgUnitId } } : {}),
      ...(query.from ? { workDate: { gte: toDateOnly(new Date(query.from)) } } : {}),
      ...(query.to ? { workDate: { lte: toDateOnly(new Date(query.to)) } } : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const [total, rows] = await Promise.all([
      this.prisma.attendanceRecord.count({ where }),
      this.prisma.attendanceRecord.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ workDate: 'desc' }],
        include: {
          employee: {
            select: { id: true, code: true, firstName: true, lastName: true, orgUnit: { select: { name: true } } },
          },
          shiftAssignment: { include: { shift: { select: { code: true, name: true } } } },
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

  async myAttendance(query: MyAttendanceQueryDto, user: AuthenticatedUser) {
    if (!user.employeeId) throw new ForbiddenException('این حساب به پرونده پرسنلی متصل نیست.');
    const rows = await this.prisma.attendanceRecord.findMany({
      where: {
        employeeId: user.employeeId,
        workDate: { gte: toDateOnly(new Date(query.from)), lte: toDateOnly(new Date(query.to)) },
      },
      orderBy: { workDate: 'desc' },
    });
    return {
      data: rows,
      meta: { total: rows.length, page: 1, limit: rows.length, totalPages: 1, hasNext: false, hasPrev: false },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  /** کارت ماهانه حضور و غیاب بر اساس ماه شمسی */
  async monthlySheet(query: MonthlySheetDto, user: AuthenticatedUser) {
    const { start, end, days } = jalaliMonthRange(query.year, query.month);
    const employeeWhere: Prisma.EmployeeWhereInput = {
      AND: [this.access.employeeWhereFor(user)],
      ...(query.companyId ? { companyId: query.companyId } : {}),
      ...(query.orgUnitId ? { orgUnitId: query.orgUnitId } : {}),
      ...(query.employeeId ? { id: query.employeeId } : {}),
    };
    const employees = await this.prisma.employee.findMany({
      where: employeeWhere,
      select: { id: true, code: true, firstName: true, lastName: true },
      orderBy: { code: 'asc' },
      take: 100,
    });

    const records = await this.prisma.attendanceRecord.findMany({
      where: { employeeId: { in: employees.map((e) => e.id) }, workDate: { gte: toDateOnly(start), lte: toDateOnly(end) } },
    });

    const byEmployee = new Map<string, Map<string, (typeof records)[number]>>();
    for (const r of records) {
      const map = byEmployee.get(r.employeeId) ?? new Map();
      map.set(dateOnlyKey(r.workDate), r);
      byEmployee.set(r.employeeId, map);
    }

    const sheet = employees.map((e) => {
      const map = byEmployee.get(e.id) ?? new Map();
      const cells: Array<{ day: number; workMinutes: number; overtimeMinutes: number; status: string }> = [];
      for (let d = 1; d <= days; d += 1) {
        const rec = map.get(dateOnlyKey(monthDayDate(query.year, query.month, d)));
        cells.push({
          day: d,
          workMinutes: rec?.workMinutes ?? 0,
          overtimeMinutes: rec?.overtimeMinutes ?? 0,
          status: rec?.status ?? 'NO_RECORD',
        });
      }
      const totalWork = cells.reduce((s, c) => s + c.workMinutes, 0);
      const totalOvertime = cells.reduce((s, c) => s + c.overtimeMinutes, 0);
      return { employee: e, cells, totalWork, totalOvertime };
    });

    return {
      data: { year: query.year, month: query.month, days, rows: sheet },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  // =========================================================================
  // اصلاحیه‌ها
  // =========================================================================

  async createCorrection(dto: CreateCorrectionDto, user: AuthenticatedUser) {
    const employee = await this.prisma.employee.findUnique({ where: { id: dto.employeeId } });
    if (!employee || employee.deletedAt) throw new NotFoundException('نیروی موردنظر یافت نشد.');
    if (!(user.isSuperAdmin || user.scope.unrestricted) && user.employeeId !== dto.employeeId) {
      // کارمند عادی فقط اصلاحیه خودش را ثبت می‌کند؛ سرپرست/HR با مجوز هم
      if (!user.permissions.includes(PERMISSIONS.ATTENDANCE_UPDATE)) {
        throw new ForbiddenException('اجازه ثبت اصلاحیه برای این نیرو را ندارید.');
      }
    }

    const workDate = toDateOnly(new Date(dto.workDate));
    const record = await this.prisma.attendanceRecord.findUnique({
      where: { employeeId_workDate: { employeeId: dto.employeeId, workDate } },
    });

    const row = await this.prisma.attendanceCorrection.create({
      data: {
        employeeId: dto.employeeId,
        attendanceRecordId: record?.id ?? null,
        workDate,
        field: dto.field,
        oldValue: record ? String((record as any)[dto.field] ?? '') : null,
        newValue: dto.newValue,
        reason: dto.reason,
        status: 'PENDING',
        requestedById: user.id,
      },
      include: { employee: { select: { code: true, firstName: true, lastName: true } } },
    });

    await this.audit.record(user.id, {
      action: AuditAction.CREATE,
      entity: 'AttendanceCorrection',
      entityId: row.id,
      after: { field: dto.field, newValue: dto.newValue, reason: dto.reason },
    });

    return row;
  }

  async listCorrections(query: CorrectionQueryDto, pagination: PaginationDto, user: AuthenticatedUser) {
    const where: Prisma.AttendanceCorrectionWhereInput = {
      employee: this.access.employeeWhereFor(user),
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      ...(query.status ? { status: query.status } : {}),
    };
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const [total, rows] = await Promise.all([
      this.prisma.attendanceCorrection.count({ where }),
      this.prisma.attendanceCorrection.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          employee: { select: { code: true, firstName: true, lastName: true } },
          requestedBy: { select: { fullName: true } },
          approvedBy: { select: { fullName: true } },
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

  /** تصمیم روی اصلاحیه — هیچ‌کس اصلاحیه خودش را تأیید نمی‌کند */
  async decideCorrection(id: string, dto: DecideCorrectionDto, user: AuthenticatedUser) {
    const row = await this.prisma.attendanceCorrection.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('اصلاحیه موردنظر یافت نشد.');
    if (row.status !== 'PENDING') throw new BadRequestException('این اصلاحیه قبلاً بررسی شده است.');
    if (row.requestedById === user.id && !user.isSuperAdmin) {
      throw new ForbiddenException('هیچ‌کس اجازه تأیید اصلاحیه ثبت‌شده توسط خودش را ندارد.');
    }
    // تأییدکننده فقط برای نیروهای داخل حوزهٔ دسترسی خودش می‌تواند تصمیم بگیرد
    if (!(await this.access.canAccessEmployee(user, row.employeeId))) {
      throw new ForbiddenException('اجازه بررسی اصلاحیه این نیرو را ندارید.');
    }

    const approved = dto.decision === 'APPROVE';
    const updated = await this.prisma.attendanceCorrection.update({
      where: { id },
      data: {
        status: approved ? 'APPROVED' : 'REJECTED',
        approvedById: user.id,
        decidedAt: new Date(),
      },
    });

    if (approved && row.attendanceRecordId && row.newValue !== null) {
      const patch: any = { [row.field]: row.field === 'status' ? row.newValue : row.newValue };
      if (['firstIn', 'lastOut'].includes(row.field)) {
        const parsed = new Date(row.newValue);
        patch[row.field] = Number.isNaN(parsed.getTime()) ? row.newValue : parsed;
      } else if (['workMinutes', 'lateMinutes', 'earlyLeaveMinutes', 'overtimeMinutes', 'absenceMinutes'].includes(row.field)) {
        patch[row.field] = Number(row.newValue) || 0;
      }
      try {
        await this.prisma.attendanceRecord.update({ where: { id: row.attendanceRecordId }, data: patch });
      } catch {
        // مقدار نامعتبر — اصلاحیه تأییدشده باقی می‌ماند و رکورد دستی اصلاح می‌شود
      }
    }

    if (row.requestedById) {
      await this.notifications.notify(row.requestedById, {
        type: 'REQUEST_RESULT',
        title: approved ? 'اصلاحیه حضور تأیید شد' : 'اصلاحیه حضور رد شد',
        body: dto.comment ?? undefined,
        link: `/attendance/corrections/${id}`,
      });
    }

    await this.audit.record(user.id, {
      action: approved ? AuditAction.APPROVE : AuditAction.REJECT,
      entity: 'AttendanceCorrection',
      entityId: id,
      after: { status: updated.status, comment: dto.comment },
    });

    return updated;
  }
}

/** ساخت تاریخ فقط-تاریخ برای روز d ام ماه شمسی */
function monthDayDate(jy: number, jm: number, d: number): Date {
  const g = jalaliToGregorian(jy, jm, d);
  return new Date(Date.UTC(g.getFullYear(), g.getMonth(), g.getDate()));
}
