import { spawn } from 'child_process';

export function postgresEnvironment(databaseUrl: string): NodeJS.ProcessEnv {
  const url = new URL(databaseUrl);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('Invalid database configuration');
  return { ...process.env, PGHOST: url.hostname, PGPORT: url.port || '5432', PGDATABASE: decodeURIComponent(url.pathname.slice(1)), PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password), ...(url.searchParams.has('sslmode') ? { PGSSLMODE: url.searchParams.get('sslmode')! } : {}), PGCONNECT_TIMEOUT: '15', PGAPPNAME: 'sana-backup' };
}

export function runPostgresTool(executable: string, args: string[], databaseUrl: string, input?: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { env: postgresEnvironment(databaseUrl), shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    const output: Buffer[] = [];
    let size = 0;
    let failed = false;
    const fail = () => { failed = true; reject(new Error('PostgreSQL backup tool failed; diagnostics suppressed')); };
    const timer = setTimeout(() => { child.kill(); fail(); }, 240000);
    child.stdout.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > 256 * 1024 * 1024) { child.kill(); fail(); }
      else output.push(chunk);
    });
    // PostgreSQL diagnostics can contain connection details and record values.
    child.stderr.on('data', () => {});
    child.stdin.on('error', () => {});
    child.on('error', () => { clearTimeout(timer); fail(); });
    child.on('close', code => { clearTimeout(timer); if (!failed) { if (code !== 0) fail(); else resolve(Buffer.concat(output)); } });
    child.stdin.end(input);
  });
}
