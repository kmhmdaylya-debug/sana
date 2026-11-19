export const COUNTDOWN_WINDOW_MS = 72 * 60 * 60 * 1000;

const tehranClock = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});

function parseDateOnly(value: string): Date | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month, day));
  if (date.getUTCFullYear() !== Number(match[1]) || date.getUTCMonth() !== Number(match[2]) - 1 || date.getUTCDate() !== Number(match[3])) {
    return null;
  }
  return date;
}

export function taskDeadlineAt(value?: string | null): number | null {
  if (!value) return null;

  // Handle date-only strings (YYYY-MM-DD)
  const dateOnlyObj = parseDateOnly(value);
  if (dateOnlyObj) {
    const midnight = dateOnlyObj.getTime();
    const nextDay = midnight + 24 * 60 * 60 * 1000;
    let end = nextDay;
    for (let pass = 0; pass < 2; pass += 1) {
      const partsArray = tehranClock.formatToParts(new Date(end));
      const parts: Record<string, string> = {};
      for (const part of partsArray) {
        parts[part.type] = part.value;
      }
      // Check if all required parts exist before converting
      if (parts['year'] === undefined || parts['month'] === undefined || parts['day'] === undefined ||
          parts['hour'] === undefined || parts['minute'] === undefined || parts['second'] === undefined) {
        return null;
      }
      const year = Number(parts['year']);
      const month = Number(parts['month']);
      const dayNum = Number(parts['day']);
      const hour = Number(parts['hour']);
      const minute = Number(parts['minute']);
      const second = Number(parts['second']);
      if (isNaN(year) || isNaN(month) || isNaN(dayNum) || isNaN(hour) || isNaN(minute) || isNaN(second)) return null;
      const localAsUtc = Date.UTC(year, month - 1, dayNum, hour, minute, second);
      end = nextDay - (localAsUtc - end);
    }
    return end;
  }

  // Handle ISO datetime strings
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;

  const day = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const midnight = Date.parse(`${day}T00:00:00.000Z`);
  if (!Number.isFinite(midnight) || new Date(midnight).toISOString().slice(0, 10) !== day) return null;

  // Task forms save a calendar date as UTC midnight, not an explicit time of day.
  const dateOnly = value === day || /^\d{4}-\d{2}-\d{2}T00:00:00(?:\.0+)?(?:Z|\+00:00)$/.test(value);
  if (!dateOnly) return timestamp;
  const nextDay = Date.parse(`${day}T00:00:00.000Z`) + 24 * 60 * 60 * 1000;
  let end = nextDay;
  for (let pass = 0; pass < 2; pass += 1) {
    const partsArray = tehranClock.formatToParts(new Date(end));
    const parts: Record<string, string> = {};
    for (const part of partsArray) {
      parts[part.type] = part.value;
    }
    // Check if all required parts exist before converting
    if (parts['year'] === undefined || parts['month'] === undefined || parts['day'] === undefined ||
        parts['hour'] === undefined || parts['minute'] === undefined || parts['second'] === undefined) {
      return null;
    }
    const year = Number(parts['year']);
    const month = Number(parts['month']);
    const dayNum = Number(parts['day']);
    const hour = Number(parts['hour']);
    const minute = Number(parts['minute']);
    const second = Number(parts['second']);
    if (isNaN(year) || isNaN(month) || isNaN(dayNum) || isNaN(hour) || isNaN(minute) || isNaN(second)) return null;
    const localAsUtc = Date.UTC(year, month - 1, dayNum, hour, minute, second);
    end = nextDay - (localAsUtc - end);
  }
  return end;
}

export function taskCountdown(deadline: number | null, status: string, now = Date.now()) {
  if (deadline === null || !Number.isFinite(deadline) || !Number.isFinite(now)
    || ['DONE', 'CANCELLED'].includes(status)) return null;
  const remaining = deadline - now;
  if (remaining > COUNTDOWN_WINDOW_MS) return null;
  const seconds = Math.max(0, Math.ceil(remaining / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return {
    expired: remaining <= 0,
    urgent: remaining <= 24 * 60 * 60 * 1000,
    hours, minutes, seconds: remainder,
    text: [hours, minutes, remainder].map(value => String(value).padStart(2, '0')).join(':'),
    fraction: Math.max(0, Math.min(1, remaining / COUNTDOWN_WINDOW_MS)),
  };
}