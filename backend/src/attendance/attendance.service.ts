import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { timingSafeEqual } from "crypto";
import { ConfigService } from "@nestjs/config";
import {
  AttendanceEventType,
  AttendanceRecordStatus,
  AttendanceSource,
  AuditAction,
  Prisma,
} from "@prisma/client";
import { PrismaService } from "../common/prisma/prisma.service";
import { AccessService } from "../common/access/access.service";
import { AuditService } from "../common/audit/audit.service";
import { NotificationService } from "../common/notifications/notification.service";
import { AuthenticatedUser } from "../common/decorators/current-user.decorator";
import { PERMISSIONS } from "../common/constants/permissions";
import { hashToken } from "../common/utils/crypto.util";
import { attendanceBuckets, shiftBounds } from './attendance-calculation';
import { calendarDayStart, shiftCalendarDay } from './daily-date.util';
import { PaginationDto } from "../common/dto/pagination.dto";
import {
  AttendanceEventDto,
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
} from "./dto/attendance.dto";
import {
  asLocalDate,
  dayBounds,
  dateOnlyKey,
  jalaliMonthRange,
  jalaliToGregorian,
  minutesBetween,
  toDateOnly,
} from "./jalali.util";

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
  private publicDevice<T extends { secret?: string | null }>(
    row: T,
  ): Omit<T, "secret"> & { hasSecret: boolean } {
    const { secret, ...rest } = row;
    return { ...rest, hasSecret: !!secret };
  }

  // =========================================================================
  // دستگاه‌ها
  // =========================================================================

  async listDevices(
    query: DeviceQueryDto,
    pagination: PaginationDto,
    user: AuthenticatedUser,
  ) {
    const where: Prisma.AttendanceDeviceWhereInput = {
      AND: [await this.access.companyWhereFor(user)],
      ...(query.companyId ? { companyId: query.companyId } : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: "insensitive" } },
              { code: { contains: query.search, mode: "insensitive" } },
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
        orderBy: { name: "asc" },
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

  async getDevice(id: string, user: AuthenticatedUser) {
    const row = await this.prisma.attendanceDevice.findUnique({
      where: { id },
      include: {
        company: { select: { id: true, code: true, name: true } },
        branch: { select: { id: true, code: true, name: true } },
        _count: { select: { events: true } },
      },
    });
    if (!row) throw new NotFoundException("دستگاه حضور موردنظر یافت نشد.");
    await this.access.assertCompanyAccess(user, row.companyId);
    return this.publicDevice(row);
  }

  async createDevice(dto: CreateDeviceDto, user: AuthenticatedUser) {
    const actorId = user.id;
    await this.access.assertCompanyAccess(user, dto.companyId);
    await this.access.assertEmployeeRelations(dto.companyId, dto);
    const duplicate = await this.prisma.attendanceDevice.findUnique({
      where: { code: dto.code },
    });
    if (duplicate)
      throw new BadRequestException(
        `کد دستگاه «${dto.code}» قبلاً ثبت شده است.`,
      );

    const row = await this.prisma.attendanceDevice.create({
      data: {
        companyId: dto.companyId,
        branchId: dto.branchId ?? null,
        code: dto.code.trim(),
        name: dto.name.trim(),
        deviceType: dto.deviceType ?? "CARD_READER",
        apiUrl: dto.apiUrl ?? null,
        // کلید دستگاه فقط به‌صورت هش ذخیره می‌شود
        secret: dto.secret ? hashToken(dto.secret) : null,
      },
    });
    await this.audit.record(actorId, {
      action: AuditAction.CREATE,
      entity: "AttendanceDevice",
      entityId: row.id,
      after: { code: row.code, name: row.name },
    });
    return this.publicDevice(row);
  }

  async updateDevice(
    id: string,
    dto: UpdateDeviceDto,
    user: AuthenticatedUser,
  ) {
    const actorId = user.id;
    const before = await this.getDevice(id, user);
    await this.access.assertEmployeeRelations(before.companyId, dto);
    const row = await this.prisma.attendanceDevice.update({
      where: { id },
      data: {
        ...(dto.branchId !== undefined ? { branchId: dto.branchId } : {}),
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.deviceType !== undefined ? { deviceType: dto.deviceType } : {}),
        ...(dto.apiUrl !== undefined ? { apiUrl: dto.apiUrl } : {}),
        ...(dto.secret !== undefined
          ? { secret: dto.secret ? hashToken(dto.secret) : null }
          : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
    await this.audit.record(actorId, {
      action: AuditAction.UPDATE,
      entity: "AttendanceDevice",
      entityId: id,
      after: { code: row.code, isActive: row.isActive },
    });
    return this.publicDevice(row);
  }

  async deleteDevice(id: string, user: AuthenticatedUser) {
    const actorId = user.id;
    const row = await this.getDevice(id, user);
    await this.prisma.attendanceDevice.update({
      where: { id },
      data: { isActive: false },
    });
    await this.audit.record(actorId, {
      action: AuditAction.DEACTIVATE,
      entity: "AttendanceDevice",
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
  async ingestFromDevice(
    dto: IngestEventsDto,
    deviceCode: string | undefined,
    deviceSecret: string | undefined,
  ) {
    if (!deviceCode || !deviceSecret)
      throw new UnauthorizedException("مشخصات دستگاه ارسال نشده است.");
    const device = await this.prisma.attendanceDevice.findUnique({
      where: { code: deviceCode },
    });
    if (!device || !device.isActive || !device.secret)
      throw new UnauthorizedException("دستگاه نامعتبر است.");

    const given = Buffer.from(hashToken(deviceSecret));
    const expected = Buffer.from(device.secret);
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
      throw new UnauthorizedException("دستگاه نامعتبر است.");
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
    const items: AttendanceEventDto[] = [];
    if (dto.events?.length) items.push(...dto.events);
    else if (dto.employeeId && dto.type && dto.eventTime && dto.source) {
      items.push({
        ...dto,
        employeeId: dto.employeeId,
        type: dto.type,
        eventTime: dto.eventTime,
        source: dto.source,
      });
    } else throw new BadRequestException("رویداد حضور ناقص است.");
    const devices = await this.prisma.attendanceDevice.findMany({
      where: {
        id: {
          in: [
            ...new Set(
              items.flatMap((item) => (item.deviceId ? [item.deviceId] : [])),
            ),
          ],
        },
        isActive: true,
      },
      select: { id: true, companyId: true },
    });
    const results: Array<{
      employeeId: string;
      type: string;
      status: "CREATED" | "DUPLICATE" | "FORBIDDEN" | "CONFLICT" | "FAILED";
    }> = [];
    for (const item of items) {
      try {
        const status = await this.prisma.$transaction(
          async (db) => {
            await db.$queryRaw`SELECT id FROM "Employee" WHERE id = ${item.employeeId}::uuid FOR UPDATE`;
            const employee = await db.employee.findFirst({
              where: {
                id: item.employeeId,
                deletedAt: null,
                AND: [this.access.employeeWhereFor(user)],
              },
              select: { companyId: true },
            });
            if (
              !employee ||
              (item.deviceId &&
                !devices.some(
                  (device) =>
                    device.id === item.deviceId &&
                    device.companyId === employee.companyId,
                ))
            )
              return "FORBIDDEN" as const;
            const rawTime = new Date(item.eventTime);
            const identity = item.idempotencyKey
              ? ["explicit", item.idempotencyKey]
              : ["automatic", rawTime.toISOString(), item.type];
            const prefix =
              "v2:" +
              hashToken(
                JSON.stringify([
                  item.employeeId,
                  item.deviceId ?? null,
                  identity,
                ]),
              ) +
              ":";
            const fingerprint = hashToken(
              JSON.stringify([
                rawTime.toISOString(),
                item.type,
                item.source,
                item.latitude ?? null,
                item.longitude ?? null,
                item.locationName ?? null,
                item.rawPayload ?? null,
              ]),
            );
            const key = prefix + fingerprint;
            const existing = await db.attendanceEvent.findFirst({
              where: {
                employeeId: item.employeeId,
                deviceId: item.deviceId ?? null,
                OR: [
                  { idempotencyKey: { startsWith: prefix } },
                  ...(item.idempotencyKey
                    ? [{ idempotencyKey: item.idempotencyKey }]
                    : []),
                ],
              },
            });
            if (existing) {
              if (existing.idempotencyKey === key) return "DUPLICATE" as const;
              if (
                !existing.idempotencyKey.startsWith("v2:") &&
                existing.eventTime.getTime() === rawTime.getTime() &&
                existing.type === item.type &&
                existing.source === item.source
              )
                return "DUPLICATE" as const;
              return "CONFLICT" as const;
            }
            // Preserve exact legacy event retries without changing existing keys.
            if (
              !item.idempotencyKey &&
              (await db.attendanceEvent.findFirst({
                where: {
                  employeeId: item.employeeId,
                  deviceId: item.deviceId ?? null,
                  eventTime: rawTime,
                  type: item.type,
                  source: item.source,
                },
                select: { id: true },
              }))
            )
              return "DUPLICATE" as const;
            const eventTime = this.resolveEventTime(rawTime);
            await db.attendanceEvent.create({
              data: {
                employeeId: item.employeeId,
                deviceId: item.deviceId ?? null,
                type: item.type,
                eventTime,
                source: item.source,
                idempotencyKey: key,
                rawPayload: item.rawPayload ?? null,
                latitude: item.latitude ?? null,
                longitude: item.longitude ?? null,
                locationName: item.locationName ?? null,
              },
            });
            return "CREATED" as const;
          },
          { maxWait: 10000, timeout: 30000 },
        );
        results.push({ employeeId: item.employeeId, type: item.type, status });
      } catch {
        results.push({
          employeeId: item.employeeId,
          type: item.type,
          status: "FAILED",
        });
      }
    }
    return {
      data: {
        ingested: results.filter((row) => row.status === "CREATED").length,
        results,
      },
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
    if (Number.isNaN(parsed.getTime()))
      throw new BadRequestException("زمان رویداد نامعتبر است.");
    const now = Date.now();
    const source =
      this.config.get<string>("app.security.attendanceTimeSource") ?? "SERVER";
    const skewMs =
      (this.config.get<number>("app.security.deviceClockSkewSeconds") ?? 120) *
      1000;
    if (source === "SERVER" && Math.abs(parsed.getTime() - now) > skewMs) {
      return new Date(now);
    }
    return parsed;
  }

  // =========================================================================
  // محاسبه کارکرد
  // =========================================================================

  async compute(dto: ComputeAttendanceDto, user: AuthenticatedUser) {
    if (new Date(dto.from) > new Date(dto.to)) {
      throw new BadRequestException("بازه تاریخ نامعتبر است.");
    }
    const from = toDateOnly(new Date(dto.from));
    const to = toDateOnly(new Date(dto.to));
    if ((to.getTime() - from.getTime()) / 86_400_000 > 92) {
      throw new BadRequestException("بازه محاسبه حداکثر ۹۲ روز است.");
    }

    const employeeWhere: Prisma.EmployeeWhereInput = {
      status: { not: "TERMINATED" },
      AND: [this.access.employeeWhereFor(user)],
      ...(dto.orgUnitId ? { orgUnitId: dto.orgUnitId } : {}),
      ...(dto.employeeIds?.length ? { id: { in: dto.employeeIds } } : {}),
    };
    const employees = await this.prisma.employee.findMany({
      where: employeeWhere,
      select: { id: true },
    });
    if (!employees.length)
      return {
        data: { processed: 0, records: 0 },
        success: true,
        timestamp: new Date().toISOString(),
      };

    let processed = 0;
    for (const employee of employees) {
      await this.computeEmployeeRange(employee.id, from, to);
      processed += 1;
    }
    return {
      data: {
        processed,
        range: { from: dateOnlyKey(from), to: dateOnlyKey(to) },
      },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  /** محاسبه رکورد روزانه برای یک نیرو در بازه مشخص */
  private async computeEmployeeRange(
    employeeId: string,
    from: Date,
    to: Date,
  ): Promise<void> {
    return this.prisma.$transaction(
      async (db) => {
        await db.$queryRaw`SELECT id FROM "Employee" WHERE id = ${employeeId}::uuid FOR UPDATE`;
        const employee = await db.employee.findUniqueOrThrow({ where: { id: employeeId }, select: { company: { select: { timezone: true } } } });
        const zone = employee.company.timezone;
        const firstDay = dateOnlyKey(from), lastDay = dateOnlyKey(to);
        const events = await db.attendanceEvent.findMany({
          where: {
            employeeId,
            eventTime: {
              gte: calendarDayStart(shiftCalendarDay(firstDay, -1), zone),
              lt: calendarDayStart(shiftCalendarDay(lastDay, 2), zone),
            },
          },
          orderBy: { eventTime: "asc" },
        });
        const assignments = await db.shiftAssignment.findMany({
          where: { employeeId, workDate: { gte: new Date(`${shiftCalendarDay(firstDay, -1)}T00:00:00Z`), lte: to } },
          include: { shift: true },
        });
        const assignmentByDate = new Map<
          string,
          (typeof assignments)[number]
        >();
        for (const a of assignments)
          assignmentByDate.set(dateOnlyKey(a.workDate), a);

        const leaves = await db.leaveRequest.findMany({
          where: {
            employeeId,
            status: "APPROVED",
            startAt: { lt: calendarDayStart(shiftCalendarDay(lastDay, 1), zone) },
            endAt: { gt: calendarDayStart(firstDay, zone) },
          },
          select: { startAt: true, endAt: true },
        });

        const byDay = attendanceBuckets(events, assignments, zone);
        for (const day of assignmentByDate.keys()) {
          if (!byDay.has(day)) byDay.set(day, { ins: [], outs: [], pairedMinutes: 0, incomplete: true, suspicious: false });
        }
        for (const [dayKey, bucket] of byDay.entries()) {
          if (dayKey < firstDay || dayKey > lastDay) continue;
          const workDate = new Date(`${dayKey}T00:00:00.000Z`);
          const current = await db.attendanceRecord.findUnique({
            where: { employeeId_workDate: { employeeId, workDate } },
          });
          if (
            current?.lockedAt ||
            (await db.attendanceCorrection.count({
              where: { employeeId, workDate, status: "APPROVED" },
            }))
          )
            continue;
          const firstIn = bucket.ins.length ? bucket.ins[0] : null;
          const lastOut = bucket.outs.length
            ? bucket.outs[bucket.outs.length - 1]
            : null;

          const assignment = assignmentByDate.get(dayKey);
          const shift = assignment?.shift;
          const bounds = shiftBounds(dayKey, shift?.startTime ?? '08:00', shift?.endTime ?? '16:00', zone);
          const planned = shift ? shift.durationMinutes : DEFAULT_WORK_MINUTES;
          const breakMinutes = shift?.breakMinutes ?? 0;

          let workMinutes = 0;
          let overtimeMinutes = 0;
          let lateMinutes = 0;
          let earlyLeaveMinutes = 0;
          let status: AttendanceRecordStatus = AttendanceRecordStatus.COMPLETE;

          if (firstIn && lastOut) {
            workMinutes = Math.max(
              0,
              Math.round(bucket.pairedMinutes) - breakMinutes,
            );
            overtimeMinutes = Math.max(0, workMinutes - planned);
            lateMinutes = Math.max(0, Math.round((firstIn.getTime() - bounds.start.getTime()) / 60000));
            earlyLeaveMinutes = Math.max(0, Math.round((bounds.end.getTime() - lastOut.getTime()) / 60000));
          } else {
            status = AttendanceRecordStatus.INCOMPLETE;
          }
          if (bucket.incomplete) status = AttendanceRecordStatus.INCOMPLETE;
          if (bucket.suspicious) status = AttendanceRecordStatus.SUSPICIOUS;
          if (!firstIn && !lastOut && assignment) status = AttendanceRecordStatus.ABSENT;

          const isLeave = leaves.some(
            (l) =>
              l.startAt < calendarDayStart(shiftCalendarDay(dayKey, 1), zone) &&
              l.endAt > calendarDayStart(dayKey, zone),
          );
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

          await db.attendanceRecord.upsert({
            where: { employeeId_workDate: { employeeId, workDate } },
            create: { employeeId, workDate, ...data },
            update: data,
          });
        }
      },
      { maxWait: 10000, timeout: 30000 },
    );
  }

  private timeToMin(time: string): number {
    const [h, m] = String(time).split(":");
    return Number(h) * 60 + Number(m ?? 0);
  }

  // =========================================================================
  // گزارش‌ها
  // =========================================================================

  async listRecords(
    query: AttendanceRecordQueryDto,
    pagination: PaginationDto,
    user: AuthenticatedUser,
  ) {
    const where: Prisma.AttendanceRecordWhereInput = {
      employee: {
        AND: [this.access.employeeWhereFor(user)],
        ...(query.orgUnitId ? { orgUnitId: query.orgUnitId } : {}),
      },
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      ...((query.from || query.to) ? {
        workDate: {
          ...(query.from ? { gte: toDateOnly(new Date(query.from)) } : {}),
          ...(query.to ? { lte: toDateOnly(new Date(query.to)) } : {}),
        },
      } : {}),
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
        orderBy: [{ workDate: "desc" }],
        include: {
          employee: {
            select: {
              id: true,
              code: true,
              firstName: true,
              lastName: true,
              orgUnit: { select: { name: true } },
            },
          },
          shiftAssignment: {
            include: { shift: { select: { code: true, name: true } } },
          },
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
    if (!user.employeeId)
      throw new ForbiddenException("این حساب به پرونده پرسنلی متصل نیست.");
    const rows = await this.prisma.attendanceRecord.findMany({
      where: {
        employeeId: user.employeeId,
        workDate: {
          gte: toDateOnly(new Date(query.from)),
          lte: toDateOnly(new Date(query.to)),
        },
      },
      orderBy: { workDate: "desc" },
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
      orderBy: { code: "asc" },
      take: 100,
    });

    const records = await this.prisma.attendanceRecord.findMany({
      where: {
        employeeId: { in: employees.map((e) => e.id) },
        workDate: { gte: toDateOnly(start), lte: toDateOnly(end) },
      },
    });

    const byEmployee = new Map<string, Map<string, (typeof records)[number]>>();
    for (const r of records) {
      const map = byEmployee.get(r.employeeId) ?? new Map();
      map.set(dateOnlyKey(r.workDate), r);
      byEmployee.set(r.employeeId, map);
    }

    const sheet = employees.map((e) => {
      const map = byEmployee.get(e.id) ?? new Map();
      const cells: Array<{
        day: number;
        workMinutes: number;
        overtimeMinutes: number;
        status: string;
      }> = [];
      for (let d = 1; d <= days; d += 1) {
        const rec = map.get(
          dateOnlyKey(monthDayDate(query.year, query.month, d)),
        );
        cells.push({
          day: d,
          workMinutes: rec?.workMinutes ?? 0,
          overtimeMinutes: rec?.overtimeMinutes ?? 0,
          status: rec?.status ?? "NO_RECORD",
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
    await this.access.assertEmployeeAccess(user, dto.employeeId);
    this.correctionPatch(dto.field, dto.newValue);
    const employee = await this.prisma.employee.findUnique({
      where: { id: dto.employeeId },
    });
    if (!employee || employee.deletedAt)
      throw new NotFoundException("نیروی موردنظر یافت نشد.");
    if (
      !(user.isSuperAdmin || user.scope.unrestricted) &&
      user.employeeId !== dto.employeeId
    ) {
      // کارمند عادی فقط اصلاحیه خودش را ثبت می‌کند؛ سرپرست/HR با مجوز هم
      if (!user.permissions.includes(PERMISSIONS.ATTENDANCE_UPDATE)) {
        throw new ForbiddenException(
          "اجازه ثبت اصلاحیه برای این نیرو را ندارید.",
        );
      }
    }

    const workDate = toDateOnly(new Date(dto.workDate));
    const record = await this.prisma.attendanceRecord.findUnique({
      where: { employeeId_workDate: { employeeId: dto.employeeId, workDate } },
    });
    if (record?.lockedAt)
      throw new BadRequestException("رکورد حضور قفل شده است.");

    const row = await this.prisma.attendanceCorrection.create({
      data: {
        employeeId: dto.employeeId,
        attendanceRecordId: record?.id ?? null,
        workDate,
        field: dto.field,
        oldValue: record ? String((record as any)[dto.field] ?? "") : null,
        newValue: dto.newValue,
        reason: dto.reason,
        status: "PENDING",
        requestedById: user.id,
      },
      include: {
        employee: { select: { code: true, firstName: true, lastName: true } },
      },
    });

    await this.audit.record(user.id, {
      action: AuditAction.CREATE,
      entity: "AttendanceCorrection",
      entityId: row.id,
      after: { field: dto.field, newValue: dto.newValue, reason: dto.reason },
    });

    return row;
  }

  async listCorrections(
    query: CorrectionQueryDto,
    pagination: PaginationDto,
    user: AuthenticatedUser,
  ) {
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
        orderBy: { createdAt: "desc" },
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
  private correctionPatch(
    field: string,
    value: string,
  ): Partial<Prisma.AttendanceRecordUncheckedCreateInput> {
    if (["firstIn", "lastOut"].includes(field)) {
      if (value === "") return { [field]: null };
      const time = new Date(value);
      if (
        Number.isNaN(time.getTime()) ||
        !/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value)
      )
        throw new BadRequestException(
          "ساعت اصلاح باید تاریخ و منطقه زمانی معتبر داشته باشد.",
        );
      return { [field]: time };
    }
    if (
      [
        "workMinutes",
        "lateMinutes",
        "earlyLeaveMinutes",
        "overtimeMinutes",
        "absenceMinutes",
      ].includes(field)
    ) {
      const minutes = Number(value);
      if (
        !/^\d+$/.test(value) ||
        !Number.isSafeInteger(minutes) ||
        minutes > 2880
      )
        throw new BadRequestException("مقدار دقیقه معتبر نیست.");
      return { [field]: minutes };
    }
    if (
      field === "status" &&
      Object.values(AttendanceRecordStatus).includes(
        value as AttendanceRecordStatus,
      )
    )
      return { status: value as AttendanceRecordStatus };
    if (field === "note" && value.length <= 500) return { note: value };
    throw new BadRequestException("فیلد یا مقدار اصلاح معتبر نیست.");
  }

  async decideCorrection(
    id: string,
    dto: DecideCorrectionDto,
    user: AuthenticatedUser,
    transaction?: Prisma.TransactionClient,
  ) {
    const run = async (db: Prisma.TransactionClient) => {
      await db.$queryRaw`SELECT id FROM "AttendanceCorrection" WHERE id = ${id}::uuid FOR UPDATE`;
      const row = await db.attendanceCorrection.findUnique({ where: { id } });
      if (!row) throw new NotFoundException("اصلاحیه موردنظر یافت نشد.");
      if (row.status !== "PENDING")
        throw new BadRequestException("این اصلاحیه قبلاً بررسی شده است.");
      if (row.requestedById === user.id && !user.isSuperAdmin)
        throw new ForbiddenException(
          "هیچ‌کس اجازه تأیید اصلاحیه ثبت‌شده توسط خودش را ندارد.",
        );
      await this.access.assertEmployeeAccess(user, row.employeeId);
      await db.$queryRaw`SELECT id FROM "Employee" WHERE id = ${row.employeeId}::uuid FOR UPDATE`;
      const approved = dto.decision === "APPROVE";
      let recordId = row.attendanceRecordId;
      if (approved) {
        const patch = this.correctionPatch(row.field, row.newValue ?? "");
        const where = {
          employeeId_workDate: {
            employeeId: row.employeeId,
            workDate: row.workDate,
          },
        };
        const current = await db.attendanceRecord.findUnique({ where });
        if (current?.lockedAt)
          throw new BadRequestException("رکورد حضور قفل شده است.");
        const firstIn =
          patch.firstIn === undefined ? current?.firstIn : patch.firstIn;
        const lastOut =
          patch.lastOut === undefined ? current?.lastOut : patch.lastOut;
        if (firstIn && lastOut && new Date(firstIn) >= new Date(lastOut))
          throw new BadRequestException("خروج باید بعد از ورود باشد.");
        if (row.field === "firstIn" || row.field === "lastOut") {
          const assignment = await db.shiftAssignment.findFirst({
            where: { employeeId: row.employeeId, workDate: row.workDate },
            include: { shift: true },
          });
          const shift = assignment?.shift;
          const work =
            firstIn && lastOut
              ? Math.max(
                  0,
                  minutesBetween(new Date(firstIn), new Date(lastOut)) -
                    (shift?.breakMinutes ?? 0),
                )
              : 0;
          const employee = await db.employee.findUniqueOrThrow({
            where: { id: row.employeeId },
            select: { company: { select: { timezone: true } } },
          });
          const localMinute = (value: Date | string) => {
            const parts = Object.fromEntries(
              new Intl.DateTimeFormat("en-US", {
                timeZone: employee.company.timezone,
                year: "numeric",
                month: "numeric",
                day: "numeric",
                hour: "numeric",
                minute: "numeric",
                hourCycle: "h23",
              })
                .formatToParts(new Date(value))
                .filter((part) => part.type !== "literal")
                .map((part) => [part.type, Number(part.value)]),
            );
            return (
              (Date.UTC(parts.year, parts.month - 1, parts.day) -
                row.workDate.getTime()) /
                60000 +
              parts.hour * 60 +
              parts.minute
            );
          };
          patch.workMinutes = work;
          patch.overtimeMinutes = Math.max(
            0,
            work - (shift?.durationMinutes ?? DEFAULT_WORK_MINUTES),
          );
          patch.lateMinutes = firstIn
            ? Math.max(
                0,
                localMinute(new Date(firstIn)) -
                  (shift
                    ? this.timeToMin(shift.startTime)
                    : DEFAULT_START_MINUTES),
              )
            : 0;
          patch.earlyLeaveMinutes = lastOut
            ? Math.max(
                0,
                (shift
                  ? this.timeToMin(shift.endTime) +
                    (shift.crossMidnight ? 1440 : 0)
                  : DEFAULT_END_MINUTES) - localMinute(new Date(lastOut)),
              )
            : 0;
          patch.status =
            firstIn && lastOut
              ? AttendanceRecordStatus.COMPLETE
              : AttendanceRecordStatus.INCOMPLETE;
          patch.shiftAssignmentId = assignment?.id ?? null;
        }
        const record = await db.attendanceRecord.upsert({
          where,
          create: {
            employeeId: row.employeeId,
            workDate: row.workDate,
            status: "INCOMPLETE",
            ...patch,
          },
          update: patch,
        });
        recordId = record.id;
      }
      const updated = await db.attendanceCorrection.update({
        where: { id },
        data: {
          status: approved ? "APPROVED" : "REJECTED",
          approvedById: user.id,
          decidedAt: new Date(),
          attendanceRecordId: recordId,
        },
      });
      if (row.requestedById)
        await db.notification.create({
          data: {
            userId: row.requestedById,
            type: "REQUEST_RESULT",
            title: approved ? "اصلاحیه حضور تأیید شد" : "اصلاحیه حضور رد شد",
            body: dto.comment ?? null,
            status: "SENT",
            sentAt: new Date(),
            link: "/attendance",
          },
        });
      await this.audit.recordInTransaction(db, user.id, {
        action: approved ? AuditAction.APPROVE : AuditAction.REJECT,
        entity: "AttendanceCorrection",
        entityId: id,
        after: { status: updated.status, field: row.field },
      });
      return updated;
    };
    return transaction
      ? run(transaction)
      : this.prisma.$transaction(run, { maxWait: 10000, timeout: 30000 });
  }
}

/** ساخت تاریخ فقط-تاریخ برای روز d ام ماه شمسی */
function monthDayDate(jy: number, jm: number, d: number): Date {
  const g = jalaliToGregorian(jy, jm, d);
  return new Date(Date.UTC(g.getFullYear(), g.getMonth(), g.getDate()));
}
