import { DailyAttendanceService } from './daily-attendance.service';
import { calendarDay, calendarDayStart, shiftCalendarDay } from './daily-date.util';

describe('Daily attendance', () => {
  const now = new Date('2026-11-15T00:00:00Z');
  const company: any = { id: 'company', timezone: 'Asia/Tehran', calendars: [{ weekendDays: '5', holidays: [] }] };
  let db: any;
  let service: DailyAttendanceService;
  const employee = (id: string, overrides = {}) => ({ id, attendanceRecords: [], attendances: [], projectAttendances: [], shiftAssignments: [], leaveRequests: [], missions: [], ...overrides });

  beforeEach(() => {
    let checkpoint = '2026-11-13';
    db = {
      company: { findMany: jest.fn().mockResolvedValue([{ id: company.id }]), findUniqueOrThrow: jest.fn().mockResolvedValue(company) },
      employee: { findMany: jest.fn().mockResolvedValue([employee('absent')]) },
      attendanceRecord: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      setting: {
        upsert: jest.fn().mockImplementation(() => ({ value: checkpoint })),
        update: jest.fn().mockImplementation(({ data }) => { checkpoint = data.value; return { value: checkpoint }; }),
      },
      $queryRaw: jest.fn().mockResolvedValue([{ locked: true }]),
    };
    db.$transaction = jest.fn((fn) => fn(db));
    service = new DailyAttendanceService(db);
  });

  it('uses Tehran midnight independently of the server timezone', () => {
    expect(calendarDay(new Date('2026-11-14T20:29:59Z'), 'Asia/Tehran')).toBe('2026-11-14');
    expect(calendarDay(new Date('2026-11-14T20:30:00Z'), 'Asia/Tehran')).toBe('2026-11-15');
    expect(calendarDayStart('2026-11-14', 'Asia/Tehran').toISOString()).toBe('2026-11-13T20:30:00.000Z');
    expect(shiftCalendarDay('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('records a full missed workday once and advances its persistent checkpoint', async () => {
    await service.closeFinishedDays(now);
    await service.closeFinishedDays(now);
    expect(db.attendanceRecord.createMany).toHaveBeenCalledTimes(1);
    expect(db.attendanceRecord.createMany).toHaveBeenCalledWith({ data: [expect.objectContaining({ employeeId: 'absent', status: 'ABSENT', absenceMinutes: 480, absenceType: 'DAILY_NO_SHOW', workDate: new Date('2026-11-14T00:00:00Z') })], skipDuplicates: true });
  });

  it('never marks the current local day absent', async () => {
    await service.closeFinishedDays(new Date('2026-11-14T20:29:59Z'));
    expect(db.attendanceRecord.createMany).not.toHaveBeenCalled();
  });

  it('initializes without backdating absences before activation', async () => {
    db.setting.upsert.mockImplementation(({ create }) => create);
    await service.closeFinishedDays(now);
    expect(db.attendanceRecord.createMany).not.toHaveBeenCalled();
  });

  it('preserves existing records and recognizes device and project attendance', async () => {
    db.employee.findMany.mockResolvedValue([
      employee('recorded', { attendanceRecords: [{ firstIn: new Date('2026-11-14T05:00:00Z'), status: 'INCOMPLETE' }] }),
      employee('device', { attendances: [{ eventTime: new Date('2026-11-14T05:00:00Z') }] }),
      employee('project', { projectAttendances: [{ id: 'presence' }] }),
    ]);
    await service.closeFinishedDays(now);
    expect(db.attendanceRecord.createMany).not.toHaveBeenCalled();
  });

  it('records approved full-day leave and mission without absence minutes', async () => {
    const coverage = [{ startAt: new Date('2026-11-14T04:30:00Z'), endAt: new Date('2026-11-14T12:30:00Z') }];
    db.employee.findMany.mockResolvedValue([employee('leave', { leaveRequests: coverage }), employee('mission', { missions: coverage })]);
    await service.closeFinishedDays(now);
    expect(db.attendanceRecord.createMany.mock.calls[0][0].data).toEqual([
      expect.objectContaining({ employeeId: 'leave', status: 'LEAVE', absenceMinutes: 0 }),
      expect.objectContaining({ employeeId: 'mission', status: 'MISSION', absenceMinutes: 0 }),
    ]);
  });

  it('does not treat an hourly leave as permission to miss the entire day', async () => {
    db.employee.findMany.mockResolvedValue([employee('hourly', { leaveRequests: [{ startAt: new Date('2026-11-14T05:30:00Z'), endAt: new Date('2026-11-14T06:30:00Z') }] })]);
    await service.closeFinishedDays(now);
    expect(db.attendanceRecord.createMany.mock.calls[0][0].data[0].status).toBe('ABSENT');
    expect(db.attendanceRecord.createMany.mock.calls[0][0].data[0].absenceMinutes).toBe(420);
  });

  it('merges approved leave intervals without double counting overlapping time', async () => {
    db.employee.findMany.mockResolvedValue([employee('split-leave', { leaveRequests: [
      { startAt: new Date('2026-11-14T04:30:00Z'), endAt: new Date('2026-11-14T09:00:00Z') },
      { startAt: new Date('2026-11-14T08:00:00Z'), endAt: new Date('2026-11-14T12:30:00Z') },
    ] })]);
    await service.closeFinishedDays(now);
    expect(db.attendanceRecord.createMany.mock.calls[0][0].data[0]).toMatchObject({ status: 'LEAVE', absenceMinutes: 0 });
  });

  it('an explicitly assigned shift overrides a calendar holiday', async () => {
    db.company.findUniqueOrThrow.mockResolvedValue({ ...company, calendars: [{ weekendDays: '5', holidays: [{ date: new Date('2026-11-14T00:00:00Z') }] }] });
    db.employee.findMany.mockResolvedValue([employee('scheduled', { shiftAssignments: [{ shift: { startTime: '08:00', endTime: '16:00', crossMidnight: false, durationMinutes: 480 } }] })]);
    await service.closeFinishedDays(now);
    expect(db.attendanceRecord.createMany.mock.calls[0][0].data[0].status).toBe('ABSENT');
  });

  it('skips calendar holidays', async () => {
    db.company.findUniqueOrThrow.mockResolvedValue({ ...company, calendars: [{ weekendDays: '5', holidays: [{ date: new Date('2026-11-14T00:00:00Z') }] }] });
    await service.closeFinishedDays(now);
    expect(db.attendanceRecord.createMany).not.toHaveBeenCalled();
  });

  it('waits until an overnight shift ends before closing the day', async () => {
    db.employee.findMany.mockResolvedValue([employee('night', { shiftAssignments: [{ shift: { startTime: '22:00', endTime: '06:00', crossMidnight: true, durationMinutes: 480 } }] })]);
    await service.closeFinishedDays(now);
    expect(db.attendanceRecord.createMany).not.toHaveBeenCalled();
    expect(db.setting.update).not.toHaveBeenCalled();
    await service.closeFinishedDays(new Date('2026-11-15T03:00:00Z'));
    expect(db.attendanceRecord.createMany).toHaveBeenCalledTimes(1);
  });

  it('does not process the same day on competing server instances', async () => {
    db.$queryRaw.mockResolvedValue([{ locked: false }]);
    await service.closeFinishedDays(now);
    expect(db.employee.findMany).not.toHaveBeenCalled();
  });

  it('uses the first successful login of the company day without manual confirmation', async () => {
    const first = new Date('2026-11-14T21:00:00Z');
    db.employee.findUniqueOrThrow = jest.fn().mockResolvedValue({ id: 'logged-in', companyId: company.id });
    db.employee.findMany.mockResolvedValue([employee('logged-in', { user: { lastLoginAt: now, sessions: [{ createdAt: first }] } })]);
    const result = await service.status({ employeeId: 'logged-in' } as any, now);
    expect(result.data).toMatchObject({ status: 'PRESENT', firstIn: first, canConfirm: false, day: '2026-11-15' });
    expect(db.employee.findMany.mock.calls[0][0].include.user.select.sessions.where.createdAt).toEqual({ gte: new Date('2026-11-14T20:30:00Z'), lt: new Date('2026-11-15T20:30:00Z') });
  });

  it('does not treat a previous-day login or physical attendance as a login today', async () => {
    db.employee.findUniqueOrThrow = jest.fn().mockResolvedValue({ id: 'not-logged-in', companyId: company.id });
    db.employee.findMany.mockResolvedValue([employee('not-logged-in', { user: { lastLoginAt: new Date('2026-11-14T10:00:00Z'), sessions: [] }, attendanceRecords: [{ firstIn: now, status: 'INCOMPLETE' }] })]);
    expect((await service.status({ employeeId: 'not-logged-in' } as any, now)).data).toMatchObject({ status: 'PENDING', firstIn: null, canConfirm: false });
  });

  it('limits the manager list to scoped employee IDs and returns login states', async () => {
    db.employee.findMany.mockResolvedValueOnce([{ companyId: company.id }]).mockResolvedValueOnce([
      employee('yes', { firstName: 'A', lastName: 'B', user: { lastLoginAt: now, sessions: [] } }),
      employee('no', { firstName: 'C', lastName: 'D', user: { lastLoginAt: null, sessions: [] } }),
    ]);
    const result = await service.teamStatus(['yes', 'no'], now);
    expect(db.employee.findMany.mock.calls[1][0].where.id).toEqual({ in: ['yes', 'no'] });
    expect(result.data.map((row) => row.status)).toEqual(['PRESENT', 'PENDING']);
  });

  it('does not mark an employee absent for a day they logged in', async () => {
    db.employee.findMany.mockResolvedValue([employee('logged-in', { user: { lastLoginAt: new Date('2026-11-14T05:00:00Z'), sessions: [] } })]);
    await service.closeFinishedDays(now);
    expect(db.attendanceRecord.createMany).not.toHaveBeenCalled();
  });
});
