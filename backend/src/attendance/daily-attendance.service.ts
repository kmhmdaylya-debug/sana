import { BadRequestException, ForbiddenException, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { AttendanceRecordStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { calendarDay, calendarDayStart, shiftCalendarDay } from './daily-date.util';
import { AccessService } from '../common/access/access.service';
import { PERMISSIONS } from '../common/constants/permissions';
import { ManualDailyAttendanceDto } from './dto/manual-daily-attendance.dto';

type Store = Prisma.TransactionClient;
const DAY = 86_400_000;
const MINUTE = 60_000;

@Injectable()
export class DailyAttendanceService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DailyAttendanceService.name);
  private timer?: ReturnType<typeof setInterval>;
  private running: Promise<void> | null = null;

  constructor(private readonly prisma: PrismaService, private readonly access: AccessService) {}

  async onModuleInit() {
    await this.run();
    this.timer = setInterval(() => void this.run(), MINUTE);
    this.timer.unref();
  }

  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    await this.running;
  }

  private run() {
    if (this.running) return this.running;
    this.running = this.closeFinishedDays().catch((error) => this.logger.error(`Daily attendance: ${(error as Error).message}`)).finally(() => { this.running = null; });
    return this.running;
  }

  private company(companyId: string, tx: Store = this.prisma) {
    return tx.company.findUniqueOrThrow({ where: { id: companyId }, include: { calendars: { orderBy: { createdAt: 'asc' }, take: 1, include: { holidays: true } } } });
  }

  private employeesForDay(tx: Store, companyId: string, day: string, zone: string, employeeId?: string, allowedIds?: string[]) {
    const workDate = new Date(`${day}T00:00:00Z`);
    const start = calendarDayStart(day, zone);
    const end = calendarDayStart(shiftCalendarDay(day, 1), zone);
    return tx.employee.findMany({
      where: {
        companyId, ...(employeeId ? { id: employeeId } : allowedIds ? { id: { in: allowedIds } } : {}), status: 'ACTIVE', deletedAt: null,
        hireDate: { lte: workDate }, createdAt: { lt: end },
        OR: [{ terminationDate: null }, { terminationDate: { gte: workDate } }],
        user: { is: { status: 'ACTIVE', deletedAt: null, ...(!employeeId ? { isSuperAdmin: false } : {}) } },
      },
      include: {
        attendanceRecords: { where: { workDate } },
        attendances: { where: { type: 'IN', eventTime: { gte: start, lt: new Date(end.getTime() + DAY) } }, orderBy: { eventTime: 'asc' } },
        projectAttendances: { where: { workDate }, select: { id: true } },
        shiftAssignments: { where: { workDate, status: { notIn: ['CANCELLED', 'REJECTED', 'OFF', 'REST'] } }, include: { shift: true } },
        leaveRequests: { where: { status: 'APPROVED', startAt: { lt: new Date(end.getTime() + DAY) }, endAt: { gt: start } }, select: { startAt: true, endAt: true } },
        missions: { where: { status: { in: ['APPROVED', 'IN_PROGRESS', 'COMPLETED'] }, startAt: { lt: new Date(end.getTime() + DAY) }, endAt: { gt: start } }, select: { startAt: true, endAt: true } },
      },
    });
  }

  private dayState(employee: Awaited<ReturnType<DailyAttendanceService['employeesForDay']>>[number], company: Awaited<ReturnType<DailyAttendanceService['company']>>, day: string) {
    const zone = company.timezone;
    const start = calendarDayStart(day, zone);
    const end = calendarDayStart(shiftCalendarDay(day, 1), zone);
    const calendar = company.calendars[0];
    const weekend = (calendar?.weekendDays ?? '5').split(',').filter((value) => value.trim() !== '').map(Number).includes(new Date(`${day}T00:00:00Z`).getUTCDay());
    const holiday = calendar?.holidays.some((h) => h.date.toISOString().slice(0, 10) === day) ?? false;
    const schedules = employee.shiftAssignments.map((a) => {
      const at = (value: string, date = day) => {
        const [hours, minutes] = value.split(':').map(Number);
        return new Date(calendarDayStart(date, zone).getTime() + (hours * 60 + minutes) * MINUTE);
      };
      return { start: at(a.shift.startTime), end: at(a.shift.endTime, a.shift.crossMidnight ? shiftCalendarDay(day, 1) : day), minutes: a.shift.durationMinutes };
    });
    if (!schedules.length) schedules.push({ start: new Date(start.getTime() + 8 * 60 * MINUTE), end: new Date(start.getTime() + 16 * 60 * MINUTE), minutes: 480 });
    const working = employee.shiftAssignments.length > 0 || (!weekend && !holiday);
    const cutoff = new Date(Math.max(end.getTime(), ...schedules.map((s) => s.end.getTime())));
    const record = employee.attendanceRecords[0];
    const firstIn = record?.status === 'ABSENT' ? null : record?.firstIn ?? employee.attendances.find((e) => e.eventTime < cutoff)?.eventTime ?? null;
    const coveredMinutes = (schedule: { start: Date; end: Date }, ranges: { startAt: Date; endAt: Date }[]) => {
      const intervals = ranges.map((r) => [Math.max(schedule.start.getTime(), r.startAt.getTime()), Math.min(schedule.end.getTime(), r.endAt.getTime())]).filter(([a, b]) => b > a).sort((a, b) => a[0] - b[0]);
      let until = schedule.start.getTime();
      let covered = 0;
      for (const [a, b] of intervals) {
        covered += Math.max(0, b - Math.max(a, until));
        until = Math.max(until, b);
      }
      return covered / MINUTE;
    };
    const coversSchedules = (ranges: { startAt: Date; endAt: Date }[]) => schedules.every((s) => coveredMinutes(s, ranges) >= (s.end.getTime() - s.start.getTime()) / MINUTE);
    const leave = record?.status === 'LEAVE' || coversSchedules(employee.leaveRequests);
    const mission = record?.status === 'MISSION' || coversSchedules(employee.missions);
    const missingMinutes = schedules.reduce((sum, s) => sum + Math.max(0, s.minutes - coveredMinutes(s, [...employee.leaveRequests, ...employee.missions])), 0);
    const mixedExcuse = missingMinutes === 0 && !leave && !mission;
    const present = record?.status !== 'ABSENT' && (!!firstIn || employee.projectAttendances.length > 0 || (!!record && ['COMPLETE', 'REMOTE'].includes(record.status)));
    return { working, cutoff, record, firstIn, present, leave, mission: mission || mixedExcuse, minutes: Math.ceil(missingMinutes) };
  }

  private displayStatus(state: ReturnType<DailyAttendanceService['dayState']>) {
    return state.present ? 'PRESENT' : state.record?.status === 'ABSENT' ? 'ABSENT' : state.leave ? 'LEAVE' : state.mission ? 'MISSION' : !state.working ? 'HOLIDAY' : 'PENDING';
  }

  async status(user: AuthenticatedUser, now = new Date()) {
    if (!user.employeeId) throw new ForbiddenException('برای شما پروندهٔ پرسنلی تعریف نشده است.');
    const employee = await this.prisma.employee.findUniqueOrThrow({ where: { id: user.employeeId } });
    const company = await this.company(employee.companyId);
    const day = calendarDay(now, company.timezone);
    const employees = await this.employeesForDay(this.prisma, company.id, day, company.timezone, employee.id);
    if (!employees.length) throw new BadRequestException('پروندهٔ پرسنلی شما برای ثبت حضور فعال نیست.');
    const state = this.dayState(employees[0], company, day);
    const status = this.displayStatus(state);
    return { success: true, data: { day, timeZone: company.timezone, serverNow: now.toISOString(), status, firstIn: state.firstIn, canConfirm: false } };
  }

  async teamStatus(employeeIds: string[], now = new Date()) {
    if (!employeeIds.length) return { success: true, data: [], timestamp: now.toISOString() };
    const refs = await this.prisma.employee.findMany({ where: { id: { in: employeeIds } }, select: { companyId: true }, distinct: ['companyId'] });
    const groups = await Promise.all(refs.map(async (ref) => {
      const company = await this.company(ref.companyId);
      const day = calendarDay(now, company.timezone);
      const employees = await this.employeesForDay(this.prisma, company.id, day, company.timezone, undefined, employeeIds);
      return employees.map((employee) => {
        const state = this.dayState(employee, company, day);
        const status = this.displayStatus(state);
        return { employeeId: employee.id, code: employee.code, fullName: `${employee.firstName} ${employee.lastName}`, day, timeZone: company.timezone, firstIn: state.firstIn, status };
      });
    }));
    return { success: true, data: groups.flat().sort((a, b) => a.fullName.localeCompare(b.fullName, 'fa')), timestamp: now.toISOString() };
  }

  async setToday(employeeId: string, dto: ManualDailyAttendanceDto, user: AuthenticatedUser, now = new Date()) {
    const required = [PERMISSIONS.DASHBOARD_VIEW_MANAGEMENT, PERMISSIONS.ATTENDANCE_CREATE];
    if (!user.isSuperAdmin && !required.every(permission => user.permissions.includes(permission) || user.permissions.includes('*'))) throw new ForbiddenException('ثبت حضور فقط برای مدیر دارای مجوز امکان‌پذیر است.');
    if (!(await this.access.canAccessEmployee(user, employeeId))) throw new ForbiddenException('این کارمند خارج از حوزهٔ دسترسی شماست.');
    const employee = await this.prisma.employee.findUniqueOrThrow({ where: { id: employeeId } });
    if (employee.deletedAt || employee.status !== 'ACTIVE') throw new BadRequestException('پروندهٔ کارمند فعال نیست.');
    const company = await this.company(employee.companyId);
    const day = calendarDay(now, company.timezone);
    if (dto.day !== day) throw new BadRequestException('تاریخ تغییر کرده است؛ فهرست حضور را تازه‌سازی کنید.');
    const workDate = new Date(`${day}T00:00:00Z`);
    if (employee.hireDate > workDate) throw new BadRequestException('تاریخ شروع همکاری این کارمند هنوز نرسیده است.');
    const minuteOfDay = dto.firstIn ? Number(dto.firstIn.slice(0, 2)) * 60 + Number(dto.firstIn.slice(3)) : null;
    const firstIn = dto.status === 'PRESENT' ? (minuteOfDay === null ? now : new Date(calendarDayStart(day, company.timezone).getTime() + minuteOfDay * MINUTE)) : null;
    if (firstIn && firstIn > now) throw new BadRequestException('زمان ورود نمی‌تواند در آینده باشد.');
    const row = await this.prisma.$transaction(async tx => {
      // Serialize with daily closing and concurrent edits; keep the record and audit atomic.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(7341, 2411)`;
      const before = await tx.attendanceRecord.findUnique({ where: { employeeId_workDate: { employeeId, workDate } } });
      if (before?.lockedAt || before?.lastOut || before?.workMinutes || before?.overtimeMinutes) throw new BadRequestException('این رکورد دارای کارکرد یا قفل است؛ از بخش اصلاحیهٔ حضور استفاده کنید.');
      const data = {
        firstIn, status: dto.status === 'PRESENT' ? AttendanceRecordStatus.INCOMPLETE : AttendanceRecordStatus.ABSENT,
        absenceMinutes: 0, absenceType: dto.status === 'ABSENT' ? 'MANUAL_ABSENT' : null,
        note: dto.note?.trim() || 'ثبت دستی حضور توسط مدیر',
      };
      const after = await tx.attendanceRecord.upsert({ where: { employeeId_workDate: { employeeId, workDate } }, create: { employeeId, workDate, ...data }, update: data });
      await tx.auditLog.create({ data: { userId: user.id, action: before ? 'UPDATE' : 'CREATE', entity: 'DailyAttendance', entityId: after.id, before: before ? JSON.stringify(before) : null, after: JSON.stringify(after), note: 'ثبت دستی وضعیت حضور توسط مدیر' } });
      return after;
    });
    return { success: true, data: row };
  }

  async closeFinishedDays(now = new Date()) {
    const companies = await this.prisma.company.findMany({ where: { isActive: true, deletedAt: null }, select: { id: true } });
    for (const companyRef of companies) {
      // Limit each pass; persistent checkpoints resume longer outages on subsequent passes.
      for (let batch = 0; batch < 31; batch++) {
        const advanced = await this.prisma.$transaction(async (tx) => {
          const [lock] = await tx.$queryRaw<{ locked: boolean }[]>`SELECT pg_try_advisory_xact_lock(7341, 2411) AS locked`;
          if (!lock.locked) return false;
          const company = await this.company(companyRef.id, tx);
          const today = calendarDay(now, company.timezone);
          const key = `attendance.daily.closedThrough:${company.id}`;
          const checkpoint = await tx.setting.upsert({ where: { key }, update: {}, create: { key, value: shiftCalendarDay(today, -1), group: 'SYSTEM', label: 'آخرین روز پردازش حضور روزانه' } });
          if (!checkpoint.value || !/^\d{4}-\d{2}-\d{2}$/.test(checkpoint.value)) throw new Error('Invalid daily attendance checkpoint');
          const day = shiftCalendarDay(checkpoint.value, 1);
          if (day >= today) return false;
          const employees = await this.employeesForDay(tx, company.id, day, company.timezone);
          const states = employees.map((employee) => ({ employee, state: this.dayState(employee, company, day) }));
          if (states.some(({ state }) => state.working && state.cutoff > now)) return false;
          const rows: Prisma.AttendanceRecordCreateManyInput[] = [];
          for (const { employee, state } of states) {
            if (state.record || state.present || !state.working) continue;
            const status: AttendanceRecordStatus = state.leave ? 'LEAVE' : state.mission ? 'MISSION' : 'ABSENT';
            rows.push({ employeeId: employee.id, workDate: new Date(`${day}T00:00:00Z`), status, absenceMinutes: status === 'ABSENT' ? state.minutes : 0, absenceType: status === 'ABSENT' ? 'DAILY_NO_SHOW' : null, note: status === 'ABSENT' ? 'غیبت خودکار: روز کاری بدون ثبت حضور' : 'وضعیت روزانه طبق درخواست تأییدشده' });
          }
          if (rows.length) {
            await tx.attendanceRecord.createMany({ data: rows, skipDuplicates: true });
            await tx.auditLog.create({ data: { action: 'CREATE', entity: 'DailyAttendance', after: JSON.stringify({ companyId: company.id, day, records: rows.length }), note: 'بستن خودکار روز کاری' } });
          }
          await tx.setting.update({ where: { key }, data: { value: day } });
          return true;
        }, { timeout: 30_000 });
        if (!advanced) break;
      }
    }
  }
}
