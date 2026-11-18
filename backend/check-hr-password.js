const { PrismaClient } = require('@prisma/client');
const { verify } = require('@node-rs/argon2');
const prisma = new PrismaClient();
async function check() {
  const users = await prisma.user.findMany({
    where: { username: { in: ['hradmin_comp-001', 'mgr_hq_comp-001'] } },
    select: { username: true, passwordHash: true }
  });
  
  for (const user of users) {
    const valid = await verify(user.passwordHash, 'SanaDemo@1404');
    console.log(`${user.username}: password valid = ${valid}`);
  }
  
  await prisma.$disconnect();
}
check();