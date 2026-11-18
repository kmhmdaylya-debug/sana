const { PrismaClient } = require('@prisma/client');
const { verify } = require('@node-rs/argon2');
const prisma = new PrismaClient();
async function check() {
  const user = await prisma.user.findUnique({ where: { username: 'admin' } });
  console.log('Password hash:', user.passwordHash);
  
  const valid = await verify(user.passwordHash, 'SanaAdmin@2026!');
  console.log('Password valid:', valid);
  
  await prisma.$disconnect();
}
check();