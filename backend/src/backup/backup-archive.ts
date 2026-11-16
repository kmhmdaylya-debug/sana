import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const MAGIC = Buffer.from('SANA-PGDUMP-v1\n', 'ascii');

export function archiveChecksum(data: Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

export function encryptArchive(dump: Buffer, secret: string): Buffer {
  if (!dump.subarray(0, 5).equals(Buffer.from('PGDMP'))) throw new Error('Invalid PostgreSQL archive');
  if (!secret || secret.length < 32) throw new Error('Missing backup encryption key');
  const key = createHash('sha256').update(secret).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(dump), cipher.final()]);
  return Buffer.concat([MAGIC, iv, cipher.getAuthTag(), encrypted]);
}

export function decryptArchive(data: Buffer, secret: string): Buffer {
  if (!secret || secret.length < 32 || data.length < MAGIC.length + 33 || !data.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error('Invalid encrypted archive');
  const offset = MAGIC.length;
  const decipher = createDecipheriv('aes-256-gcm', createHash('sha256').update(secret).digest(), data.subarray(offset, offset + 12));
  decipher.setAuthTag(data.subarray(offset + 12, offset + 28));
  const dump = Buffer.concat([decipher.update(data.subarray(offset + 28)), decipher.final()]);
  if (!dump.subarray(0, 5).equals(Buffer.from('PGDMP'))) throw new Error('Invalid PostgreSQL archive');
  return dump;
}
