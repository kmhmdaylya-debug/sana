const { createRequire } = require('node:module');
const path = require('node:path');
const backend = createRequire(path.resolve(__dirname, '../../backend/package.json'));
backend('dotenv').config({ path:path.resolve(__dirname,'../../backend/.env'), quiet:true });
const { PrismaClient } = backend('@prisma/client');
const { hash } = backend('@node-rs/argon2');
const p = new PrismaClient();
const prefix = 'codex.ui.verify.';
async function main() {
  if (process.argv[2] === 'clean') {
    const users = await p.user.findMany({where:{username:{startsWith:prefix}}});
    await p.task.deleteMany({where:{createdById:{in:users.map(u=>u.id)}}});
    await p.user.deleteMany({where:{id:{in:users.map(u=>u.id)}}});
    await p.employee.deleteMany({where:{id:{in:users.map(u=>u.employeeId).filter(Boolean)}}});
    console.log('Only UI verification fixtures removed'); return;
  }
  const existing = await p.user.count({where:{username:{startsWith:prefix}}});
  if (existing) throw new Error('Clean previous verification fixtures first');
  const password = 'Verify!' + require('node:crypto').randomBytes(12).toString('hex');
  const passwordHash = await hash(password);
  const company = await p.company.findFirstOrThrow({where:{deletedAt:null}});
  const role = await p.role.findUniqueOrThrow({where:{code:'EMPLOYEE'}});
  const users=[];
  for (const key of ['admin','employee']) {
    const employee = await p.employee.create({data:{companyId:company.id,code:prefix+key,firstName:key==='admin'?'مدیر':'کارمند',lastName:'آزمایش رابط',hireDate:new Date('2026-11-14')}});
    users.push(await p.user.create({data:{username:prefix+key,fullName:employee.firstName+' '+employee.lastName,passwordHash,employeeId:employee.id,isSuperAdmin:key==='admin',userRoles:{create:{roleId:role.id}}}}));
  }
  for (const [status,title,delayReason] of [['NEW','تهیه گزارش فعالیت‌های امروز',null],['IN_PROGRESS','بررسی فایل‌های پروژه','دسترسی به فایل‌های اصلی پروژه هنوز فعال نشده است.'],['DONE','ثبت گزارش روز گذشته',null]]) {
    await p.task.create({data:{companyId:company.id,createdById:users[0].id,title,status,delayReason,description:'حساب موقت برای بررسی رابط کاربری؛ اطلاعات واقعی تغییر نکرده‌اند.',completedAt:status==='DONE'?new Date():null,progress:status==='DONE'?100:0,assignees:{create:{userId:users[1].id,employeeId:users[1].employeeId}}}});
  }
  console.log(JSON.stringify({admin:users[0].username,employee:users[1].username,password}));
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>p.$disconnect());
