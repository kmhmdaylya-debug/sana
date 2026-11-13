/**
 * اسکریپت Seed سامانه مدیریت منابع انسانی «سنا»
 * - همگام‌سازی مجوزها با فهرست مرکزی PERMISSIONS
 * - ایجاد نقش‌های سیستمی و کاربر مدیر ارشد
 * - داده‌های نمونه (شرکت، ساختار سازمانی، انواع مرخصی، تنظیمات) در صورت SEED_DEMO_DATA
 *
 * اجرا: npm run db:seed
 */
import { PrismaClient } from '@prisma/client';
import { hash } from '@node-rs/argon2';
import { ALL_PERMISSIONS, PERMISSION_GROUPS } from '../src/common/constants/permissions';
import { validatePasswordStrength } from '../src/common/utils/password.util';

const prisma = new PrismaClient();

/** رمز کاربران نمونه از محیط خوانده می‌شود؛ در تولید اصلاً ساخته نمی‌شوند */
function demoPassword(user: 'ali' | 'maryam'): string {
  const value = process.env[user === 'ali' ? 'DEMO_PASSWORD_ALI' : 'DEMO_PASSWORD_MARYAM'];
  if (!value || value.length < 10) {
    throw new Error(`برای کاربر نمونهٔ «${user}» متغیر محیطی با رمز حداقل ۱۰ نویسه تنظیم کنید.`);
  }
  return value;
}

const ACTION_LABELS: Record<string, string> = {
  view: 'مشاهده',
  create: 'ایجاد',
  update: 'ویرایش',
  delete: 'حذف',
  approve: 'تأیید',
  cancel: 'لغو',
  export: 'خروجی',
  manage: 'مدیریت',
  swap: 'تعویض',
  run: 'اجرا',
  rate: 'امتیازدهی',
  review: 'بازبینی',
  publish: 'انتشار',
  respond: 'پاسخ',
  decide: 'تصمیم',
};

const ROLE_DEFS: {
  code: string;
  name: string;
  description: string;
  match: (code: string) => boolean;
}[] = [
  {
    code: 'SUPER_ADMIN',
    name: 'مدیر ارشد سامانه',
    description: 'دسترسی کامل به تمام بخش‌ها',
    match: () => true,
  },
  {
    code: 'HR_ADMIN',
    name: 'مدیر منابع انسانی',
    description: 'مدیریت کامل منابع انسانی، قراردادها، حقوق و دستمزد و استخدام',
    match: (c) =>
      !c.startsWith('users') &&
      !c.startsWith('roles') &&
      !c.startsWith('backup') &&
      !c.startsWith('settings.manage') &&
      !c.startsWith('audit.manage'),
  },
  {
    code: 'MANAGER',
    name: 'مدیر / سرپرست',
    description: 'مشاهدهٔ تیم و تأیید درخواست‌های پرسنلی',
    match: (c) =>
      c.endsWith('.view') ||
      c.endsWith('.view.management') ||
      c.endsWith('.approve') ||
      c.startsWith('approvals') ||
      c.startsWith('tasks') ||
      c === 'employees.view.sensitive',
  },
  {
    code: 'EMPLOYEE',
    name: 'کارمند',
    description: 'خدمات خودکارسازی: درخواست مرخصی، اصلاح حضور، وظایف و اعلامیه‌ها',
    match: (c) =>
      c === 'dashboard.view' ||
      c === 'leaves.view' ||
      c === 'leaves.create' ||
      c === 'attendance.view' ||
      c === 'attendance.create' ||
      c === 'shifts.view' ||
      c === 'shifts.swap' ||
      c === 'missions.view' ||
      c === 'missions.create' ||
      c === 'tasks.view' ||
      c === 'assets.view' ||
      c === 'training.view' ||
      c === 'evaluations.view' ||
      c === 'evaluations.rate' ||
      c === 'announcements.view' ||
      c === 'notifications.view' ||
      c === 'payroll.view.own' ||
      c === 'admin.view' ||
      c === 'admin.suggestions' ||
      // خودکاری پروندهٔ شخصی (ABAC دسترسی را به رکورد خودِ کاربر محدود می‌کند)
      c === 'employees.view' ||
      c === 'contracts.view' ||
      c === 'documents.view' ||
      // پنل اختصاصی کارمند
      c.startsWith('panel.'),
  },
];

