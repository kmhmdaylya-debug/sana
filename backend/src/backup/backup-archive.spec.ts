import { randomBytes } from 'crypto';
import { archiveChecksum, decryptArchive, encryptArchive } from './backup-archive';
import { postgresEnvironment } from './postgres-tools';
import { buildCsvBuffer } from '../common/utils/export.util';

describe('Encrypted PostgreSQL archives', () => {
  const secret = randomBytes(48).toString('hex');
  const dump = Buffer.concat([Buffer.from('PGDMP'), randomBytes(200)]);
  it('round trips binary archive data without exposing plaintext and uses a unique IV', () => {
    const encrypted = encryptArchive(dump, secret);
    expect(decryptArchive(encrypted, secret)).toEqual(dump);
    expect(encryptArchive(dump, secret)).not.toEqual(encrypted);
    expect(encrypted.includes(dump)).toBe(false);
    expect(archiveChecksum(encrypted)).toHaveLength(64);
  });
  it.each([0, 14, 28, 50, 100])('rejects tampering at byte %s', index => {
    const encrypted = encryptArchive(dump, secret);
    encrypted[index] ^= 1;
    expect(() => decryptArchive(encrypted, secret)).toThrow();
  });
  it('rejects wrong keys, truncated files and non-database exports', () => {
    const encrypted = encryptArchive(dump, secret);
    expect(() => decryptArchive(encrypted, randomBytes(48).toString('hex'))).toThrow();
    expect(() => decryptArchive(encrypted.subarray(0, 20), secret)).toThrow();
    expect(() => encryptArchive(Buffer.from('{"employees":[]}'), secret)).toThrow();
  });
  it('passes database credentials via child environment, not command arguments', () => {
    const env = postgresEnvironment('postgresql://test-user:test%21password@127.0.0.1:5433/test_db?schema=public&sslmode=require');
    expect(env.PGDATABASE).toBe('test_db');
    expect(env.PGPASSWORD).toBe('test!password');
    expect(env.PGSSLMODE).toBe('require');
  });
  it('escapes CSV formula injection but preserves actual negative numeric amounts', () => {
    const csv = buildCsvBuffer(['value'], [['=HYPERLINK("test")'], [' +123'], ['@SUM(1)'], ['-2+3'], [-123]]).toString('utf8');
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain("' +123");
    expect(csv).toContain("'@SUM(1)");
    expect(csv).toContain("'-2+3");
    expect(csv).toContain('\r\n-123');
  });
});
