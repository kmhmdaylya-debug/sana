import { calendarDay } from '../../attendance/daily-date.util';

export function employmentEnded(employee: { status?: string; terminationDate?: Date | null; company?: { timezone: string } } | null | undefined, now = new Date()): boolean {
  if (!employee) return false;
  if (employee.status === 'TERMINATED') return true;
  return !!employee.terminationDate && employee.terminationDate.toISOString().slice(0, 10) <= calendarDay(now, employee.company?.timezone ?? 'Asia/Tehran');
}
