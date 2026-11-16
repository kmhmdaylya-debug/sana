import { sanitizeStoredAudit, stringifyAudit } from './audit-redaction';

describe('Audit redaction', () => {
  it('redacts nested sensitive values without losing identifiers and state transitions', () => {
    const output = JSON.parse(stringifyAudit({ id: 'record', status: 'ACTIVE', nested: { passwordHash: 'secret-hash', nationalId: 'private-id', bankAccounts: [{ sheba: 'private-bank' }], monthlyBaseSalary: 123n, note: 'private note' } })!);
    expect(output.id).toBe('record');
    expect(output.status).toBe('ACTIVE');
    expect(output.nested.bankAccounts[0].sheba).toBe('[REDACTED]');
    for (const value of ['secret-hash', 'private-id', 'private-bank', 'private note']) expect(JSON.stringify(output)).not.toContain(value);
  });
  it('does not return raw malformed legacy audit text', () => {
    expect(sanitizeStoredAudit('private legacy message')).toBe('[REDACTED]');
    const cyclic: any = {}; cyclic.self = cyclic;
    expect(stringifyAudit(cyclic)).toBe('[UNSERIALIZABLE]');
  });
});
