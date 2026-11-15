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
  Menu,
  Moon,
  NotebookPen,
  Receipt,
  ScrollText,
  Search,
  Settings,
  ShieldCheck,
  Sun,
  UserCheck,
  UserPlus,
  UserRound,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import { toPersianDigits } from '../lib/format';
import ChangePassword from '../components/ChangePassword';
import DailyAttendance from '../components/DailyAttendance';

interface MenuItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  permission?: string;
  badgeUrl?: string;
  /** شمارندهٔ کنار آیتم منو (مثلاً تعداد تأییدهای در انتظار) */
  count?: number;
  /** فقط برای کاربرانی که پروندهٔ پرسنلی دارند (مثل پنل کارمند) */
  requiresEmployee?: boolean;
}

const MENU: { group: string; items: MenuItem[] }[] = [
  {
    group: 'اصلی',
    items: [
      { to: '/panel', label: 'پنل کارمند', icon: <UserRound size={17} />, permission: 'panel.view', requiresEmployee: true },
      { to: '/', label: 'داشبورد', icon: <LayoutDashboard size={17} />, permission: 'dashboard.view.management' },
      { to: '/approvals', label: 'صندوق تأییدها', icon: <ClipboardCheck size={17} />, permission: 'approvals.view' },
    ],
  },
  {
    group: 'منابع انسانی',
    items: [
      { to: '/users', label: 'کاربران و پرسنل', icon: <Users size={17} />, permission: 'users.view' },
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
  '/users': 'کاربران و پرسنل',
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
  const [search, setSearch] = useState('');
  const [pendingApprovals, setPendingApprovals] = useState(0);

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
    // شمارندهٔ صندوق تأییدها در کنار آیتم منو
    api
      .get('/approvals/inbox')
      .then((r) => {
        const rows = r?.data?.data ?? [];
        if (active) setPendingApprovals(Array.isArray(rows) ? rows.length : (rows?.items?.length ?? 0));
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
        items: g.items
          .filter(
            (i) =>
              (!i.permission || user?.isSuperAdmin || user?.permissions?.includes(i.permission)) &&
              (!i.requiresEmployee || !!user?.employee),
          )
          .map((i) => (i.to === '/approvals' ? { ...i, count: pendingApprovals } : i)),
      })).filter((g) => g.items.length > 0),
    [user, pendingApprovals],
  );

  const title = PAGE_TITLES[location.pathname] ?? 'سامانهٔ سنا';
  const initials = (user?.fullName ?? '؟').split(' ').slice(0, 2).map((p) => p[0]).join('');

  return (
    <div className="app-shell">
      <aside className={`sidebar${sidebarOpen ? ' open' : ''}`}>
        <div className="sidebar-brand">
          <div className="sidebar-brand-logo">سنا</div>
          <div>
            <div>سنا</div>
            <div style={{ fontSize: 10.5, fontWeight: 400, color: 'var(--text-soft)' }}>مدیریت منابع انسانی</div>
          </div>
          <button className="header-icon-btn mobile-only" style={{ marginInlineStart: 'auto' }} aria-label="بستن منو" title="بستن منو" onClick={() => setSidebarOpen(false)}><X size={18} /></button>
        </div>
        <nav className="sidebar-nav">
          {visibleMenu.map((g) => (
            <div key={g.group}>
              <div className="sidebar-group">{g.group}</div>
              {g.items.map((i) => (
                <NavLink key={i.to} to={i.to} className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`} end={i.to === '/'}>
                  {i.icon}
                  <span>{i.label}</span>
                  {i.count !== undefined && <span className="sidebar-link-count">{toPersianDigits(i.count)}</span>}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-foot">
          <div className="sidebar-user">
            <div className="sidebar-user-avatar">{initials}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="sidebar-user-name">{user?.fullName ?? 'کاربر'}</div>
              <div className="sidebar-user-role">{user?.employee?.position?.title ?? user?.roles?.[0]?.name ?? 'کاربر'}</div>
            </div>
            <button
              className="header-icon-btn"
              onClick={async () => {
                await logout();
                navigate('/login');
              }}
              aria-label="خروج"
              title="خروج از حساب"
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>

      <div className="app-main">
        <header className="app-header">
          <button
            className="header-icon-btn mobile-only"
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label="منو"
            aria-expanded={sidebarOpen}
          >
            <Menu size={18} />
          </button>

          <div className="search-box">
            <Search size={16} />
            <input
              className="input"
              placeholder="جست‌وجوی نیرو، پروژه، سند…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && search.trim()) {
                  navigate(`/users?search=${encodeURIComponent(search.trim())}`);
                }
              }}
            />
          </div>

          <div className="header-spacer" />
          <div className="header-actions">
            <ChangePassword />
            <button
              className="header-icon-btn"
              onClick={() => navigate('/notifications')}
              aria-label="اعلان‌ها"
              title="اعلان‌ها"
            >
              <Bell size={18} />
              {unread > 0 && (
                <span className="header-badge-dot">{toPersianDigits(unread > 99 ? '99+' : unread)}</span>
              )}
            </button>
            <button
              className="header-icon-btn"
              onClick={() => setDark((v) => !v)}
              aria-label="تغییر پوسته"
              title={dark ? 'پوستهٔ روشن' : 'پوستهٔ تیره'}
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button
              className="header-icon-btn"
              onClick={() => navigate(user?.employee ? '/panel' : '/users')}
              aria-label="حساب کاربری"
              title={user?.fullName ?? 'حساب کاربری'}
            >
              <div className="avatar" style={{ width: 30, height: 30, fontSize: 11 }}>{initials}</div>
            </button>
          </div>
        </header>
        <main className="app-content">
          {user && <DailyAttendance key={user.id} attendance={!!user.employee} />}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
