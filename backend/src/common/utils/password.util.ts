import { hash, verify } from '@node-rs/argon2';

/** هش رمز عبور با Argon2id */
export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, {
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
}

export async function verifyPassword(storedHash: string, plain: string): Promise<boolean> {
  try {
    return await verify(storedHash, plain);
  } catch {
    return false;
  }
}

export interface PasswordStrength {
  ok: boolean;
  message: string;
}

/**
 * سیاست رمز عبور: حداقل طول، ترکیب حروف بزرگ/کوچک/عدد/نماد و رد رمزهای ضعیف رایج.
 */
export function validatePasswordStrength(password: string, minLength = 10): PasswordStrength {
  if (!password || password.length < minLength) {
    return { ok: false, message: `رمز عبور باید حداقل ${minLength} کاراکتر باشد.` };
  }
  if (!/[a-z]/.test(password)) return { ok: false, message: 'رمز عبور باید حداقل یک حرف کوچک داشته باشد.' };
  if (!/[A-Z]/.test(password)) return { ok: false, message: 'رمز عبور باید حداقل یک حرف بزرگ داشته باشد.' };
  if (!/[0-9]/.test(password)) return { ok: false, message: 'رمز عبور باید حداقل یک رقم داشته باشد.' };
  if (!/[^A-Za-z0-9]/.test(password)) {
    return { ok: false, message: 'رمز عبور باید حداقل یک نماد (مثل ! یا @) داشته باشد.' };
  }
  const weak = ['1234567890', 'password', 'qwerty', 'admin123', '1111111111', '123456789'];
  if (weak.includes(password.toLowerCase())) {
    return { ok: false, message: 'این رمز عبور بیش از حد ضعیف است؛ رمز دیگری انتخاب کنید.' };
  }
  return { ok: true, message: 'رمز عبور قابل قبول است.' };
}
