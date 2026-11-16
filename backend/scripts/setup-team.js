/**
 * راه‌اندازی نهایی:
 *  ۱) پاک کردن تمام وظایف (و وابستگی‌ها/نظرات)
 *  ۲) ساخت چند کارمند (کاربر + پروندهٔ پرسنلی) با نقش‌های واقعی
 *  ۳) تخصیص وظیفه‌ها به کاربران
 *
 * اجرا: node scripts/setup-team.js
 */
const BASE = 'http://localhost:4114/api/v1';

async function api(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status}: ${json?.message ?? JSON.stringify(json).slice(0, 200)}`);
  }
  return json?.data ?? json;
}

async function main() {
  // ---------- ورود مدیر ----------
  const login = await api('/auth/login', {
    method: 'POST',
    body: { username: 'admin', password: 'E7HHpQcEFezE4OAa1!' },
  });
  const token = login.accessToken;
  console.log('✅ ورود مدیر');

  // ---------- ۱) پاک کردن وظایف ----------
  const existing = await api('/tasks?limit=200', { token });
  const taskRows = existing?.items ?? existing?.data ?? existing ?? [];
  for (const t of taskRows) {
    try {
      await api(`/tasks/${t.id}`, { method: 'DELETE', token });
    } catch (e) {
      console.log(`  ⚠️ حذف وظیفهٔ ${t.title} ناموفق: ${e.message}`);
    }
  }
  console.log(`🗑️ ${taskRows.length} وظیفه حذف شد`);

  // ---------- ۲) ساخت کارمندان ----------
  const roles = await api('/roles', { token });
  const roleByCode = Object.fromEntries(roles.map((r) => [r.code, r.id]));
  const positions = await api('/org/positions', { token });
  const orgUnits = await api('/org/units', { token });
  const company = (await api('/org/companies', { token }))?.[0];

  const staff = [
    {
      username: 'ahmad.rezaei',
      fullName: 'احمد رضایی',
      email: 'ahmad.rezaei@sana-example.ir',
      mobile: '09121210001',
      employeeCode: '2001',
      jobTitle: 'کارشناس ارشد منابع انسانی',
      positionCode: 'HR-SPEC',
      orgUnitCode: 'HR',
      hireDate: '2024-03-01',
      monthlyBaseSalary: 480_000_000,
      roleCode: 'HR_ADMIN',
      gender: 'MALE',
    },
    {
      username: 'sara.mahmoodi',
      fullName: 'سارا محمودی',
      email: 'sara.mahmoodi@sana-example.ir',
      mobile: '09121210002',
      employeeCode: '2002',
      jobTitle: 'کارشناس برنامه‌ریزی',
      positionCode: 'OPS-TB-LEAD',
      orgUnitCode: 'OPS-TB',
      hireDate: '2025-01-12',
      monthlyBaseSalary: 420_000_000,
      roleCode: 'MANAGER',
      gender: 'FEMALE',
    },
    {
      username: 'mohammad.karimi',
      fullName: 'محمد کریمی',
      email: 'mohammad.karimi@sana-example.ir',
      mobile: '09121210003',
      employeeCode: '2003',
      jobTitle: 'کارشناس مالی',
      positionCode: 'FIN-ACC',
      orgUnitCode: 'FIN',
      hireDate: '2025-09-01',
      monthlyBaseSalary: 390_000_000,
      roleCode: 'EMPLOYEE',
      gender: 'MALE',
    },
    {
      username: 'elham.nosrati',
      fullName: 'الهام نصرتی',
      email: 'elham.nosrati@sana-example.ir',
      mobile: '09121210004',
      employeeCode: '2004',
      jobTitle: 'کارشناس جذب',
      positionCode: 'HR-SPEC',
      orgUnitCode: 'HR',
      hireDate: '2026-02-15',
      monthlyBaseSalary: 360_000_000,
      roleCode: 'EMPLOYEE',
      gender: 'FEMALE',
    },
  ];

  const created = [];
  for (const s of staff) {
    const existingUser = await api(`/users?search=${encodeURIComponent(s.username)}&limit=5`, { token }).catch(() => []);
    const rows = existingUser?.items ?? existingUser?.data ?? [];
    const found = rows.find((u) => u.username === s.username);
    if (found) {
      console.log(`ℹ️ کاربر «${s.username}» از قبل وجود دارد`);
      created.push(found);
      continue;
    }
    const user = await api('/users', {
      method: 'POST',
      token,
      body: {
        username: s.username,
        fullName: s.fullName,
        password: 'SanaTeam@1404',
        email: s.email,
        mobile: s.mobile,
        employeeCode: s.employeeCode,
        nationalId: `200${s.employeeCode.slice(-2)}${Math.floor(Math.random() * 90 + 10)}`,
        positionId: positions.find((p) => p.code === s.positionCode)?.id,
        orgUnitId: orgUnits.find((u) => u.code === s.orgUnitCode)?.id,
        hireDate: s.hireDate,
        monthlyBaseSalary: s.monthlyBaseSalary,
        gender: s.gender,
        roleIds: [roleByCode[s.roleCode]],
        mustChangePassword: true,
      },
    });
    console.log(`✅ کارمند ساخته شد: ${s.fullName} (${s.username}) — نقش ${s.roleCode}`);
    created.push(user);
  }

  // ---------- ۳) تخصیص وظیفه به کاربران ----------
  const companyId = company?.id ?? (await api('/org/companies', { token }))[0]?.id;
  const today = new Date();
  const inDays = (n) => new Date(today.getTime() + n * 86400000).toISOString().slice(0, 10);

  const taskDefs = [
    { title: 'تهیهٔ گزارش حقوق و دستمزد ماه جاری', description: 'محاسبه اضافه‌کاری، کسورات و آماده‌سازی فیش‌ها برای تأیید.', priority: 'HIGH', due: inDays(4), assignees: [0] },
    { title: 'بازبینی پرونده‌های استخدامی کارکنان جدید', description: 'بررسی و تأیید مدارک و اطلاعات پروندهٔ کارکنان تازه‌وارد.', priority: 'MEDIUM', due: inDays(6), assignees: [0, 3] },
    { title: 'هماهنگی جلسهٔ ارزیابی عملکرد فصل', description: 'تنظیم وقت جلسه و آماده‌سازی فرم‌های ارزیابی برای سرپرستان.', priority: 'MEDIUM', due: inDays(9), assignees: [1] },
    { title: 'بستن حساب‌های تأمین اجتماعی', description: 'تهیه و ارسال لیست بیمه و مغایرت‌گیری با پروندهٔ پرسنلی.', priority: 'CRITICAL', due: inDays(2), assignees: [2] },
    { title: 'انبارگردانی تجهیزات اداری', description: 'شمارش، ثبت وضعیت و تحویل تجهیزات به کارکنان.', priority: 'LOW', due: inDays(12), assignees: [3] },
    { title: 'به‌روزرسانی ساختار سازمانی و چارت سازمانی', description: 'به‌روزرسانی واحدها، سمت‌ها و گزارش‌های ساختاری.', priority: 'LOW', due: inDays(18), assignees: [1, 0] },
  ];

  for (const t of taskDefs) {
    const assigneeUserIds = t.assignees.map((i) => created[i]?.id).filter(Boolean);
    await api('/tasks', {
      method: 'POST',
      token,
      body: {
        companyId,
        title: t.title,
        description: t.description,
        priority: t.priority,
        dueDate: t.due,
        estimatedHours: 8,
        assigneeUserIds,
      },
    });
    console.log(`✅ وظیفه ساخته شد: ${t.title} → ${assigneeUserIds.length} مسئول`);
  }

  // ---------- گزارش نهایی ----------
  const finalTasks = await api('/tasks?limit=100', { token });
  const finalUsers = await api('/users?limit=100', { token });
  console.log('\n📊 وضعیت نهایی:');
  console.log(`   کاربران: ${finalUsers?.meta?.total ?? finalUsers?.length ?? '—'}`);
  console.log(`   وظایف:   ${finalTasks?.meta?.total ?? finalTasks?.length ?? '—'}`);
  for (const t of (finalTasks?.items ?? finalTasks?.data ?? [])) {
    const names = (t.assignees ?? []).map((a) => a.employee ? `${a.employee.firstName} ${a.employee.lastName}` : a.user?.fullName).filter(Boolean).join('، ');
    console.log(`   • ${t.title} → ${names || 'بدون مسئول'}`);
  }
  console.log('\n✅ آماده است؛ با کاربران تازه (رمز: SanaTeam@1404) وارد شوید.');
}

main().catch((e) => {
  console.error('❌ خطا:', e.message);
  process.exit(1);
});
