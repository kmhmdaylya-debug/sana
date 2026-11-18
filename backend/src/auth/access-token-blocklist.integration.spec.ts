import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const databaseUrl = process.env.SANA_INTEGRATION_DATABASE_URL;
const integration = databaseUrl ? describe : describe.skip;

integration('Access token blocklist with PostgreSQL', () => {
  let db: PrismaClient;
  const tokenIds: string[] = [];

  beforeAll(async () => {
    if (!/^\/sana_audit_test_[a-f0-9]{16}$/.test(new URL(databaseUrl!).pathname)) {
      throw new Error('Tests require a separately provisioned synthetic database');
    }
    db = new PrismaClient({ datasources: { db: { url: databaseUrl } }, log: [] });
    await db.$connect();
  });

  afterAll(async () => {
    if (!db) return;
    try {
      await db.accessTokenBlocklist.deleteMany({ where: { tokenId: { in: tokenIds } } });
    } finally {
      await db.$disconnect();
    }
  });

  it('allows a lookup for an unblocked token after migration', async () => {
    expect(await db.accessTokenBlocklist.findUnique({ where: { tokenId: randomUUID() } })).toBeNull();
  });

  it('persists an expiry and rejects duplicate token IDs', async () => {
    const tokenId = randomUUID();
    tokenIds.push(tokenId);
    const expiresAt = new Date(Date.now() + 60_000);
    const row = await db.accessTokenBlocklist.create({ data: { tokenId, expiresAt } });
    expect(row.expiresAt).toEqual(expiresAt);
    expect(row.createdAt).toBeInstanceOf(Date);
    expect(await db.accessTokenBlocklist.findUnique({ where: { tokenId } })).toEqual(row);
    await expect(db.accessTokenBlocklist.create({ data: { tokenId, expiresAt } })).rejects.toMatchObject({ code: 'P2002' });
  });

  it('distinguishes expired blocklist entries from active entries', async () => {
    const now = new Date();
    const expired = randomUUID();
    const active = randomUUID();
    tokenIds.push(expired, active);
    await db.accessTokenBlocklist.createMany({ data: [
      { tokenId: expired, expiresAt: new Date(now.getTime() - 60_000) },
      { tokenId: active, expiresAt: new Date(now.getTime() + 60_000) },
    ] });
    const rows = await db.accessTokenBlocklist.findMany({
      where: { tokenId: { in: [expired, active] }, expiresAt: { gt: now } },
    });
    expect(rows.map(row => row.tokenId)).toEqual([active]);
  });
});
