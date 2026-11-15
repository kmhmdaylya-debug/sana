import { useEffect, useMemo, useRef, useState } from 'react';
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
  PanelRightClose,
  PanelRightOpen,
  ChevronDown,
  ChevronLeft,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import { toPersianDigits } from '../lib/format';
import ChangePassword from '../components/ChangePassword';
import DailyAttendance from '../components/DailyAttendance';
import GlobalSearch from '../components/GlobalSearch';
import PageBoundary from '../components/PageBoundary';
import { applyTheme, readTheme } from '../lib/theme';

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
  requiresManagement?: boolean;
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
      { to: '/attendance', label: 'حضور و غیاب', icon: <CalendarCheck size={17} />, permission: 'attendance.view', requiresManagement: true },
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
  '/panel': 'پنل کارمند',
  '/projects': 'پروژه‌ها و گانت',
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
  const { user, logout, hasPermission } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sana-sidebar') === 'collapsed');
  const [dark, setDark] = useState(() => readTheme() === 'dark');
  const [unread, setUnread] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [closedGroups, setClosedGroups] = useState<string[]>([]);
  const aside = useRef<HTMLElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const profile = useRef<HTMLDetailsElement>(null);

  useEffect(() => { applyTheme(dark ? 'dark' : 'light'); }, [dark]);
  useEffect(() => { localStorage.setItem('sana-sidebar', collapsed ? 'collapsed' : 'expanded'); }, [collapsed]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setSearchOpen(v => !v); }
      if (event.key === 'Escape') { setSidebarOpen(false); if (profile.current) profile.current.open = false; }
    };
    document.addEventListener('keydown', onKey);
    const closeProfile = (event: PointerEvent) => { if (profile.current && !profile.current.contains(event.target as Node)) profile.current.open = false; };
    document.addEventListener('pointerdown', closeProfile);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', closeProfile); };
  }, []);
  useEffect(() => {
    if (!sidebarOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const old = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusFrame = requestAnimationFrame(() => aside.current?.querySelector<HTMLElement>('button,a')?.focus());
    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const controls = Array.from(aside.current?.querySelectorAll<HTMLElement>('a[href],button:not(:disabled)') ?? []).filter(el => el.getClientRects().length > 0);
      const first = controls[0], last = controls[controls.length-1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', trap);
    return () => { cancelAnimationFrame(focusFrame); document.body.style.overflow = old; document.removeEventListener('keydown', trap); (previous?.isConnected ? previous : menuButton.current)?.focus(); };
  }, [sidebarOpen]);
  useEffect(() => {
    setSidebarOpen(false);
    const activeGroup = MENU.find(group => group.items.some(item => item.to === location.pathname));
    if (activeGroup) setClosedGroups(groups => groups.filter(group => group !== activeGroup.group));
    if (profile.current) profile.current.open = false;
    document.title = `${PAGE_TITLES[location.pathname] ?? 'کارهای تیم'} | سنا`;
    let active = true;
    if (hasPermission('notifications.view')) api.get('/notifications/unread-count').then(r => { if (active) setUnread(r?.data?.data?.unreadCount ?? 0); }).catch(() => {});
    if (hasPermission('approvals.view')) api.get('/approvals/inbox').then(r => {
      const rows = r?.data?.data ?? [];
      if (active) setPendingApprovals(Array.isArray(rows) ? rows.length : (rows?.items?.length ?? 0));
    }).catch(() => {});
    return () => { active = false; };
  }, [location.pathname, hasPermission]);

  const visibleMenu = useMemo(() => MENU.map(g => ({
    ...g,
    items: g.items.filter(i => (!i.permission || hasPermission(i.permission)) && (!i.requiresEmployee || !!user?.employee) && (!i.requiresManagement || hasPermission('dashboard.view.management')))
      .map(i => i.to === '/approvals' ? { ...i, count:pendingApprovals } : i),
  })).filter(g => g.items.length > 0), [user, pendingApprovals, hasPermission]);
  const currentGroup = visibleMenu.find(group => group.items.some(item => item.to === location.pathname));
  const title = location.pathname === '/' ? 'کارهای تیم' : PAGE_TITLES[location.pathname] ?? 'سامانه سنا';
  const initials = (user?.fullName ?? 'کاربر').split(' ').slice(0,2).map(p => p[0]).join('');
  const role = user?.isSuperAdmin ? 'مدیر سیستم' : user?.employee?.position?.title ?? user?.roles?.[0]?.name ?? 'کاربر';
  const signOut = async () => { await logout(); navigate('/login'); };

  return <div className={`app-shell${collapsed ? ' sidebar-collapsed' : ''}`}>
    <a className="skip-link" href="#main-content">رفتن به محتوای اصلی</a>
    {sidebarOpen && <button type="button" className="sidebar-backdrop" aria-label="بستن منو" onClick={() => setSidebarOpen(false)} />}
    <aside ref={aside} id="main-sidebar" className={`sidebar${sidebarOpen ? ' open' : ''}`} role={sidebarOpen ? 'dialog' : undefined} aria-modal={sidebarOpen || undefined} aria-label="منوی اصلی">
      <div className="sidebar-brand">
        <img className="sidebar-brand-logo" src="/favicon.svg" alt="" width={36} height={36} />
        <div className="brand-copy"><strong>سنا</strong><span>مدیریت منابع انسانی</span></div>
        <button type="button" className="header-icon-btn mobile-only" aria-label="بستن منو" title="بستن منو" onClick={() => setSidebarOpen(false)}><X size={19} /></button>
      </div>
      <nav className="sidebar-nav" aria-label="بخش‌های سامانه">
        {visibleMenu.map(g => {
          const groupClosed = closedGroups.includes(g.group);
          return <div className="sidebar-section" key={g.group}>
            <button type="button" className="sidebar-group" aria-expanded={!groupClosed} onClick={() => setClosedGroups(groups => groups.includes(g.group) ? groups.filter(name => name !== g.group) : [...groups,g.group])}><span>{g.group}</span><ChevronDown size={12} /></button>
            <div className={groupClosed ? 'sidebar-group-items is-closed' : 'sidebar-group-items'}>{g.items.map(item => <NavLink key={item.to} to={item.to} end={item.to === '/'} title={collapsed ? item.label : undefined} aria-label={item.label} className={({isActive}) => `sidebar-link${isActive ? ' active' : ''}`}>
              {item.icon}<span className="sidebar-link-label">{item.label}</span>{!!item.count && <span className="sidebar-link-count">{toPersianDigits(item.count)}</span>}
            </NavLink>)}</div>
          </div>;
        })}
      </nav>
      <div className="sidebar-foot">
        <button type="button" className="sidebar-collapse" onClick={() => setCollapsed(v => !v)} title={collapsed ? 'باز کردن منو' : 'جمع کردن منو'} aria-label={collapsed ? 'باز کردن منو' : 'جمع کردن منو'} aria-expanded={!collapsed}>{collapsed ? <PanelRightOpen size={18} /> : <PanelRightClose size={18} />}<span>جمع کردن منو</span></button>
        <div className="sidebar-user"><span className="sidebar-user-avatar">{initials}</span><div className="sidebar-user-copy"><div className="sidebar-user-name">{user?.fullName}</div><div className="sidebar-user-role">{role}</div></div><button type="button" className="header-icon-btn" onClick={() => void signOut()} aria-label="خروج" title="خروج از حساب"><LogOut size={17} /></button></div>
      </div>
    </aside>
    <div className="app-main" {...(sidebarOpen ? { inert: '' } : {})}>
      <header className="app-header">
        <button ref={menuButton} type="button" className="header-icon-btn mobile-only" onClick={() => setSidebarOpen(v => !v)} aria-label="منو" aria-expanded={sidebarOpen} aria-controls="main-sidebar"><Menu size={20} /></button>
        <nav className="header-breadcrumb" aria-label="مسیر صفحه"><span>{currentGroup?.group ?? 'سنا'}</span><ChevronLeft size={13} /><strong>{title}</strong></nav>
        <button type="button" className="header-search" onClick={() => setSearchOpen(true)} aria-label="جست‌وجوی سراسری" title="جست‌وجوی سراسری"><Search size={17} /><span>جست‌وجو در سنا</span></button>
        <div className="header-spacer" />
        {user && <DailyAttendance />}
        <div className="header-actions">
          <ChangePassword />
          {hasPermission('notifications.view') && <button type="button" className="header-icon-btn" onClick={() => navigate('/notifications')} aria-label="اعلان‌ها" title="اعلان‌ها"><Bell size={18} />{unread > 0 && <span className="header-badge-dot">{toPersianDigits(unread > 99 ? '99+' : unread)}</span>}</button>}
          <button type="button" className="header-icon-btn" onClick={() => setDark(v => !v)} aria-label={dark ? 'فعال کردن تم روشن' : 'فعال کردن تم تیره'} title={dark ? 'تم روشن' : 'تم تیره'}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button>
          <details ref={profile} className="profile-menu">
            <summary aria-label="حساب کاربری" title={user?.fullName}><span className="avatar">{initials}</span><ChevronDown size={12} /></summary>
            <div className="profile-dropdown"><strong>{user?.fullName}</strong><span>{role}</span><span className="ltr">{user?.username}</span>{user?.employee && hasPermission('panel.view') && <NavLink to="/panel"><UserRound size={16} />پنل کارمند</NavLink>}{hasPermission('settings.view') && <NavLink to="/settings"><Settings size={16} />تنظیمات</NavLink>}<button type="button" onClick={() => void signOut()}><LogOut size={16} />خروج از حساب</button></div>
          </details>
        </div>
      </header>
      <main className="app-content" id="main-content" tabIndex={-1}><PageBoundary key={location.pathname}><Outlet /></PageBoundary></main>
    </div>
    <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} links={visibleMenu.flatMap(group => group.items)} />
  </div>;
}
