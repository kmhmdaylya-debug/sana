const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function check() {
  const user = await prisma.user.findUnique({ where: { username: 'admin' } });
  console.log('Admin user:', user ? { id: user.id, username: user.username, status: user.status, isSuperAdmin: user.isSuperAdmin } : 'NOT FOUND');
  await prisma.$disconnect();
}
check();