/**
 * دادهٔ نمونهٔ جامع سامانه مدیریت منابع انسانی «سنا»
 * ------------------------------------------------------------------
 * این اسکریپت همهٔ بخش‌های سامانه را با دادهٔ واقع‌گرایانه (فارسی) پر می‌کند:
 * ساختار سازمانی، پروندهٔ پرسنلی، قرارداد، حضور و غیاب، شیفت، مرخصی، گردش تأیید،
 * حقوق و دستمزد، ارزیابی عملکرد، وظایف، دارایی، آموزش، استخدام، ورود/خروج،
 * مأموریت، وام و مزایا، مکاتبات و جلسات، اعلامیه‌ها، اعلان‌ها و گزارش‌ها.
 *
 * اجرا:  npx ts-node --transpile-only prisma/seed-demo.ts
 * یا:    npm run db:seed:demo
 *
 * نکته: اسکریپت idempotent است؛ اجرای دوباره رکوردهای موجود را دست نمی‌زند
 * (به‌جز بخش‌هایی که با شمارندهٔ یکتا ساخته می‌شوند و در صورت وجود، رد می‌شوند).
 */
import { PrismaClient, Prisma } from '@prisma/client';
import { hash } from '@node-rs/argon2';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const prisma = new PrismaClient();

/** بارگذاری سادهٔ فایل .env (برای اجرای مستقیم با ts-node) */
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

const DAY = 24 * 60 * 60 * 1000;
const now = new Date();
const daysAgo = (n: number) => new Date(now.getTime() - n * DAY);
const daysAhead = (n: number) => new Date(now.getTime() + n * DAY);
const at = (d: Date, h: number, m = 0) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m, 0, 0);
const dateOnly = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const RIAL = (n: number) => BigInt(n);

/** شمارندهٔ ساخت رکوردهای یکتا (برای شناسه‌هایی مثل کد پرسنلی) */
let seq = 1000;
const nextSeq = () => String(++seq);

