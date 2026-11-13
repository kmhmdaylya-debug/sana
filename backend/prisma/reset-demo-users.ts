/**
 * هم‌راستاسازی رمز کاربران نمونه با DEMO_PASSWORD_ALI / DEMO_PASSWORD_MARYAM
 * اجرا: npx ts-node --transpile-only prisma/reset-demo-users.ts
 */
import { PrismaClient } from '@prisma/client';
import { hash } from '@node-rs/argon2';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const prisma = new PrismaClient();

function loadEnvFile(file: string) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const key = m[1];
    if (process.env[key] === undefined) {
      process.env[key] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}
loadEnvFile(join(__dirname, '..', '.env'));

async function main() {
  const map: Record<string, string> = {
    ali: process.env.DEMO_PASSWORD_ALI ?? 'SanaDemo@1404',
    maryam: process.env.DEMO_PASSWORD_MARYAM ?? 'SanaDemo@1404',
    negar: process.env.DEMO_PASSWORD_ALI ?? 'SanaDemo@1404',
  };
  for (const [username, password] of Object.entries(map)) {
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      console.log(`ℹ️ کاربر «${username}» وجود ندارد.`);
      continue;
    }
    await prisma.user.update({
      where: { username },
      data: { passwordHash: await hash(password), mustChangePassword: false },
    });
    console.log(`✅ رمز کاربر «${username}» به‌روزرسانی شد.`);
  }
}

main()
  .catch((e) => {
    console.error('❌ خطا:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
