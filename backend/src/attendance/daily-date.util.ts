const DAY = 86_400_000;

export function calendarDay(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function shiftCalendarDay(day: string, amount: number): string {
  return new Date(new Date(`${day}T00:00:00Z`).getTime() + amount * DAY).toISOString().slice(0, 10);
}

export function calendarDayStart(day: string, timeZone: string): Date {
  const midnight = new Date(`${day}T00:00:00Z`).getTime();
  let instant = midnight;
  // Resolve the zone offset at the resulting instant, independent of the host zone.
  for (let i = 0; i < 3; i++) {
    const offset = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' }).formatToParts(new Date(instant)).find((p) => p.type === 'timeZoneName')!.value;
    const match = /^GMT([+-])(\d{2}):(\d{2})$/.exec(offset);
    const minutes = match ? (Number(match[2]) * 60 + Number(match[3])) * (match[1] === '+' ? 1 : -1) : 0;
    instant = midnight - minutes * 60_000;
  }
  return new Date(instant);
}
