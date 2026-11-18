const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function check() {
  const users = await prisma.user.findMany({
    where: { username: { in: ['admin', 'hradmin_comp-001', 'hradmin_comp-002', 'hradmin_comp-003', 'mgr_hq_comp-001', 'mgr_hq_comp-002', 'mgr_hq_comp-003', 'ali'] } },
    select: { username: true, email: true, status: true, isSuperAdmin: true }
  });
  console.log('Users:', users);
  await prisma.$disconnect();
}
check();