/**
 * فهرست کامل مجوزهای سامانه مدیریت منابع انسانی «سنا».
 * قالب کد مجوز: `<module>.<action>`
 * - view   : مشاهده
 * - create : ایجاد
 * - update : ویرایش
 * - delete : حذف
 * - approve: تأیید
 * - cancel : لغو
 * - export : خروجی گرفتن
 * - manage : مدیریت کامل (کاربران، نقش‌ها، تنظیمات، پشتیبان)
 */
export const PERMISSIONS = {
  // داشبورد
  DASHBOARD_VIEW: 'dashboard.view',
  DASHBOARD_VIEW_MANAGEMENT: 'dashboard.view.management',

  // ساختار سازمانی
  ORG_VIEW: 'org.view',
  ORG_MANAGE: 'org.manage',

  // پرونده پرسنلی
  EMPLOYEES_VIEW: 'employees.view',
  EMPLOYEES_CREATE: 'employees.create',
  EMPLOYEES_UPDATE: 'employees.update',
  EMPLOYEES_DELETE: 'employees.delete',
  EMPLOYEES_EXPORT: 'employees.export',
  EMPLOYEES_VIEW_SENSITIVE: 'employees.view.sensitive',

  // قرارداد و مدارک
  CONTRACTS_VIEW: 'contracts.view',
  CONTRACTS_CREATE: 'contracts.create',
  CONTRACTS_UPDATE: 'contracts.update',
  CONTRACTS_APPROVE: 'contracts.approve',

  DOCUMENTS_VIEW: 'documents.view',
  DOCUMENTS_CREATE: 'documents.create',
  DOCUMENTS_UPDATE: 'documents.update',
  DOCUMENTS_DELETE: 'documents.delete',

  // حضور و غیاب
  ATTENDANCE_VIEW: 'attendance.view',
  ATTENDANCE_CREATE: 'attendance.create',
  ATTENDANCE_UPDATE: 'attendance.update',
  ATTENDANCE_APPROVE: 'attendance.approve',
  ATTENDANCE_EXPORT: 'attendance.export',

  // شیفت
  SHIFTS_VIEW: 'shifts.view',
  SHIFTS_MANAGE: 'shifts.manage',
  SHIFTS_SWAP: 'shifts.swap',
  SHIFTS_APPROVE: 'shifts.approve',

  // مرخصی
  LEAVES_VIEW: 'leaves.view',
  LEAVES_CREATE: 'leaves.create',
  LEAVES_UPDATE: 'leaves.update',
  LEAVES_APPROVE: 'leaves.approve',
  LEAVES_MANAGE_TYPES: 'leaves.manage.types',

  // حقوق و دستمزد
  PAYROLL_VIEW: 'payroll.view',
  PAYROLL_CREATE: 'payroll.create',
  PAYROLL_UPDATE: 'payroll.update',
  PAYROLL_REVIEW: 'payroll.review',
  PAYROLL_APPROVE: 'payroll.approve',
  PAYROLL_PUBLISH: 'payroll.publish',
  PAYROLL_VIEW_OWN: 'payroll.view.own',
  PAYROLL_EXPORT: 'payroll.export',

  // ارزیابی عملکرد
  EVALUATIONS_VIEW: 'evaluations.view',
  EVALUATIONS_MANAGE: 'evaluations.manage',
  EVALUATIONS_RATE: 'evaluations.rate',
  EVALUATIONS_APPROVE: 'evaluations.approve',

  // وظایف
  TASKS_VIEW: 'tasks.view',
  TASKS_CREATE: 'tasks.create',
  TASKS_UPDATE: 'tasks.update',
  TASKS_DELETE: 'tasks.delete',
  TASKS_APPROVE: 'tasks.approve',

  // پروژه‌ها
  PROJECTS_VIEW: 'projects.view',
  PROJECTS_CREATE: 'projects.create',
  PROJECTS_UPDATE: 'projects.update',
  PROJECTS_DELETE: 'projects.delete',

  // پنل اختصاصی کارمند
  PANEL_VIEW: 'panel.view',
  PANEL_ATTENDANCE: 'panel.attendance',
  PANEL_LEAVE_REQUEST: 'panel.leave.request',

  // دارایی
  ASSETS_VIEW: 'assets.view',
  ASSETS_MANAGE: 'assets.manage',
  ASSETS_HANDOVER: 'assets.handover',

  // آموزش و گواهینامه
  TRAINING_VIEW: 'training.view',
  TRAINING_MANAGE: 'training.manage',

  // گردش تأیید
  APPROVALS_VIEW: 'approvals.view',
  APPROVALS_DECIDE: 'approvals.decide',
  APPROVALS_MANAGE: 'approvals.manage',

  // استخدام و جذب
  RECRUITMENT_VIEW: 'recruitment.view',
  RECRUITMENT_MANAGE: 'recruitment.manage',
  RECRUITMENT_INTERVIEW: 'recruitment.interview',

  // ورود / جابه‌جایی / خروج
  LIFECYCLE_VIEW: 'lifecycle.view',
  LIFECYCLE_MANAGE: 'lifecycle.manage',

  // مأموریت
  MISSIONS_VIEW: 'missions.view',
  MISSIONS_CREATE: 'missions.create',
  MISSIONS_APPROVE: 'missions.approve',

  // وام و مزایا
  LOANS_VIEW: 'loans.view',
  LOANS_CREATE: 'loans.create',
  LOANS_APPROVE: 'loans.approve',
  BENEFITS_VIEW: 'benefits.view',
  BENEFITS_MANAGE: 'benefits.manage',

  // مکاتبات، جلسات، نظرسنجی
  ADMIN_VIEW: 'admin.view',
  ADMIN_MANAGE: 'admin.manage',
  SURVEYS_VIEW: 'surveys.view',
  SURVEYS_MANAGE: 'surveys.manage',
  SUGGESTIONS_VIEW: 'suggestions.view',
  SUGGESTIONS_MANAGE: 'suggestions.manage',
  CONFIDENTIAL_REPORTS_MANAGE: 'confidential-reports.manage',

  // اعلان‌ها و اعلامیه‌ها
  NOTIFICATIONS_VIEW: 'notifications.view',
  ANNOUNCEMENTS_VIEW: 'announcements.view',
  ANNOUNCEMENTS_MANAGE: 'announcements.manage',

  // کاربران و نقش‌ها
  USERS_VIEW: 'users.view',
  USERS_CREATE: 'users.create',
  USERS_UPDATE: 'users.update',
  USERS_DELETE: 'users.delete',
  USERS_MANAGE_ROLES: 'users.manage.roles',
  USERS_MANAGE_SESSIONS: 'users.manage.sessions',

  ROLES_VIEW: 'roles.view',
  ROLES_MANAGE: 'roles.manage',

  // گزارش‌ها
  REPORTS_VIEW: 'reports.view',
  REPORTS_EXPORT: 'reports.export',

  // تنظیمات و امنیت
  SETTINGS_VIEW: 'settings.view',
  SETTINGS_MANAGE: 'settings.manage',
  AUDIT_VIEW: 'audit.view',
  BACKUP_MANAGE: 'backup.manage',
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: PermissionCode[] = Object.values(PERMISSIONS);

export const PERMISSION_GROUPS: { group: string; label: string; codes: PermissionCode[] }[] = [
  {
    group: 'dashboard',
    label: 'داشبورد',
    codes: [PERMISSIONS.DASHBOARD_VIEW, PERMISSIONS.DASHBOARD_VIEW_MANAGEMENT],
  },
  {
    group: 'org',
    label: 'ساختار سازمانی',
    codes: [PERMISSIONS.ORG_VIEW, PERMISSIONS.ORG_MANAGE],
  },
  {
    group: 'employees',
    label: 'پرونده پرسنلی',
    codes: [
      PERMISSIONS.EMPLOYEES_VIEW,
      PERMISSIONS.EMPLOYEES_CREATE,
      PERMISSIONS.EMPLOYEES_UPDATE,
      PERMISSIONS.EMPLOYEES_DELETE,
      PERMISSIONS.EMPLOYEES_EXPORT,
      PERMISSIONS.EMPLOYEES_VIEW_SENSITIVE,
    ],
  },
  {
    group: 'contracts',
    label: 'قرارداد و مدارک',
    codes: [
      PERMISSIONS.CONTRACTS_VIEW,
      PERMISSIONS.CONTRACTS_CREATE,
      PERMISSIONS.CONTRACTS_UPDATE,
      PERMISSIONS.CONTRACTS_APPROVE,
      PERMISSIONS.DOCUMENTS_VIEW,
      PERMISSIONS.DOCUMENTS_CREATE,
      PERMISSIONS.DOCUMENTS_UPDATE,
      PERMISSIONS.DOCUMENTS_DELETE,
    ],
  },
  {
    group: 'attendance',
    label: 'حضور و غیاب',
    codes: [
      PERMISSIONS.ATTENDANCE_VIEW,
      PERMISSIONS.ATTENDANCE_CREATE,
      PERMISSIONS.ATTENDANCE_UPDATE,
      PERMISSIONS.ATTENDANCE_APPROVE,
      PERMISSIONS.ATTENDANCE_EXPORT,
    ],
  },
  {
    group: 'shifts',
    label: 'شیفت و برنامه کاری',
    codes: [
      PERMISSIONS.SHIFTS_VIEW,
      PERMISSIONS.SHIFTS_MANAGE,
      PERMISSIONS.SHIFTS_SWAP,
      PERMISSIONS.SHIFTS_APPROVE,
    ],
  },
  {
    group: 'leaves',
    label: 'مرخصی',
    codes: [
      PERMISSIONS.LEAVES_VIEW,
      PERMISSIONS.LEAVES_CREATE,
      PERMISSIONS.LEAVES_UPDATE,
      PERMISSIONS.LEAVES_APPROVE,
      PERMISSIONS.LEAVES_MANAGE_TYPES,
    ],
  },
  {
    group: 'payroll',
    label: 'حقوق و دستمزد',
    codes: [
      PERMISSIONS.PAYROLL_VIEW,
      PERMISSIONS.PAYROLL_CREATE,
      PERMISSIONS.PAYROLL_UPDATE,
      PERMISSIONS.PAYROLL_REVIEW,
      PERMISSIONS.PAYROLL_APPROVE,
      PERMISSIONS.PAYROLL_PUBLISH,
      PERMISSIONS.PAYROLL_VIEW_OWN,
      PERMISSIONS.PAYROLL_EXPORT,
    ],
  },
  {
    group: 'evaluations',
    label: 'ارزیابی عملکرد',
    codes: [
      PERMISSIONS.EVALUATIONS_VIEW,
      PERMISSIONS.EVALUATIONS_MANAGE,
      PERMISSIONS.EVALUATIONS_RATE,
      PERMISSIONS.EVALUATIONS_APPROVE,
    ],
  },
  {
    group: 'tasks',
    label: 'وظایف',
    codes: [
      PERMISSIONS.TASKS_VIEW,
      PERMISSIONS.TASKS_CREATE,
      PERMISSIONS.TASKS_UPDATE,
      PERMISSIONS.TASKS_DELETE,
      PERMISSIONS.TASKS_APPROVE,
    ],
  },
  {
    group: 'panel',
    label: 'پنل کارمند',
    codes: [PERMISSIONS.PANEL_VIEW, PERMISSIONS.PANEL_ATTENDANCE, PERMISSIONS.PANEL_LEAVE_REQUEST],
  },
  {
    group: 'projects',
    label: 'پروژه‌ها',
    codes: [
      PERMISSIONS.PROJECTS_VIEW,
      PERMISSIONS.PROJECTS_CREATE,
      PERMISSIONS.PROJECTS_UPDATE,
      PERMISSIONS.PROJECTS_DELETE,
    ],
  },
  {
    group: 'assets',
    label: 'دارایی و تجهیزات',
    codes: [
      PERMISSIONS.ASSETS_VIEW,
      PERMISSIONS.ASSETS_MANAGE,
      PERMISSIONS.ASSETS_HANDOVER,
    ],
  },
  {
    group: 'training',
    label: 'آموزش و گواهینامه',
    codes: [PERMISSIONS.TRAINING_VIEW, PERMISSIONS.TRAINING_MANAGE],
  },
  {
    group: 'approvals',
    label: 'گردش تأیید',
    codes: [
      PERMISSIONS.APPROVALS_VIEW,
      PERMISSIONS.APPROVALS_DECIDE,
      PERMISSIONS.APPROVALS_MANAGE,
    ],
  },
  {
    group: 'recruitment',
    label: 'استخدام و جذب',
    codes: [
      PERMISSIONS.RECRUITMENT_VIEW,
      PERMISSIONS.RECRUITMENT_MANAGE,
      PERMISSIONS.RECRUITMENT_INTERVIEW,
    ],
  },
  {
    group: 'lifecycle',
    label: 'ورود و خروج نیرو',
    codes: [PERMISSIONS.LIFECYCLE_VIEW, PERMISSIONS.LIFECYCLE_MANAGE],
  },
  {
    group: 'missions',
    label: 'مأموریت',
    codes: [
      PERMISSIONS.MISSIONS_VIEW,
      PERMISSIONS.MISSIONS_CREATE,
      PERMISSIONS.MISSIONS_APPROVE,
    ],
  },
  {
    group: 'loans',
    label: 'وام و مزایا',
    codes: [
      PERMISSIONS.LOANS_VIEW,
      PERMISSIONS.LOANS_CREATE,
      PERMISSIONS.LOANS_APPROVE,
      PERMISSIONS.BENEFITS_VIEW,
      PERMISSIONS.BENEFITS_MANAGE,
    ],
  },
  {
    group: 'admin',
    label: 'مکاتبات، جلسات و نظرسنجی',
    codes: [
      PERMISSIONS.ADMIN_VIEW,
      PERMISSIONS.ADMIN_MANAGE,
      PERMISSIONS.SURVEYS_VIEW,
      PERMISSIONS.SURVEYS_MANAGE,
      PERMISSIONS.SUGGESTIONS_VIEW,
      PERMISSIONS.SUGGESTIONS_MANAGE,
      PERMISSIONS.CONFIDENTIAL_REPORTS_MANAGE,
    ],
  },
  {
    group: 'notifications',
    label: 'اعلان‌ها و اعلامیه‌ها',
    codes: [
      PERMISSIONS.NOTIFICATIONS_VIEW,
      PERMISSIONS.ANNOUNCEMENTS_VIEW,
      PERMISSIONS.ANNOUNCEMENTS_MANAGE,
    ],
  },
  {
    group: 'users',
    label: 'کاربران و نقش‌ها',
    codes: [
      PERMISSIONS.USERS_VIEW,
      PERMISSIONS.USERS_CREATE,
      PERMISSIONS.USERS_UPDATE,
      PERMISSIONS.USERS_DELETE,
      PERMISSIONS.USERS_MANAGE_ROLES,
      PERMISSIONS.USERS_MANAGE_SESSIONS,
      PERMISSIONS.ROLES_VIEW,
      PERMISSIONS.ROLES_MANAGE,
    ],
  },
  {
    group: 'reports',
    label: 'گزارش‌ها',
    codes: [PERMISSIONS.REPORTS_VIEW, PERMISSIONS.REPORTS_EXPORT],
  },
  {
    group: 'system',
    label: 'تنظیمات و امنیت',
    codes: [
      PERMISSIONS.SETTINGS_VIEW,
      PERMISSIONS.SETTINGS_MANAGE,
      PERMISSIONS.AUDIT_VIEW,
      PERMISSIONS.BACKUP_MANAGE,
    ],
  },
];

export const PERMISSION_LABELS: Record<string, string> = {
  view: 'مشاهده',
  create: 'ایجاد',
  update: 'ویرایش',
  delete: 'حذف',
  approve: 'تأیید',
  cancel: 'لغو',
  export: 'خروجی گرفتن',
  manage: 'مدیریت',
  import: 'ورود اطلاعات',
  decide: 'تصمیم‌گیری',
  handover: 'تحویل / بازپس‌گیری',
  rate: 'ارزیابی',
  interview: 'مصاحبه',
  swap: 'تعویض',
  review: 'بررسی',
  publish: 'انتشار',
  sensitive: 'مشاهده داده حساس',
  own: 'مشاهده اطلاعات خود',
};

/** برچسب فارسی برای هر کد مجوز */
export function permissionLabel(code: string): string {
  const [module, action] = code.split('.');
  const actionLabel = PERMISSION_LABELS[action] ?? action;
  const group = PERMISSION_GROUPS.find((g) => g.group === module);
  return `${group?.label ?? module} — ${actionLabel}`;
}
