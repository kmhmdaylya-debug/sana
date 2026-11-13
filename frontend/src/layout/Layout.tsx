import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  Briefcase,
  Building2,
  CalendarCheck,
  CalendarDays,
  CalendarRange,
  ClipboardCheck,
  ClipboardList,
  Boxes,
  FileText,
  FolderOpen,
  GanttChartSquare,
  GraduationCap,
  HandCoins,
  LayoutDashboard,
  LogOut,
  Moon,
  NotebookPen,
  Receipt,
  ScrollText,
  Settings,
  ShieldCheck,
  Sun,
  UserCheck,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import { toPersianDigits } from '../lib/format';

interface MenuItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  permission?: string;
  badgeUrl?: string;
}

const MENU: { group: string; items: MenuItem[] }[] = [
  {
    group: 'اصلی',
    items: [
      { to: '/', label: 'داشبورد', icon: <LayoutDashboard size={17} />, permission: 'dashboard.view' },
      { to: '/approvals', label: 'صندوق تأییدها', icon: <ClipboardCheck size={17} />, permission: 'approvals.view' },
    ],
  },
  {
    group: 'منابع انسانی',
    items: [
      { to: '/employees', label: 'نیروها', icon: <Users size={17} />, permission: 'employees.view' },
      { to: '/contracts', label: 'قراردادها', icon: <FileText size={17} />, permission: 'contracts.view' },
      { to: '/documents', label: 'مدارک پرسنلی', icon: <FolderOpen size={17} />, permission: 'documents.view' },
      { to: '/attendance', label: 'حضور و غیاب', icon: <CalendarCheck size={17} />, permission: 'attendance.view' },
      { to: '/shifts', label: 'شیفت‌ها', icon: <CalendarRange size={17} />, permission: 'shifts.view' },
      { to: '/leaves', label: 'مرخصی‌ها', icon: <CalendarDays size={17} />, permission: 'leaves.view' },
      { to: '/missions', label: 'مأموریت‌ها', icon: <Briefcase size={17} />, permission: 'missions.view' },
      { to: '/payroll', label: 'حقوق و دستمزد', icon: <Wallet size={17} />, permission: 'payroll.view' },
      { to: '/evaluations', label: 'ارزیابی عملکرد', icon: <NotebookPen size={17} />, permission: 'evaluations.view' },
    ],
  },
  {
    group: 'همکاری و پشتیبانی',
    items: [
      { to: '/tasks', label: 'وظایف', icon: <ClipboardList size={17} />, permission: 'tasks.view' },
      { to: '/projects', label: 'پروژه‌ها و گانت', icon: <GanttChartSquare size={17} />, permission: 'projects.view' },
      { to: '/assets', label: 'دارایی‌ها', icon: <Boxes size={17} />, permission: 'assets.view' },
      { to: '/training', label: 'آموزش و گواهینامه', icon: <GraduationCap size={17} />, permission: 'training.view' },
      { to: '/loans', label: 'وام و مزایا', icon: <HandCoins size={17} />, permission: 'loans.view' },
    ],
  },
  {
    group: 'جذب و چرخهٔ عمر',
    items: [
      { to: '/recruitment', label: 'استخدام', icon: <UserPlus size={17} />, permission: 'recruitment.view' },
      { to: '/lifecycle', label: 'ورود و خروج نیرو', icon: <UserCheck size={17} />, permission: 'lifecycle.view' },
    ],
  },
  {
    group: 'امور اداری',
    items: [
      { to: '/admin', label: 'مکاتبات و جلسات', icon: <ScrollText size={17} />, permission: 'admin.view' },
      { to: '/announcements', label: 'اعلامیه‌ها', icon: <FileText size={17} />, permission: 'announcements.view' },
      { to: '/notifications', label: 'اعلان‌های من', icon: <Bell size={17} />, permission: 'notifications.view' },
    ],
  },
  {
    group: 'گزارش و سیستم',
    items: [
      { to: '/reports', label: 'گزارش‌ها', icon: <Receipt size={17} />, permission: 'reports.view' },
      { to: '/users', label: 'کاربران', icon: <Users size={17} />, permission: 'users.view' },
      { to: '/roles', label: 'نقش‌ها و مجوزها', icon: <ShieldCheck size={17} />, permission: 'roles.view' },
      { to: '/org', label: 'ساختار سازمانی', icon: <Building2 size={17} />, permission: 'org.view' },
      { to: '/audit', label: 'لاگ ممیزی', icon: <ScrollText size={17} />, permission: 'audit.view' },
      { to: '/settings', label: 'تنظیمات', icon: <Settings size={17} />, permission: 'settings.view' },
      { to: '/backup', label: 'پشتیبان‌گیری', icon: <FolderOpen size={17} />, permission: 'backup.manage' },
    ],
  },
];

