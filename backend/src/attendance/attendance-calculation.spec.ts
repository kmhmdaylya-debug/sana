import { attendanceBuckets, shiftBounds } from './attendance-calculation';
import { calendarDayStart } from './daily-date.util';

describe('Attendance workday pairing', () => {
  const zone = 'Asia/Tehran';
  const assignment = [{ workDate: new Date('2026-11-01'), shift: { startTime: '22:00', endTime: '06:00' } }];
  const event = (type: 'IN' | 'OUT', time: string) => ({ type, eventTime: new Date(time) });
  it('keeps the next-morning exit on the night shift start day', () => {
    const rows = attendanceBuckets([event('IN', '2026-11-01T18:30:00Z'), event('OUT', '2026-11-02T02:30:00Z')], assignment, zone);
    expect(rows.size).toBe(1);
    expect(rows.get('2026-11-01')).toMatchObject({ pairedMinutes: 480, incomplete: false });
    expect(shiftBounds('2026-11-01', '22:00', '06:00', zone).end.toISOString()).toBe('2026-11-02T02:30:00.000Z');
  });
  it('does not count time spent clocked out as work', () => {
    const rows = attendanceBuckets([event('IN', '2026-11-01T04:30:00Z'), event('OUT', '2026-11-01T08:30:00Z'), event('IN', '2026-11-01T09:30:00Z'), event('OUT', '2026-11-01T12:30:00Z')], [], zone);
    expect(rows.get('2026-11-01')).toMatchObject({ pairedMinutes: 420, incomplete: false });
  });
  it('does not pair an exit several days later and flags repeated entries', () => {
    const rows = attendanceBuckets([event('IN', '2026-11-01T04:30:00Z'), event('IN', '2026-11-01T05:30:00Z'), event('OUT', '2026-11-03T12:30:00Z')], [], zone);
    expect(rows.get('2026-11-01')).toMatchObject({ pairedMinutes: 0, incomplete: true, suspicious: true });
  });
  it('binds an entry after midnight to an assigned overnight shift', () => {
    const rows = attendanceBuckets([event('IN', '2026-11-01T21:30:00Z'), event('OUT', '2026-11-02T02:30:00Z')], assignment, zone);
    expect(rows.has('2026-11-02')).toBe(false);
    expect(rows.get('2026-11-01')?.pairedMinutes).toBe(300);
  });
});
