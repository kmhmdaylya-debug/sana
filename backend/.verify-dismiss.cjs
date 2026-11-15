require('dotenv').config({ quiet: true });
const { PrismaClient } = require('@prisma/client');
const { hash } = require('@node-rs/argon2');
const { EmployeePanelService } = require('./dist/employee-panel/employee-panel.service');
const { TasksService } = require('./dist/tasks/tasks.service');
const assert = require('node:assert/strict');
const p = new PrismaClient();
const prefix = 'codex.dismiss.verify.';
async function main() {
  if (process.argv[2] === 'clean') {
    const users = await p.user.findMany({ where: { username: { startsWith: prefix } } });
    await p.task.deleteMany({ where: { createdById: { in: users.map(u => u.id) } } });
    await p.user.deleteMany({ where: { id: { in: users.map(u => u.id) } } });
    await p.employee.deleteMany({ where: { id: { in: users.map(u => u.employeeId).filter(Boolean) } } });
    console.log('Cleaned verification fixtures only'); return;
  }
  const company = await p.company.findFirstOrThrow({ where: { deletedAt: null } });
  const role = await p.role.findUniqueOrThrow({ where: { code: 'EMPLOYEE' } });
  const password = 'Verify!' + require('crypto').randomBytes(12).toString('hex');
  const passwordHash = await hash(password);
  const users = [];
  for (const index of [1, 2]) {
    const employee = await p.employee.create({ data: { companyId: company.id, code: prefix + index, firstName: 'کارمند', lastName: 'آزمایش', hireDate: new Date('2026-11-14') } });
    users.push(await p.user.create({ data: { username: prefix + index, fullName: 'کارمند آزمایش', passwordHash, employeeId: employee.id, userRoles: { create: { roleId: role.id } } } }));
  }
  const service = new EmployeePanelService(p, { record: async () => {} }, { notify: async () => {} });
  const task = await p.task.create({ data: { companyId: company.id, title: 'گزارش تکمیل‌شده آزمایشی', status: 'DONE', createdById: users[0].id, assignees: { create: users.map(u => ({ userId: u.id, employeeId: u.employeeId })) } } });
  await service.dismissTask(task.id, users[0]);
  assert.equal((await service.myTasks({}, users[0])).data.length, 0);
  assert.equal((await service.myTasks({}, users[1])).data.length, 1);
  assert.ok(await p.task.findUnique({ where: { id: task.id } }));
  const tasks = new TasksService(p, {}, { record: async () => {} }, { notify: async () => {} });
  await tasks.update(task.id, { status: 'NEW' }, { ...users[0], isSuperAdmin: true });
  assert.equal((await service.myTasks({}, users[0])).data.length, 1);
  await assert.rejects(service.dismissTask(task.id, users[0]));
  await tasks.update(task.id, { status: 'DONE' }, { ...users[0], isSuperAdmin: true });
  assert.equal((await service.myTasks({}, users[0])).data.length, 1);
  console.log(JSON.stringify({ passed: true, username: users[0].username, password, taskId: task.id }));
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => p.$disconnect());
