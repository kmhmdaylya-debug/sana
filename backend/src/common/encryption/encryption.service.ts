import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer;

  constructor(private readonly config: ConfigService) {
    const secret = this.config.get<string>('app.encryption.fieldKey') ?? this.config.get<string>('BACKUP_ENCRYPTION_KEY');
    if (!secret) {
      throw new Error('FIELD_ENCRYPTION_KEY or BACKUP_ENCRYPTION_KEY must be set');
    }
    this.key = crypto.createHash('sha256').update(secret).digest();
  }

  /**
   * Encrypt a plaintext string
   * Returns: iv:authTag:ciphertext (all base64)
   */
  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(12); // 96-bit IV for GCM
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    // Format: iv:authTag:ciphertext (all base64)
    return `${iv.toString('base64')}:${authTag.toString('base64')}:${ciphertext.toString('base64')}`;
  }

  /**
   * Decrypt a string encrypted with encrypt()
   */
  decrypt(encrypted: string): string {
    const parts = encrypted.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted format');
    }
    const [ivB64, authTagB64, ciphertextB64] = parts;
    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(authTagB64, 'base64');
    const ciphertext = Buffer.from(ciphertextB64, 'base64');

    const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
    decipher.setAuthTag(authTag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plaintext.toString('utf8');
  }

  /**
   * Check if a string appears to be encrypted (has the format iv:authTag:ciphertext)
   */
  isEncrypted(value: string): boolean {
    if (!value || typeof value !== 'string') return false;
    const parts = value.split(':');
    if (parts.length !== 3) return false;
    // Check if all parts are valid base64
    return parts.every(p => {
      try {
        Buffer.from(p, 'base64');
        return true;
      } catch {
        return false;
      }
    });
  }
}

export const encryptionServiceInstance = new EncryptionService({ get: () => process.env.BACKUP_ENCRYPTION_KEY } as any);