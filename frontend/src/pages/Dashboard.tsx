import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CalendarDays, CheckCircle2, Clock, Mail, MessageSquare, MoreVertical } from 'lucide-react';
import { api, apiErrorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Badge, Card, PageHeader, useToast } from '../components/ui';
import { toPersianDigits, statusLabel, badgeKind, formatJalali } from '../lib/format';
import TeamPresence from '../components/TeamPresence';

interface MyDashboard {
  unreadNotifications: number;
  myActiveLeaves: number;
  myOpenTasks: number;
  myPendingSwaps: number;
}

interface ManagementDashboard {
  employees: { total: number; active: number };
  byStatus: { status: string; count: number }[];
  pending: { leaves: number; corrections: number; missions: number; swaps: number; loans: number };
  expiringContracts: number;
  absentToday: number;
  openTasks: number;
  monthAttendance: { records: number; workMinutes: number; overtimeMinutes: number; lateMinutes: number };
}

interface BoardTask {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  dueDate?: string | null;
  progress: number;
  orgUnit?: { name: string } | null;
  assignees?: { employee?: { id: string; firstName: string; lastName: string } | null }[];
  _count?: { comments?: number; attachments?: number };
}

interface AttendanceRow {
  id: string;
  workDate: string;
  workMinutes: number;
  lateMinutes: number;
  status: string;
}

const WEEKDAYS = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];

const fmtMinutes = (m: number) => {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (h && mm) return `${toPersianDigits(h)} ساعت و ${toPersianDigits(mm)} دقیقه`;
  if (h) return `${toPersianDigits(h)} ساعت`;
  return `${toPersianDigits(mm)} دقیقه`;
};

