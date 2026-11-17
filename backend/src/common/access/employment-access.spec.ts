import { employmentEnded } from './employment-access';
describe('Employment access cutoff', () => {
  it('keeps a future offboarding active until the company-local effective day', () => {
    const employee = { status: 'ACTIVE', terminationDate: new Date('2026-11-02'), company: { timezone: 'Asia/Tehran' } };
    expect(employmentEnded(employee, new Date('2026-11-01T20:29:59Z'))).toBe(false);
    expect(employmentEnded(employee, new Date('2026-11-01T20:30:00Z'))).toBe(true);
  });
  it('rejects a terminated employee independently of a background job', () => {
    expect(employmentEnded({ status: 'TERMINATED' })).toBe(true);
    expect(employmentEnded(null)).toBe(false);
  });
});