async function main() {
  console.log('🌾 شروع تولید دادهٔ نمونهٔ جامع…');

  // ------------------------------------------------------------------
  // ۱) شرکت
  // ------------------------------------------------------------------
  let company = await prisma.company.findFirst({
    where: { deletedAt: null, isActive: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!company) {
    company = await prisma.company.create({
      data: {
        code: 'SANA-HQ',
        name: 'شرکت نمونه سنا',
        legalName: 'شرکت نمونه سنا (سهامی خاص)',
        nationalId: '14001234567',
        phone: '021-88776655',
        email: 'info@sana-example.ir',
        address: 'تهران، خیابان ولیعصر، پلاک ۱۲۰',
      },
    });
    console.log('✅ شرکت نمونه ساخته شد.');
  }
  const companyId = company.id;

  // ------------------------------------------------------------------
  // ۲) ساختار سازمانی: شعب، واحدها، سمت‌ها، محل کار، مراکز هزینه
  // ------------------------------------------------------------------
  const branchDefs = [
    { code: 'HQ', name: 'دفتر مرکزی', city: 'تهران', address: 'تهران، خیابان ولیعصر', phone: '021-88776655' },
    { code: 'TABRIZ', name: 'شعبه تبریز', city: 'تبریز', address: 'تبریز، خیابان آزادی', phone: '041-33445566' },
    { code: 'ISFAHAN', name: 'شعبه اصفهان', city: 'اصفهان', address: 'اصفهان، خیابان چهارباغ', phone: '031-55667788' },
  ];
  const branches: Record<string, string> = {};
  for (const b of branchDefs) {
    const row = await prisma.branch.upsert({
      where: { companyId_code: { companyId, code: b.code } },
      update: { name: b.name },
      create: { companyId, code: b.code, name: b.name, kind: b.code === 'HQ' ? 'HQ' : 'BRANCH', address: b.address, phone: b.phone },
    });
    branches[b.code] = row.id;
  }
  const hq = branches.HQ;

  const unitDefs = [
    { code: 'HR', name: 'اداره منابع انسانی', kind: 'DEPARTMENT', branch: 'HQ' },
    { code: 'IT', name: 'اداره فناوری اطلاعات', kind: 'DEPARTMENT', branch: 'HQ' },
    { code: 'FIN', name: 'اداره امور مالی', kind: 'DEPARTMENT', branch: 'HQ' },
    { code: 'SALES', name: 'اداره فروش', kind: 'DEPARTMENT', branch: 'HQ' },
    { code: 'OPS-TB', name: 'واحد عملیات تبریز', kind: 'UNIT', branch: 'TABRIZ' },
    { code: 'OPS-ISF', name: 'واحد عملیات اصفهان', kind: 'UNIT', branch: 'ISFAHAN' },
  ];
  const units: Record<string, string> = {};
  for (const u of unitDefs) {
    const row = await prisma.orgUnit.upsert({
      where: { companyId_code: { companyId, code: u.code } },
      update: { name: u.name },
      create: { companyId, branchId: branches[u.branch], code: u.code, name: u.name, kind: u.kind },
    });
    units[u.code] = row.id;
  }

  const positionDefs = [
    { code: 'HR-MGR', title: 'مدیر منابع انسانی', unit: 'HR', grade: 'M1' },
    { code: 'HR-SPEC', title: 'کارشناس منابع انسانی', unit: 'HR', grade: 'P2' },
    { code: 'IT-MGR', title: 'مدیر فناوری اطلاعات', unit: 'IT', grade: 'M1' },
    { code: 'IT-DEV', title: 'کارشناس نرم‌افزار', unit: 'IT', grade: 'P2' },
    { code: 'FIN-MGR', title: 'مدیر مالی', unit: 'FIN', grade: 'M1' },
    { code: 'FIN-ACC', title: 'حسابدار', unit: 'FIN', grade: 'P2' },
    { code: 'SALES-MGR', title: 'مدیر فروش', unit: 'SALES', grade: 'M1' },
    { code: 'SALES-REP', title: 'کارشناس فروش', unit: 'SALES', grade: 'P3' },
    { code: 'OPS-TB-LEAD', title: 'سرپرست عملیات تبریز', unit: 'OPS-TB', grade: 'S1' },
    { code: 'OPS-ISF-LEAD', title: 'سرپرست عملیات اصفهان', unit: 'OPS-ISF', grade: 'S1' },
  ];
  const positions: Record<string, string> = {};
  for (const p of positionDefs) {
    const row = await prisma.position.upsert({
      where: { companyId_code: { companyId, code: p.code } },
      update: { title: p.title },
      create: { companyId, orgUnitId: units[p.unit], code: p.code, title: p.title, grade: p.grade },
    });
    positions[p.code] = row.id;
  }

  let location = await prisma.workLocation.findFirst({ where: { companyId, code: 'LOC-HQ' } });
  if (!location) {
    location = await prisma.workLocation.create({
      data: {
        companyId,
        branchId: hq,
        code: 'LOC-HQ',
        name: 'ساختمان اصلی — طبقه سوم',
        address: 'تهران، خیابان ولیعصر، پلاک ۱۲۰',
        latitude: 35.7219,
        longitude: 51.3347,
        radiusMeters: 150,
      },
    });
  }

  const costCenters = [
    { code: 'CC-100', name: 'مرکز هزینه ستاد' },
    { code: 'CC-200', name: 'مرکز هزینه فروش' },
    { code: 'CC-300', name: 'مرکز هزینه عملیات' },
  ];
  const costCenterIds: string[] = [];
  for (const c of costCenters) {
    const row = await prisma.costCenter.upsert({
      where: { companyId_code: { companyId, code: c.code } },
      update: {},
      create: { companyId, code: c.code, name: c.name },
    });
    costCenterIds.push(row.id);
  }

  const calendar = await prisma.calendar.upsert({
    where: { companyId_name: { companyId, name: 'تقویم رسمی' } },
    update: {},
    create: { companyId, name: 'تقویم رسمی', weekendDays: '5' },
  });
  if ((await prisma.holiday.count({ where: { calendarId: calendar.id } })) === 0) {
    const y = now.getFullYear();
    await prisma.holiday.createMany({
      data: [
        { calendarId: calendar.id, date: new Date(`${y}-03-21`), name: 'عید نوروز' },
        { calendarId: calendar.id, date: new Date(`${y}-02-11`), name: 'پیروزی انقلاب اسلامی' },
        { calendarId: calendar.id, date: new Date(`${y}-03-22`), name: 'عید نوروز (روز دوم)' },
        { calendarId: calendar.id, date: new Date(`${y}-04-02`), name: 'عید سعید فطر' },
        { calendarId: calendar.id, date: new Date(`${y}-06-04`), name: 'عید غدیر خم' },
        { calendarId: calendar.id, date: new Date(`${y}-12-29`), name: 'روز ملی شدن صنعت نفت' },
      ],
    });
  }
  console.log('✅ ساختار سازمانی آماده شد.');

  // ------------------------------------------------------------------
  // ۳) پروندهٔ پرسنلی
  // ------------------------------------------------------------------
  const employeeDefs = [
    { code: '1001', first: 'مریم', last: 'احمدی', unit: 'HR', pos: 'HR-MGR', branch: 'HQ', nationalId: '0098765432', mobile: '09125556677', email: 'maryam@sana-example.ir', gender: 'FEMALE', type: 'PERMANENT', hire: '2020-02-01', salary: 950_000_000, marital: 'MARRIED', birth: '1988-05-14' },
    { code: '1002', first: 'علی', last: 'رضایی', unit: 'IT', pos: 'IT-MGR', branch: 'HQ', nationalId: '0012345678', mobile: '09121112233', email: 'ali@sana-example.ir', gender: 'MALE', type: 'PERMANENT', hire: '2019-07-15', salary: 880_000_000, marital: 'MARRIED', birth: '1986-11-02' },
    { code: '1003', first: 'فاطمه', last: 'کریمی', unit: 'HR', pos: 'HR-SPEC', branch: 'HQ', nationalId: '0023456789', mobile: '09127778899', email: 'fateme@sana-example.ir', gender: 'FEMALE', type: 'PERMANENT', hire: '2021-03-20', salary: 520_000_000, marital: 'SINGLE', birth: '1993-08-23' },
    { code: '1004', first: 'حسین', last: 'موسوی', unit: 'FIN', pos: 'FIN-MGR', branch: 'HQ', nationalId: '0034567890', mobile: '09123334455', email: 'hossein@sana-example.ir', gender: 'MALE', type: 'PERMANENT', hire: '2018-01-20', salary: 900_000_000, marital: 'MARRIED', birth: '1985-02-30' },
    { code: '1005', first: 'زهرا', last: 'حسینی', unit: 'FIN', pos: 'FIN-ACC', branch: 'HQ', nationalId: '0045678901', mobile: '09126667788', email: 'zahra@sana-example.ir', gender: 'FEMALE', type: 'PERMANENT', hire: '2022-09-01', salary: 430_000_000, marital: 'MARRIED', birth: '1995-01-09' },
    { code: '1006', first: 'محمد', last: 'صادقی', unit: 'IT', pos: 'IT-DEV', branch: 'HQ', nationalId: '0056789012', mobile: '09129998877', email: 'mohammad@sana-example.ir', gender: 'MALE', type: 'PERMANENT', hire: '2021-11-10', salary: 610_000_000, marital: 'MARRIED', birth: '1991-04-17' },
    { code: '1007', first: 'سارا', last: 'نوری', unit: 'SALES', pos: 'SALES-MGR', branch: 'HQ', nationalId: '0067890123', mobile: '09124445566', email: 'sara@sana-example.ir', gender: 'FEMALE', type: 'PERMANENT', hire: '2020-06-05', salary: 780_000_000, marital: 'MARRIED', birth: '1989-09-30' },
    { code: '1008', first: 'رضا', last: 'نوروزی', unit: 'SALES', pos: 'SALES-REP', branch: 'HQ', nationalId: '0078901234', mobile: '09122223344', email: 'reza@sana-example.ir', gender: 'MALE', type: 'PERMANENT', hire: '2023-02-15', salary: 380_000_000, marital: 'MARRIED', birth: '1994-07-08' },
    { code: '1009', first: 'نگار', last: 'قاسمی', unit: 'OPS-TB', pos: 'OPS-TB-LEAD', branch: 'TABRIZ', nationalId: '0089012345', mobile: '09123334400', email: 'negar@sana-example.ir', gender: 'FEMALE', type: 'PERMANENT', hire: '2019-12-01', salary: 700_000_000, marital: 'MARRIED', birth: '1987-03-12' },
    { code: '1010', first: 'امیر', last: 'طاهری', unit: 'OPS-ISF', pos: 'OPS-ISF-LEAD', branch: 'ISFAHAN', nationalId: '0090123456', mobile: '09124440000', email: 'amir@sana-example.ir', gender: 'MALE', type: 'CONTRACTUAL', hire: '2022-05-10', salary: 650_000_000, marital: 'MARRIED', birth: '1990-12-25' },
    { code: '1011', first: 'الهام', last: 'جعفری', unit: 'HR', pos: 'HR-SPEC', branch: 'HQ', nationalId: '0101234567', mobile: '09125550000', email: 'elaham@sana-example.ir', gender: 'FEMALE', type: 'PERMANENT', hire: '2023-08-07', salary: 450_000_000, marital: 'SINGLE', birth: '1996-06-19' },
    { code: '1012', first: 'کاوه', last: 'مرادی', unit: 'IT', pos: 'IT-DEV', branch: 'HQ', nationalId: '0112345678', mobile: '09126660000', email: 'kaveh@sana-example.ir', gender: 'MALE', type: 'INTERN', hire: '2025-04-01', salary: 180_000_000, marital: 'SINGLE', birth: '2001-10-05' },
  ];

  const employees: Record<string, string> = {};
  for (const e of employeeDefs) {
    const existing = await prisma.employee.findFirst({ where: { companyId, code: e.code } });
    if (existing) {
      employees[e.code] = existing.id;
      continue;
    }
    const row = await prisma.employee.create({
      data: {
        companyId,
        branchId: branches[e.branch],
        workLocationId: location.id,
        costCenterId: costCenterIds[Math.floor(Math.random() * costCenterIds.length)],
        orgUnitId: units[e.unit],
        positionId: positions[e.pos],
        code: e.code,
        nationalId: e.nationalId,
        firstName: e.first,
        lastName: e.last,
        fatherName: e.first,
        birthDate: new Date(e.birth),
        birthPlace: 'تهران',
        gender: e.gender as Prisma.EmployeeCreateInput['gender'],
        maritalStatus: e.marital as Prisma.EmployeeCreateInput['maritalStatus'],
        mobile: e.mobile,
        email: e.email,
        address: `${e.last}، ${e.branch === 'HQ' ? 'تهران' : 'شهرستان'}`,
        emergencyName: `${e.first} ${e.last}`,
        emergencyPhone: '09121234567',
        employmentType: e.type as Prisma.EmployeeCreateInput['employmentType'],
        hireDate: new Date(e.hire),
        status: 'ACTIVE',
        monthlyBaseSalary: RIAL(e.salary),
      },
    });
    employees[e.code] = row.id;

    // تاریخچهٔ سمت
    await prisma.employeePosition.create({
      data: {
        employeeId: row.id,
        positionId: positions[e.pos],
        orgUnitId: units[e.unit],
        companyId,
        startDate: new Date(e.hire),
        changeType: 'HIRE',
        note: 'انتصاب اولیه',
      },
    });

    // حساب بانکی
    await prisma.bankAccount.create({
      data: {
        employeeId: row.id,
        bankName: 'بانک ملت',
        accountNumber: `IR620170000000${Number(e.code)}0`,
        sheba: `IR620170000000${Number(e.code)}0`,
        cardNumber: `62198600${Number(e.code)}`,
        isPrimary: true,
      },
    });

    // مهارت‌ها
    const skills: Record<string, string[]> = {
      '1001': ['مدیریت منابع انسانی', 'جذب و استخدام', 'توسعه سازمانی'],
      '1002': ['مدیریت پروژه', 'معماری نرم‌افزار', 'DevOps'],
      '1003': ['حقوق و دستمزد', 'اداری و پشتیبانی', 'اکسل پیشرفته'],
      '1004': ['حسابداری صنعتی', 'بودجه‌ریزی', 'مالیات'],
      '1005': ['حسابداری', 'انبارداری', 'اکسل'],
      '1006': ['برنامه‌نویسی', 'تست نرم‌افزار', 'پایگاه داده'],
      '1007': ['مدیریت فروش', 'بازاریابی', 'مذاکره'],
      '1008': ['فروش', 'ارتباط با مشتری'],
      '1009': ['سرپرستی', 'کنترل کیفیت', 'انبار'],
      '1010': ['ایمنی و HSE', 'نگهداری و تعمیرات'],
      '1011': ['جذب و استخدام', 'مصاحبه فنی'],
      '1012': ['برنامه‌نویسی', 'طراحی رابط کاربری'],
    };
    for (const [i, skill] of (skills[e.code] ?? []).entries()) {
      await prisma.employeeSkill.create({
        data: { employeeId: row.id, skill, level: 3 + (i % 3) },
      });
    }
  }

  // مدیران
  await prisma.employee.updateMany({
    where: { companyId, code: { in: ['1003', '1011'] } },
    data: { managerId: employees['1001'] },
  });
  await prisma.employee.updateMany({
    where: { companyId, code: { in: ['1006', '1012'] } },
    data: { managerId: employees['1002'] },
  });
  await prisma.employee.updateMany({
    where: { companyId, code: '1005' },
    data: { managerId: employees['1004'] },
  });
  await prisma.employee.updateMany({
    where: { companyId, code: '1008' },
    data: { managerId: employees['1007'] },
  });

  // خانواده (تابعه)
  await prisma.employeeDependent.createMany({
    data: [
      { employeeId: employees['1001'], relation: 'همسر', fullName: 'حسین احمدی', nationalId: '1234567890', isUnderCover: true },
      { employeeId: employees['1001'], relation: 'فرزند', fullName: 'سارا احمدی', birthDate: new Date('2015-08-12') },
      { employeeId: employees['1002'], relation: 'فرزند', fullName: 'امیر رضایی', birthDate: new Date('2018-03-05') },
      { employeeId: employees['1004'], relation: 'همسر', fullName: 'مریم موسوی' },
    ],
    skipDuplicates: true,
  }).catch(() => undefined);

  // رویدادهای شغلی
  await prisma.employmentEvent.createMany({
    data: [
      { employeeId: employees['1003'], eventType: 'PROMOTION', fromDate: new Date('2023-04-01'), note: 'ارتقا به کارشناس ارشد منابع انسانی' },
      { employeeId: employees['1006'], eventType: 'SALARY_INCREASE', fromDate: new Date('2024-10-01'), note: 'افزایش حقوق سالانه' },
      { employeeId: employees['1008'], eventType: 'TRAINING', fromDate: new Date('2024-05-10'), toDate: new Date('2024-05-12'), note: 'دورهٔ تکنیک فروش' },
    ],
    skipDuplicates: true,
  }).catch(() => undefined);
  console.log('✅ پروندهٔ پرسنلی آماده شد.');

  // ------------------------------------------------------------------
  // ۴) کاربران نمونه
  // ------------------------------------------------------------------
  const demoPassword = process.env.DEMO_PASSWORD_ALI ?? 'SanaDemo@1404';
  const roleCodes = ['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE'];
  const roles = new Map<string, string>();
  for (const code of roleCodes) {
    const r = await prisma.role.findUnique({ where: { code } });
    if (r) roles.set(code, r.id);
  }
  const adminUser = await prisma.user.findFirst({ where: { username: 'admin' } });

  const userDefs = [
    { username: 'maryam', fullName: 'مریم احمدی', employee: '1001', role: 'HR_ADMIN', scope: { scopeType: 'COMPANY' as const, companyId } },
    { username: 'ali', fullName: 'علی رضایی', employee: '1002', role: 'MANAGER', scope: { scopeType: 'ORG_UNIT' as const, orgUnitId: units.IT } },
    { username: 'negar', fullName: 'نگار قاسمی', employee: '1009', role: 'EMPLOYEE', scope: { scopeType: 'EMPLOYEE' as const, employeeId: employees['1009'] } },
  ];
  const users: Record<string, string> = {};
  if (adminUser) users.admin = adminUser.id;
  for (const u of userDefs) {
    const existing = await prisma.user.findUnique({ where: { username: u.username } });
    if (existing) {
      users[u.username] = existing.id;
      continue;
    }
    const row = await prisma.user.create({
      data: {
        username: u.username,
        fullName: u.fullName,
        email: `${u.username}@sana-example.ir`,
        mobile: `0912${u.username.length}000000`.slice(0, 11),
        passwordHash: await hash(demoPassword),
        status: 'ACTIVE',
        employeeId: employees[u.employee],
        userRoles: roles.has(u.role) ? { create: { roleId: roles.get(u.role)! } } : undefined,
        scopeAssignments: { create: u.scope },
      },
    });
    users[u.username] = row.id;
    await prisma.employee.update({ where: { id: employees[u.employee] }, data: { userId: row.id } });
  }
  console.log('✅ کاربران نمونه آماده شدند.');

  // ------------------------------------------------------------------
  // ۵) قراردادها
  // ------------------------------------------------------------------
  for (const e of employeeDefs) {
    const empId = employees[e.code];
    const has = await prisma.contract.findFirst({ where: { employeeId: empId } });
    if (has) continue;
    const contract = await prisma.contract.create({
      data: { employeeId: empId, companyId, currentVersion: 1, status: 'ACTIVE' },
    });
    await prisma.contractVersion.create({
      data: {
        contractId: contract.id,
        version: 1,
        contractType: e.type === 'INTERN' ? 'INTERN' : e.type === 'CONTRACTUAL' ? 'FIXED' : 'PERMANENT',
        startDate: new Date(e.hire),
        endDate: e.type === 'PERMANENT' ? null : new Date(new Date(e.hire).getTime() + 365 * DAY),
        effectiveDate: new Date(e.hire),
        baseSalary: RIAL(e.salary),
        housingAllowance: RIAL(2_000_000),
        foodAllowance: RIAL(1_500_000),
        childAllowance: RIAL(3_000_000),
        seniorityPay: RIAL(Math.round(e.salary * 0.05)),
        workHoursPerDay: 8,
        workHoursPerMonth: 220,
        terms: 'قرارداد بر اساس قوانین کار و مقررات داخلی سازمان.',
        createdById: users.admin,
      },
    });
  }
  console.log('✅ قراردادها آماده شدند.');

  // ------------------------------------------------------------------
  // ۶) حضور و غیاب: دستگاه، رکوردهای ۴۵ روز، درخواست اصلاح
  // ------------------------------------------------------------------
  const device = await prisma.attendanceDevice.upsert({
    where: { code: 'DEV-HQ-01' },
    update: {},
    create: { companyId, branchId: hq, code: 'DEV-HQ-01', name: 'کارت‌خوان ورودی ساختمان اصلی', deviceType: 'CARD_READER' },
  });

  const employeeIds = employeeDefs.map((e) => employees[e.code]);
  const existingRecords = await prisma.attendanceRecord.count();
  if (existingRecords < 50) {
    for (let d = 45; d >= 0; d--) {
      const day = daysAgo(d);
      const weekday = day.getDay();
      if (weekday === 5) continue; // جمعه تعطیل
      for (const e of employeeDefs) {
        const empId = employees[e.code];
        const seed = (Number(e.code) + d) % 11;
        const status = seed === 0 ? 'ABSENT' : seed === 1 ? 'LEAVE' : seed === 2 ? 'REMOTE' : 'COMPLETE';
        const inTime = at(day, 8, (seed * 3) % 40);
        const lateMinutes = status === 'COMPLETE' && seed > 3 ? seed * 4 : 0;
        const outTime = at(day, 17, seed % 50);
        const workMinutes = status === 'COMPLETE' || status === 'REMOTE' ? 480 - lateMinutes : 0;
        await prisma.attendanceRecord.upsert({
          where: { employeeId_workDate: { employeeId: empId, workDate: dateOnly(day) } },
          update: {},
          create: {
            employeeId: empId,
            workDate: dateOnly(day),
            firstIn: workMinutes ? inTime : null,
            lastOut: workMinutes ? outTime : null,
            workMinutes,
            overtimeMinutes: seed === 5 ? 60 : 0,
            lateMinutes,
            earlyLeaveMinutes: seed === 7 ? 30 : 0,
            absenceMinutes: status === 'ABSENT' ? 480 : 0,
            absenceType: status === 'ABSENT' ? 'UNEXCUSED' : null,
            status,
            isRemote: status === 'REMOTE',
            note: status === 'ABSENT' ? 'عدم حضور بدون اطلاع' : null,
          },
        });
      }
    }
  }

  const corrections = await prisma.attendanceCorrection.count();
  if (corrections === 0) {
    await prisma.attendanceCorrection.createMany({
      data: [
        { employeeId: employees['1006'], workDate: dateOnly(daysAgo(6)), field: 'firstIn', oldValue: '08:20', newValue: '08:00', reason: 'اشتباه ثبت ساعت ورود توسط دستگاه', status: 'PENDING', requestedById: users.ali },
        { employeeId: employees['1003'], workDate: dateOnly(daysAgo(9)), field: 'lastOut', oldValue: '16:40', newValue: '17:00', reason: 'تأخیر در ثبت خروج به دلیل جلسه', status: 'APPROVED', requestedById: users.maryam, approvedById: users.admin, decidedAt: daysAgo(7) },
      ],
    });
  }
  console.log('✅ حضور و غیاب آماده شد.');

  // ------------------------------------------------------------------
  // ۷) شیفت‌ها و برنامهٔ کاری
  // ------------------------------------------------------------------
  const shiftDefs = [
    { code: 'STD-08', name: 'شیفت اداری ۸ تا ۱۶', kind: 'MORNING' as const, start: '08:00', end: '16:00', duration: 480, break: 60, color: '#2563eb' },
    { code: 'STD-09', name: 'شیفت اداری ۹ تا ۱۷', kind: 'MORNING' as const, start: '09:00', end: '17:00', duration: 480, break: 60, color: '#7c3aed' },
    { code: 'NIGHT-22', name: 'شیفت شب ۲۲ تا ۶', kind: 'NIGHT' as const, start: '22:00', end: '06:00', duration: 480, break: 45, color: '#0f172a' },
  ];
  const shifts: Record<string, string> = {};
  for (const s of shiftDefs) {
    const row = await prisma.shift.upsert({
      where: { companyId_code: { companyId, code: s.code } },
      update: {},
      create: { companyId, code: s.code, name: s.name, kind: s.kind, startTime: s.start, endTime: s.end, durationMinutes: s.duration, breakMinutes: s.break, color: s.color, capacity: 50 },
    });
    shifts[s.code] = row.id;
  }

  const assignments = await prisma.shiftAssignment.count();
  if (assignments < 20) {
    for (let d = 14; d >= 0; d--) {
      const day = daysAgo(d);
      if (day.getDay() === 5) continue;
      for (const e of employeeDefs) {
        const code = e.code === '1010' ? 'NIGHT-22' : Number(e.code) % 2 === 0 ? 'STD-09' : 'STD-08';
        await prisma.shiftAssignment.create({
          data: { shiftId: shifts[code], employeeId: employees[e.code], workDate: dateOnly(day), status: d === 0 ? 'PLANNED' : 'COMPLETED' },
        });
      }
    }
  }
  console.log('✅ شیفت و برنامهٔ کاری آماده شد.');

  // ------------------------------------------------------------------
  // ۸) مرخصی: انواع، درخواست‌ها، تراکنش مانده
  // ------------------------------------------------------------------
  const leaveTypeDefs = [
    { code: 'ANNUAL' as const, name: 'مرخصی استحقاقی سالانه', quota: 26 * 480, color: '#2563eb' },
    { code: 'SICK' as const, name: 'مرخصی استعلاجی', quota: 10 * 480, color: '#dc2626' },
    { code: 'UNPAID' as const, name: 'مرخصی بدون حقوق', quota: 0, color: '#64748b' },
    { code: 'HOURLY' as const, name: 'مرخصی ساعتی', quota: 0, color: '#f59e0b' },
    { code: 'MARRIAGE' as const, name: 'مرخصی ازدواج', quota: 3 * 480, color: '#ec4899' },
    { code: 'BEREAVEMENT' as const, name: 'مرخصی فوت بستگان', quota: 3 * 480, color: '#0f172a' },
  ];
  const leaveTypes: Record<string, string> = {};
  for (const t of leaveTypeDefs) {
    const row = await prisma.leaveType.upsert({
      where: { companyId_code: { companyId, code: t.code } },
      update: {},
      create: { companyId, code: t.code, name: t.name, isPaid: t.code !== 'UNPAID', annualQuotaMinutes: t.quota, color: t.color, maxDailyMinutes: 480 },
    });
    leaveTypes[t.code] = row.id;
  }

  const leaveRequests = await prisma.leaveRequest.count();
  if (leaveRequests < 5) {
    const defs = [
      { emp: '1003', type: 'ANNUAL', start: daysAgo(12), days: 3, status: 'APPROVED' as const, reason: 'سفر خانوادگی' },
      { emp: '1006', type: 'SICK', start: daysAgo(8), days: 2, status: 'APPROVED' as const, reason: 'سرماخوردگی و استراحت پزشکی' },
      { emp: '1008', type: 'ANNUAL', start: daysAhead(10), days: 5, status: 'SUBMITTED' as const, reason: 'مرخصی تابستانی' },
      { emp: '1009', type: 'HOURLY', start: daysAhead(3), days: 1, status: 'PENDING_SUPERVISOR' as const, reason: 'مراجعهٔ پزشکی ساعتی' },
      { emp: '1011', type: 'ANNUAL', start: daysAhead(20), days: 2, status: 'DRAFT' as const, reason: 'پیش‌نویس مرخصی' },
      { emp: '1005', type: 'MARRIAGE', start: daysAgo(30), days: 3, status: 'APPROVED' as const, reason: 'مرخصی ازدواج' },
    ];
    for (const r of defs) {
      const start = at(r.start, 8);
      const end = at(new Date(r.start.getTime() + (r.days - 1) * DAY), 16);
      const row = await prisma.leaveRequest.create({
        data: {
          employeeId: employees[r.emp],
          leaveTypeId: leaveTypes[r.type],
          startAt: start,
          endAt: end,
          durationMinutes: r.days * 480,
          status: r.status,
          reason: r.reason,
          decidedAt: r.status === 'APPROVED' ? daysAgo(1) : null,
        },
      });
      await prisma.leaveRequestEvent.create({
        data: { requestId: row.id, action: 'SUBMIT', toStatus: 'SUBMITTED', actorId: users.admin, comment: r.reason },
      });
      if (r.status === 'APPROVED') {
        await prisma.leaveTransaction.create({
          data: {
            employeeId: employees[r.emp],
            leaveTypeId: leaveTypes[r.type],
            type: 'CONSUME',
            minutes: r.days * 480,
            sourceType: 'LEAVE_REQUEST',
            sourceId: row.id,
            occurredAt: start,
            note: 'مرخصی تأییدشده',
          },
        });
      }
    }
  }

  // مانده مرخصی سالانه
  const txCount = await prisma.leaveTransaction.count();
  if (txCount < 10) {
    for (const e of employeeDefs) {
      const annual = leaveTypes.ANNUAL;
      await prisma.leaveTransaction.create({
        data: {
          employeeId: employees[e.code],
          leaveTypeId: annual,
          type: 'GRANT',
          minutes: 26 * 480,
          sourceType: 'YEARLY_GRANT',
          occurredAt: daysAgo(120),
          note: 'اعتبار سالانه مرخصی استحقاقی',
        },
      });
    }
  }
  console.log('✅ مرخصی آماده شد.');

  // ------------------------------------------------------------------
  // ۹) گردش تأیید
  // ------------------------------------------------------------------
  const flowDefs = [
    { code: 'LEAVE-FLOW', name: 'گردش تأیید مرخصی', subject: 'LEAVE' as const, steps: ['سرپرست واحد', 'مدیر منابع انسانی'] },
    { code: 'OVERTIME-FLOW', name: 'گردش تأیید اضافه‌کاری', subject: 'OVERTIME' as const, steps: ['سرپرست واحد'] },
    { code: 'LOAN-FLOW', name: 'گردش تأیید وام', subject: 'LOAN' as const, steps: ['مدیر منابع انسانی', 'مدیر مالی'] },
  ];
  const flows: Record<string, string> = {};
  for (const f of flowDefs) {
    const flow = await prisma.approvalFlow.upsert({
      where: { code: f.code },
      update: {},
      create: { companyId, code: f.code, name: f.name, subjectType: f.subject, description: `گردش پیش‌فرض ${f.name}` },
    });
    flows[f.code] = flow.id;
    const existingSteps = await prisma.approvalStep.count({ where: { flowId: flow.id } });
    if (existingSteps === 0) {
      for (const [i, name] of f.steps.entries()) {
        await prisma.approvalStep.create({
          data: { flowId: flow.id, stepOrder: i + 1, name, approverType: 'ROLE', approverRoleCode: i === 0 ? 'MANAGER' : 'HR_ADMIN', slaHours: 48 },
        });
      }
    }
  }
  console.log('✅ گردش تأیید آماده شد.');

  // ------------------------------------------------------------------
  // ۱۰) حقوق و دستمزد
  // ------------------------------------------------------------------
  const componentDefs = [
    { code: 'BASE_SALARY', name: 'حقوق پایه', type: 'EARNING' as const, calc: 'FIXED' as const, amount: 0 },
    { code: 'HOUSING', name: 'حق مسکن', type: 'EARNING' as const, calc: 'FIXED' as const, amount: 2_000_000 },
    { code: 'FOOD', name: 'حق خوراک', type: 'EARNING' as const, calc: 'FIXED' as const, amount: 1_500_000 },
    { code: 'CHILD', name: 'حق اولاد', type: 'EARNING' as const, calc: 'FIXED' as const, amount: 3_000_000 },
    { code: 'SENIORITY', name: 'سنوات', type: 'EARNING' as const, calc: 'PERCENT' as const, amount: 5 },
    { code: 'OVERTIME', name: 'اضافه‌کاری', type: 'EARNING' as const, calc: 'HOURLY' as const, amount: 0 },
    { code: 'TAX', name: 'مالیات بر درآمد', type: 'DEDUCTION' as const, calc: 'PERCENT' as const, amount: 10 },
    { code: 'INSURANCE', name: 'بیمه تأمین اجتماعی', type: 'DEDUCTION' as const, calc: 'PERCENT' as const, amount: 7 },
    { code: 'LOAN', name: 'اقساط وام', type: 'DEDUCTION' as const, calc: 'FIXED' as const, amount: 0 },
  ];
  const components: Record<string, string> = {};
  for (const c of componentDefs) {
    const row = await prisma.payComponent.upsert({
      where: { companyId_code: { companyId, code: c.code } },
      update: {},
      create: { companyId, code: c.code, name: c.name, type: c.type, calculationType: c.calc, amount: RIAL(c.amount), isTaxable: c.type === 'EARNING', sortOrder: componentDefs.indexOf(c) },
    });
    components[c.code] = row.id;
  }

  const periodCount = await prisma.payrollPeriod.count();
  if (periodCount < 3) {
    for (let m = 3; m >= 1; m--) {
      const ref = new Date(now.getFullYear(), now.getMonth() - m, 1);
      const year = ref.getFullYear();
      const month = ref.getMonth() + 1;
      const period = await prisma.payrollPeriod.create({
        data: {
          companyId,
          year,
          month,
          status: m === 1 ? 'REVIEWED' : 'LOCKED',
          lockedAt: m === 1 ? null : daysAgo(m * 30),
          lockedById: m === 1 ? null : users.admin,
          generatedAt: daysAgo(m * 30),
        },
      });
      let totalGross = 0n;
      let totalNet = 0n;
      for (const e of employeeDefs) {
        const empId = employees[e.code];
        const gross = RIAL(e.salary);
        const housing = RIAL(2_000_000);
        const food = RIAL(1_500_000);
        const senior = RIAL(Math.round(e.salary * 0.05));
        const tax = RIAL(Math.round(e.salary * 0.1));
        const insurance = RIAL(Math.round(e.salary * 0.07));
        const rows = [
          { componentId: components.BASE_SALARY, amount: gross },
          { componentId: components.HOUSING, amount: housing },
          { componentId: components.FOOD, amount: food },
          { componentId: components.SENIORITY, amount: senior },
          { componentId: components.TAX, amount: tax },
          { componentId: components.INSURANCE, amount: insurance },
        ];
        for (const r of rows) {
          await prisma.payrollItem.create({
            data: { periodId: period.id, employeeId: empId, componentId: r.componentId, amount: r.amount },
          });
        }
        const empGross = gross + housing + food + senior;
        const empDeduction = tax + insurance;
        totalGross += empGross;
        totalNet += empGross - empDeduction;
        await prisma.payslip.create({
          data: {
            periodId: period.id,
            employeeId: empId,
            grossAmount: empGross,
            deductionAmount: empDeduction,
            netAmount: empGross - empDeduction,
            status: m === 1 ? 'DRAFT' : 'PUBLISHED',
            publishedAt: m === 1 ? null : daysAgo(m * 30 - 1),
          },
        });
      }
      await prisma.payrollPeriod.update({
        where: { id: period.id },
        data: { totalGross, totalDeductions: totalGross - totalNet, totalNet },
      });
    }
  }
  console.log('✅ حقوق و دستمزد آماده شد.');

  // ------------------------------------------------------------------
  // ۱۱) ارزیابی عملکرد
  // ------------------------------------------------------------------
  let form = await prisma.evaluationForm.findFirst({ where: { companyId } });
  if (!form) {
    form = await prisma.evaluationForm.create({
      data: { companyId, name: 'فرم ارزیابی عملکرد سالانه', description: 'فرم استاندارد ارزیابی عملکرد کارکنان', version: 1 },
    });
  }
  if ((await prisma.evaluationItem.count({ where: { formId: form.id } })) === 0) {
    const items = [
      { title: 'کیفیت انجام کار', weight: 25, isKPI: false },
      { title: 'رعایت قوانین و مقررات', weight: 15, isKPI: false },
      { title: 'همکاری تیمی و ارتباط مؤثر', weight: 15, isKPI: false },
      { title: 'تحقق اهداف کلیدی عملکرد (KPI)', weight: 30, isKPI: true },
      { title: 'نوآوری و بهبود فرایندها', weight: 15, isKPI: false },
    ];
    for (const [i, it] of items.entries()) {
      await prisma.evaluationItem.create({
        data: { formId: form.id, title: it.title, weight: it.weight, isKPI: it.isKPI, scaleType: 'NUMERIC', minScore: 1, maxScore: 5, sortOrder: i },
      });
    }
  }
  const cycle = await prisma.evaluationCycle.findFirst({ where: { companyId } });
  let cycleId = cycle?.id;
  if (!cycleId) {
    const created = await prisma.evaluationCycle.create({
      data: {
        companyId,
        formId: form.id,
        name: 'دورهٔ ارزیابی شش‌ماههٔ اول ۱۴۰۴',
        periodType: 'SEMI_ANNUAL',
        startDate: daysAgo(120),
        endDate: daysAgo(30),
        dueDate: daysAhead(10),
        status: 'IN_PROGRESS',
      },
    });
    cycleId = created.id;
    const evalItems = await prisma.evaluationItem.findMany({ where: { formId: form.id } });
    for (const e of employeeDefs) {
      const empId = employees[e.code];
      const status = e.code === '1004' || e.code === '1008' ? 'PENDING' : 'COMPLETED';
      const evaluation = await prisma.evaluation.create({
        data: {
          cycleId,
          employeeId: empId,
          evaluatorId: users.admin,
          evaluationType: 'SUPERVISOR',
          status,
          selfScore: status === 'COMPLETED' ? 3.8 : null,
          supervisorScore: status === 'COMPLETED' ? 4.1 : null,
          weightedScore: status === 'COMPLETED' ? 3.95 : null,
          finalScore: status === 'COMPLETED' ? 3.95 : null,
          employeeResponse: status === 'COMPLETED' ? 'عملکرد خود را در این دوره مثبت ارزیابی می‌کنم و خواهم نقاط قابل بهبود را دنبال کنم.' : null,
        },
      });
      if (status === 'COMPLETED') {
        for (const [i, it] of evalItems.entries()) {
          await prisma.evaluationScore.create({
            data: { evaluationId: evaluation.id, itemId: it.id, score: 3.4 + (i % 3) * 0.4, comment: 'ارزیابی مطابق شاخص‌های دوره.' },
          });
        }
        await prisma.evaluationFeedback.create({
          data: { evaluationId: evaluation.id, authorId: users.admin, content: 'نقطه قوت: پیگیری دقیق وظایف. نقطه بهبود: توسعهٔ مهارت‌های ارتباطی.' },
        });
      }
    }
  }

  const goalCount = await prisma.goal.count();
  if (goalCount < 5) {
    const goals = [
      { emp: '1003', title: 'کاهش زمان چرخهٔ جذب نیرو به ۲۱ روز', target: 21, unit: 'روز', progress: 70 },
      { emp: '1006', title: 'ارتقای نرخ پایداری سامانه به ۹۹٫۵ درصد', target: 99.5, unit: 'درصد', progress: 85 },
      { emp: '1005', title: 'دقت گزارش‌های مالی ماهانه', target: 100, unit: 'درصد', progress: 95 },
      { emp: '1008', title: 'رسیدن به سهم فروش ۱۲۰ میلیون ریالی', target: 120_000_000, unit: 'ریال', progress: 60 },
      { emp: '1001', title: 'اجرای نظام ارزیابی عملکرد برای ۱۰۰٪ کارکنان', target: 100, unit: 'درصد', progress: 75 },
    ];
    for (const g of goals) {
      await prisma.goal.create({
        data: {
          employeeId: employees[g.emp],
          cycleId,
          title: g.title,
          goalType: 'KPI',
          targetValue: g.target,
          unit: g.unit,
          startDate: daysAgo(100),
          endDate: daysAhead(80),
          progress: g.progress,
          status: 'OPEN',
        },
      });
    }
  }
  console.log('✅ ارزیابی عملکرد آماده شد.');

  // ------------------------------------------------------------------
  // ۱۲) وظایف
  // ------------------------------------------------------------------
  const taskCount = await prisma.task.count();
  if (taskCount < 8) {
    const defs = [
      { title: 'تهیهٔ گزارش حقوق و دستمزد ماهانه', desc: 'محاسبه و کنترل فیش‌های حقوقی پیش از انتشار', status: 'IN_PROGRESS' as const, priority: 'HIGH' as const, orgUnit: 'FIN', due: daysAhead(3), progress: 60 },
      { title: 'تکمیل مستندات پروندهٔ پرسنلی کارکنان جدید', desc: 'جمع‌آوری و بارگذاری مدارک هویتی و تحصیلی', status: 'NEW' as const, priority: 'MEDIUM' as const, orgUnit: 'HR', due: daysAhead(7), progress: 20 },
      { title: 'ارتقای زیرساخت پایگاه داده', desc: 'افزایش ظرفیت و بهینه‌سازی کوئری‌های سنگین', status: 'IN_PROGRESS' as const, priority: 'HIGH' as const, orgUnit: 'IT', due: daysAhead(14), progress: 45 },
      { title: 'بازبینی سیاست دورکاری کارکنان', desc: 'به‌روزرسانی دستورالعمل دورکاری بر اساس بازخورد واحدها', status: 'NEW' as const, priority: 'LOW' as const, orgUnit: 'HR', due: daysAhead(20), progress: 0 },
      { title: 'برنامهٔ آموزشی نیم‌سال دوم', desc: 'تدوین سرفصل دوره‌های تخصصی و تکمیلی', status: 'DONE' as const, priority: 'MEDIUM' as const, orgUnit: 'HR', due: daysAgo(10), progress: 100 },
      { title: 'پیگیری فروش قراردادهای شعبهٔ تبریز', desc: 'تماس با مشتریان بالقوه و نهایی‌سازی قراردادها', status: 'IN_PROGRESS' as const, priority: 'HIGH' as const, orgUnit: 'SALES', due: daysAhead(5), progress: 35 },
      { title: 'انبارگردانی تجهیزات اداری', desc: 'شمارش و ثبت وضعیت تجهیزات اداری شعب', status: 'NEW' as const, priority: 'LOW' as const, orgUnit: 'OPS-TB', due: daysAhead(30), progress: 0 },
      { title: 'اصلاح فرایند تأیید مرخصی', desc: 'کاهش زمان چرخهٔ تأیید درخواست‌های مرخصی', status: 'DONE' as const, priority: 'MEDIUM' as const, orgUnit: 'HR', due: daysAgo(20), progress: 100 },
    ];
    for (const t of defs) {
      const task = await prisma.task.create({
        data: {
          companyId,
          orgUnitId: units[t.orgUnit],
          title: t.title,
          description: t.desc,
          status: t.status,
          priority: t.priority,
          dueDate: dateOnly(t.due),
          progress: t.progress,
          slaHours: 72,
          createdById: users.admin,
          completedAt: t.status === 'DONE' ? daysAgo(5) : null,
        },
      });
      const assignee = employeeDefs[Number(t.title.length) % employeeDefs.length];
      await prisma.taskAssignee.create({
        data: { taskId: task.id, employeeId: employees[assignee.code], role: 'ASSIGNEE', isResponsible: true, completedAt: t.status === 'DONE' ? daysAgo(5) : null },
      });
      await prisma.taskComment.create({
        data: { taskId: task.id, authorId: users.admin, content: 'این وظیفه در جلسهٔ هفتگی تعریف و برای اجرا به واحد مربوطه ابلاغ شد.' },
      });
    }
  }
  console.log('✅ وظایف آماده شد.');

  // ------------------------------------------------------------------
  // ۱۳) دارایی و تجهیزات
  // ------------------------------------------------------------------
  const assetCount = await prisma.asset.count();
  if (assetCount < 8) {
    const defs = [
      { code: 'AST-0001', name: 'لپ‌تاپ مدیریتی', category: 'COMPUTER', brand: 'Lenovo', model: 'ThinkPad X1', price: 85_000_000, holder: '1001', status: 'ASSIGNED' as const },
      { code: 'AST-0002', name: 'لپ‌تاپ کارشناسی', category: 'COMPUTER', brand: 'Dell', model: 'Latitude 5540', price: 48_000_000, holder: '1003', status: 'ASSIGNED' as const },
      { code: 'AST-0003', name: 'ایستگاه کاری سرور', category: 'COMPUTER', brand: 'HP', model: 'ProLiant DL360', price: 320_000_000, holder: null, status: 'IN_STOCK' as const },
      { code: 'AST-0004', name: 'خودرو سازمانی', category: 'VEHICLE', brand: 'ایران خودرو', model: 'سمند', price: 210_000_000, holder: '1009', status: 'ASSIGNED' as const },
      { code: 'AST-0005', name: 'دستگاه کارت‌خوان', category: 'EQUIPMENT', brand: 'اکسس', model: 'BioPass', price: 9_500_000, holder: null, status: 'IN_STOCK' as const },
      { code: 'AST-0006', name: 'مبل اداری', category: 'FURNITURE', brand: 'نیلوفر', model: 'اداری ۳ نفره', price: 32_000_000, holder: null, status: 'IN_STOCK' as const },
      { code: 'AST-0007', name: 'پرینتر شبکه‌ای', category: 'EQUIPMENT', brand: 'HP', model: 'LaserJet M404', price: 18_000_000, holder: '1004', status: 'ASSIGNED' as const },
      { code: 'AST-0008', name: 'دوربین مداربسته', category: 'EQUIPMENT', brand: 'تیاندی', model: 'IPC-HFW', price: 12_500_000, holder: null, status: 'DAMAGED' as const },
    ];
    for (const a of defs) {
      const asset = await prisma.asset.create({
        data: {
          companyId,
          orgUnitId: units.HR,
          code: a.code,
          name: a.name,
          category: a.category,
          brand: a.brand,
          model: a.model,
          serialNumber: `SN-${a.code}-${nextSeq()}`,
          purchaseDate: daysAgo(400 + Number(a.code.slice(-2)) * 7),
          purchasePrice: RIAL(a.price),
          warrantyEnd: daysAhead(200),
          status: a.status,
          condition: a.status === 'DAMAGED' ? 'نیازمند تعمیر' : 'سالم',
          currentHolderId: a.holder ? employees[a.holder] : null,
        },
      });
      if (a.holder) {
        await prisma.assetHandover.create({
          data: {
            assetId: asset.id,
            toEmployeeId: employees[a.holder],
            handoverType: 'DELIVER',
            handoverAt: daysAgo(300),
            receivedAt: daysAgo(300),
            condition: 'سالم',
            note: 'تحویل تجهیزات هنگام شروع همکاری',
          },
        });
      }
      if (a.status === 'DAMAGED') {
        await prisma.assetMaintenance.create({
          data: {
            assetId: asset.id,
            maintenanceType: 'REPAIR',
            performedAt: daysAgo(15),
            cost: RIAL(4_500_000),
            description: 'خرابی لنز و قطع تصویر',
            vendor: 'تعمیرات رایانه پارس',
            nextDueDate: daysAhead(45),
          },
        });
      }
    }
  }
  console.log('✅ دارایی و تجهیزات آماده شد.');

  // ------------------------------------------------------------------
  // ۱۴) آموزش و گواهینامه
  // ------------------------------------------------------------------
  const courseDefs = [
    { code: 'TR-001', title: 'اصول حقوق و دستمزد', instructor: 'دکتر رضایی', hours: 16, cost: 12_000_000 },
    { code: 'TR-002', title: 'ایمنی و بهداشت حرفه‌ای (HSE)', instructor: 'مهندس کاظمی', hours: 8, cost: 0 },
    { code: 'TR-003', title: 'Excel پیشرفته و تحلیل داده', instructor: 'مهندس نوری', hours: 24, cost: 8_500_000 },
    { code: 'TR-004', title: 'مدیریت عملکرد و ارزیابی', instructor: 'دکتر احمدی', hours: 12, cost: 10_000_000 },
    { code: 'TR-005', title: 'فروش حرفه‌ای و مذاکره', instructor: 'آقای صادقی', hours: 20, cost: 9_000_000 },
  ];
  const courses: Record<string, string> = {};
  for (const c of courseDefs) {
    const row = await prisma.trainingCourse.upsert({
      where: { companyId_code: { companyId, code: c.code } },
      update: {},
      create: { companyId, code: c.code, title: c.title, instructor: c.instructor, durationHours: c.hours, cost: RIAL(c.cost), description: `دورهٔ آموزشی «${c.title}»` },
    });
    courses[c.code] = row.id;
  }

  const trainingCount = await prisma.trainingRecord.count();
  if (trainingCount < 10) {
    const defs = [
      { emp: '1003', course: 'TR-001', score: 92, result: 'PASSED' },
      { emp: '1003', course: 'TR-003', score: 88, result: 'PASSED' },
      { emp: '1006', course: 'TR-003', score: 79, result: 'PASSED' },
      { emp: '1001', course: 'TR-004', score: 95, result: 'PASSED' },
      { emp: '1004', course: 'TR-001', score: 84, result: 'PASSED' },
      { emp: '1005', course: 'TR-003', score: 71, result: 'PASSED' },
      { emp: '1009', course: 'TR-002', score: 96, result: 'PASSED' },
      { emp: '1010', course: 'TR-002', score: 90, result: 'PASSED' },
      { emp: '1007', course: 'TR-005', score: 86, result: 'PASSED' },
      { emp: '1008', course: 'TR-005', score: 74, result: 'PASSED' },
      { emp: '1012', course: 'TR-003', score: 68, result: 'FAILED' },
    ];
    for (const t of defs) {
      await prisma.trainingRecord.create({
        data: {
          courseId: courses[t.course],
          employeeId: employees[t.emp],
          attendanceDate: dateOnly(daysAgo(60 + (Number(t.emp) % 30))),
          endDate: dateOnly(daysAgo(58 + (Number(t.emp) % 30))),
          result: t.result,
          score: t.score,
          effectivenessScore: t.score - 5,
          status: 'COMPLETED',
        },
      });
    }
  }

  const certCount = await prisma.certificate.count();
  if (certCount < 5) {
    const defs = [
      { emp: '1009', name: 'گواهینامه ایمنی صنعتی', body: 'وزارت تعاون، کار و رفاه اجتماعی', days: 400 },
      { emp: '1010', name: 'گواهینامه برق صنعتی', body: 'سازمان آموزش فنی و حرفه‌ای', days: 300 },
      { emp: '1003', name: 'گواهینامه حقوق و دستمزد', body: 'مؤسسه آموزش عالی آزاد', days: 500 },
      { emp: '1006', name: 'گواهینامه Microsoft', body: 'مایکروسافت', days: 250 },
      { emp: '1008', name: 'گواهینامه فروش حرفه‌ای', body: 'انجمن فروش ایران', days: 180 },
    ];
    for (const c of defs) {
      await prisma.certificate.create({
        data: {
          employeeId: employees[c.emp],
          name: c.name,
          issuingBody: c.body,
          issueDate: dateOnly(daysAgo(c.days)),
          expiryDate: dateOnly(daysAhead(c.days - 30)),
        },
      });
    }
  }
  console.log('✅ آموزش و گواهینامه آماده شد.');

  // ------------------------------------------------------------------
  // ۱۵) استخدام و جذب
  // ------------------------------------------------------------------
  const reqCount = await prisma.jobRequisition.count();
  if (reqCount < 3) {
    const reqs = [
      { title: 'جذب کارشناس منابع انسانی', headcount: 2, unit: 'HR', budget: 600_000_000, status: 'APPROVED' },
      { title: 'جذب برنامه‌نویس فرانت‌اند', headcount: 1, unit: 'IT', budget: 720_000_000, status: 'APPROVED' },
      { title: 'جذب حسابدار ارشد', headcount: 1, unit: 'FIN', budget: 540_000_000, status: 'DRAFT' },
    ];
    for (const r of reqs) {
      await prisma.jobRequisition.create({
        data: {
          companyId,
          orgUnitId: units[r.unit],
          workLocationId: location.id,
          title: r.title,
          headcount: r.headcount,
          reason: 'نیاز سازمانی تأییدشده در جلسهٔ کمیتهٔ منابع انسانی',
          budget: RIAL(r.budget),
          status: r.status,
          requestedById: users.admin,
          approvedAt: r.status === 'APPROVED' ? daysAgo(40) : null,
        },
      });
    }
  }

  const openingCount = await prisma.jobOpening.count();
  if (openingCount < 3) {
    const reqs = await prisma.jobRequisition.findMany({ where: { companyId }, take: 3 });
    const openings: string[] = [];
    const openingDefs = [
      { title: 'کارشناس منابع انسانی', min: 480_000_000, max: 620_000_000, type: 'PERMANENT' as const, deadline: daysAhead(20) },
      { title: 'برنامه‌نویس فرانت‌اند', min: 650_000_000, max: 820_000_000, type: 'PERMANENT' as const, deadline: daysAhead(25) },
      { title: 'حسابدار ارشد', min: 520_000_000, max: 680_000_000, type: 'CONTRACTUAL' as const, deadline: daysAhead(15) },
    ];
    for (const [i, o] of openingDefs.entries()) {
      const req = reqs[i];
      if (!req) continue;
      const row = await prisma.jobOpening.create({
        data: {
          requisitionId: req.id,
          title: o.title,
          description: `شرح شغل «${o.title}» — همکاری با واحد مربوطه در تهران.`,
          requiredSkills: i === 1 ? 'JavaScript, React, TypeScript' : i === 2 ? 'حسابداری صنعتی، Excel' : 'منابع انسانی، مصاحبه',
          preferredSkills: i === 1 ? 'طراحی رابط کاربری' : 'تجربهٔ صنعتی',
          employmentType: o.type,
          salaryMin: RIAL(o.min),
          salaryMax: RIAL(o.max),
          applicationDeadline: dateOnly(o.deadline),
          status: 'OPEN',
        },
      });
      openings.push(row.id);
    }

    const applicantDefs = [
      { opening: 0, first: 'سپیده', last: 'محمدی', mobile: '09121230000', status: 'HR_INTERVIEW' as const, source: 'سایت استخدام' },
      { opening: 0, first: 'پریسا', last: 'یزدانی', mobile: '09121230001', status: 'APPLIED' as const, source: 'لینکدین' },
      { opening: 1, first: 'مهدی', last: 'جعفری', mobile: '09121230002', status: 'TECH_INTERVIEW' as const, source: 'جابینجا' },
      { opening: 1, first: 'نیما', last: 'سلطانی', mobile: '09121230003', status: 'OFFERED' as const, source: 'معرفی همکاران' },
      { opening: 2, first: 'گلناز', last: 'فتحی', mobile: '09121230004', status: 'REJECTED' as const, source: 'سایت شرکت' },
    ];
    for (const a of applicantDefs) {
      const openingId = openings[a.opening];
      if (!openingId) continue;
      const applicant = await prisma.applicant.create({
        data: {
          openingId,
          firstName: a.first,
          lastName: a.last,
          mobile: a.mobile,
          email: `${a.first}@example.com`,
          source: a.source,
          status: a.status,
          stageNote: a.status === 'REJECTED' ? 'عدم تطابق با نیاز موقعیت شغلی' : null,
        },
      });
      if (a.status === 'HR_INTERVIEW' || a.status === 'TECH_INTERVIEW' || a.status === 'OFFERED') {
        await prisma.interview.create({
          data: {
            applicantId: applicant.id,
            openingId,
            interviewerId: users.admin,
            scheduledAt: at(daysAhead(2 + a.opening), 10),
            mode: 'ONSITE',
            status: 'SCHEDULED',
          },
        });
      }
      if (a.status === 'OFFERED') {
        await prisma.offer.create({
          data: {
            applicantId: applicant.id,
            version: 1,
            salary: RIAL(750_000_000),
            startDate: dateOnly(daysAhead(30)),
            expiresAt: daysAhead(20),
            status: 'SENT',
            notes: 'پیشنهاد شغلی اولیه با حقوق پایه و مزایای کامل.',
          },
        });
      }
    }
  }
  console.log('✅ استخدام و جذب آماده شد.');

  // ------------------------------------------------------------------
  // ۱۶) ورود، جابه‌جایی و خروج
  // ------------------------------------------------------------------
  let template = await prisma.onboardingChecklistTemplate.findFirst({ where: { companyId } });
  if (!template) {
    template = await prisma.onboardingChecklistTemplate.create({
      data: { companyId, name: 'چک‌لیست ورود به سازمان' },
    });
  }
  if ((await prisma.onboardingTemplateItem.count({ where: { templateId: template.id } })) === 0) {
    const items = [
      'تنظیم قرارداد و ثبت در پروندهٔ پرسنلی',
      'دریافت و بارگذاری مدارک هویتی و تحصیلی',
      'افتتاح حساب بانکی و ثبت اطلاعات شبا',
      'معرفی به واحد مربوطه و ارجاع به مدیر مستقیم',
      'تخصیص تجهیزات (لپ‌تاپ، تلفن، کارت حضور)',
      'ثبت در دورهٔ آموزشی توجیهی',
      'معرّفی سامانه‌ها و آشنایی با دستورالعمل‌ها',
    ];
    for (const [i, title] of items.entries()) {
      await prisma.onboardingTemplateItem.create({
        data: { templateId: template.id, title, sortOrder: i, isRequired: true, requiresDocument: i === 1 || i === 2 },
      });
    }
  }

  const checklistCount = await prisma.onboardingChecklist.count();
  if (checklistCount < 2) {
    const defs = [
      { emp: '1012', status: 'IN_PROGRESS' as const, done: 3 },
      { emp: '1011', status: 'COMPLETED' as const, done: 7 },
    ];
    for (const c of defs) {
      const checklist = await prisma.onboardingChecklist.create({
        data: {
          employeeId: employees[c.emp],
          templateId: template.id,
          status: c.status,
          startedAt: daysAgo(20),
          completedAt: c.status === 'COMPLETED' ? daysAgo(5) : null,
        },
      });
      const defsItems = await prisma.onboardingTemplateItem.findMany({ where: { templateId: template.id }, orderBy: { sortOrder: 'asc' } });
      for (const [i, item] of defsItems.entries()) {
        const done = i < c.done;
        await prisma.onboardingChecklistItem.create({
          data: {
            checklistId: checklist.id,
            definitionId: item.id,
            title: item.title,
            status: done ? 'DONE' : 'PENDING',
            completedById: done ? users.admin : null,
            completedAt: done ? daysAgo(18 - i) : null,
          },
        });
      }
    }
  }

  const terminationCount = await prisma.terminationRequest.count();
  if (terminationCount < 1) {
    await prisma.terminationRequest.create({
      data: {
        employeeId: employees['1010'],
        reason: 'RESIGNATION',
        terminationDate: dateOnly(daysAhead(25)),
        status: 'REQUESTED',
        note: 'استعفای نیروی پیمانی با رعایت مهلت قانونی یک‌ماهه.',
      },
    });
    const offboard = await prisma.offboardingChecklist.create({
      data: {
        employeeId: employees['1010'],
        reason: 'استعفا',
        terminationDate: dateOnly(daysAhead(25)),
        status: 'IN_PROGRESS',
      },
    });
    const items = ['تسویه حساب', 'تحویل تجهیزات', 'قطع دسترسی سامانه‌ها', 'پایان همکاری'];
    for (const [i, title] of items.entries()) {
      await prisma.offboardingChecklistItem.create({
        data: { checklistId: offboard.id, title, status: i === 0 ? 'DONE' : 'PENDING' },
      });
    }
  }
  console.log('✅ ورود و خروج آماده شد.');

  // ------------------------------------------------------------------
  // ۱۷) مأموریت
  // ------------------------------------------------------------------
  const missionCount = await prisma.mission.count();
  if (missionCount < 4) {
    const defs = [
      { emp: '1009', title: 'بازدید از مشتری صنعتی تبریز', dest: 'تبریز، شهرک صنعتی', status: 'COMPLETED' as const, cost: 12_000_000, report: 'بازدید انجام شد و صورت‌جلسه با مشتری تنظیم گردید.' },
      { emp: '1010', title: 'انتقال تجهیزات خط تولید', dest: 'اصفهان، کارخانه شماره ۲', status: 'IN_PROGRESS' as const, cost: 8_500_000, report: null },
      { emp: '1006', title: 'عیب‌یابی سرور شعبه تبریز', dest: 'تبریز، دفتر شعبه', status: 'APPROVED' as const, cost: 3_200_000, report: null },
      { emp: '1004', title: 'ارائه گزارش مالی سالانه به هیئت‌مدیره', dest: 'تهران، ساختمان مرکزی', status: 'REQUESTED' as const, cost: 1_000_000, report: null },
    ];
    for (const m of defs) {
      const mission = await prisma.mission.create({
        data: {
          employeeId: employees[m.emp],
          orgUnitId: units.IT,
          title: m.title,
          destination: m.dest,
          purpose: 'انجام مأموریت ابلاغ‌شده از سوی واحد مربوطه',
          startAt: at(daysAgo(10), 7),
          endAt: at(daysAgo(9), 18),
          transport: 'خودروی سازمانی',
          estimatedCost: RIAL(m.cost),
          actualCost: RIAL(Math.round(m.cost * 0.9)),
          status: m.status,
          approvedById: users.admin,
          report: m.report,
        },
      });
      await prisma.missionExpense.create({
        data: {
          missionId: mission.id,
          description: 'هزینهٔ سوخت و ایاب و ذهاب',
          amount: RIAL(Math.round(m.cost * 0.4)),
          spentAt: dateOnly(daysAgo(10)),
          status: 'APPROVED',
          approvedById: users.admin,
        },
      });
    }
  }
  console.log('✅ مأموریت‌ها آماده شد.');

  // ------------------------------------------------------------------
  // ۱۸) وام و مزایا
  // ------------------------------------------------------------------
  const benefitDefs = [
    { code: 'MEAL', name: 'کمک هزینه غذا', desc: 'سهم ماهانهٔ ناهار' },
    { code: 'TRANSPORT', name: 'کمک هزینه رفت‌وآمد', desc: 'سهم ماهانهٔ ایاب و ذهاب' },
    { code: 'PHONE', name: 'کمک هزینه تلفن', desc: 'مشارکت هزینهٔ تلفن همراه' },
    { code: 'CHILDCARE', name: 'کمک هزینه نگهداری کودک', desc: 'مزایای خانواده دارای فرزند' },
  ];
  const benefits: Record<string, string> = {};
  for (const b of benefitDefs) {
    const row = await prisma.benefitType.upsert({
      where: { companyId_code: { companyId, code: b.code } },
      update: {},
      create: { companyId, code: b.code, name: b.name, description: b.desc },
    });
    benefits[b.code] = row.id;
  }
  let pkg = await prisma.benefitPackage.findFirst({ where: { companyId } });
  if (!pkg) {
    pkg = await prisma.benefitPackage.create({
      data: { companyId, name: 'بستهٔ مزایای پایه', description: 'مزایای مشترک کارکنان رسمی' },
    });
  }
  if ((await prisma.benefitPackageItem.count({ where: { packageId: pkg.id } })) === 0) {
    for (const [code, share] of [['MEAL', 4_000_000], ['TRANSPORT', 2_500_000], ['PHONE', 500_000]] as const) {
      await prisma.benefitPackageItem.create({
        data: { packageId: pkg.id, benefitTypeId: benefits[code], companyShare: RIAL(share), employeeShare: RIAL(0), period: 'MONTHLY' },
      });
    }
  }
  const empBenefitCount = await prisma.employeeBenefit.count();
  if (empBenefitCount < 5) {
    for (const e of employeeDefs.slice(0, 6)) {
      await prisma.employeeBenefit.create({
        data: {
          employeeId: employees[e.code],
          benefitTypeId: benefits.MEAL,
          packageId: pkg.id,
          startDate: dateOnly(daysAgo(180)),
          status: 'ACTIVE',
          note: 'تخصیص خودکار بستهٔ مزایای پایه',
        },
      });
    }
  }

  const loanCount = await prisma.loan.count();
  if (loanCount < 3) {
    const defs = [
      { emp: '1003', amount: 100_000_000, count: 10, status: 'APPROVED' as const, purpose: 'هزینهٔ درمان همسر' },
      { emp: '1008', amount: 50_000_000, count: 5, status: 'PENDING_APPROVAL' as const, purpose: 'خرید خودرو' },
      { emp: '1011', amount: 30_000_000, count: 6, status: 'REQUESTED' as const, purpose: 'کمک هزینه ازدواج' },
    ];
    for (const l of defs) {
      const loan = await prisma.loan.create({
        data: {
          employeeId: employees[l.emp],
          loanType: 'LOAN',
          amount: RIAL(l.amount),
          installmentCount: l.count,
          monthlyAmount: RIAL(Math.round(l.amount / l.count)),
          interestRate: 0,
          purpose: l.purpose,
          status: l.status,
          approvedById: l.status === 'APPROVED' ? users.admin : null,
          disbursedAt: l.status === 'APPROVED' ? daysAgo(20) : null,
        },
      });
      for (let i = 0; i < l.count; i++) {
        const paid = l.status === 'APPROVED' && i < 2;
        await prisma.loanInstallment.create({
          data: {
            loanId: loan.id,
            dueDate: dateOnly(daysAhead(i * 30 - 30)),
            amount: RIAL(Math.round(l.amount / l.count)),
            paidAmount: paid ? RIAL(Math.round(l.amount / l.count)) : RIAL(0),
            status: paid ? 'PAID' : 'PENDING',
            paidAt: paid ? daysAgo(25 - i * 30) : null,
          },
        });
      }
    }
  }
  console.log('✅ وام و مزایا آماده شد.');

  // ------------------------------------------------------------------
  // ۱۹) مکاتبات، جلسات، نظرسنجی، پیشنهادها
  // ------------------------------------------------------------------
  const corrCount = await prisma.correspondence.count();
  if (corrCount < 3) {
    const defs = [
      { ref: 'COR-1001', dir: 'INCOMING', subject: 'درخواست بازرسی کارگاه از سوی اداره کار', sender: 'اداره کار رفت و آمد', deadline: daysAhead(10), status: 'REGISTERED' },
      { ref: 'COR-1002', dir: 'OUTGOING', subject: 'پاسخ استعلام‌های بیمه تأمین اجتماعی', sender: 'اداره تأمین اجتماعی', deadline: daysAhead(20), status: 'REGISTERED' },
      { ref: 'COR-1003', dir: 'INCOMING', subject: 'گزارش بازرسی ایمنی محیط کار', sender: 'اداره کل کار', deadline: daysAgo(5), status: 'ANSWERED' },
    ];
    for (const c of defs) {
      await prisma.correspondence.create({
        data: {
          companyId,
          referenceNo: c.ref,
          direction: c.dir,
          letterDate: dateOnly(daysAgo(10)),
          subject: c.subject,
          senderName: c.sender,
          senderOrg: c.sender,
          classification: 'NORMAL',
          deadline: dateOnly(c.deadline),
          status: c.status,
        },
      });
    }
  }

  const meetingCount = await prisma.meeting.count();
  if (meetingCount < 3) {
    const defs = [
      { title: 'جلسهٔ شورای معاونین', loc: 'سالن جلسات طبقه سوم', offset: -7, status: 'HELD' },
      { title: 'جلسهٔ هفتگی واحد منابع انسانی', loc: 'اتاق جلسات منابع انسانی', offset: -2, status: 'HELD' },
      { title: 'جلسهٔ برنامه‌ریزی فروش فصل بعد', loc: 'سالن جلسات', offset: 5, status: 'PLANNED' },
    ];
    for (const m of defs) {
      const meeting = await prisma.meeting.create({
        data: {
          companyId,
          title: m.title,
          scheduledAt: at(daysAgo(-m.offset), 10),
          endAt: at(daysAgo(-m.offset), 12),
          location: m.loc,
          organizerId: users.admin,
          agenda: 'مرور دستور جلسه و تعیین اقدامات با مسئولیت و مهلت مشخص.',
          minutes: m.status === 'HELD' ? 'مصوبات جلسه در صورت‌جلسه ثبت گردید.' : null,
          status: m.status,
        },
      });
      for (const e of employeeDefs.slice(0, 5)) {
        await prisma.meetingParticipant.create({
          data: { meetingId: meeting.id, employeeId: employees[e.code], attended: m.status === 'HELD' },
        });
      }
      await prisma.meetingAction.create({
        data: {
          meetingId: meeting.id,
          title: 'پیگیری مصوبات و تهیهٔ گزارش اقدام',
          responsibleId: employees['1001'],
          dueDate: dateOnly(daysAhead(7)),
          status: m.status === 'HELD' ? 'OPEN' : 'OPEN',
        },
      });
    }
  }

  const surveyCount = await prisma.survey.count();
  if (surveyCount < 2) {
    const defs = [
      { title: 'نظرسنجی رضایت کارکنان از محیط کار', status: 'OPEN' as const, anonymous: true },
      { title: 'نظرسنجی دوره‌های آموزشی سال گذشته', status: 'CLOSED' as const, anonymous: true },
    ];
    for (const s of defs) {
      const survey = await prisma.survey.create({
        data: {
          companyId,
          title: s.title,
          description: 'این نظرسنجی به منظور بهبود مستمر فرایندها انجام می‌شود.',
          isAnonymous: s.anonymous,
          status: s.status,
          startDate: dateOnly(daysAgo(20)),
          endDate: dateOnly(daysAhead(10)),
          createdById: users.admin,
        },
      });
      const questions = [
        { text: 'میزان رضایت از محیط کار', type: 'SCALE' },
        { text: 'کیفیت مدیریت مستقیم', type: 'SCALE' },
        { text: 'پیشنهاد شما برای بهبود', type: 'TEXT' },
      ];
      for (const [i, q] of questions.entries()) {
        await prisma.surveyQuestion.create({
          data: { surveyId: survey.id, sortOrder: i, text: q.text, questionType: q.type },
        });
      }
      for (const e of employeeDefs.slice(0, 6)) {
        await prisma.surveyResponse.create({
          data: {
            surveyId: survey.id,
            respondentId: users.admin,
            answersJson: JSON.stringify({ answers: [{ score: 4 }, { score: 4 }, { text: 'بهبود سرعت فرایندهای اداری' }] }),
            submittedAt: daysAgo(5),
          },
        });
        break;
      }
    }
  }

  const suggestionCount = await prisma.suggestion.count();
  if (suggestionCount < 3) {
    const defs = [
      { title: 'راه‌اندازی سیستم ثبت مرخصی از طریق موبایل', desc: 'کارکنان بتوانند درخواست مرخصی را از طریق اپلیکیشن ثبت کنند.', category: 'IT', status: 'UNDER_REVIEW' as const, anon: false },
      { title: 'افزودن امکان انتخاب نوبت کاری شناور', desc: 'امکان تنظیم ساعت شروع/پایان به‌صورت انعطاف‌پذیر.', category: 'POLICY', status: 'ACCEPTED' as const, anon: true },
      { title: 'ایجاد بوفهٔ سازمانی با تخفیف کارکنان', desc: 'تأمین غذای گرم با قیمت یارانه‌ای برای پرسنل.', category: 'WELFARE', status: 'NEW' as const, anon: true },
    ];
    for (const s of defs) {
      await prisma.suggestion.create({
        data: {
          companyId,
          title: s.title,
          description: s.desc,
          category: s.category,
          isAnonymous: s.anon,
          status: s.status,
          reporterId: s.anon ? null : users.ali,
          responsibleId: s.status === 'NEW' ? null : users.maryam,
          response: s.status === 'UNDER_REVIEW' ? 'در حال بررسی در کمیتهٔ بهبود فرایندها.' : s.status === 'ACCEPTED' ? 'پذیرفته شد و در برنامهٔ سه‌ماههٔ بعد گنجانده می‌شود.' : null,
        },
      });
    }
  }

  const confCount = await prisma.confidentialReport.count();
  if (confCount < 1) {
    await prisma.confidentialReport.create({
      data: {
        companyId,
        title: 'گزارش محرمانهٔ بررسی اضافه‌کاری شعبهٔ تبریز',
        description: 'بر اساس گزارش‌های حضور و غیاب، مغایرت‌هایی در ثبت ساعات کارکنان شعبه مشاهده شده است.',
        severity: 'HIGH',
        status: 'UNDER_REVIEW',
        reporterId: users.admin,
        investigation: 'کارشناسان منابع انسانی در حال بررسی مستندات و گفت‌وگو با سرپرست شعبه هستند.',
      },
    });
  }
  console.log('✅ مکاتبات و جلسات آماده شدند.');

  // ------------------------------------------------------------------
  // ۲۰) اعلامیه‌ها و اعلان‌ها
  // ------------------------------------------------------------------
  const annCount = await prisma.announcement.count();
  if (annCount < 4) {
    const defs = [
      { title: 'اطلاعیهٔ افزایش حقوق سالانهٔ ۱۴۰۴', body: 'به اطلاع می‌رساند افزایش حقوق پایهٔ کارکنان از ابتدای ماه آینده اعمال خواهد شد.', ack: true, expires: daysAhead(20) },
      { title: 'برنامهٔ آموزشی نیم‌سال دوم', body: 'دوره‌های آموزشی نیم‌سال دوم آغاز شده است. مهلت ثبت‌نام تا پایان هفته آینده است.', ack: true, expires: daysAhead(10) },
      { title: 'تغییر ساعت کاری واحدهای عملیاتی', body: 'از ابتدای ماه آینده، ساعت کاری واحدهای عملیاتی به ۸ تا ۱۶ تغییر می‌کند.', ack: false, expires: daysAhead(30) },
      { title: 'فراخوان ثبت‌نام دورهٔ تخصصی HSE', body: 'دورهٔ ایمنی و بهداشت حرفه‌ای با مدرک معتبر برگزار می‌شود.', ack: false, expires: null },
    ];
    for (const a of defs) {
      const row = await prisma.announcement.create({
        data: {
          companyId,
          title: a.title,
          body: a.body,
          targetType: 'ALL',
          requiresAck: a.ack,
          publishedById: users.admin,
          publishedAt: daysAgo(5),
          expiresAt: a.expires,
        },
      });
      if (a.ack && users.ali) {
        await prisma.announcementAck.create({
          data: { announcementId: row.id, userId: users.ali },
        });
      }
    }
  }

  const notifCount = await prisma.notification.count();
  if (notifCount < 5) {
    const defs = [
      { type: 'PAYSLIP_PUBLISHED' as const, sev: 'INFO' as const, title: 'فیش حقوقی ماهانه منتشر شد', body: 'فیش حقوقی شما برای دورهٔ جاری آماده مشاهده است.' },
      { type: 'CONTRACT_EXPIRING' as const, sev: 'WARNING' as const, title: 'قرارداد رو به پایان', body: 'قرارداد یکی از همکاران نزدیک به پایان مهلت است.' },
      { type: 'CERTIFICATE_EXPIRING' as const, sev: 'WARNING' as const, title: 'انقضای گواهینامه', body: 'گواهینامهٔ ایمنی یکی از همکاران رو به اتمام است.' },
      { type: 'LEAVE_BALANCE' as const, sev: 'INFO' as const, title: 'مانده مرخصی', body: 'مانده مرخصی استحقاقی شما به‌روزرسانی شد.' },
      { type: 'SECURITY_ALERT' as const, sev: 'CRITICAL' as const, title: 'ورود جدید به حساب', body: 'ورود جدیدی به حساب کاربری شما از دستگاه جدید ثبت شد.' },
    ];
    for (const n of defs) {
      if (!users.ali) break;
      await prisma.notification.create({
        data: {
          userId: users.ali,
          type: n.type,
          severity: n.sev,
          title: n.title,
          body: n.body,
          channel: 'IN_APP',
          status: 'SENT',
          sentAt: daysAgo(1),
          readAt: n.sev === 'INFO' ? daysAgo(0) : null,
          senderId: users.admin,
        },
      });
    }
  }
  console.log('✅ اعلامیه‌ها و اعلان‌ها آماده شدند.');

  // ------------------------------------------------------------------
  // ۲۱) مدارک پرسنلی
  // ------------------------------------------------------------------
  const docCount = await prisma.employeeDocument.count();
  if (docCount < 8) {
    const defs = [
      { emp: '1001', type: 'NATIONAL_ID' as const, title: 'کارت ملی', num: '0098765432', issue: daysAgo(900), expiry: daysAhead(2000) },
      { emp: '1001', type: 'DEGREE' as const, title: 'مدرک کارشناسی', num: '۷۸۹۱۲۳', issue: daysAgo(2500), expiry: null },
      { emp: '1002', type: 'NATIONAL_ID' as const, title: 'کارت ملی', num: '0012345678', issue: daysAgo(1200), expiry: daysAhead(1700) },
      { emp: '1002', type: 'WORK_EXPERIENCE' as const, title: 'گواهی سابقه کار', num: 'EXP-5521', issue: daysAgo(300), expiry: null },
      { emp: '1003', type: 'NATIONAL_ID' as const, title: 'کارت ملی', num: '0023456789', issue: daysAgo(800), expiry: daysAhead(2100) },
      { emp: '1003', type: 'CERTIFICATE' as const, title: 'گواهینامه دورهٔ حقوق و دستمزد', num: 'CERT-1120', issue: daysAgo(200), expiry: daysAhead(530) },
      { emp: '1006', type: 'NATIONAL_ID' as const, title: 'کارت ملی', num: '0056789012', issue: daysAgo(700), expiry: daysAhead(2200) },
      { emp: '1009', type: 'NATIONAL_ID' as const, title: 'کارت ملی', num: '0089012345', issue: daysAgo(650), expiry: daysAhead(2250) },
      { emp: '1009', type: 'CERTIFICATE' as const, title: 'گواهینامه ایمنی صنعتی', num: 'HSE-3320', issue: daysAgo(400), expiry: daysAhead(30) },
      { emp: '1010', type: 'NATIONAL_ID' as const, title: 'کارت ملی', num: '0090123456', issue: daysAgo(400), expiry: daysAhead(2500) },
    ];
    for (const d of defs) {
      const doc = await prisma.employeeDocument.create({
        data: {
          employeeId: employees[d.emp],
          docType: d.type,
          title: d.title,
          documentNumber: d.num,
          issueDate: dateOnly(d.issue),
          expiryDate: d.expiry ? dateOnly(d.expiry) : null,
          confidentiality: d.type === 'NATIONAL_ID' ? 'CONFIDENTIAL' : 'NORMAL',
          currentVersion: 1,
        },
      });
      await prisma.employeeDocumentVersion.create({
        data: {
          documentId: doc.id,
          version: 1,
          fileName: `${d.num}.pdf`,
          filePath: `/uploads/employees/${employees[d.emp]}/${d.num}.pdf`,
          mimeType: 'application/pdf',
          size: 120_000 + (Number(d.emp) % 7) * 1000,
          uploadedById: users.admin,
        },
      });
    }
  }
  console.log('✅ مدارک پرسنلی آماده شد.');

  // ------------------------------------------------------------------
  // ۲۲) نمونه‌های گردش تأیید
  // ------------------------------------------------------------------
  const instanceCount = await prisma.approvalInstance.count();
  if (instanceCount < 3) {
    // درخواست مرخصی
    const leaveRequest = await prisma.leaveRequest.findFirst({ where: { status: 'PENDING_SUPERVISOR' } });
    if (leaveRequest) {
      const flow = await prisma.approvalFlow.findUnique({ where: { code: 'LEAVE-FLOW' } });
      const steps = flow ? await prisma.approvalStep.findMany({ where: { flowId: flow.id }, orderBy: { stepOrder: 'asc' } }) : [];
      if (flow && steps.length) {
        const instance = await prisma.approvalInstance.create({
          data: {
            flowId: flow.id,
            subjectType: 'LEAVE',
            subjectId: leaveRequest.id,
            status: 'PENDING',
            currentStepOrder: 1,
            initiatedById: users.ali,
            note: 'درخواست مرخصی ساعتی نیروی کارشناسی',
          },
        });
        await prisma.approvalTask.create({
          data: {
            instanceId: instance.id,
            stepId: steps[0].id,
            stepOrder: 1,
            status: 'PENDING',
            assigneeRoleCode: 'MANAGER',
            assigneeUserId: users.ali,
            dueAt: daysAhead(2),
          },
        });
        await prisma.leaveRequest.update({ where: { id: leaveRequest.id }, data: { approvalInstanceId: instance.id } });
      }
    }

    // درخواست وام
    const loan = await prisma.loan.findFirst({ where: { status: 'PENDING_APPROVAL' } });
    if (loan) {
      const flow = await prisma.approvalFlow.findUnique({ where: { code: 'LOAN-FLOW' } });
      const steps = flow ? await prisma.approvalStep.findMany({ where: { flowId: flow.id }, orderBy: { stepOrder: 'asc' } }) : [];
      if (flow && steps.length) {
        const instance = await prisma.approvalInstance.create({
          data: {
            flowId: flow.id,
            subjectType: 'LOAN',
            subjectId: loan.id,
            status: 'PENDING',
            currentStepOrder: 1,
            initiatedById: users.ali,
            note: 'درخواست وام خرید خودرو',
          },
        });
        await prisma.approvalTask.create({
          data: {
            instanceId: instance.id,
            stepId: steps[0].id,
            stepOrder: 1,
            status: 'PENDING',
            assigneeRoleCode: 'HR_ADMIN',
            assigneeUserId: users.maryam,
            dueAt: daysAhead(1),
          },
        });
      }
    }

    // مأموریت
    const mission = await prisma.mission.findFirst({ where: { status: 'REQUESTED' } });
    if (mission) {
      const flow = await prisma.approvalFlow.findUnique({ where: { code: 'OVERTIME-FLOW' } });
      const steps = flow ? await prisma.approvalStep.findMany({ where: { flowId: flow.id }, orderBy: { stepOrder: 'asc' } }) : [];
      if (flow && steps.length) {
        const instance = await prisma.approvalInstance.create({
          data: {
            flowId: flow.id,
            subjectType: 'MISSION',
            subjectId: mission.id,
            status: 'APPROVED',
            currentStepOrder: 1,
            initiatedById: users.admin,
            completedAt: daysAgo(8),
            note: 'مأموریت ارائهٔ گزارش سالانه',
          },
        });
        await prisma.approvalTask.create({
          data: {
            instanceId: instance.id,
            stepId: steps[0].id,
            stepOrder: 1,
            status: 'APPROVED',
            decision: 'APPROVE',
            assigneeRoleCode: 'MANAGER',
            assigneeUserId: users.ali,
            decidedById: users.ali,
            decidedAt: daysAgo(8),
            comment: 'تأیید شد.',
          },
        });
      }
    }
  }
  console.log('✅ نمونه‌های گردش تأیید آماده شدند.');

  // ------------------------------------------------------------------
  // ۲۳) تعویض شیفت، اصلاحیه حقوق و تأیید برای مدیر
  // ------------------------------------------------------------------
  const swapCount = await prisma.shiftSwapRequest.count();
  if (swapCount < 1) {
    const assignmentsList = await prisma.shiftAssignment.findMany({
      where: { workDate: { gte: dateOnly(daysAgo(3)) } },
      include: { shift: true },
      take: 40,
    });
    const a = assignmentsList.find((x) => x.employeeId === employees['1003']);
    const b = assignmentsList.find((x) => x.employeeId === employees['1011']);
    if (a && b) {
      await prisma.shiftSwapRequest.create({
        data: {
          sourceAssignmentId: a.id,
          targetAssignmentId: b.id,
          fromEmployeeId: a.employeeId,
          toEmployeeId: b.employeeId,
          reason: 'درگیری جلسهٔ مصاحبه در روز مقرر',
          status: 'PENDING',
        },
      });
    }
  }

  const amendmentCount = await prisma.payrollAmendment.count();
  if (amendmentCount < 1) {
    const period = await prisma.payrollPeriod.findFirst({ where: { companyId }, orderBy: [{ year: 'desc' }, { month: 'desc' }] });
    if (period) {
      await prisma.payrollAmendment.create({
        data: {
          periodId: period.id,
          employeeId: employees['1003'],
          reason: 'پاداش عملکرد فصلی و جبران کارکرد شبانه',
          itemsJson: JSON.stringify([
            { code: 'BONUS', label: 'پاداش عملکرد', amount: 45_000_000 },
            { code: 'OVERTIME', label: 'اضافه‌کاری', amount: 12_500_000 },
          ]),
          status: 'PENDING',
          createdById: users.maryam,
        },
      });
    }
  }

  // یک تأیید در انتظار برای مدیر (صندوق تأییدها)
  if (users.admin) {
    const adminTask = await prisma.approvalTask.count({ where: { assigneeUserId: users.admin } });
    if (adminTask === 0) {
      const flow = await prisma.approvalFlow.findUnique({ where: { code: 'LOAN-FLOW' } });
      const steps = flow ? await prisma.approvalStep.findMany({ where: { flowId: flow.id }, orderBy: { stepOrder: 'asc' } }) : [];
      const loan = await prisma.loan.findFirst({ where: { status: 'REQUESTED' } });
      if (flow && steps.length && loan) {
        const instance = await prisma.approvalInstance.create({
          data: {
            flowId: flow.id,
            subjectType: 'LOAN',
            subjectId: loan.id,
            status: 'PENDING',
            currentStepOrder: 2,
            initiatedById: users.ali,
            note: 'درخواست وام کمک هزینه ازدواج — در انتظار تأیید مدیر',
          },
        });
        await prisma.approvalTask.create({
          data: {
            instanceId: instance.id,
            stepId: steps[1].id,
            stepOrder: 2,
            status: 'PENDING',
            assigneeRoleCode: 'SUPER_ADMIN',
            assigneeUserId: users.admin,
            dueAt: daysAhead(3),
          },
        });
      }
    }
  }

  // اعلان برای مدیر
  if (users.admin) {
    const adminNotif = await prisma.notification.count({ where: { userId: users.admin } });
    if (adminNotif === 0) {
      await prisma.notification.createMany({
        data: [
          { userId: users.admin, type: 'SYSTEM', severity: 'INFO', title: 'به سامانهٔ سنا خوش آمدید', body: 'دادهٔ نمونه برای همهٔ بخش‌های سامانه ایجاد شد.', channel: 'IN_APP', status: 'READ', sentAt: daysAgo(1), readAt: daysAgo(1) },
          { userId: users.admin, type: 'REQUEST_RESULT', severity: 'INFO', title: 'درخواست مرخصی در انتظار تأیید', body: 'یک درخواست مرخصی ساعتی در انتظار بررسی شماست.', channel: 'IN_APP', status: 'SENT', sentAt: daysAgo(1) },
          { userId: users.admin, type: 'PAYSLIP_PUBLISHED', severity: 'INFO', title: 'دورهٔ حقوق بسته شد', body: 'دورهٔ حقوقی دو ماه گذشته قفل و فیش‌ها منتشر شد.', channel: 'IN_APP', status: 'SENT', sentAt: daysAgo(20) },
        ],
      });
    }
  }

  // ------------------------------------------------------------------
  // ۲۱) فیلدهای سفارشی، فیلترهای ذخیره‌شده، گزارش‌ها و پشتیبان‌ها
  // ------------------------------------------------------------------
  const cfCount = await prisma.customFieldDefinition.count();
  if (cfCount < 2) {
    const defs = [
      { entity: 'EMPLOYEE' as const, code: 'BLOOD_TYPE', label: 'گروه خونی', dataType: 'text', required: false },
      { entity: 'EMPLOYEE' as const, code: 'SHIFT_PREF', label: 'شیفت ترجیحی', dataType: 'select', required: false, options: 'STD-08|STD-09|NIGHT-22' },
      { entity: 'ASSET' as const, code: 'INSURANCE_POLICY', label: 'شماره بیمهٔ تجهیز', dataType: 'text', required: false },
    ];
    for (const d of defs) {
      await prisma.customFieldDefinition.upsert({
        where: { companyId_entity_code: { companyId, entity: d.entity, code: d.code } },
        update: {},
        create: { companyId, entity: d.entity, code: d.code, label: d.label, dataType: d.dataType, options: d.options, isRequired: d.required },
      });
    }
  }

  if (adminUser) {
    const sfCount = await prisma.savedFilter.count({ where: { userId: adminUser.id } });
    if (sfCount < 2) {
      await prisma.savedFilter.createMany({
        data: [
          { userId: adminUser.id, scope: 'employees', name: 'نیروهای رسمی فعال', params: JSON.stringify({ employmentType: 'PERMANENT', status: 'ACTIVE' }) },
          { userId: adminUser.id, scope: 'employees', name: 'استخدام‌های جدید', params: JSON.stringify({ sortBy: 'hireDate', sortOrder: 'desc' }) },
        ],
      });
    }
  }

  const runCount = await prisma.reportRun.count();
  if (runCount < 3) {
    const defs = [
      { code: 'EMPLOYEE_LIST', status: 'DONE' as const, rows: employeeDefs.length },
      { code: 'PAYROLL_SUMMARY', status: 'DONE' as const, rows: employeeDefs.length },
      { code: 'ATTENDANCE_MONTHLY', status: 'DONE' as const, rows: 240 },
    ];
    for (const r of defs) {
      await prisma.reportRun.create({
        data: {
          userId: users.admin,
          reportCode: r.code,
          params: JSON.stringify({ format: 'csv' }),
          format: 'csv',
          status: r.status,
          rowCount: r.rows,
          startedAt: daysAgo(3),
          finishedAt: daysAgo(3),
        },
      });
    }
  }

  const backupCount = await prisma.backupHistory.count();
  if (backupCount < 3) {
    for (let i = 3; i >= 1; i--) {
      await prisma.backupHistory.create({
        data: {
          fileName: `sana-hrms-${daysAgo(i * 7).toISOString().slice(0, 10)}.dump.enc`,
          size: RIAL(145_000_000 + i * 1_200_000),
          checksum: `sha256:${(await import('node:crypto')).createHash('sha256').update(`backup-${i}`).digest('hex').slice(0, 32)}`,
          location: './backups',
          result: 'SUCCESS',
          createdById: users.admin,
          startedAt: daysAgo(i * 7),
          finishedAt: daysAgo(i * 7),
        },
      });
    }
  }

  // ------------------------------------------------------------------
  // ۲۴) تنظیمات سامانه
  // ------------------------------------------------------------------
  const settingsDefs: { key: string; value: string; group: string; label: string; description?: string }[] = [
    { key: 'GENERAL.COMPANY_NAME', value: company.name, group: 'GENERAL', label: 'نام سازمان', description: 'نام نمایشی سازمان در سربرگ گزارش‌ها' },
    { key: 'GENERAL.DEFAULT_LANGUAGE', value: 'fa', group: 'GENERAL', label: 'زبان پیش‌فرض' },
    { key: 'GENERAL.TIMEZONE', value: 'Asia/Tehran', group: 'GENERAL', label: 'منطقهٔ زمانی' },
    { key: 'GENERAL.CALENDAR_TYPE', value: 'JALALI', group: 'GENERAL', label: 'نوع تقویم' },
    { key: 'PAYROLL.CURRENCY', value: 'IRR', group: 'PAYROLL', label: 'واحد پول' },
    { key: 'PAYROLL.DISPLAY_UNIT', value: 'RIAL', group: 'PAYROLL', label: 'واحد نمایش مبالغ' },
    { key: 'PAYROLL.WORKING_DAYS_PER_MONTH', value: '30', group: 'PAYROLL', label: 'روز کاری ماه' },
    { key: 'PAYROLL.DEFAULT_WORK_HOURS_PER_DAY', value: '8', group: 'PAYROLL', label: 'ساعت کاری روزانه' },
    { key: 'PAYROLL.OVERTIME_FACTOR', value: '1.4', group: 'PAYROLL', label: 'ضریب اضافه‌کاری' },
    { key: 'ATTENDANCE.LATE_GRACE_MINUTES', value: '15', group: 'ATTENDANCE', label: 'حاشیهٔ تأخیر مجاز (دقیقه)' },
    { key: 'ATTENDANCE.ROUNDING_MINUTES', value: '5', group: 'ATTENDANCE', label: 'گرد کردن دقیقهٔ کارکرد' },
    { key: 'ATTENDANCE.TIME_SOURCE', value: 'SERVER', group: 'ATTENDANCE', label: 'منبع معتبر زمان' },
    { key: 'LEAVES.AUTO_APPROVE_HOURLY', value: 'false', group: 'LEAVES', label: 'تأیید خودکار مرخصی ساعتی' },
    { key: 'NOTIFICATIONS.EMAIL_ENABLED', value: 'true', group: 'NOTIFICATIONS', label: 'ارسال اعلان ایمیلی' },
    { key: 'SECURITY.PASSWORD_MIN_LENGTH', value: '10', group: 'SECURITY', label: 'حداقل طول رمز عبور' },
    { key: 'SECURITY.MAX_LOGIN_ATTEMPTS', value: '5', group: 'SECURITY', label: 'حداکثر تلاش ناموفق ورود' },
  ];
  for (const s of settingsDefs) {
    await prisma.setting.upsert({
      where: { key: s.key },
      update: { value: s.value, label: s.label },
      create: { key: s.key, value: s.value, group: s.group, label: s.label, description: s.description },
    });
  }
  console.log('✅ تنظیمات سامانه آماده شد.');

  // ------------------------------------------------------------------
  // ۲۵) پروژه‌ها برای تقویم پروژه و گانت چارت
  // ------------------------------------------------------------------
  const projectCount = await prisma.project.count({ where: { companyId } });
  if (projectCount < 4) {
    // رنگ‌ها: سبز (اجاره)، آبی (تیم)، بنفش (همکاران)، قرمز (دکترسینو)، زرد (تحلیل)، نارنجی (تماس)
    const projectDefs = [
      {
        code: 'PRJ-1404-01',
        title: 'اجارهٔ غرفهٔ سالن دو',
        phase: 'اجاره',
        color: '#059669',
        priority: 'HIGH' as const,
        status: 'ACTIVE' as const,
        manager: '1007',
        startOffset: -6,
        endOffset: 12,
        tasks: [
          { title: 'اجارهٔ غرفهٔ سالن دو', phase: 'اجاره', start: -6, end: 4, color: '#059669', assignees: ['1007', '1008'], progress: 80 },
          { title: 'تهیهٔ پلیت‌های تبلیغاتی', phase: 'تبلیغات', start: -2, end: 6, color: '#2563eb', assignees: ['1008'], progress: 55, dependsOn: 0 },
          { title: 'تکمیل فرم‌های اطلاعات شرکت', phase: 'اطلاعات شرکت', start: 2, end: 9, color: '#7c3aed', assignees: ['1001', '1003'], progress: 40, dependsOn: 1 },
        ],
      },
      {
        code: 'PRJ-1404-02',
        title: 'طراحی دکترسینویی غریبه',
        phase: 'طراحی',
        color: '#dc2626',
        priority: 'CRITICAL' as const,
        status: 'ACTIVE' as const,
        manager: '1002',
        startOffset: -12,
        endOffset: 10,
        tasks: [
          { title: 'طراحی دکترسینویی غریبه', phase: 'طراحی', start: -12, end: 2, color: '#dc2626', assignees: ['1002'], progress: 90 },
          { title: 'شفیت‌بندی همکاران پروژه', phase: 'منابع انسانی', start: -1, end: 7, color: '#db2777', assignees: ['1001', '1011'], progress: 60, dependsOn: 0 },
          { title: 'تحلیل و تعریف دامنهٔ پروژه', phase: 'تحلیل', start: 3, end: 14, color: '#ca8a04', assignees: ['1006'], progress: 25 },
        ],
      },
      {
        code: 'PRJ-1404-03',
        title: 'تیم پلیت‌های تبلیغاتی',
        phase: 'تیم',
        color: '#2563eb',
        priority: 'MEDIUM' as const,
        status: 'ACTIVE' as const,
        manager: '1002',
        startOffset: -4,
        endOffset: 16,
        tasks: [
          { title: 'تیم پلیت‌های تبلیغاتی', phase: 'تیم', start: -4, end: 8, color: '#2563eb', assignees: ['1002', '1006'], progress: 70 },
          { title: 'توسعهٔ پلاگین تیم پلیت', phase: 'توسعه', start: 5, end: 18, color: '#7c3aed', assignees: ['1006', '1012'], progress: 30, dependsOn: 0 },
          { title: 'تماس با مراجعان و پیگیری درخواست', phase: 'ارتباط با مراجعان', start: 10, end: 20, color: '#ea580c', assignees: ['1008'], progress: 10, dependsOn: 1 },
        ],
      },
      {
        code: 'PRJ-1404-04',
        title: 'شمیت‌بندی همکاران برای تعیین شرف',
        phase: 'منابع انسانی',
        color: '#db2777',
        priority: 'MEDIUM' as const,
        status: 'PLANNING' as const,
        manager: '1001',
        startOffset: 3,
        endOffset: 24,
        tasks: [
          { title: 'شمیت‌بندی همکاران برای تعیین شرف', phase: 'منابع انسانی', start: 3, end: 18, color: '#db2777', assignees: ['1001'], progress: 20 },
          { title: 'آماده‌سازی فرم‌های ارزیابی عملکرد', phase: 'ارزیابی', start: 12, end: 26, color: '#ca8a04', assignees: ['1011'], progress: 0, dependsOn: 0 },
        ],
      },
    ];

    for (const p of projectDefs) {
      const existing = await prisma.project.findFirst({ where: { companyId, code: p.code } });
      if (existing) continue;
      const project = await prisma.project.create({
        data: {
          companyId,
          code: p.code,
          title: p.title,
          description: `پروژهٔ «${p.title}» — ${p.phase}`,
          startDate: dateOnly(daysAgo(-p.startOffset)),
          endDate: dateOnly(daysAgo(-p.endOffset)),
          status: p.status,
          priority: p.priority,
          progress: Math.round(p.tasks.reduce((s, t) => s + t.progress, 0) / p.tasks.length),
          color: p.color,
          managerId: employees[p.manager],
          createdById: users.admin,
          members: {
            create: [...new Set(p.tasks.flatMap((t) => t.assignees))].map((code) => ({
              employeeId: employees[code],
              role: code === p.manager ? 'MANAGER' : 'MEMBER',
            })),
          },
        },
      });

      const createdTasks: string[] = [];
      for (const [i, t] of p.tasks.entries()) {
        const row = await prisma.projectTask.create({
          data: {
            projectId: project.id,
            title: t.title,
            phase: t.phase,
            startDate: dateOnly(daysAgo(-t.start)),
            endDate: dateOnly(daysAgo(-t.end)),
            progress: t.progress,
            status: t.progress >= 100 ? 'DONE' : t.progress > 0 ? 'IN_PROGRESS' : 'PENDING',
            priority: p.priority === 'CRITICAL' ? 'HIGH' : 'MEDIUM',
            color: t.color,
            assigneeId: employees[t.assignees[0]],
            dependsOnId: t.dependsOn !== undefined ? createdTasks[t.dependsOn] : null,
            sortOrder: i,
          },
        });
        createdTasks.push(row.id);
        // مسئولان فرعی به‌عنوان عضو پروژه ثبت می‌شوند
        for (const code of t.assignees.slice(1)) {
          await prisma.projectMember.upsert({
            where: { projectId_employeeId: { projectId: project.id, employeeId: employees[code] } },
            update: {},
            create: { projectId: project.id, employeeId: employees[code], role: 'MEMBER' },
          });
        }
      }
    }
  }
  console.log('✅ پروژه‌ها و گانت چارت آماده شد.');

  // حضور پروژه‌ای نمونه (مراحلی که نیروها روی آن‌ها کار کرده‌اند)
  const attendanceCount = await prisma.projectAttendance.count();
  if (attendanceCount < 5) {
    const stages = await prisma.projectTask.findMany({
      where: { assigneeId: { in: Object.values(employees) } },
      include: { project: { select: { id: true } } },
      take: 20,
    });
    for (const stage of stages.slice(0, 6)) {
      if (!stage.assigneeId) continue;
      for (let d = 3; d >= 0; d--) {
        const workDate = dateOnly(daysAgo(d));
        const exists = await prisma.projectAttendance.findFirst({
          where: { taskId: stage.id, employeeId: stage.assigneeId, workDate },
        });
        if (exists) continue;
        await prisma.projectAttendance.create({
          data: {
            taskId: stage.id,
            employeeId: stage.assigneeId,
            workDate,
            minutes: 420 + ((d * 37) % 120),
            note: d === 0 ? 'پیشرفت کار امروز ثبت شد.' : null,
          },
        });
      }
    }
  }
  console.log('✅ حضور پروژه‌ای نمونه آماده شد.');

  // ------------------------------------------------------------------
  // ۲۲) گزارش نهایی
  // ------------------------------------------------------------------
  const counts = {
    'نیرو': await prisma.employee.count({ where: { companyId } }),
    'قرارداد': await prisma.contract.count(),
    'رکورد حضور': await prisma.attendanceRecord.count(),
    'شیفت': await prisma.shift.count(),
    'برنامهٔ کاری': await prisma.shiftAssignment.count(),
    'درخواست مرخصی': await prisma.leaveRequest.count(),
    'دورهٔ حقوق': await prisma.payrollPeriod.count(),
    'فیش حقوقی': await prisma.payslip.count(),
    'ارزیابی': await prisma.evaluation.count(),
    'وظیفه': await prisma.task.count(),
    'دارایی': await prisma.asset.count(),
    'دورهٔ آموزشی': await prisma.trainingCourse.count(),
    'گواهینامه': await prisma.certificate.count(),
    'درخواست جذب': await prisma.jobRequisition.count(),
    'آگهی': await prisma.jobOpening.count(),
    'داوطلب': await prisma.applicant.count(),
    'مأموریت': await prisma.mission.count(),
    'وام': await prisma.loan.count(),
    'مزایا': await prisma.employeeBenefit.count(),
    'مکاتبه': await prisma.correspondence.count(),
    'جلسه': await prisma.meeting.count(),
    'نظرسنجی': await prisma.survey.count(),
    'پیشنهاد': await prisma.suggestion.count(),
    'اعلامیه': await prisma.announcement.count(),
    'اعلان': await prisma.notification.count(),
    'گزارش': await prisma.reportRun.count(),
    'پشتیبان': await prisma.backupHistory.count(),
  };
  console.log('\n📊 خلاصهٔ دادهٔ نمونه:');
  for (const [k, v] of Object.entries(counts)) console.log(`   ${k.padEnd(20, '·')} ${v}`);
  console.log('\n✅ دادهٔ نمونهٔ جامع آماده شد.');
}

main()
  .catch((e) => {
    console.error('❌ خطا در تولید دادهٔ نمونه:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
