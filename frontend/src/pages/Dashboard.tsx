import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ArrowUp, ArrowDown, CalendarDays, CheckCircle2, Clock, Mail, MessageSquare, MoreVertical } from 'lucide-react';
import axios from 'axios';
import { api, apiErrorMessage, createAbortController } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Badge, Card, PageHeader, useToast } from '../components/ui';
import { toPersianDigits, statusLabel, badgeKind, formatJalali } from '../lib/format';
import TeamPresence from '../components/TeamPresence';
import TeamWork from '../components/TeamWork';
import TaskCountdown from '../components/TaskCountdown';
import TaskStatusMark from '../components/TaskStatusMark';
import { WorkCategoryTag } from '../components/WorkCategory';
import { categoryStyle } from '../lib/workCategories';

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
  category?: string | null;
  delayReason?: string | null;
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
  const { hasPermission } = useAuth();
  return hasPermission('dashboard.view.management') ? <TeamWork /> : <PersonalDashboard />;
}

function PersonalDashboard() {
  const { user, hasPermission } = useAuth();
  const toast = useToast();
  const [my, setMy] = useState<MyDashboard | null>(null);
  const [mgmt, setMgmt] = useState<ManagementDashboard | null>(null);
  const [tasks, setTasks] = useState<BoardTask[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Kanban keyboard navigation state
  const [focusedColumnIndex, setFocusedColumnIndex] = useState(0);
  const [focusedCardIndex, setFocusedCardIndex] = useState(-1);
  const columnRefs = useRef<(HTMLDivElement | null)[]>([]);
  const cardRefs = useRef<Map<number, (HTMLDivElement | null)[]>>(new Map());

  const canMgmt = hasPermission('dashboard.view.management');

  useEffect(() => {
    const controller = createAbortController();
    let active = true;
    (async () => {
      try {
        const [m, mg, t, at] = await Promise.all([
          api.get('/dashboard/me', { signal: controller.signal }),
          canMgmt ? api.get('/dashboard/management', { signal: controller.signal }) : null,
          hasPermission('tasks.view') ? api.get('/tasks?limit=60', { signal: controller.signal }) : null,
          hasPermission('attendance.view') ? api.get('/attendance/records?limit=200', { signal: controller.signal }) : null,
        ]);
        if (!active) return;
        setMy(m?.data?.data ?? null);
        if (mg) setMgmt(mg?.data?.data ?? null);
        setTasks(t?.data?.data?.items ?? t?.data?.data ?? []);
        setAttendance(at?.data?.data?.items ?? at?.data?.data ?? []);
      } catch (e) {
        if (axios.isCancel(e) || (e as Error).name === 'CanceledError') return;
        toast('error', apiErrorMessage(e));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
      controller.abort();
    };
  }, [canMgmt, toast]);

  /** تعداد رکوردهای حضور در هر روز هفته (۵ روز کاری) */
  const weekBars = useMemo(() => {
    const formatter = new Intl.DateTimeFormat('en-CA', { timeZone:'Asia/Tehran', year:'numeric', month:'2-digit', day:'2-digit' });
    const days = Array.from({length:7},(_,index) => { const date = new Date(); date.setDate(date.getDate()-6+index); return date; });
    const counts = days.map(date => attendance.filter(row => row.workDate.slice(0,10) === formatter.format(date)).length);
    const max = Math.max(1, ...counts);
    return counts.map((c, i) => ({
      label: new Intl.DateTimeFormat('fa-IR', { timeZone:'Asia/Tehran', weekday:'short' }).format(days[i]),
      value: c,
      height: Math.round((c / max) * 100),
    }));
  }, [attendance]);

  /** درصد حضور موفق (کارکرد کامل بدون تأخیر) */
  const attendanceRate = useMemo(() => {
    if (!attendance.length) return 0;
    const good = attendance.filter((r) => (r.lateMinutes ?? 0) === 0).length;
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

  // Kanban keyboard navigation handlers
  const handleKanbanKeyDown = useCallback((e: React.KeyboardEvent) => {
    const colCount = columns.length;
    const currentColumn = columns[focusedColumnIndex];
    const cardCount = currentColumn?.cards.length ?? 0;

    switch (e.key) {
      case 'ArrowRight': // RTL: next column (lower index)
        e.preventDefault();
        if (focusedCardIndex >= 0) {
          setFocusedCardIndex(-1); // Exit card, focus column header
        } else if (focusedColumnIndex > 0) {
          setFocusedColumnIndex(prev => prev - 1);
        }
        break;
      case 'ArrowLeft': // RTL: previous column (higher index)
        e.preventDefault();
        if (focusedCardIndex >= 0) {
          setFocusedCardIndex(-1);
        } else if (focusedColumnIndex < colCount - 1) {
          setFocusedColumnIndex(prev => prev + 1);
        }
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (focusedCardIndex < 0) {
          // Enter first card in column
          if (cardCount > 0) setFocusedCardIndex(0);
        } else if (focusedCardIndex < cardCount - 1) {
          setFocusedCardIndex(prev => prev + 1);
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (focusedCardIndex > 0) {
          setFocusedCardIndex(prev => prev - 1);
        } else if (focusedCardIndex === 0) {
          // Exit to column header
          setFocusedCardIndex(-1);
        }
        break;
      case 'Enter':
      case ' ':
        if (focusedCardIndex >= 0) {
          e.preventDefault();
          const card = currentColumn?.cards[focusedCardIndex];
          if (card) {
            // Navigate to task detail
            window.location.href = `/tasks`;
          }
        }
        break;
      case 'Home':
        e.preventDefault();
        if (focusedCardIndex >= 0) setFocusedCardIndex(0);
        break;
      case 'End':
        e.preventDefault();
        if (focusedCardIndex >= 0) setFocusedCardIndex(cardCount - 1);
        break;
      case 'Escape':
        if (focusedCardIndex >= 0) {
          e.preventDefault();
          setFocusedCardIndex(-1);
        }
        break;
    }
  }, [columns, focusedColumnIndex, focusedCardIndex]);

  return (
    <>
      <PageHeader
        title={`سلام ${user?.fullName ?? ''}`}
        subtitle="خلاصهٔ وضعیت سازمان و کارهای در جریان"
      />

      {canMgmt && <TeamPresence />}

      {/* ---------- پنل تحلیلی ---------- */}
      <div className="hero-panel mb">
        <div className="hero-chart">
          <div className="hero-title">حضور ثبت‌شده در هفت روز اخیر</div>
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
            <div className="hero-kpi-label">task در جریان</div>
            <Link to="/tasks" className="hero-kpi-link">
              مشاهدهٔ task <ArrowLeft size={13} />
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
        <StatCard label="کارهای باز من" value={loading ? '—' : toPersianDigits(my?.myOpenTasks ?? 0)} link="/tasks" />
        <StatCard label="درخواست‌های مرخصی من" value={loading ? '—' : toPersianDigits(my?.myActiveLeaves ?? 0)} link="/leaves" />
        <StatCard label="جابه‌جایی شیفت در انتظار" value={loading ? '—' : toPersianDigits(my?.myPendingSwaps ?? 0)} link="/shifts" />
        <StatCard label="اعلان‌های خوانده‌نشده" value={loading ? '—' : toPersianDigits(my?.unreadNotifications ?? 0)} link="/notifications" />
      </div>

      {/* ---------- بوم کانبان task ---------- */}
      {hasPermission('tasks.view') && (
        <Card
          title="بوم کارها"
          className="mb"
        >
          <div
            className="kanban"
            role="listbox"
            aria-label="بوم کارها - ستون‌ها"
            onKeyDown={handleKanbanKeyDown}
            tabIndex={0}
          >
            {columns.map((col, colIdx) => (
              <div
                key={col.key}
                ref={el => { columnRefs.current[colIdx] = el; }}
                className={`kanban-col${focusedColumnIndex === colIdx ? ' focused' : ''}`}
                role="group"
                aria-labelledby={`kanban-col-${col.key}`}
              >
                <div className="kanban-col-head">
                  <span id={`kanban-col-${col.key}`} className="kanban-col-title">{col.title}</span>
                  <span className="kanban-col-count">{toPersianDigits(col.cards.length)}</span>
                  <Link className="kanban-col-menu" to="/tasks" aria-label="مشاهده task" title="مشاهده task"><ArrowLeft size={15} /></Link>
                </div>
                <div
                  className="kanban-cards"
                  role="list"
                  aria-label={`${col.title} - ${toPersianDigits(col.cards.length)} کار`}
                >
                  {col.cards.slice(0, 8).map((t, cardIdx) => (
                    <TaskCard
                      key={t.id}
                      task={t}
                      cardIdx={cardIdx}
                      colIdx={colIdx}
                      isFocused={focusedColumnIndex === colIdx && focusedCardIndex === cardIdx}
                      onFocus={() => {
                        setFocusedColumnIndex(colIdx);
                        setFocusedCardIndex(cardIdx);
                      }}
                      cardRef={el => {
                        if (!cardRefs.current.has(colIdx)) cardRefs.current.set(colIdx, []);
                        cardRefs.current.get(colIdx)![cardIdx] = el;
                      }}
                    />
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
        <div className="gauge-label">رکوردهای بدون تأخیر</div>
      </div>
    </div>
  );
}

/* ==========================================================================
   کارت کانبان
   ========================================================================== */

interface TaskCardProps {
  task: BoardTask;
  cardIdx: number;
  colIdx: number;
  isFocused: boolean;
  onFocus: () => void;
  cardRef: (el: HTMLDivElement | null) => void;
}

function TaskCard({ task, cardIdx, colIdx, isFocused, onFocus, cardRef }: TaskCardProps) {
  const assignees = (task.assignees ?? []).map((a) => a.employee).filter(Boolean) as {
    id: string;
    firstName: string;
    lastName: string;
  }[];
  const dark = task.priority === 'CRITICAL';

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Let parent handle navigation keys
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'Escape', 'Enter', ' '].includes(e.key)) {
      return; // Allow parent handler
    }
  };

  return (
    <div
      ref={cardRef}
      onFocus={onFocus}
      onKeyDown={handleKeyDown}
      style={categoryStyle(task.category)}
      className={`kanban-card status-${task.delayReason ? 'blocked' : task.status.toLowerCase()}${dark ? ' dark' : ''}${task.category ? ' has-category' : ''}${isFocused ? ' focused' : ''}`}
      role="option"
      aria-selected={isFocused}
      tabIndex={isFocused ? 0 : -1}
      aria-label={`${task.title}، ${task.status === 'NEW' ? 'جدید' : task.status === 'IN_PROGRESS' ? 'در حال انجام' : task.status === 'DONE' ? 'انجام‌شده' : 'لغوشده'}، اولویت ${task.priority}`}
    >
      <div className="kanban-card-head">
        <TaskStatusMark status={task.status} blocked={!!task.delayReason} />
        <Link to="/tasks" className="kanban-card-title" style={{ color: 'inherit', textDecoration: 'none' }}>
          {task.title}
        </Link>
        <Link className="kanban-card-menu" to="/tasks" aria-label="مشاهده task" title="مشاهده task"><ArrowLeft size={15} /></Link>
      </div>
      {task.description && <div className="kanban-card-desc">{task.description}</div>}
      <div className="kanban-card-foot">
        {task.dueDate && (
          <span className="kanban-chip">
            <CalendarDays size={12} /> {formatJalali(task.dueDate)}
          </span>
        )}
        <TaskCountdown dueDate={task.dueDate} status={task.status} />
        <WorkCategoryTag value={task.category} />
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