export default function Dashboard() {
  const { user, hasPermission } = useAuth();
  const toast = useToast();
  const [my, setMy] = useState<MyDashboard | null>(null);
  const [mgmt, setMgmt] = useState<ManagementDashboard | null>(null);
  const [tasks, setTasks] = useState<BoardTask[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);

  const canMgmt = hasPermission('dashboard.view.management');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const requests: Promise<any>[] = [api.get('/dashboard/me')];
        if (canMgmt) requests.push(api.get('/dashboard/management'));
        if (hasPermission('tasks.view')) requests.push(api.get('/tasks?limit=60'));
        if (hasPermission('attendance.view')) requests.push(api.get('/attendance/records?limit=200'));
        const [m, mg, t, at] = await Promise.all(requests);
        if (!active) return;
        setMy(m?.data?.data ?? null);
        if (mg) setMgmt(mg?.data?.data ?? null);
        setTasks(t?.data?.data?.items ?? t?.data?.data ?? []);
        setAttendance(at?.data?.data?.items ?? at?.data?.data ?? []);
      } catch (e) {
        toast('error', apiErrorMessage(e));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [canMgmt, toast]);

  /** تعداد رکوردهای حضور در هر روز هفته (۵ روز کاری) */
  const weekBars = useMemo(() => {
    const counts = new Array(5).fill(0);
    for (const r of attendance) {
      const d = new Date(r.workDate);
      const dow = d.getDay(); // 0=یکشنبه … 6=جمعه
      const idx = dow === 6 ? -1 : dow - 1; // شنبه=0 … پنجشنبه=4
      if (idx >= 0 && idx < 5) counts[idx] += 1;
    }
    const max = Math.max(1, ...counts);
    return counts.map((c, i) => ({
      label: WEEKDAYS[i + 1],
      value: c,
      height: Math.round((c / max) * 100),
    }));
  }, [attendance]);

  /** درصد حضور موفق (کارکرد کامل بدون تأخیر) */
  const attendanceRate = useMemo(() => {
    if (!attendance.length) return 0;
    const good = attendance.filter((r) => r.workMinutes >= 420 && (r.lateMinutes ?? 0) <= 15).length;
    return Math.round((good / attendance.length) * 100);
  }, [attendance]);

  const columns = useMemo(() => {
    const defs: { key: string; title: string }[] = [
      { key: 'NEW', title: 'جدید' },
      { key: 'IN_PROGRESS', title: 'در حال انجام' },
      { key: 'DONE', title: 'انجام‌شده' },
      { key: 'CANCELLED', title: 'لغوشده' },
    ];
    return defs.map((d) => ({
      ...d,
      cards: tasks.filter((t) => t.status === d.key),
    }));
  }, [tasks]);

  const totalPending =
    (mgmt?.pending.leaves ?? 0) +
    (mgmt?.pending.corrections ?? 0) +
    (mgmt?.pending.missions ?? 0) +
    (mgmt?.pending.swaps ?? 0) +
    (mgmt?.pending.loans ?? 0);

  return (
    <>
      <PageHeader
        title={`سلام ${user?.fullName ?? ''} 👋`}
        subtitle="خلاصهٔ وضعیت سازمان و کارهای در جریان"
      />

      {canMgmt && <TeamPresence />}

      {/* ---------- پنل تحلیلی ---------- */}
      <div className="hero-panel mb">
        <div className="hero-chart">
          <div className="hero-title">حضور ثبت‌شده در هفتهٔ جاری</div>
          <div className="hero-bars">
            {weekBars.map((b, i) => (
              <div key={i} className="hero-bar-item">
                <div
                  className={`hero-bar${i % 2 === 0 ? '' : ' soft'}`}
                  style={{ height: `${Math.max(6, b.height)}%` }}
                  title={`${b.label}: ${toPersianDigits(b.value)}`}
                />
                <div className="hero-bar-label">{b.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="hero-gauge">
          <Gauge value={attendanceRate} />
        </div>

        <div className="hero-kpis">
          <div>
            <div className="hero-kpi-value">{toPersianDigits(mgmt?.openTasks ?? my?.myOpenTasks ?? 0)}</div>
            <div className="hero-kpi-label">وظایف در جریان</div>
            <Link to="/tasks" className="hero-kpi-link">
              مشاهدهٔ وظایف <ArrowLeft size={13} />
            </Link>
          </div>
          <div>
            <div className="hero-kpi-value">{toPersianDigits(totalPending)}</div>
            <div className="hero-kpi-label">در انتظار تأیید</div>
            <Link to="/approvals" className="hero-kpi-link">
              صندوق تأییدها <ArrowLeft size={13} />
            </Link>
          </div>
        </div>
      </div>

      {/* ---------- کارت‌های خلاصه ---------- */}
      <div className="grid grid-4 mb">
        <StatCard label="کل کاربران" value={toPersianDigits(mgmt?.employees.total ?? 0)} link="/users" />
        <StatCard label="کاربران فعال" value={toPersianDigits(mgmt?.employees.active ?? 0)} link="/users" />
        <StatCard label="غایب امروز" value={toPersianDigits(mgmt?.absentToday ?? 0)} link="/attendance" />
        <StatCard label="قراردادهای رو به انقضا" value={toPersianDigits(mgmt?.expiringContracts ?? 0)} link="/contracts" />
      </div>

      {/* ---------- بوم کانبان وظایف ---------- */}
      {hasPermission('tasks.view') && (
        <Card
          title="بوم کارها"
          subtitle="وظایف بر اساس وضعیت — برای دیدن جزئیات روی هر کارت کلیک کنید"
          className="mb"
        >
          <div className="kanban">
            {columns.map((col) => (
              <div key={col.key} className="kanban-col">
                <div className="kanban-col-head">
                  <span className="kanban-col-title">{col.title}</span>
                  <span className="kanban-col-count">{toPersianDigits(col.cards.length)}</span>
                  <button className="kanban-col-menu" aria-label="گزینه‌ها">
                    <MoreVertical size={15} />
                  </button>
                </div>
                <div className="kanban-cards">
                  {col.cards.slice(0, 8).map((t) => (
                    <TaskCard key={t.id} task={t} />
                  ))}
                  {col.cards.length === 0 && (
                    <div className="text-muted text-xs" style={{ padding: '14px 4px' }}>
                      موردی در این ستون نیست
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {loading && <div className="skeleton" style={{ height: 120 }} />}
    </>
  );
}

/* ==========================================================================
   گیج نیم‌دایره
   ========================================================================== */

function Gauge({ value }: { value: number }) {
  const radius = 58;
  const circumference = Math.PI * radius; // نیم‌دایره
  const offset = circumference * (1 - Math.min(100, Math.max(0, value)) / 100);
  return (
    <div className="gauge">
      <svg width="150" height="80" viewBox="0 0 150 80">
        <path
          className="gauge-track"
          d="M 17 72 A 58 58 0 0 1 133 72"
          fill="none"
          strokeWidth="13"
          strokeLinecap="round"
        />
        <path
          className="gauge-value"
          d="M 17 72 A 58 58 0 0 1 133 72"
          fill="none"
          strokeWidth="13"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="gauge-center">
        <div className="gauge-number">{toPersianDigits(value)}٪</div>
        <div className="gauge-label">حضور منظم</div>
      </div>
    </div>
  );
}

/* ==========================================================================
   کارت کانبان
   ========================================================================== */

function TaskCard({ task }: { task: BoardTask }) {
  const assignees = (task.assignees ?? []).map((a) => a.employee).filter(Boolean) as {
    id: string;
    firstName: string;
    lastName: string;
  }[];
  const dark = task.priority === 'CRITICAL';

  return (
    <div className={`kanban-card${dark ? ' dark' : ''}`}>
      <div className="kanban-card-head">
        <Link to="/tasks" className="kanban-card-title" style={{ color: 'inherit', textDecoration: 'none' }}>
          {task.title}
        </Link>
        <button className="kanban-card-menu" aria-label="گزینه‌ها">
          <MoreVertical size={15} />
        </button>
      </div>
      {task.description && <div className="kanban-card-desc">{task.description}</div>}
      <div className="kanban-card-foot">
        {task.dueDate && (
          <span className="kanban-chip">
            <CalendarDays size={12} /> {formatJalali(task.dueDate)}
          </span>
        )}
        {task.orgUnit?.name && <span className="kanban-chip">{task.orgUnit.name}</span>}
        <span className="kanban-meta">
          <MessageSquare size={12} /> {toPersianDigits(task._count?.comments ?? 0)}
        </span>
        {assignees.slice(0, 2).map((a) => (
          <span key={a.id} className="avatar" title={`${a.firstName} ${a.lastName}`}>
            {a.firstName[0]}
            {a.lastName[0]}
          </span>
        ))}
      </div>
    </div>
  );
}

function StatCard({ label, value, link }: { label: string; value: string; link: string }) {
  return (
    <Link to={link} style={{ textDecoration: 'none' }}>
      <div className="stat-card">
        <div className="stat-icon blue">
          <CheckCircle2 size={17} />
        </div>
        <div>
          <div className="stat-value">{value}</div>
          <div className="stat-label">{label}</div>
        </div>
      </div>
    </Link>
  );
}
