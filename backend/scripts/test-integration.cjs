const fs = require('node:fs');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const { spawn } = require('node:child_process');
const { PrismaClient } = require('@prisma/client');
const { parse } = require('dotenv');

async function main() {
  const root = path.resolve(__dirname, '..');
  const envFile = path.join(root, '.env');
  const env = { ...(fs.existsSync(envFile) ? parse(fs.readFileSync(envFile)) : {}), ...process.env };
  const source = new URL(env.DATABASE_URL);
  const name = `sana_audit_test_${randomBytes(8).toString('hex')}`;
  const target = new URL(source);
  target.pathname = `/${name}`;
  const restoreName = `sana_restore_test_${randomBytes(8).toString('hex')}`;
  const restore = new URL(source);
  restore.pathname = `/${restoreName}`;
  const adminUrl = new URL(source);
  adminUrl.pathname = '/postgres';
  adminUrl.search = '';
  if (!/^sana_audit_test_[a-f0-9]{16}$/.test(name) || source.pathname === target.pathname) throw new Error('Unsafe test database target');
  const admin = new PrismaClient({ datasources: { db: { url: adminUrl.toString() } }, log: [] });
  const run = (script, args, extraEnv) => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [require.resolve(script), ...args], { cwd: root, env: { ...env, DATABASE_URL: target.toString(), SANA_INTEGRATION_DATABASE_URL: target.toString(), SANA_RESTORE_TEST_URL: restore.toString(), ...extraEnv }, stdio: 'inherit', windowsHide: true });
    child.on('error', () => reject(new Error('Test process failed to start')));
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(`Test process exited with status ${code}`)));
  });
  let created = false;
  let restoreCreated = false;
  try {
    await admin.$executeRawUnsafe(`CREATE DATABASE "${name}"`);
    created = true;
    if (!/^sana_restore_test_[a-f0-9]{16}$/.test(restoreName) || restoreName === name || source.pathname === restore.pathname) throw new Error('Unsafe restore target');
    await admin.$executeRawUnsafe(`CREATE DATABASE "${restoreName}"`);
    restoreCreated = true;
    console.log(`Isolated synthetic database: ${name}`);
    await run('prisma/build/index.js', ['migrate', 'deploy'], {});
    await run('jest/bin/jest', ['--config', 'jest.config.js', '--runInBand'], {});
  } finally {
    if (restoreCreated) await admin.$executeRawUnsafe(`DROP DATABASE "${restoreName}" WITH (FORCE)`);
    if (created) {
      await admin.$executeRawUnsafe(`DROP DATABASE "${name}" WITH (FORCE)`);
      console.log('Isolated test database removed. Live database was not modified.');
    }
    await admin.$disconnect();
  }
}

main().catch(() => {
  console.error('Integration checks failed. Confidential connection details suppressed.');
  process.exitCode = 1;
});
