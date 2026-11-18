/**
 * QA Seed Script for Sana HRMS
 * Creates realistic fake data for end-to-end testing:
 * - 3 companies
 * - 2 branches each (6 total)
 * - ~20 org units per company (60 total)
 * - 5,000 employees total (~833 per company)
 * - Users for every role (SUPER_ADMIN, HR_ADMIN, MANAGER, EMPLOYEE)
 *
 * Run: npx ts-node --transpile-only prisma/seed-qa.ts
 */
import { PrismaClient, Prisma } from '@prisma/client';
import { hash } from '@node-rs/argon2';
import { faker } from '@faker-js/faker';

const prisma = new PrismaClient();

const DAY = 24 * 60 * 60 * 1000;
const now = new Date();
const daysAgo = (n: number) => new Date(now.getTime() - n * DAY);
const daysAhead = (n: number) => new Date(now.getTime() + n * DAY);
const at = (d: Date, h: number, m = 0) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m, 0, 0);
const dateOnly = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const RIAL = (n: number) => BigInt(n);

const COMPANY_COUNT = 3;
const BRANCHES_PER_COMPANY = 2;
const ORG_UNITS_PER_COMPANY = 20;
const EMPLOYEES_PER_COMPANY = 1700;

const POSITION_TITLES = [
  { title: 'مدیر ارشد', grade: 'M3' },
  { title: 'مدیر', grade: 'M2' },
  { title: 'سرپرست', grade: 'M1' },
  { title: 'کارشناس ارشد', grade: 'P3' },
  { title: 'کارشناس', grade: 'P2' },
  { title: 'کارشناس млад', grade: 'P1' },
  { title: 'تکنسین', grade: 'T2' },
  { title: 'عملیات', grade: 'O1' },
];

const ORG_UNIT_KINDS = ['DEPARTMENT', 'UNIT', 'TEAM', 'DIVISION'];
const BRANCH_KINDS = ['HQ', 'BRANCH'];

const LEAVE_TYPES = [
  { code: 'ANNUAL', name: 'مرخصی استحقاقی سالانه', quota: 26 * 480, color: '#2563eb', paid: true },
  { code: 'SICK', name: 'مرخصی استعلاجی', quota: 10 * 480, color: '#dc2626', paid: true },
  { code: 'UNPAID', name: 'مرخصی بدون حقوق', quota: 0, color: '#64748b', paid: false },
  { code: 'HOURLY', name: 'مرخصی ساعتی', quota: 0, color: '#f59e0b', paid: true },
  { code: 'MARRIAGE', name: 'مرخصی ازدواج', quota: 3 * 480, color: '#ec4899', paid: true },
  { code: 'BEREAVEMENT', name: 'مرخصی فوت بستگان', quota: 3 * 480, color: '#0f172a', paid: true },
];

const SHIFT_DEFS = [
  { code: 'STD-08', name: 'شیفت اداری ۸ تا ۱۶', kind: 'MORNING' as const, start: '08:00', end: '16:00', duration: 480, break: 60 },
  { code: 'STD-09', name: 'شیفت اداری ۹ تا ۱۷', kind: 'MORNING' as const, start: '09:00', end: '17:00', duration: 480, break: 60 },
  { code: 'SHIFT-14', name: 'شیفت عصر ۱۴ تا ۲۲', kind: 'EVENING' as const, start: '14:00', end: '22:00', duration: 480, break: 45 },
  { code: 'NIGHT-22', name: 'شیفت شب ۲۲ تا ۶', kind: 'NIGHT' as const, start: '22:00', end: '06:00', duration: 480, break: 45 },
];

const EMPLOYMENT_TYPES = ['PERMANENT', 'CONTRACTUAL', 'TEMPORARY', 'INTERN', 'PROJECT'];
const EMPLOYMENT_WEIGHTS = [0.7, 0.15, 0.05, 0.05, 0.05];

const GENDERS = ['MALE', 'FEMALE'];
const MARITAL_STATUSES = ['SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED'];
const MARITAL_WEIGHTS = [0.35, 0.55, 0.08, 0.02];

const PAY_COMPONENTS = [
  { code: 'BASE_SALARY', name: 'حقوق پایه', type: 'EARNING', calc: 'FIXED', amount: 0 },
  { code: 'HOUSING', name: 'حق مسکن', type: 'EARNING', calc: 'FIXED', amount: 2_000_000 },
  { code: 'FOOD', name: 'حق خوراک', type: 'EARNING', calc: 'FIXED', amount: 1_500_000 },
  { code: 'CHILD', name: 'حق اولاد', type: 'EARNING', calc: 'FIXED', amount: 3_000_000 },
  { code: 'SENIORITY', name: 'سنوات', type: 'EARNING', calc: 'PERCENT', amount: 5 },
  { code: 'OVERTIME', name: 'اضافه‌کاری', type: 'EARNING', calc: 'HOURLY', amount: 0 },
  { code: 'TAX', name: 'مالیات بر درآمد', type: 'DEDUCTION', calc: 'PERCENT', amount: 10 },
  { code: 'INSURANCE', name: 'بیمه تأمین اجتماعی', type: 'DEDUCTION', calc: 'PERCENT', amount: 7 },
  { code: 'LOAN', name: 'اقساط وام', type: 'DEDUCTION', calc: 'FIXED', amount: 0 },
];

const APPROVAL_FLOWS = [
  { code: 'LEAVE-FLOW', name: 'گردش تأیید مرخصی', subject: 'LEAVE', steps: ['سرپرست واحد', 'مدیر منابع انسانی'] },
  { code: 'OVERTIME-FLOW', name: 'گردش تأیید اضافه‌کاری', subject: 'OVERTIME', steps: ['سرپرست واحد'] },
  { code: 'LOAN-FLOW', name: 'گردش تأیید وام', subject: 'LOAN', steps: ['مدیر منابع انسانی', 'مدیر مالی'] },
  { code: 'MISSION-FLOW', name: 'گردش تأیید مأموریت', subject: 'MISSION', steps: ['سرپرست واحد'] },
];

const BENEFIT_TYPES = [
  { code: 'MEAL', name: 'کمک هزینه غذا', desc: 'سهم ماهانهٔ ناهار', share: 4_000_000 },
  { code: 'TRANSPORT', name: 'کمک هزینه رفت‌وآمد', desc: 'سهم ماهانهٔ ایاب و ذهاب', share: 2_500_000 },
  { code: 'PHONE', name: 'کمک هزینه تلفن', desc: 'مشارکت هزینهٔ تلفن همراه', share: 500_000 },
  { code: 'CHILDCARE', name: 'کمک هزینه نگهداری کودک', desc: 'مزایای خانواده دارای فرزند', share: 3_000_000 },
];

const DOCUMENT_TYPES = ['NATIONAL_ID', 'BIRTH_CERTIFICATE', 'DEGREE', 'WORK_EXPERIENCE', 'CONTRACT', 'NDA', 'CERTIFICATE', 'RESUME', 'OTHER'];

function weightedRandom<T>(items: T[], weights: number[]): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

function randomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function generateNationalId(): string {
  return String(faker.number.int({ min: 1000000000, max: 9999999999 }));
}

function generateMobile(): string {
  return '09' + String(faker.number.int({ min: 100000000, max: 999999999 }));
}

function generateSheba(accountNum: string): string {
  return 'IR620170000000' + accountNum.padStart(10, '0');
}

