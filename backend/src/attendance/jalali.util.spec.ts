import { jalaliMonthLength, jalaliMonthRange, jalaliToGregorian, localDateKey } from './jalali.util';

describe('Jalali calendar boundaries', () => {
  it.each([1399, 1403])('includes Esfand 30 in leap year %i', (year) => {
    expect(jalaliMonthLength(year, 12)).toBe(30);
    const range = jalaliMonthRange(year, 12);
    expect(range.days).toBe(30);
    expect(range.end.getTime()).toBe(jalaliToGregorian(year, 12, 30).getTime());
  });

  it.each([1400, 1404])('rejects Esfand 30 in common year %i', (year) => {
    expect(jalaliMonthLength(year, 12)).toBe(29);
    expect(() => jalaliToGregorian(year, 12, 30)).toThrow();
  });

  it('maps the leap-year boundary to the correct consecutive Gregorian days', () => {
    expect(localDateKey(jalaliToGregorian(1403, 12, 30))).toBe('2025-03-20');
    expect(localDateKey(jalaliToGregorian(1404, 1, 1))).toBe('2025-03-21');
  });

  it.each([0, 13, 1.5, NaN])('rejects invalid month %s before computing a range', (month) => {
    expect(() => jalaliMonthLength(1403, month)).toThrow();
    expect(() => jalaliMonthRange(1403, month)).toThrow();
  });

  it.each([0, 1403.5, 3178, NaN])('rejects invalid year %s', (year) => {
    expect(() => jalaliMonthLength(year, 1)).toThrow();
  });

  it('does not silently roll an invalid date into the next month', () => {
    expect(jalaliMonthLength(1403, 6)).toBe(31);
    expect(jalaliMonthLength(1403, 7)).toBe(30);
    expect(() => jalaliToGregorian(1403, 7, 31)).toThrow();
  });
});