async function syncPermissions(): Promise<number> {
  let created = 0;
  for (const group of PERMISSION_GROUPS) {
    for (const code of group.codes) {
      const action = code.split('.').slice(1).join('.') || 'view';
      const label = `${group.label} — ${ACTION_LABELS[action] ?? action}`;
      const existing = await prisma.permission.findUnique({ where: { code } });
      if (!existing) {
        await prisma.permission.create({ data: { code, label, group: group.group } });
        created++;
      }
    }
  }
  // مجوزهای خارج از گروه‌ها (اگر وجود داشته باشد)
  for (const code of ALL_PERMISSIONS) {
    const exists = await prisma.permission.findUnique({ where: { code } });
    if (!exists) {
      await prisma.permission.create({
        data: { code, label: code, group: code.split('.')[0] },
      });
      created++;
    }
  }
  return created;
}

async function main() {
  const env = process.env;
  console.log('🌱 شروع Seed…');

  // ۱) همگام‌سازی مجوزها
  const createdPerms = await syncPermissions();
  console.log(`✅ مجوزها همگام شد (${createdPerms} مورد جدید).`);
  const allPerms = await prisma.permission.findMany({ select: { id: true, code: true } });
  const permByCode = new Map(allPerms.map((p) => [p.code, p.id]));

  // ۲) نقش‌های سیستمی
  for (const def of ROLE_DEFS) {
    const codes = allPerms.map((p) => p.code).filter(def.match);
    const role = await prisma.role.upsert({
      where: { code: def.code },
      update: { name: def.name, description: def.description, isSystem: true },
      create: { code: def.code, name: def.name, description: def.description, isSystem: true },
    });
    for (const code of codes) {
      const permissionId = permByCode.get(code);
      if (!permissionId) continue;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId } },
        update: {},
        create: { roleId: role.id, permissionId },
      });
    }
    console.log(`✅ نقش «${def.name}» با ${codes.length} مجوز.`);
  }

  // ۳) کاربر مدیر ارشد
  const adminUsername = env.ADMIN_USERNAME || 'admin';
  const adminPassword = env.ADMIN_PASSWORD ?? '';
  if (!adminPassword) {
    throw new Error('متغیر ADMIN_PASSWORD تنظیم نشده است؛ رمز مدیر اولیه نمی‌تواند پیش‌فرض باشد.');
  }
  const strength = validatePasswordStrength(adminPassword, 10);
  if (!strength.ok) throw new Error(`ADMIN_PASSWORD نامعتبر است: ${strength.message}`);
  const existingAdmin = await prisma.user.findUnique({ where: { username: adminUsername } });
  if (!existingAdmin) {
    const passwordHash = await hash(adminPassword);
    const superRole = await prisma.role.findUnique({ where: { code: 'SUPER_ADMIN' } });
    await prisma.user.create({
      data: {
        username: adminUsername,
        fullName: env.ADMIN_FULLNAME || 'مدیر سیستم',
        email: env.ADMIN_EMAIL || null,
        passwordHash,
        isSuperAdmin: true,
        status: 'ACTIVE',
        ...(superRole ? { userRoles: { create: { roleId: superRole.id } } } : {}),
        scopeAssignments: { create: { scopeType: 'ALL' } },
      },
    });
    console.log(`✅ کاربر مدیر ارشد «${adminUsername}» ایجاد شد.`);
  } else {
    console.log(`ℹ️ کاربر «${adminUsername}» از قبل وجود دارد.`);
  }

  // ۴) داده‌های نمونه (توسعه)
  if (env.SEED_DEMO_DATA === 'true' && env.NODE_ENV === 'production') {
    throw new Error('ایجاد داده‌های نمونه در محیط production مجاز نیست.');
  }
  if ((env.SEED_DEMO_DATA || 'false').toLowerCase() !== 'true') {
    console.log('ℹ️ SEED_DEMO_DATA=false — دادهٔ نمونه ایجاد نشد.');
    return;
  }

  const company = await prisma.company.upsert({
    where: { code: 'SANA-HQ' },
    update: {},
    create: {
      code: 'SANA-HQ',
      name: 'شرکت نمونه سنا',
      legalName: 'شرکت نمونه سنا (سهامی خاص)',
      nationalId: '14001234567',
      phone: '021-88776655',
      email: 'info@sana-example.ir',
      isHolding: false,
    },
  });

  const branch = await prisma.branch.upsert({
    where: { companyId_code: { companyId: company.id, code: 'TEHRAN' } },
    update: {},
    create: { companyId: company.id, code: 'TEHRAN', name: 'دفتر مرکزی تهران', kind: 'HQ' },
  });

  const itUnit = await prisma.orgUnit.upsert({
    where: { companyId_code: { companyId: company.id, code: 'IT' } },
    update: {},
    create: { companyId: company.id, branchId: branch.id, code: 'IT', name: 'فناوری اطلاعات', kind: 'DEPARTMENT' },
  });
  const hrUnit = await prisma.orgUnit.upsert({
    where: { companyId_code: { companyId: company.id, code: 'HR' } },
    update: {},
    create: { companyId: company.id, branchId: branch.id, code: 'HR', name: 'منابع انسانی', kind: 'DEPARTMENT' },
  });

  const posManager = await prisma.position.upsert({
    where: { companyId_code: { companyId: company.id, code: 'MGR-01' } },
    update: {},
    create: { companyId: company.id, orgUnitId: itUnit.id, code: 'MGR-01', title: 'مدیر فناوری اطلاعات', grade: 'M1' },
  });
  const posDev = await prisma.position.upsert({
    where: { companyId_code: { companyId: company.id, code: 'DEV-01' } },
    update: {},
    create: { companyId: company.id, orgUnitId: itUnit.id, code: 'DEV-01', title: 'کارشناس نرم‌افزار', grade: 'P2' },
  });

  // تقویم و تعطیلات
  const calendar = await prisma.calendar.upsert({
    where: { companyId_name: { companyId: company.id, name: 'تقویم رسمی' } },
    update: {},
    create: { companyId: company.id, name: 'تقویم رسمی', weekendDays: '4,5' },
  });
  const holidayCount = await prisma.holiday.count({ where: { calendarId: calendar.id } });
  if (holidayCount === 0) {
    const y = new Date().getFullYear();
    await prisma.holiday.createMany({
      data: [
        { calendarId: calendar.id, date: new Date(`${y}-03-21`), name: 'نوروز' },
        { calendarId: calendar.id, date: new Date(`${y}-02-10`), name: 'قیام ۲۲ بهمن' },
        { calendarId: calendar.id, date: new Date(`${y}-04-01`), name: 'روز جمهوری اسلامی' },
      ],
    });
  }

  // انواع مرخصی
  const leaveTypes: { code: 'ANNUAL' | 'SICK' | 'UNPAID' | 'HOURLY' | 'MARRIAGE' | 'BEREAVEMENT'; name: string; quota: number }[] = [
    { code: 'ANNUAL', name: 'مرخصی استحقاقی سالانه', quota: 26 * 480 },
    { code: 'SICK', name: 'مرخصی استعلاجی', quota: 10 * 480 },
    { code: 'UNPAID', name: 'مرخصی بدون حقوق', quota: 0 },
    { code: 'HOURLY', name: 'مرخصی ساعتی', quota: 0 },
    { code: 'MARRIAGE', name: 'مرخصی ازدواج', quota: 3 * 480 },
    { code: 'BEREAVEMENT', name: 'مرخصی فوت بستگان', quota: 3 * 480 },
  ];
  for (const lt of leaveTypes) {
    await prisma.leaveType.upsert({
      where: { companyId_code: { companyId: company.id, code: lt.code } },
      update: { name: lt.name },
      create: {
        companyId: company.id,
        code: lt.code,
        name: lt.name,
        isPaid: lt.code !== 'UNPAID',
        annualQuotaMinutes: lt.quota,
        color: lt.code === 'ANNUAL' ? '#2563eb' : lt.code === 'SICK' ? '#dc2626' : '#64748b',
      },
    });
  }
  console.log('✅ انواع مرخصی ایجاد شد.');

  // شیفت پیش‌فرض
  await prisma.shift.upsert({
    where: { companyId_code: { companyId: company.id, code: 'STD-08' } },
    update: {},
    create: {
      companyId: company.id,
      code: 'STD-08',
      name: 'شیفت اداری ۸ تا ۱۶',
      kind: 'MORNING',
      startTime: '08:00',
      endTime: '16:00',
      durationMinutes: 480,
      breakMinutes: 60,
      isActive: true,
    },
  });

  // تنظیمات پایه
  const settings: { key: string; value: string; group: string; label: string; description?: string }[] = [
    { key: 'GENERAL.COMPANY_NAME', value: company.name, group: 'GENERAL', label: 'نام سازمان', description: 'نام نمایشی سازمان در سربرگ گزارش‌ها' },
    { key: 'GENERAL.DEFAULT_LANGUAGE', value: 'fa', group: 'GENERAL', label: 'زبان پیش‌فرض' },
    { key: 'LEAVES.AUTO_APPROVE_HOURLY', value: 'false', group: 'LEAVES', label: 'تأیید خودکار مرخصی ساعتی' },
    { key: 'ATTENDANCE.LATE_GRACE_MINUTES', value: '15', group: 'ATTENDANCE', label: 'حاشیهٔ تأخیر مجاز (دقیقه)' },
    { key: 'PAYROLL.OVERTIME_FACTOR', value: '1.4', group: 'PAYROLL', label: 'ضریب اضافه‌کاری' },
    { key: 'NOTIFICATIONS.EMAIL_ENABLED', value: 'true', group: 'NOTIFICATIONS', label: 'ارسال اعلان ایمیلی' },
  ];
  for (const s of settings) {
    await prisma.setting.upsert({
      where: { key: s.key },
      update: {},
      create: { key: s.key, value: s.value, group: s.group, label: s.label, description: s.description },
    });
  }

  // نیروی نمونه و کاربر آزمایشی
  const demoExists = await prisma.employee.findFirst({ where: { companyId: company.id, code: '1001' } });
  if (!demoExists) {
    const emp = await prisma.employee.create({
      data: {
        companyId: company.id,
        branchId: branch.id,
        orgUnitId: itUnit.id,
        positionId: posDev.id,
        code: '1001',
        firstName: 'علی',
        lastName: 'رضایی',
        nationalId: '0012345678',
        mobile: '09121112233',
        email: 'ali@example.com',
        employmentType: 'PERMANENT',
        hireDate: new Date('2024-04-01'),
        status: 'ACTIVE',
        monthlyBaseSalary: BigInt(320000000),
        gender: 'MALE',
      },
    });
    const empUser = await prisma.user.create({
      data: {
        username: 'ali',
        fullName: 'علی رضایی',
        email: 'ali@example.com',
        passwordHash: await hash(demoPassword('ali')),
        status: 'ACTIVE',
        employeeId: emp.id,
        userRoles: {
          create: { roleId: (await prisma.role.findUniqueOrThrow({ where: { code: 'EMPLOYEE' } })).id },
        },
        scopeAssignments: { create: { scopeType: 'EMPLOYEE', employeeId: emp.id } },
      },
    });
    await prisma.employee.update({ where: { id: emp.id }, data: { userId: empUser.id } });

    const mgr = await prisma.employee.create({
      data: {
        companyId: company.id,
        branchId: branch.id,
        orgUnitId: itUnit.id,
        positionId: posManager.id,
        managerId: null,
        code: '1000',
        firstName: 'مریم',
        lastName: 'احمدی',
        nationalId: '0098765432',
        mobile: '09125556677',
        employmentType: 'PERMANENT',
        hireDate: new Date('2021-01-15'),
        status: 'ACTIVE',
        monthlyBaseSalary: BigInt(580000000),
        gender: 'FEMALE',
      },
    });
    await prisma.employee.update({ where: { id: emp.id }, data: { managerId: mgr.id } });
    await prisma.user.create({
      data: {
        username: 'maryam',
        fullName: 'مریم احمدی',
        passwordHash: await hash(demoPassword('maryam')),
        status: 'ACTIVE',
        employeeId: mgr.id,
        userRoles: { create: { roleId: (await prisma.role.findUniqueOrThrow({ where: { code: 'MANAGER' } })).id } },
        scopeAssignments: { create: { scopeType: 'ORG_UNIT', orgUnitId: itUnit.id } },
      },
    });
    await prisma.orgUnit.update({ where: { id: itUnit.id }, data: { managerId: mgr.id } });
    console.log('✅ دادهٔ نمونه: نیروها و کاربران آزمایشی ایجاد شد.');
  } else {
    console.log('ℹ️ دادهٔ نمونه از قبل موجود است.');
  }

  console.log('🌱 Seed با موفقیت پایان یافت.');
  console.log('   ورود مدیر: username =', adminUsername);
}

main()
  .catch((e) => {
    console.error('❌ خطا در Seed:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