async function main() {
  console.log('🌱 Starting QA Seed - Creating comprehensive test dataset...');
  const startTime = Date.now();

  // Set Persian locale for faker
  faker.locale = 'fa';

  // ------------------------------------------------------------------
  // 1) Create Companies
  // ------------------------------------------------------------------
  const companies = [];
  for (let i = 0; i < COMPANY_COUNT; i++) {
    const companyCode = `COMP-${String(i + 1).padStart(3, '0')}`;
    const company = await prisma.company.upsert({
      where: { code: companyCode },
      update: {},
      create: {
        code: companyCode,
        name: `شرکت ${faker.company.name()} ${i + 1}`,
        legalName: `شرکت ${faker.company.name()} (سهامی خاص) ${i + 1}`,
        nationalId: String(faker.number.int({ min: 10000000000, max: 99999999999 })),
        phone: `021-${faker.number.int({ min: 10000000, max: 99999999 })}`,
        email: `info@comp${i + 1}-example.ir`,
        address: faker.location.streetAddress({ useFullAddress: true }),
        isHolding: i === 0,
      },
    });
    companies.push(company);
    console.log(`✅ Company ${i + 1}/${COMPANY_COUNT}: ${company.name}`);
  }

  // ------------------------------------------------------------------
  // 2) For each company: branches, org units, positions, calendars, etc.
  // ------------------------------------------------------------------
  for (let companyIndex = 0; companyIndex < companies.length; companyIndex++) {
    const company = companies[companyIndex];
    const companyId = company.id;
    console.log(`\n🏢 Processing company: ${company.name} (${companyId.slice(0, 8)}...)`);

    // Branches
    const branches = [];
    for (let b = 0; b < BRANCHES_PER_COMPANY; b++) {
      const branchCode = b === 0 ? 'HQ' : `BR-${String(b).padStart(3, '0')}`;
      const branch = await prisma.branch.upsert({
        where: { companyId_code: { companyId, code: branchCode } },
        update: {},
        create: {
          companyId,
          code: branchCode,
          name: b === 0 ? 'دفتر مرکزی' : `شعبه ${faker.location.city()}`,
          kind: b === 0 ? 'HQ' : 'BRANCH',
          address: faker.location.streetAddress({ useFullAddress: true }),
          phone: `0${faker.number.int({ min: 21, max: 99 })}-${faker.number.int({ min: 10000000, max: 99999999 })}`,
        },
      });
      branches.push(branch);
    }
    const hqBranch = branches[0];
    console.log(`  📍 Branches: ${branches.length}`);

    // Work Location
    let workLocation = await prisma.workLocation.findFirst({ where: { companyId, code: 'LOC-HQ' } });
    if (!workLocation) {
      workLocation = await prisma.workLocation.create({
        data: {
          companyId,
          branchId: hqBranch.id,
          code: 'LOC-HQ',
          name: 'ساختمان اصلی',
          address: faker.location.streetAddress({ useFullAddress: true }),
          latitude: 35.7 + Math.random() * 0.5,
          longitude: 51.3 + Math.random() * 0.5,
          radiusMeters: 150,
        },
      });
    }

    // Cost Centers
    const costCenters = [];
    for (let c = 0; c < 5; c++) {
      const cc = await prisma.costCenter.upsert({
        where: { companyId_code: { companyId, code: `CC-${String(c + 1).padStart(3, '0')}` } },
        update: {},
        create: { companyId, code: `CC-${String(c + 1).padStart(3, '0')}`, name: `مرکز هزینه ${faker.commerce.department()}` },
      });
      costCenters.push(cc);
    }

    // Calendar & Holidays
    const calendar = await prisma.calendar.upsert({
      where: { companyId_name: { companyId, name: 'تقویم رسمی' } },
      update: {},
      create: { companyId, name: 'تقویم رسمی', weekendDays: '4,5' }, // Thu, Fri
    });
    if ((await prisma.holiday.count({ where: { calendarId: calendar.id } })) === 0) {
      const y = now.getFullYear();
      const holidays = [
        { date: new Date(`${y}-03-21`), name: 'نوروز' },
        { date: new Date(`${y}-02-10`), name: 'پیروزی انقلاب اسلامی' },
        { date: new Date(`${y}-03-22`), name: 'عید نوروز (روز دوم)' },
        { date: new Date(`${y}-04-01`), name: 'عید سعید فطر' },
        { date: new Date(`${y}-06-04`), name: 'عید غدیر خم' },
        { date: new Date(`${y}-12-29`), name: 'روز ملی شدن صنعت نفت' },
      ];
      await prisma.holiday.createMany({ data: holidays.map(h => ({ calendarId: calendar.id, date: h.date, name: h.name })) });
    }

    // Leave Types
    const leaveTypeMap = new Map<string, string>();
    for (const lt of LEAVE_TYPES) {
      const row = await prisma.leaveType.upsert({
        where: { companyId_code: { companyId, code: lt.code } },
        update: {},
        create: { companyId, code: lt.code, name: lt.name, isPaid: lt.paid, annualQuotaMinutes: lt.quota, color: lt.color, maxDailyMinutes: 480 },
      });
      leaveTypeMap.set(lt.code, row.id);
    }

    // Shifts
    const shiftMap = new Map<string, string>();
    for (const s of SHIFT_DEFS) {
      const row = await prisma.shift.upsert({
        where: { companyId_code: { companyId, code: s.code } },
        update: {},
        create: { companyId, code: s.code, name: s.name, kind: s.kind, startTime: s.start, endTime: s.end, durationMinutes: s.duration, breakMinutes: s.break, color: s.kind === 'MORNING' ? '#2563eb' : s.kind === 'EVENING' ? '#f59e0b' : '#0f172a', capacity: 100 },
      });
      shiftMap.set(s.code, row.id);
    }

    // Org Units (20 per company)
    const orgUnits = [];
    const unitCodes = [
      'HR', 'IT', 'FIN', 'SALES', 'OPS', 'MKT', 'RND', 'LEGAL', 'ADMIN', 'PROC',
      'QA', 'DEV', 'INFRA', 'SEC', 'CS', 'LOG', 'WH', 'FLEET', 'MAINT', 'SAFE'
    ];
    for (let u = 0; u < ORG_UNITS_PER_COMPANY; u++) {
      const branch = branches[u % branches.length];
      const kind = u < 10 ? 'DEPARTMENT' : 'UNIT';
      const row = await prisma.orgUnit.upsert({
        where: { companyId_code: { companyId, code: unitCodes[u] } },
        update: { name: faker.commerce.department(), kind: kind as any },
        create: { companyId, branchId: branch.id, code: unitCodes[u], name: faker.commerce.department(), kind: kind as any },
      });
      orgUnits.push(row);
    }
    console.log(`  🏬 Org Units: ${orgUnits.length}`);

    // Positions (multiple per org unit)
    const positionMap = new Map<string, string>();
    for (const unit of orgUnits) {
      const posCount = faker.number.int({ min: 2, max: 4 });
      for (let p = 0; p < posCount; p++) {
        const posDef = POSITION_TITLES[p % POSITION_TITLES.length];
        const posCode = `${unit.code}-${String(p + 1).padStart(2, '0')}`;
        const row = await prisma.position.upsert({
          where: { companyId_code: { companyId, code: posCode } },
          update: { title: posDef.title, grade: posDef.grade },
          create: { companyId, orgUnitId: unit.id, code: posCode, title: posDef.title, grade: posDef.grade },
        });
        positionMap.set(posCode, row.id);
      }
    }
    console.log(`  💼 Positions: ${positionMap.size}`);

    // Pay Components
    const componentMap = new Map<string, string>();
    for (const [i, c] of PAY_COMPONENTS.entries()) {
      const row = await prisma.payComponent.upsert({
        where: { companyId_code: { companyId, code: c.code } },
        update: {},
        create: { companyId, code: c.code, name: c.name, type: c.type as any, calculationType: c.calc as any, amount: RIAL(c.amount), isTaxable: c.type === 'EARNING', sortOrder: i },
      });
      componentMap.set(c.code, row.id);
    }

    // Approval Flows
    const flowMap = new Map<string, string>();
    for (const f of APPROVAL_FLOWS) {
      const flow = await prisma.approvalFlow.upsert({
        where: { code: f.code },
        update: {},
        create: { companyId, code: f.code, name: f.name, subjectType: f.subject as any, description: `گردش پیش‌فرض ${f.name}` },
      });
      flowMap.set(f.code, flow.id);
      const existingSteps = await prisma.approvalStep.count({ where: { flowId: flow.id } });
      if (existingSteps === 0) {
        for (const [i, stepName] of f.steps.entries()) {
          await prisma.approvalStep.create({
            data: { flowId: flow.id, stepOrder: i + 1, name: stepName, approverType: 'ROLE', approverRoleCode: i === 0 ? 'MANAGER' : 'HR_ADMIN', slaHours: 48 },
          });
        }
      }
    }

    // Benefits
    const benefitMap = new Map<string, string>();
    for (const b of BENEFIT_TYPES) {
      const row = await prisma.benefitType.upsert({
        where: { companyId_code: { companyId, code: b.code } },
        update: {},
        create: { companyId, code: b.code, name: b.name, description: b.desc },
      });
      benefitMap.set(b.code, row.id);
    }
    let benefitPackage = await prisma.benefitPackage.findFirst({ where: { companyId } });
    if (!benefitPackage) {
      benefitPackage = await prisma.benefitPackage.create({
        data: { companyId, name: 'بستهٔ مزایای پایه', description: 'مزایای مشترک کارکنان رسمی' },
      });
    }
    if ((await prisma.benefitPackageItem.count({ where: { packageId: benefitPackage.id } })) === 0) {
      for (const [code, share] of [['MEAL', 4_000_000], ['TRANSPORT', 2_500_000], ['PHONE', 500_000], ['CHILDCARE', 3_000_000]] as const) {
        await prisma.benefitPackageItem.create({
          data: { packageId: benefitPackage.id, benefitTypeId: benefitMap.get(code)!, companyShare: RIAL(share), employeeShare: RIAL(0), period: 'MONTHLY' },
        });
      }
    }

    // Settings
    const settingsDefs = [
      { key: 'GENERAL.COMPANY_NAME', value: company.name, group: 'GENERAL', label: 'نام سازمان' },
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
        create: { key: s.key, value: s.value, group: s.group, label: s.label },
      });
    }

    // ------------------------------------------------------------------
    // 3) Create Users and Roles
    // ------------------------------------------------------------------
    const roleCodes = ['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE'];
    const roles = new Map<string, string>();
    for (const code of roleCodes) {
      const r = await prisma.role.findUnique({ where: { code } });
      if (r) roles.set(code, r.id);
    }

    // Admin user (SUPER_ADMIN)
    const adminUser = await prisma.user.upsert({
      where: { username: 'admin' },
      update: {},
      create: {
        username: 'admin',
        fullName: 'مدیر سیستم',
        email: 'admin@sana-hrms.ir',
        passwordHash: await hash('SanaAdmin@2026!'),
        status: 'ACTIVE',
        isSuperAdmin: true,
        userRoles: { create: { roleId: roles.get('SUPER_ADMIN')! } },
        scopeAssignments: { create: { scopeType: 'ALL' } },
      },
    });

    // Company-level users
    const hrAdminUser = await prisma.user.upsert({
      where: { username: `hradmin_${company.code.toLowerCase()}` },
      update: {},
      create: {
        username: `hradmin_${company.code.toLowerCase()}`,
        fullName: `مدیر منابع انسانی ${company.name}`,
        email: `hradmin@${company.code.toLowerCase()}.ir`,
        passwordHash: await hash('SanaDemo@1404'),
        status: 'ACTIVE',
        userRoles: { create: { roleId: roles.get('HR_ADMIN')! } },
        scopeAssignments: { create: { scopeType: 'COMPANY', companyId } },
      },
    });

    // Branch managers
    const branchManagers = new Map<string, string>();
    for (const branch of branches) {
      const mgrUser = await prisma.user.upsert({
        where: { username: `mgr_${branch.code.toLowerCase()}_${company.code.toLowerCase()}` },
        update: {},
        create: {
          username: `mgr_${branch.code.toLowerCase()}_${company.code.toLowerCase()}`,
          fullName: `مدیر ${branch.name}`,
          email: `mgr_${branch.code.toLowerCase()}@${company.code.toLowerCase()}.ir`,
          passwordHash: await hash('SanaDemo@1404'),
          status: 'ACTIVE',
          userRoles: { create: { roleId: roles.get('MANAGER')! } },
          scopeAssignments: { create: { scopeType: 'BRANCH', branchId: branch.id } },
        },
      });
      branchManagers.set(branch.id, mgrUser.id);
    }

    // Org unit managers (some)
    const orgUnitManagers = new Map<string, string>();
    for (const unit of orgUnits.slice(0, 10)) {
      const mgrUser = await prisma.user.upsert({
        where: { username: `oumgr_${unit.code.toLowerCase()}_${company.code.toLowerCase()}` },
        update: {},
        create: {
          username: `oumgr_${unit.code.toLowerCase()}_${company.code.toLowerCase()}`,
          fullName: `سرپرست ${unit.name}`,
          email: `oumgr_${unit.code.toLowerCase()}@${company.code.toLowerCase()}.ir`,
          passwordHash: await hash('SanaDemo@1404'),
          status: 'ACTIVE',
          userRoles: { create: { roleId: roles.get('MANAGER')! } },
          scopeAssignments: { create: { scopeType: 'ORG_UNIT', orgUnitId: unit.id } },
        },
      });
      orgUnitManagers.set(unit.id, mgrUser.id);
    }

    // ------------------------------------------------------------------
    // 4) Create Employees (5000 total across all companies)
    // ------------------------------------------------------------------
    console.log(`  👥 Creating ${EMPLOYEES_PER_COMPANY} employees...`);
    const employees = [];
    const employeeUsers = new Map<string, string>();
    const employeeCodes = new Set<string>();
    let empSeq = 10000 + companyIndex * 10000;

    const positionIds = Array.from(positionMap.values());
    const branchIds = branches.map(b => b.id);
    const orgUnitIds = orgUnits.map(u => u.id);
    const costCenterIds = costCenters.map(c => c.id);

    // First create some managers to reference
    const managerCandidates: string[] = [];

    for (let i = 0; i < EMPLOYEES_PER_COMPANY; i++) {
      if (i % 500 === 0) console.log(`    Progress: ${i}/${EMPLOYEES_PER_COMPANY}`);

      const branchId = faker.helpers.arrayElement(branchIds);
      const orgUnitId = faker.helpers.arrayElement(orgUnitIds);
      const positionId = faker.helpers.arrayElement(positionIds);
      const costCenterId = faker.helpers.arrayElement(costCenterIds);

      const empCode = String(++empSeq);
      while (employeeCodes.has(empCode)) {
        empSeq++;
      }
      employeeCodes.add(empCode);

      const firstName = faker.person.firstName();
      const lastName = faker.person.lastName();
      const gender = weightedRandom(GENDERS, [0.5, 0.5]);
      const maritalStatus = weightedRandom(MARITAL_STATUSES, MARITAL_WEIGHTS);
      const employmentType = weightedRandom(EMPLOYMENT_TYPES, EMPLOYMENT_WEIGHTS);

      // Salary based on position grade
      const position = await prisma.position.findUnique({ where: { id: positionId } });
      const baseSalary = position?.grade?.startsWith('M') ? faker.number.int({ min: 700_000_000, max: 1_500_000_000 })
        : position?.grade?.startsWith('P') ? faker.number.int({ min: 300_000_000, max: 800_000_000 })
        : faker.number.int({ min: 150_000_000, max: 400_000_000 });

      const hireDate = randomDate(daysAgo(365 * 10), daysAgo(30));
      const birthDate = randomDate(new Date(hireDate.getFullYear() - 60), new Date(hireDate.getFullYear() - 20));

      const emp = await prisma.employee.upsert({
        where: { companyId_code: { companyId, code: empCode } },
        update: {},
        create: {
          companyId,
          branchId,
          orgUnitId,
          positionId,
          workLocationId: workLocation.id,
          costCenterId,
          code: empCode,
          nationalId: generateNationalId(),
          firstName,
          lastName,
          fatherName: faker.person.firstName(),
          birthDate,
          birthPlace: faker.location.city(),
          gender: gender as any,
          maritalStatus: maritalStatus as any,
          mobile: generateMobile(),
          email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${empSeq}@${company.code.toLowerCase()}.ir`,
          address: faker.location.streetAddress({ useFullAddress: true }),
          emergencyName: `${faker.person.firstName()} ${faker.person.lastName()}`,
          emergencyPhone: generateMobile(),
          employmentType: employmentType as any,
          hireDate,
          status: 'ACTIVE',
          monthlyBaseSalary: RIAL(baseSalary),
        },
      });
      employees.push(emp);
      managerCandidates.push(emp.id);

      // Position history
      await prisma.employeePosition.create({
        data: {
          employeeId: emp.id,
          positionId,
          orgUnitId,
          companyId,
          startDate: hireDate,
          changeType: 'HIRE',
          note: 'انتصاب اولیه',
        },
      });

      // Bank account
      await prisma.bankAccount.create({
        data: {
          employeeId: emp.id,
          bankName: faker.helpers.arrayElement(['بانک ملت', 'بانک ملی', 'بانک صادرات', 'بانک تجارت', 'بانک تچارات', 'بانک اقتصاد نوین']),
          accountNumber: `IR620170000000${empCode.padStart(10, '0')}`,
          sheba: `IR620170000000${empCode.padStart(10, '0')}`,
          cardNumber: `621986${empCode.padStart(10, '0')}`,
          isPrimary: true,
        },
      });

      // Skills (0-3)
      for (let s = 0; s < faker.number.int({ min: 0, max: 3 }); s++) {
        await prisma.employeeSkill.create({
          data: { employeeId: emp.id, skill: faker.person.jobDescriptor(), level: faker.number.int({ min: 1, max: 5 }) },
        });
      }

      // Benefits
      if (Math.random() < 0.8) {
        await prisma.employeeBenefit.create({
          data: {
            employeeId: emp.id,
            benefitTypeId: benefitMap.get('MEAL')!,
            packageId: benefitPackage.id,
            startDate: dateOnly(randomDate(hireDate, now)),
            status: 'ACTIVE',
          },
        });
      }

      // Create user account for ~30% of employees
      if (Math.random() < 0.3) {
        const userRole = Math.random() < 0.05 ? 'MANAGER' : 'EMPLOYEE';
        const scopeType = userRole === 'MANAGER' ? 'ORG_UNIT' : 'EMPLOYEE';
        const scopeData: any = { scopeType };
        if (scopeType === 'ORG_UNIT') scopeData.orgUnitId = orgUnitId;
        else scopeData.employeeId = emp.id;

        const username = `${firstName.toLowerCase()}_${lastName.toLowerCase()}_${empCode}`.substring(0, 50);
        const existingUser = await prisma.user.findFirst({ where: { OR: [{ username }, { email: emp.email }] } });
        let user;
        if (existingUser) {
          user = existingUser;
          await prisma.user.update({
            where: { id: user.id },
            data: {
              userRoles: { create: { roleId: roles.get(userRole)! } },
              scopeAssignments: { create: scopeData },
            },
          });
        } else {
          user = await prisma.user.create({
            data: {
              username,
              fullName: `${firstName} ${lastName}`,
              email: emp.email,
              passwordHash: await hash('SanaDemo@1404'),
              status: 'ACTIVE',
              employeeId: emp.id,
              userRoles: { create: { roleId: roles.get(userRole)! } },
              scopeAssignments: { create: scopeData },
            },
          });
        }
        employeeUsers.set(emp.id, user.id);
        await prisma.employee.update({ where: { id: emp.id }, data: { userId: user.id } });
      }

      // Leave transactions (annual grant)
      if (i % 5 === 0) {
        await prisma.leaveTransaction.create({
          data: {
            employeeId: emp.id,
            leaveTypeId: leaveTypeMap.get('ANNUAL')!,
            type: 'GRANT',
            minutes: 26 * 480,
            sourceType: 'YEARLY_GRANT',
            occurredAt: daysAgo(365),
            note: 'اعتبار سالانه مرخصی استحقاقی',
          },
        });
      }
    }
    console.log(`  ✅ Employees created: ${employees.length}`);

    // ------------------------------------------------------------------
    // 5) Set Managers (hierarchy)
    // ------------------------------------------------------------------
    console.log(`  🔗 Setting up manager hierarchy...`);
    for (let i = 0; i < employees.length; i++) {
      if (i < 50) continue; // Top 50 have no manager (executives)
      const managerPool = managerCandidates.slice(0, i).filter(m => m !== employees[i].id);
      if (managerPool.length === 0) continue;
      const managerId = faker.helpers.arrayElement(managerPool);
      await prisma.employee.update({
        where: { id: employees[i].id },
        data: { managerId },
      });
    }

    // Set org unit managers
    for (const unit of orgUnits) {
      const unitEmployees = employees.filter(e => e.orgUnitId === unit.id);
      if (unitEmployees.length > 0) {
        const mgr = unitEmployees.find(e => employeeUsers.has(e.id)) || unitEmployees[0];
        await prisma.orgUnit.update({ where: { id: unit.id }, data: { managerId: mgr.id } });
      }
    }

    // ------------------------------------------------------------------
    // 6) Contracts
    // ------------------------------------------------------------------
    console.log(`  📄 Creating contracts...`);
    for (const emp of employees) {
      const hasContract = await prisma.contract.findFirst({ where: { employeeId: emp.id } });
      if (hasContract) continue;

      const contract = await prisma.contract.create({
        data: { employeeId: emp.id, companyId, currentVersion: 1, status: 'ACTIVE' },
      });

      const contractType = emp.employmentType === 'INTERN' ? 'INTERN' : emp.employmentType === 'CONTRACTUAL' ? 'FIXED' : 'PERMANENT';
      await prisma.contractVersion.create({
        data: {
          contractId: contract.id,
          version: 1,
          contractType: contractType as any,
          startDate: emp.hireDate,
          endDate: contractType === 'PERMANENT' ? null : new Date(emp.hireDate.getTime() + 365 * DAY),
          effectiveDate: emp.hireDate,
          baseSalary: emp.monthlyBaseSalary,
          housingAllowance: RIAL(2_000_000),
          foodAllowance: RIAL(1_500_000),
          childAllowance: RIAL(3_000_000),
          seniorityPay: RIAL(Math.round(Number(emp.monthlyBaseSalary) * 0.05)),
          workHoursPerDay: 8,
          workHoursPerMonth: 220,
          terms: 'قرارداد بر اساس قوانین کار و مقررات داخلی سازمان.',
          createdById: adminUser.id,
        },
      });
    }

    // ------------------------------------------------------------------
    // 7) Attendance Records (45 days)
    // ------------------------------------------------------------------
    console.log(`  ⏰ Creating attendance records (45 days)...`);

    for (let d = 45; d >= 0; d--) {
      const day = daysAgo(d);
      if (day.getDay() === 5) continue; // Friday

      for (const emp of employees) {
        const seed = (Number(emp.code) + d) % 13;
        const status = seed === 0 ? 'ABSENT' : seed === 1 ? 'LEAVE' : seed === 2 ? 'REMOTE' : seed === 3 ? 'MISSION' : 'COMPLETE';
        const inTime = at(day, 8, (seed * 7) % 40);
        const lateMinutes = status === 'COMPLETE' && seed > 4 ? seed * 5 : 0;
        const outTime = at(day, 17, seed % 50);
        const workMinutes = (status === 'COMPLETE' || status === 'REMOTE') ? 480 - lateMinutes : 0;

        await prisma.attendanceRecord.upsert({
          where: { employeeId_workDate: { employeeId: emp.id, workDate: dateOnly(day) } },
          update: {},
          create: {
            employeeId: emp.id,
            workDate: dateOnly(day),
            firstIn: workMinutes ? inTime : null,
            lastOut: workMinutes ? outTime : null,
            workMinutes,
            overtimeMinutes: seed === 5 ? 60 : seed === 6 ? 90 : 0,
            lateMinutes,
            earlyLeaveMinutes: seed === 7 ? 30 : 0,
            absenceMinutes: status === 'ABSENT' ? 480 : 0,
            absenceType: status === 'ABSENT' ? 'UNEXCUSED' : null,
            status: status as any,
            isRemote: status === 'REMOTE',
            note: status === 'ABSENT' ? 'عدم حضور بدون اطلاع' : status === 'LEAVE' ? 'در مرخصی' : null,
          },
        });
      }
    }

    // ------------------------------------------------------------------
    // 8) Shift Assignments (14 days)
    // ------------------------------------------------------------------
    console.log(`  📅 Creating shift assignments (14 days)...`);
    const shiftCodes = Array.from(shiftMap.keys());
    for (let d = 14; d >= 0; d--) {
      const day = daysAgo(d);
      if (day.getDay() === 5) continue;

      for (const emp of employees) {
        const shiftCode = faker.helpers.arrayElement(shiftCodes);
        await prisma.shiftAssignment.upsert({
          where: { shiftId_employeeId_workDate: { shiftId: shiftMap.get(shiftCode)!, employeeId: emp.id, workDate: dateOnly(day) } },
          update: { status: d === 0 ? 'PLANNED' : 'COMPLETED' },
          create: {
            shiftId: shiftMap.get(shiftCode)!,
            employeeId: emp.id,
            workDate: dateOnly(day),
            status: d === 0 ? 'PLANNED' : 'COMPLETED',
          },
        });
      }
    }

    // ------------------------------------------------------------------
    // 9) Leave Requests
    // ------------------------------------------------------------------
    console.log(`  🏖️ Creating leave requests...`);
    const leaveStatuses = ['DRAFT', 'SUBMITTED', 'PENDING_SUPERVISOR', 'APPROVED', 'REJECTED', 'CANCELLED'];
    for (let i = 0; i < 50; i++) {
      const emp = faker.helpers.arrayElement(employees);
      const leaveTypeCode = faker.helpers.arrayElement(LEAVE_TYPES).code;
      const start = randomDate(daysAgo(60), daysAhead(30));
      const days = faker.number.int({ min: 1, max: 5 });
      const end = new Date(start.getTime() + (days - 1) * DAY);

      const status = faker.helpers.arrayElement(leaveStatuses);
      const request = await prisma.leaveRequest.create({
        data: {
          employeeId: emp.id,
          leaveTypeId: leaveTypeMap.get(leaveTypeCode)!,
          startAt: at(start, 8),
          endAt: at(end, 16),
          durationMinutes: days * 480,
          status: status as any,
          reason: faker.lorem.sentence({ min: 3, max: 10 }),
          decidedAt: status === 'APPROVED' || status === 'REJECTED' ? randomDate(start, now) : null,
        },
      });

      if (status === 'APPROVED') {
        await prisma.leaveTransaction.create({
          data: {
            employeeId: emp.id,
            leaveTypeId: leaveTypeMap.get(leaveTypeCode)!,
            type: 'CONSUME',
            minutes: days * 480,
            sourceType: 'LEAVE_REQUEST',
            sourceId: request.id,
            occurredAt: start,
            note: 'مرخصی تأییدشده',
          },
        });
      }
    }

    // ------------------------------------------------------------------
    // 10) Payroll Periods & Payslips (3 months)
    // ------------------------------------------------------------------
    console.log(`  💰 Creating payroll periods...`);
    for (let m = 3; m >= 1; m--) {
      const ref = new Date(now.getFullYear(), now.getMonth() - m, 1);
      const year = ref.getFullYear();
      const month = ref.getMonth() + 1;

      const period = await prisma.payrollPeriod.upsert({
        where: { companyId_year_month: { companyId, year, month } },
        update: {
          status: m === 1 ? 'REVIEWED' : 'LOCKED',
          lockedAt: m === 1 ? null : daysAgo(m * 30),
          lockedById: m === 1 ? null : adminUser.id,
          generatedAt: daysAgo(m * 30),
        },
        create: {
          companyId,
          year,
          month,
          status: m === 1 ? 'REVIEWED' : 'LOCKED',
          lockedAt: m === 1 ? null : daysAgo(m * 30),
          lockedById: m === 1 ? null : adminUser.id,
          generatedAt: daysAgo(m * 30),
        },
      });

      let totalGross = 0n;
      let totalNet = 0n;

      for (const emp of employees) {
        const gross = emp.monthlyBaseSalary;
        const housing = RIAL(2_000_000);
        const food = RIAL(1_500_000);
        const senior = RIAL(Math.round(Number(emp.monthlyBaseSalary) * 0.05));
        const tax = RIAL(Math.round(Number(emp.monthlyBaseSalary) * 0.1));
        const insurance = RIAL(Math.round(Number(emp.monthlyBaseSalary) * 0.07));

        const rows = [
          { componentId: componentMap.get('BASE_SALARY')!, amount: gross },
          { componentId: componentMap.get('HOUSING')!, amount: housing },
          { componentId: componentMap.get('FOOD')!, amount: food },
          { componentId: componentMap.get('SENIORITY')!, amount: senior },
          { componentId: componentMap.get('TAX')!, amount: tax },
          { componentId: componentMap.get('INSURANCE')!, amount: insurance },
        ];

        for (const r of rows) {
          await prisma.payrollItem.upsert({
            where: { periodId_employeeId_componentId: { periodId: period.id, employeeId: emp.id, componentId: r.componentId } },
            update: { amount: r.amount },
            create: { periodId: period.id, employeeId: emp.id, componentId: r.componentId, amount: r.amount },
          });
        }

        const empGross = gross + housing + food + senior;
        const empDeduction = tax + insurance;
        totalGross += empGross;
        totalNet += empGross - empDeduction;

        await prisma.payslip.upsert({
          where: { periodId_employeeId: { periodId: period.id, employeeId: emp.id } },
          update: {
            grossAmount: empGross,
            deductionAmount: empDeduction,
            netAmount: empGross - empDeduction,
            status: m === 1 ? 'DRAFT' : 'PUBLISHED',
            publishedAt: m === 1 ? null : daysAgo(m * 30 - 1),
          },
          create: {
            periodId: period.id,
            employeeId: emp.id,
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

    // ------------------------------------------------------------------
    // 11) Evaluation Forms & Cycles
    // ------------------------------------------------------------------
    console.log(`  📊 Creating evaluations...`);
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

    let cycle = await prisma.evaluationCycle.findFirst({ where: { companyId } });
    if (!cycle) {
      cycle = await prisma.evaluationCycle.create({
        data: {
          companyId,
          formId: form.id,
          name: `دورهٔ ارزیابی ${now.getFullYear()}`,
          periodType: 'ANNUAL',
          startDate: daysAgo(365),
          endDate: daysAgo(30),
          dueDate: daysAhead(30),
          status: 'IN_PROGRESS',
        },
      });
    }

    const evalItems = await prisma.evaluationItem.findMany({ where: { formId: form.id } });
    for (const emp of employees.slice(0, 200)) { // Evaluate first 200
      const status = faker.helpers.arrayElement(['PENDING', 'IN_PROGRESS', 'COMPLETED']);
      const evaluation = await prisma.evaluation.upsert({
        where: { cycleId_employeeId_evaluationType: { cycleId: cycle.id, employeeId: emp.id, evaluationType: 'SUPERVISOR' } },
        update: {
          evaluatorId: adminUser.id,
          status: status as any,
          selfScore: status === 'COMPLETED' ? faker.number.float({ min: 3, max: 5, fractionDigits: 2 }) : null,
          supervisorScore: status === 'COMPLETED' ? faker.number.float({ min: 3, max: 5, fractionDigits: 2 }) : null,
          weightedScore: status === 'COMPLETED' ? faker.number.float({ min: 3, max: 5, fractionDigits: 2 }) : null,
          finalScore: status === 'COMPLETED' ? faker.number.float({ min: 3, max: 5, fractionDigits: 2 }) : null,
        },
        create: {
          cycleId: cycle.id,
          employeeId: emp.id,
          evaluatorId: adminUser.id,
          evaluationType: 'SUPERVISOR',
          status: status as any,
          selfScore: status === 'COMPLETED' ? faker.number.float({ min: 3, max: 5, fractionDigits: 2 }) : null,
          supervisorScore: status === 'COMPLETED' ? faker.number.float({ min: 3, max: 5, fractionDigits: 2 }) : null,
          weightedScore: status === 'COMPLETED' ? faker.number.float({ min: 3, max: 5, fractionDigits: 2 }) : null,
          finalScore: status === 'COMPLETED' ? faker.number.float({ min: 3, max: 5, fractionDigits: 2 }) : null,
        },
      });
      if (status === 'COMPLETED') {
        for (const it of evalItems) {
          await prisma.evaluationScore.upsert({
            where: { evaluationId_itemId: { evaluationId: evaluation.id, itemId: it.id } },
            update: { score: faker.number.float({ min: 3, max: 5, fractionDigits: 1 }), comment: 'ارزیابی مطابق شاخص‌های دوره.' },
            create: { evaluationId: evaluation.id, itemId: it.id, score: faker.number.float({ min: 3, max: 5, fractionDigits: 1 }), comment: 'ارزیابی مطابق شاخص‌های دوره.' },
          });
        }
      }
    }

    // ------------------------------------------------------------------
    // 12) Tasks
    // ------------------------------------------------------------------
    console.log(`  ✅ Creating tasks...`);
    const taskStatuses = ['NEW', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELLED'];
    const taskPriorities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    for (let i = 0; i < 50; i++) {
      const orgUnit = faker.helpers.arrayElement(orgUnits);
      const status = faker.helpers.arrayElement(taskStatuses);
      const task = await prisma.task.create({
        data: {
          companyId,
          orgUnitId: orgUnit.id,
          title: faker.lorem.sentence({ min: 4, max: 8 }),
          description: faker.lorem.paragraph(),
          status: status as any,
          priority: faker.helpers.arrayElement(taskPriorities) as any,
          dueDate: dateOnly(randomDate(now, daysAhead(60))),
          progress: status === 'DONE' ? 100 : faker.number.int({ min: 0, max: 90 }),
          slaHours: 72,
          createdById: adminUser.id,
          completedAt: status === 'DONE' ? daysAgo(faker.number.int({ min: 1, max: 30 })) : null,
        },
      });
      const assignee = faker.helpers.arrayElement(employees);
      await prisma.taskAssignee.create({
        data: { taskId: task.id, employeeId: assignee.id, role: 'ASSIGNEE', isResponsible: true, completedAt: status === 'DONE' ? daysAgo(5) : null },
      });
    }

    // ------------------------------------------------------------------
    // 13) Assets
    // ------------------------------------------------------------------
    console.log(`  💻 Creating assets...`);
    const assetCategories = ['COMPUTER', 'VEHICLE', 'EQUIPMENT', 'FURNITURE', 'TOOL'];
    for (let i = 0; i < 20; i++) {
      const category = faker.helpers.arrayElement(assetCategories);
      const holder = Math.random() < 0.7 ? faker.helpers.arrayElement(employees) : null;
      const status = holder ? 'ASSIGNED' : faker.helpers.arrayElement(['IN_STOCK', 'DAMAGED', 'LOST', 'RETIRED']);
      const assetCode = `AST-${company.code}-${String(i + 1).padStart(4, '0')}`;
      const asset = await prisma.asset.upsert({
        where: { code: assetCode },
        update: {
          status: status as any,
          condition: status === 'DAMAGED' ? 'نیازمند تعمیر' : status === 'LOST' ? 'مفقود' : 'سالم',
          currentHolderId: holder?.id ?? null,
        },
        create: {
          companyId,
          orgUnitId: faker.helpers.arrayElement(orgUnits).id,
          code: assetCode,
          name: `${faker.commerce.productName()} ${category}`,
          category: category as any,
          brand: faker.company.name(),
          model: faker.commerce.product(),
          serialNumber: `SN-${company.code}-${String(i + 1).padStart(6, '0')}`,
          purchaseDate: randomDate(daysAgo(1000), daysAgo(30)),
          purchasePrice: RIAL(faker.number.int({ min: 5_000_000, max: 500_000_000 })),
          warrantyEnd: daysAhead(faker.number.int({ min: 100, max: 1000 })),
          status: status as any,
          condition: status === 'DAMAGED' ? 'نیازمند تعمیر' : status === 'LOST' ? 'مفقود' : 'سالم',
          currentHolderId: holder?.id ?? null,
        },
      });
      if (holder) {
        try {
          await prisma.assetHandover.create({
            data: {
              assetId: asset.id,
              toEmployeeId: holder.id,
              handoverType: 'DELIVER',
              handoverAt: daysAgo(30),
              receivedAt: daysAgo(30),
              condition: 'سالم',
            },
          });
        } catch (e) {
          // Ignore duplicate errors
        }
      }
    }

    // ------------------------------------------------------------------
    // 14) Training & Certificates
    // ------------------------------------------------------------------
    console.log(`  🎓 Creating training courses...`);
    const courseTitles = [
      'اصول حقوق و دستمزد', 'ایمنی و بهداشت حرفه‌ای (HSE)', 'Excel پیشرفته و تحلیل داده',
      'مدیریت عملکرد و ارزیابی', 'فروش حرفه‌ای و مذاکره', 'برنامه‌نویسی React',
      'معماری میکروسرویس‌ها', 'پایگاه داده PostgreSQL', 'امنیت سایبری', 'مدیریت پروژه Agile',
    ];
    const courses = [];
    for (const title of courseTitles) {
      const course = await prisma.trainingCourse.upsert({
        where: { companyId_code: { companyId, code: `TR-${String(courses.length + 1).padStart(3, '0')}` } },
        update: {},
        create: {
          companyId,
          code: `TR-${String(courses.length + 1).padStart(3, '0')}`,
          title,
          instructor: `${faker.person.firstName()} ${faker.person.lastName()}`,
          durationHours: faker.number.int({ min: 8, max: 40 }),
          cost: RIAL(faker.number.int({ min: 0, max: 20_000_000 })),
          description: `دورهٔ آموزشی «${title}»`,
        },
      });
      courses.push(course);
    }

    for (let i = 0; i < 100; i++) {
      const emp = faker.helpers.arrayElement(employees);
      const course = faker.helpers.arrayElement(courses);
      const result = faker.helpers.arrayElement(['PASSED', 'PASSED', 'PASSED', 'FAILED', 'IN_PROGRESS']);
      await prisma.trainingRecord.create({
        data: {
          courseId: course.id,
          employeeId: emp.id,
          attendanceDate: dateOnly(randomDate(daysAgo(180), daysAgo(1))),
          endDate: dateOnly(randomDate(daysAgo(180), now)),
          result: result as any,
          score: result === 'PASSED' ? faker.number.int({ min: 70, max: 100 }) : faker.number.int({ min: 30, max: 69 }),
          effectivenessScore: faker.number.int({ min: 50, max: 100 }),
          status: result === 'IN_PROGRESS' ? 'IN_PROGRESS' : 'COMPLETED',
        },
      });
    }

    for (let i = 0; i < 20; i++) {
      const emp = faker.helpers.arrayElement(employees);
      await prisma.certificate.create({
        data: {
          employeeId: emp.id,
          name: faker.helpers.arrayElement(['گواهینامه ایمنی صنعتی', 'گواهینامه برق صنعتی', 'گواهینامه ICDL', 'گواهینامه PMP', 'گواهینامه زبان']),
          issuingBody: faker.company.name(),
          issueDate: dateOnly(randomDate(daysAgo(1000), daysAgo(30))),
          expiryDate: dateOnly(daysAhead(faker.number.int({ min: 30, max: 1000 }))),
        },
      });
    }

    // ------------------------------------------------------------------
    // 15) Recruitment
    // ------------------------------------------------------------------
    console.log(`  🎯 Creating recruitment data...`);
    for (let i = 0; i < 5; i++) {
      const req = await prisma.jobRequisition.create({
        data: {
          companyId,
          orgUnitId: faker.helpers.arrayElement(orgUnits).id,
          workLocationId: workLocation.id,
          title: faker.person.jobTitle(),
          headcount: faker.number.int({ min: 1, max: 5 }),
          reason: 'نیاز سازمانی تأییدشده',
          budget: RIAL(faker.number.int({ min: 300_000_000, max: 1_000_000_000 })),
          status: faker.helpers.arrayElement(['DRAFT', 'APPROVED', 'CLOSED']) as any,
          requestedById: adminUser.id,
        },
      });
      const opening = await prisma.jobOpening.create({
        data: {
          requisitionId: req.id,
          title: req.title,
          description: faker.lorem.paragraphs(2),
          requiredSkills: faker.lorem.words(10),
          employmentType: faker.helpers.arrayElement(EMPLOYMENT_TYPES) as any,
          salaryMin: RIAL(faker.number.int({ min: 300_000_000, max: 600_000_000 })),
          salaryMax: RIAL(faker.number.int({ min: 600_000_000, max: 1_200_000_000 })),
          applicationDeadline: dateOnly(daysAhead(30)),
          status: 'OPEN',
        },
      });
      for (let a = 0; a < faker.number.int({ min: 2, max: 8 }); a++) {
        await prisma.applicant.create({
          data: {
            openingId: opening.id,
            firstName: faker.person.firstName(),
            lastName: faker.person.lastName(),
            mobile: generateMobile(),
            email: faker.internet.email(),
            source: faker.helpers.arrayElement(['سایت استخدام', 'لینکدین', 'جابینجا', 'معرفی همکاران', 'سایت شرکت']),
            status: faker.helpers.arrayElement(['APPLIED', 'SCREENING', 'HR_INTERVIEW', 'TECH_INTERVIEW', 'OFFERED', 'REJECTED', 'HIRED']) as any,
          },
        });
      }
    }

    // ------------------------------------------------------------------
    // 16) Onboarding / Offboarding
    // ------------------------------------------------------------------
    console.log(`  🚀 Creating onboarding/offboarding...`);
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

    for (let i = 0; i < 20; i++) {
      const emp = faker.helpers.arrayElement(employees);
      const existing = await prisma.onboardingChecklist.findFirst({ where: { employeeId: emp.id } });
      if (existing) continue;
      const status = faker.helpers.arrayElement(['IN_PROGRESS', 'COMPLETED']) as any;
      const checklist = await prisma.onboardingChecklist.create({
        data: { employeeId: emp.id, templateId: template.id, status, startedAt: daysAgo(30), completedAt: status === 'COMPLETED' ? daysAgo(5) : null },
      });
      const defsItems = await prisma.onboardingTemplateItem.findMany({ where: { templateId: template.id }, orderBy: { sortOrder: 'asc' } });
      for (const [idx, item] of defsItems.entries()) {
        const done = status === 'COMPLETED' || idx < faker.number.int({ min: 1, max: defsItems.length });
        await prisma.onboardingChecklistItem.create({
          data: { checklistId: checklist.id, definitionId: item.id, title: item.title, status: done ? 'DONE' : 'PENDING', completedById: done ? adminUser.id : null, completedAt: done ? daysAgo(20 - idx) : null },
        });
      }
    }

    // ------------------------------------------------------------------
    // 17) Missions
    // ------------------------------------------------------------------
    console.log(`  🚗 Creating missions...`);
    for (let i = 0; i < 10; i++) {
      await prisma.mission.create({
        data: {
          employeeId: faker.helpers.arrayElement(employees).id,
          orgUnitId: faker.helpers.arrayElement(orgUnits).id,
          title: faker.lorem.sentence({ min: 3, max: 6 }),
          destination: faker.location.city(),
          purpose: 'انجام مأموریت ابلاغ‌شده از سوی واحد مربوطه',
          startAt: at(randomDate(daysAgo(30), daysAhead(10)), 8),
          endAt: at(randomDate(daysAgo(30), daysAhead(10)), 18),
          transport: faker.helpers.arrayElement(['خودروی سازمانی', 'هواپیما', 'قطار', 'اتوبوس']),
          estimatedCost: RIAL(faker.number.int({ min: 1_000_000, max: 50_000_000 })),
          actualCost: RIAL(faker.number.int({ min: 1_000_000, max: 50_000_000 })),
          status: faker.helpers.arrayElement(['REQUESTED', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']) as any,
          approvedById: adminUser.id,
        },
      });
    }

    // ------------------------------------------------------------------
    // 18) Loans
    // ------------------------------------------------------------------
    console.log(`  💳 Creating loans...`);
    for (let i = 0; i < 30; i++) {
      const emp = faker.helpers.arrayElement(employees);
      const amount = faker.number.int({ min: 20_000_000, max: 200_000_000 });
      const count = faker.number.int({ min: 6, max: 24 });
      const status = faker.helpers.arrayElement(['REQUESTED', 'PENDING_APPROVAL', 'APPROVED', 'DISBURSED', 'SETTLING', 'SETTLED', 'REJECTED', 'CANCELLED']) as any;
      const loan = await prisma.loan.create({
        data: {
          employeeId: emp.id,
          loanType: 'LOAN',
          amount: RIAL(amount),
          installmentCount: count,
          monthlyAmount: RIAL(Math.round(amount / count)),
          interestRate: 0,
          purpose: faker.lorem.sentence({ min: 3, max: 8 }),
          status,
          approvedById: status === 'APPROVED' || status === 'DISBURSED' || status === 'SETTLING' || status === 'SETTLED' ? adminUser.id : null,
          disbursedAt: status === 'DISBURSED' || status === 'SETTLING' || status === 'SETTLED' ? daysAgo(30) : null,
        },
      });
      for (let inst = 0; inst < count; inst++) {
        const paid = (status === 'SETTLING' || status === 'SETTLED') && inst < faker.number.int({ min: 1, max: 5 });
        await prisma.loanInstallment.create({
          data: {
            loanId: loan.id,
            dueDate: dateOnly(daysAhead(inst * 30)),
            amount: RIAL(Math.round(amount / count)),
            paidAmount: paid ? RIAL(Math.round(amount / count)) : RIAL(0),
            status: paid ? 'PAID' : 'PENDING',
            paidAt: paid ? daysAgo(30 - inst * 30) : null,
          },
        });
      }
    }

    // ------------------------------------------------------------------
    // 19) Correspondence, Meetings, Surveys, Suggestions
    // ------------------------------------------------------------------
    console.log(`  📬 Creating correspondence & meetings...`);
    for (let i = 0; i < 10; i++) {
      await prisma.correspondence.upsert({
        where: { referenceNo: `COR-${company.code}-${String(i + 1).padStart(4, '0')}` },
        update: {},
        create: {
          companyId,
          referenceNo: `COR-${company.code}-${String(i + 1).padStart(4, '0')}`,
          direction: faker.helpers.arrayElement(['INCOMING', 'OUTGOING', 'INTERNAL']) as any,
          letterDate: dateOnly(randomDate(daysAgo(60), now)),
          subject: faker.lorem.sentence({ min: 4, max: 8 }),
          senderName: faker.company.name(),
          senderOrg: faker.company.name(),
          classification: faker.helpers.arrayElement(['NORMAL', 'URGENT', 'CONFIDENTIAL']) as any,
          deadline: dateOnly(daysAhead(faker.number.int({ min: 5, max: 60 }))),
          status: faker.helpers.arrayElement(['REGISTERED', 'ANSWERED', 'ARCHIVED']) as any,
        },
      });
    }

    for (let i = 0; i < 5; i++) {
      const meeting = await prisma.meeting.create({
        data: {
          companyId,
          title: faker.lorem.sentence({ min: 3, max: 6 }),
          scheduledAt: at(randomDate(daysAgo(30), daysAhead(30)), 10),
          endAt: at(randomDate(daysAgo(30), daysAhead(30)), 12),
          location: faker.location.streetAddress(),
          organizerId: adminUser.id,
          agenda: faker.lorem.paragraph(),
          status: faker.helpers.arrayElement(['PLANNED', 'HELD', 'CANCELLED']) as any,
        },
      });
      for (const emp of faker.helpers.arrayElements(employees, faker.number.int({ min: 3, max: 8 }))) {
        await prisma.meetingParticipant.create({ data: { meetingId: meeting.id, employeeId: emp.id, attended: faker.datatype.boolean() } });
      }
    }

    for (let i = 0; i < 3; i++) {
      const survey = await prisma.survey.create({
        data: {
          companyId,
          title: faker.lorem.sentence({ min: 4, max: 8 }),
          description: 'این نظرسنجی به منظور بهبود مستمر فرایندها انجام می‌شود.',
          isAnonymous: true,
          status: faker.helpers.arrayElement(['OPEN', 'CLOSED']) as any,
          startDate: dateOnly(daysAgo(30)),
          endDate: dateOnly(daysAhead(30)),
          createdById: adminUser.id,
        },
      });
      for (const q of ['رضایت کلی', 'کیفیت مدیریت', 'پیشنهاد بهبود']) {
        await prisma.surveyQuestion.create({ data: { surveyId: survey.id, text: q, questionType: q === 'پیشنهاد بهبود' ? 'TEXT' : 'SCALE' } });
      }
    }

    for (let i = 0; i < 5; i++) {
      await prisma.suggestion.create({
        data: {
          companyId,
          title: faker.lorem.sentence({ min: 4, max: 8 }),
          description: faker.lorem.paragraph(),
          category: faker.helpers.arrayElement(['IT', 'POLICY', 'WELFARE', 'PROCESS', 'OTHER']),
          isAnonymous: faker.datatype.boolean(),
          status: faker.helpers.arrayElement(['NEW', 'UNDER_REVIEW', 'ACCEPTED', 'REJECTED', 'IMPLEMENTED']) as any,
          reporterId: faker.datatype.boolean() ? null : adminUser.id,
        },
      });
    }

    // ------------------------------------------------------------------
    // 20) Announcements & Notifications
    // ------------------------------------------------------------------
    console.log(`  📢 Creating announcements & notifications...`);
    for (let i = 0; i < 10; i++) {
      const ann = await prisma.announcement.create({
        data: {
          companyId,
          title: faker.lorem.sentence({ min: 4, max: 8 }),
          body: faker.lorem.paragraphs(2),
          targetType: 'ALL',
          requiresAck: faker.datatype.boolean(),
          publishedById: adminUser.id,
          publishedAt: daysAgo(faker.number.int({ min: 1, max: 30 })),
          expiresAt: faker.datatype.boolean() ? daysAhead(faker.number.int({ min: 7, max: 60 })) : null,
        },
      });
      if (ann.requiresAck) {
        await prisma.announcementAck.create({ data: { announcementId: ann.id, userId: adminUser.id } });
      }
    }

    const notifTypes = ['PAYSLIP_PUBLISHED', 'CONTRACT_EXPIRING', 'CERTIFICATE_EXPIRING', 'LEAVE_BALANCE', 'SECURITY_ALERT', 'SYSTEM', 'REQUEST_RESULT'];
    for (let i = 0; i < 50; i++) {
      await prisma.notification.create({
        data: {
          userId: faker.helpers.arrayElement([adminUser.id, hrAdminUser.id, ...Array.from(branchManagers.values()), ...Array.from(orgUnitManagers.values())]),
          type: faker.helpers.arrayElement(notifTypes) as any,
          severity: faker.helpers.arrayElement(['INFO', 'WARNING', 'CRITICAL']) as any,
          title: faker.lorem.sentence({ min: 3, max: 6 }),
          body: faker.lorem.sentence({ min: 5, max: 12 }),
          channel: 'IN_APP',
          status: faker.helpers.arrayElement(['SENT', 'READ']) as any,
          sentAt: daysAgo(faker.number.int({ min: 1, max: 30 })),
          readAt: faker.datatype.boolean() ? daysAgo(faker.number.int({ min: 0, max: 29 })) : null,
        },
      });
    }

    // ------------------------------------------------------------------
    // 21) Employee Documents
    // ------------------------------------------------------------------
    console.log(`  📄 Creating employee documents...`);
    for (let i = 0; i < 100; i++) {
      const emp = faker.helpers.arrayElement(employees);
      const docType = faker.helpers.arrayElement(DOCUMENT_TYPES);
      const doc = await prisma.employeeDocument.create({
        data: {
          employeeId: emp.id,
          docType: docType as any,
          title: faker.lorem.words(3),
          documentNumber: faker.string.alphanumeric(10).toUpperCase(),
          issueDate: dateOnly(randomDate(daysAgo(2000), daysAgo(30))),
          expiryDate: faker.datatype.boolean() ? dateOnly(daysAhead(faker.number.int({ min: 30, max: 2000 }))) : null,
          confidentiality: docType === 'NATIONAL_ID' ? 'CONFIDENTIAL' : 'NORMAL',
          currentVersion: 1,
        },
      });
      await prisma.employeeDocumentVersion.create({
        data: {
          documentId: doc.id,
          version: 1,
          fileName: `${doc.documentNumber}.pdf`,
          filePath: `/uploads/employees/${emp.id}/${doc.documentNumber}.pdf`,
          mimeType: 'application/pdf',
          size: faker.number.int({ min: 50_000, max: 500_000 }),
          uploadedById: adminUser.id,
        },
      });
    }

    // ------------------------------------------------------------------
    // 22) Projects & Gantt
    // ------------------------------------------------------------------
    console.log(`  📈 Creating projects...`);
    for (let i = 0; i < 5; i++) {
      const projectCode = `PRJ-${company.code}-${String(i + 1).padStart(3, '0')}`;
      const project = await prisma.project.upsert({
        where: { companyId_code: { companyId, code: projectCode } },
        update: {},
        create: {
          companyId,
          code: projectCode,
          title: faker.lorem.sentence({ min: 3, max: 6 }),
          description: faker.lorem.paragraph(),
          startDate: dateOnly(randomDate(daysAgo(180), daysAgo(1))),
          endDate: dateOnly(daysAhead(faker.number.int({ min: 30, max: 365 }))),
          status: faker.helpers.arrayElement(['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED']) as any,
          priority: faker.helpers.arrayElement(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']) as any,
          progress: faker.number.int({ min: 0, max: 100 }),
          color: faker.helpers.arrayElement(['#2563eb', '#059669', '#dc2626', '#7c3aed', '#ea580c', '#ca8a04']),
          managerId: faker.helpers.arrayElement(employees).id,
          createdById: adminUser.id,
        },
      });
      for (let t = 0; t < faker.number.int({ min: 3, max: 8 }); t++) {
        await prisma.projectTask.create({
          data: {
            projectId: project.id,
            title: faker.lorem.sentence({ min: 3, max: 6 }),
            phase: faker.helpers.arrayElement(['اجاره', 'طراحی', 'توسعه', 'تست', 'استقرار']),
            startDate: dateOnly(randomDate(daysAgo(60), now)),
            endDate: dateOnly(daysAhead(faker.number.int({ min: 7, max: 90 }))),
            progress: faker.number.int({ min: 0, max: 100 }),
            status: faker.helpers.arrayElement(['PENDING', 'IN_PROGRESS', 'DONE']) as any,
            priority: 'MEDIUM',
            color: project.color,
            assigneeId: faker.helpers.arrayElement(employees).id,
          },
        });
      }
    }

    console.log(`\n✅ Company ${company.name} completed!`);
  }

  // ------------------------------------------------------------------
  // Final Summary
  // ------------------------------------------------------------------
  const totalEmployees = await prisma.employee.count({ where: { deletedAt: null } });
  const totalCompanies = await prisma.company.count({ where: { deletedAt: null } });
  const totalBranches = await prisma.branch.count({ where: { deletedAt: null } });
  const totalOrgUnits = await prisma.orgUnit.count({ where: { deletedAt: null } });
  const totalUsers = await prisma.user.count({ where: { deletedAt: null } });

  console.log('\n==========================================');
  console.log('📊 QA SEED SUMMARY');
  console.log('==========================================');
  console.log(`Companies:      ${totalCompanies}`);
  console.log(`Branches:       ${totalBranches}`);
  console.log(`Org Units:      ${totalOrgUnits}`);
  console.log(`Employees:      ${totalEmployees}`);
  console.log(`Users:          ${totalUsers}`);
  console.log(`Attendance:     ${await prisma.attendanceRecord.count()}`);
  console.log(`Shifts:         ${await prisma.shift.count()}`);
  console.log(`Shift Assign:   ${await prisma.shiftAssignment.count()}`);
  console.log(`Leave Requests: ${await prisma.leaveRequest.count()}`);
  console.log(`Payroll Periods:${await prisma.payrollPeriod.count()}`);
  console.log(`Payslips:       ${await prisma.payslip.count()}`);
  console.log(`Contracts:      ${await prisma.contract.count()}`);
  console.log(`Evaluations:    ${await prisma.evaluation.count()}`);
  console.log(`Tasks:          ${await prisma.task.count()}`);
  console.log(`Assets:         ${await prisma.asset.count()}`);
  console.log(`Training:       ${await prisma.trainingCourse.count()}`);
  console.log(`Recruitment:    ${await prisma.jobRequisition.count()}`);
  console.log(`Loans:          ${await prisma.loan.count()}`);
  console.log(`Missions:       ${await prisma.mission.count()}`);
  console.log(`Announcements:  ${await prisma.announcement.count()}`);
  console.log(`Notifications:  ${await prisma.notification.count()}`);
  console.log(`Documents:      ${await prisma.employeeDocument.count()}`);
  console.log(`Projects:       ${await prisma.project.count()}`);
  console.log('==========================================');
  console.log(`⏱️  Total time: ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
  console.log('==========================================');
}

main()
  .catch((e) => {
    console.error('❌ Error in QA Seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });