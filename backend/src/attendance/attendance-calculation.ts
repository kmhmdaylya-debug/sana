import { calendarDay, calendarDayStart, shiftCalendarDay } from './daily-date.util';

type Event = { type: 'IN' | 'OUT'; eventTime: Date };
type Assignment = { workDate: Date; shift: { startTime: string; endTime: string } };
const MINUTE = 60000;

export function shiftBounds(day: string, startTime: string, endTime: string, zone: string) {
  const minute = (value: string) => { const [h, m] = value.split(':').map(Number); return h * 60 + m; };
  const start = minute(startTime), end = minute(endTime);
  return {
    start: new Date(calendarDayStart(day, zone).getTime() + start * MINUTE),
    end: new Date(calendarDayStart(end <= start ? shiftCalendarDay(day, 1) : day, zone).getTime() + end * MINUTE),
  };
}

export function attendanceBuckets(events: Event[], assignments: Assignment[], zone: string) {
  const buckets = new Map<string, { ins: Date[]; outs: Date[]; pairedMinutes: number; incomplete: boolean; suspicious: boolean }>();
  const bucket = (day: string) => {
    if (!buckets.has(day)) buckets.set(day, { ins: [], outs: [], pairedMinutes: 0, incomplete: false, suspicious: false });
    return buckets.get(day)!;
  };
  const shifts = assignments.map(a => ({ day: a.workDate.toISOString().slice(0, 10), ...shiftBounds(a.workDate.toISOString().slice(0, 10), a.shift.startTime, a.shift.endTime, zone) }));
  let open: { day: string; at: Date } | null = null;
  for (const event of [...events].sort((a, b) => a.eventTime.getTime() - b.eventTime.getTime())) {
    if (event.type === 'IN') {
      if (open) { bucket(open.day).incomplete = true; bucket(open.day).suspicious = true; }
      const match = shifts.filter(s => event.eventTime.getTime() >= s.start.getTime() - 4 * 60 * MINUTE && event.eventTime <= s.end)
        .sort((a, b) => Math.abs(event.eventTime.getTime() - a.start.getTime()) - Math.abs(event.eventTime.getTime() - b.start.getTime()))[0];
      const day = match?.day ?? calendarDay(event.eventTime, zone);
      bucket(day).ins.push(event.eventTime);
      open = { day, at: event.eventTime };
    } else if (open && event.eventTime.getTime() - open.at.getTime() <= 24 * 60 * MINUTE) {
      const row = bucket(open.day);
      row.outs.push(event.eventTime);
      row.pairedMinutes += Math.max(0, (event.eventTime.getTime() - open.at.getTime()) / MINUTE);
      open = null;
    } else {
      if (open) bucket(open.day).incomplete = true;
      const day = calendarDay(event.eventTime, zone);
      bucket(day).outs.push(event.eventTime);
      bucket(day).incomplete = true;
      open = null;
    }
  }
  if (open) bucket(open.day).incomplete = true;
  return buckets;
}
