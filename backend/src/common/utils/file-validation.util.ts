import { BadRequestException, Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';
import { execSync } from 'child_process';

const UPLOAD_ROOT = path.resolve(process.cwd(), 'uploads');
const ALLOWED_EXT = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx', '.xls', '.xlsx'];
const MAX_SIZE = 10 * 1024 * 1024;
const PERSONAL_DOCUMENTS = ['NATIONAL_ID', 'BIRTH_CERTIFICATE', 'RESUME', 'NDA'] as const;

export interface UploadedFilePayload {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

/** 확장이 허용된 확장자인지 확인 */
export function isAllowedExtension(ext: string): boolean {
  return ALLOWED_EXT.includes(ext.toLowerCase());
}

/** MIME 타입이 허용된 확장자와 일치하는지 확인 */
export function isMimeTypeAllowed(ext: string, mimetype: string): boolean {
  const signatures: Record<string, { mime: string[]; prefix: number[] }> = {
    '.pdf': { mime: ['application/pdf'], prefix: [0x25, 0x50, 0x44, 0x46, 0x2d] },
    '.png': { mime: ['image/png'], prefix: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
    '.jpg': { mime: ['image/jpeg'], prefix: [0xff, 0xd8, 0xff] },
    '.jpeg': { mime: ['image/jpeg'], prefix: [0xff, 0xd8, 0xff] },
    '.doc': { mime: ['application/msword'], prefix: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] },
    '.xls': { mime: ['application/vnd.ms-excel'], prefix: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] },
    '.docx': { mime: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'], prefix: [0x50, 0x4b, 0x03, 0x04] },
    '.xlsx': { mime: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'], prefix: [0x50, 0x4b, 0x03, 0x04] },
  };
  const expected = signatures[ext.toLowerCase()];
  if (!expected) return false;
  return expected.mime.includes(mimetype);
}

/** 파일의 매직 바이트(시그니처) 검증 */
export function validateMagicBytes(buffer: Buffer, ext: string): boolean {
  const signatures: Record<string, { prefix: number[] }> = {
    '.pdf': { prefix: [0x25, 0x50, 0x44, 0x46, 0x2d] },
    '.png': { prefix: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
    '.jpg': { prefix: [0xff, 0xd8, 0xff] },
    '.jpeg': { prefix: [0xff, 0xd8, 0xff] },
    '.doc': { prefix: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] },
    '.xls': { prefix: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] },
    '.docx': { prefix: [0x50, 0x4b, 0x03, 0x04] },
    '.xlsx': { prefix: [0x50, 0x4b, 0x03, 0x04] },
  };
  const expected = signatures[ext.toLowerCase()];
  if (!expected) return false;
  return buffer.subarray(0, expected.prefix.length).equals(Buffer.from(expected.prefix));
}

/** 업로드된 파일의 기본 검증 (크기, 확장자, MIME) */
export function validateUploadedFile(file: UploadedFilePayload): { ext: string } {
  if (!file) throw new BadRequestException('파일 첨부가 필요합니다.');
  if (!Buffer.isBuffer(file.buffer) || !file.buffer.length || file.size !== file.buffer.length || file.size > 10 * 1024 * 1024) {
    throw new BadRequestException('파일 크기가 유효하지 않거나 10MB를 초과합니다.');
  }
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXT.includes(ext)) {
    throw new BadRequestException(`확장자「${ext}」는 허용되지 않습니다. 허용된 확장자: ${ALLOWED_EXT.join('، ')}`);
  }
  if (!isMimeTypeAllowed(ext, file.mimetype)) {
    throw new BadRequestException('파일 내용이 타입과 일치하지 않습니다.');
  }
  if (!validateMagicBytes(file.buffer, file.mimetype)) {
    throw new BadRequestException('파일 내용이 유형과 일치하지 않습니다.');
  }
  return { ext };
}

/** Multer fileFilter 팩토리 - 컨트롤러에서 사용 */
export function createFileFilter(config: ConfigService) {
  return (req: any, file: any, callback: (error: Error | null, acceptFile: boolean) => void) => {
    try {
      const buffer = file.buffer;
      if (!Buffer.isBuffer(buffer) || !buffer.length) {
        return callback(new BadRequestException('파일이 비어 있습니다.'), false);
      }
      const ext = path.extname(file.originalname).toLowerCase();
      if (!ALLOWED_EXT.includes(ext)) {
        return callback(new BadRequestException(`확장자「${ext}」는 허용되지 않습니다.`), false);
      }
      const signatures: Record<string, { mime: string[]; prefix: number[] }> = {
        '.pdf': { mime: ['application/pdf'], prefix: [0x25, 0x50, 0x44, 0x46, 0x2d] },
        '.png': { mime: ['image/png'], prefix: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
        '.jpg': { mime: ['image/jpeg'], prefix: [0xff, 0xd8, 0xff] },
        '.jpeg': { mime: ['image/jpeg'], prefix: [0xff, 0xd8, 0xff] },
        '.doc': { mime: ['application/msword'], prefix: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] },
        '.xls': { mime: ['application/vnd.ms-excel'], prefix: [0xd0, 0xcf, 0x11, 0x0e0, 0xa1, 0xb1, 0x1a, 0xe1] },
        '.docx': { mime: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'], prefix: [0x50, 0x4b, 0x03, 0x04] },
        '.xlsx': { mime: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'], prefix: [0x50, 0x4b, 0x03, 0x04] },
      };
      const expected = signatures[ext];
      if (!expected || !expected.mime.includes(file.mimetype) || !file.buffer.subarray(0, expected.prefix.length).equals(Buffer.from(expected.prefix))) {
        return callback(new BadRequestException('파일 내용이 타입과 일치하지 않습니다.'), false);
      }
      callback(null, true);
    } catch (e) {
      callback(new BadRequestException('파일 검증 중 오류가 발생했습니다.'), false);
    }
  };
}

/** 파일 저장 (service 계층에서 사용) */
export async function storeUpload(file: UploadedFilePayload, subdir: string, config: ConfigService): Promise<{ fileName: string; filePath: string }> {
  const { ext } = validateUploadedFile(file);
  if (!/^[a-z0-9-]{1,40}$/.test(subdir)) throw new BadRequestException('파일 저장 경로가 유효하지 않습니다.');
  const dir = path.join(UPLOAD_ROOT, subdir);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const stored = `${randomFileName(ext)}`;
  const fullPath = path.join(dir, stored);
  fs.writeFileSync(fullPath, file.buffer, { flag: 'wx', mode: 0o600 });
  await scanFileForViruses(fullPath, config);
  return { fileName: path.basename(file.originalname.replace(/\\/g, '/')).replace(/[\x00-\x1f\x7f]/g, '').slice(0, 255), filePath: `${subdir}/${stored}` };
}

/** 안티바이러스 검사 (ClamAV) - 선택적 */
async function scanFileForViruses(filePath: string, config: ConfigService): Promise<void> {
  if (!config.get<boolean>('security.antivirusEnabled')) return;
  try {
    const command = `${config.get<string>('security.antivirusCommand') ?? 'clamscan'} --no-summary --infected "${filePath}"`;
    const result = execSync(command, { timeout: config.get<number>('security.antivirusTimeoutMs') ?? 30000, encoding: 'utf8' });
    if (result && result.includes('FOUND')) {
      fs.unlinkSync(filePath);
      throw new BadRequestException('업로드된 파일에 위험한 콘텐츠가 포함되어 있어 거부되었습니다.');
    }
  } catch (e: any) {
    if (e instanceof BadRequestException) throw e;
    console.warn(`Antivirus scan skipped or failed: ${e.message}`);
  }
}

/** 랜덤 파일명 생성 */
function randomFileName(ext: string): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('') + ext;
}