const PAGE_TITLES: Record<string, string> = {
  '/': 'داشبورد',
  '/approvals': 'صندوق تأییدها',
  '/employees': 'نیروها',
  '/contracts': 'قراردادها',
  '/documents': 'مدارک پرسنلی',
  '/attendance': 'حضور و غیاب',
  '/shifts': 'شیفت‌ها',
  '/leaves': 'مرخصی‌ها',
  '/missions': 'مأموریت‌ها',
  '/payroll': 'حقوق و دستمزد',
  '/evaluations': 'ارزیابی عملکرد',
  '/tasks': 'وظایف',
  '/assets': 'دارایی‌ها',
  '/training': 'آموزش و گواهینامه',
  '/loans': 'وام و مزایا',
  '/recruitment': 'استخدام',
  '/lifecycle': 'ورود و خروج نیرو',
  '/admin': 'مکاتبات و جلسات',
  '/announcements': 'اعلامیه‌ها',
  '/notifications': 'اعلان‌های من',
  '/reports': 'گزارش‌ها',
  '/users': 'کاربران',
  '/roles': 'نقش‌ها و مجوزها',
  '/org': 'ساختار سازمانی',
  '/audit': 'لاگ ممیزی',
  '/settings': 'تنظیمات',
  '/backup': 'پشتیبان‌گیری',
};

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dark, setDark] = useState(() => localStorage.getItem('sana-theme') === 'dark');
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    localStorage.setItem('sana-theme', dark ? 'dark' : 'light');
  }, [dark]);

  useEffect(() => {
    setSidebarOpen(false);
    let active = true;
    api
      .get('/notifications/unread-count')
      .then((r) => {
        if (active) setUnread(r?.data?.data?.unreadCount ?? 0);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [location.pathname]);

  const visibleMenu = useMemo(
    () =>
      MENU.map((g) => ({
        ...g,
        items: g.items.filter((i) => !i.permission || user?.isSuperAdmin || user?.permissions?.includes(i.permission)),
      })).filter((g) => g.items.length > 0),
    [user],
  );

  const title = PAGE_TITLES[location.pathname] ?? 'سامانهٔ سنا';
  const initials = (user?.fullName ?? '؟').split(' ').slice(0, 2).map((p) => p[0]).join('');

  return (
    <div className="app-shell">
      <aside className={`sidebar${sidebarOpen ? ' open' : ''}`}>
        <div className="sidebar-brand">
          <div className="sidebar-brand-logo">س</div>
          <div>
            <div>سنا</div>
            <div style={{ fontSize: 10.5, fontWeight: 400, color: '#94a3b8' }}>مدیریت منابع انسانی</div>
          </div>
        </div>
        <nav className="sidebar-nav">
          {visibleMenu.map((g) => (
            <div key={g.group}>
              <div className="sidebar-group">{g.group}</div>
              {g.items.map((i) => (
                <NavLink key={i.to} to={i.to} className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`} end={i.to === '/'}>
                  {i.icon}
                  <span>{i.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      <div className="app-main">
        <header className="app-header">
          <button
            className="btn btn-ghost btn-sm mobile-only"
            onClick={() => setSidebarOpen((v) => !v)}
            style={{ background: 'none', border: '1px solid var(--border)', cursor: 'pointer' }}
            aria-label="منو"
          >
            ☰
          </button>
          <div className="header-title">{title}</div>
          <div className="header-spacer" />
          <div className="header-actions">
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => navigate('/notifications')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', position: 'relative', color: 'inherit' }}
              aria-label="اعلان‌ها"
              title="اعلان‌ها"
            >
              <Bell size={18} />
              {unread > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: -4,
                    insetInlineEnd: -4,
                    background: 'var(--red-600)',
                    color: '#fff',
                    borderRadius: 999,
                    fontSize: 10,
                    padding: '1px 5px',
                    fontWeight: 700,
                  }}
                >
                  {toPersianDigits(unread > 99 ? '99+' : unread)}
                </span>
              )}
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setDark((v) => !v)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
              aria-label="تغییر پوسته"
              title={dark ? 'پوستهٔ روشن' : 'پوستهٔ تیره'}
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <div style={{ textAlign: 'left', lineHeight: 1.3 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700 }}>{user?.fullName}</div>
              <div className="text-muted text-xs">{user?.employee?.position?.title ?? user?.roles?.[0]?.name ?? 'کاربر'}</div>
            </div>
            <div className="avatar">{initials}</div>
            <button
              className="btn btn-ghost btn-sm"
              onClick={async () => {
                await logout();
                navigate('/login');
              }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red-600)' }}
              aria-label="خروج"
              title="خروج از حساب"
            >
              <LogOut size={17} />
            </button>
          </div>
        </header>
        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
