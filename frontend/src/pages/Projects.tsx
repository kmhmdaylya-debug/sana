import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Trash2, GanttChartSquare } from 'lucide-react';
import { api, apiErrorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useList } from '../lib/useList';
import { DatePicker, Tabs,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  Field,
  Input,
  ListToolbar,
  Modal,
  PageHeader,
  Select,
  Textarea,
  useToast,
  type Column,
} from '../components/ui';
import { formatJalali, toPersianDigits, parseDateInput, toJalali } from '../lib/format';
import { normalizeSearch } from '../lib/search';

interface Member {
  id: string;
  role: string;
  employee: { id: string; code: string; firstName: string; lastName: string; position?: { title: string } | null };
}

interface ProjectTask {
  id: string;
  title: string;
  phase?: string | null;
  startDate: string;
  endDate: string;
  progress: number;
  status: string;
  priority: string;
  color?: string | null;
  sortOrder: number;
  dependsOnId?: string | null;
  assignee?: { id: string; firstName: string; lastName: string } | null;
  dependsOn?: { id: string; title: string } | null;
}

interface Project {
  id: string;
  code: string;
  title: string;
  description?: string | null;
  startDate: string;
  endDate: string;
  status: string;
  priority: string;
  progress: number;
  color?: string | null;
  manager?: { id: string; firstName: string; lastName: string } | null;
  members: Member[];
  tasks: ProjectTask[];
  _count?: { tasks: number; members: number };
}

interface Employee {
  id: string;
  code: string;
  firstName: string;
  lastName: string;
  position?: { title: string } | null;
}

const DAY = 86_400_000;
const STATUS_LABELS: Record<string, string> = {
  PLANNING: 'در حال برنامه‌ریزی',
  ACTIVE: 'در حال اجرا',
  ON_HOLD: 'متوقف',
  COMPLETED: 'تکمیل‌شده',
  CANCELLED: 'لغوشده',
};
const PRIORITY_LABELS: Record<string, string> = {
  LOW: 'کم',
  MEDIUM: 'متوسط',
  HIGH: 'زیاد',
  CRITICAL: 'بحرانی',
};
const PRIORITY_COLORS: Record<string, string> = {
  LOW: '#68758a',
  MEDIUM: '#4778d8',
  HIGH: '#a77524',
  CRITICAL: '#ba4859',
};
const PALETTE = ['#27805e', '#4778d8', '#8060ad', '#ba4859', '#a77524', '#467a73', '#307c99', '#a65f8c'];

const toDate = (v: string) => new Date(v);
const dayDiff = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / DAY);

export default function Projects() {
  const toast = useToast();
  const { hasPermission } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get('search') ?? '';
  const [view, setView] = useState<'timeline' | 'gantt'>('timeline');
  const [data, setData] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [taskFor, setTaskFor] = useState<Project | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    code: '',
    title: '',
    description: '',
    startDate: '',
    endDate: '',
    priority: 'MEDIUM',
    status: 'PLANNING',
    color: PALETTE[0],
    managerId: '',
    memberIds: [] as string[],
  });
  const employees = useList<Employee>('/employees', { limit: 200 });

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const r = await api.get('/projects/timeline');
      const body = r?.data?.data ?? r?.data;
      setData(body?.projects ?? []);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submitProject = async () => {
    setSaving(true);
    try {
      const startDate = parseDateInput(form.startDate);
      const endDate = parseDateInput(form.endDate);
      if (!startDate || !endDate) throw new Error('قالب تاریخ معتبر نیست (نمونه: ۱۴۰۴/۰۱/۰۱).');
      await api.post('/projects', {
        code: form.code.trim(),
        title: form.title.trim(),
        description: form.description || undefined,
        startDate,
        endDate,
        priority: form.priority,
        status: form.status,
        color: form.color,
        managerId: form.managerId || undefined,
        memberIds: form.memberIds,
      });
      toast('success', 'پروژه ایجاد شد.');
      setCreateOpen(false);
      setForm({ ...form, code: '', title: '', description: '', startDate: '', endDate: '', memberIds: [] });
      void load();
    } catch (e) {
      toast('error', e instanceof Error ? e.message : apiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const removeProject = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/projects/${deleteTarget.id}`);
      toast('success', 'پروژه حذف شد.');
      setDeleteTarget(null);
      void load();
    } catch (e) {
      toast('error', apiErrorMessage(e));
    }
  };

  const progressOf = (p: Project) => {
    if (!p.tasks.length) return p.progress;
    return Math.round(p.tasks.reduce((s, t) => s + t.progress, 0) / p.tasks.length);
  };
  const visibleProjects = data.filter(project => normalizeSearch(`${project.title} ${project.code}`).includes(normalizeSearch(search)));

  return (
    <>
      <PageHeader
        title="پروژه‌ها و گانت چارت"
        subtitle="تقویم زمانی پروژه‌ها، مراحل و وابستگی کارها"
        actions={
          hasPermission('projects.create') && (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus size={15} /> پروژهٔ جدید
            </Button>
          )
        }
      />

      <Tabs className="tabs mb">
        <button className={`tab${view === 'timeline' ? ' active' : ''}`} onClick={() => setView('timeline')}>
          تقویم پروژه
        </button>
        <button className={`tab${view === 'gantt' ? ' active' : ''}`} onClick={() => setView('gantt')}>
          <GanttChartSquare size={14} /> گانت چارت
        </button>
      </Tabs>
      <ListToolbar search={search} onSearch={value => {
        const next = new URLSearchParams(searchParams);
        if (value) next.set('search', value); else next.delete('search');
        setSearchParams(next, { replace: true });
      }} />

      {loading ? (
        <Card><div className="skeleton" style={{ height: 220 }} /></Card>
      ) : error ? (
        <div className="alert alert-danger" role="alert">{error} <Button variant="secondary" onClick={load}>تلاش دوباره</Button></div>
      ) : !visibleProjects.length ? (
        <Card><div className="empty-state">{search ? 'پروژه‌ای با این عبارت پیدا نشد.' : 'هنوز پروژه‌ای ثبت نشده است.'}</div></Card>
      ) : view === 'timeline' ? (
        <TimelineView projects={visibleProjects} onOpen={setTaskFor} onDelete={setDeleteTarget} progressOf={progressOf} />
      ) : (
        <GanttView projects={visibleProjects} />
      )}

      {/* ایجاد پروژه */}
      <Modal
        open={createOpen}
        title="پروژهٔ جدید"
        onClose={() => setCreateOpen(false)}
        footer={
          <>
            <Button onClick={submitProject} loading={saving}>ثبت</Button>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>انصراف</Button>
          </>
        }
      >
        <div className="form-grid">
          <Field label="کد پروژه" required>
            <Input className="ltr" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} placeholder="PRJ-1404-05" />
          </Field>
          <Field label="عنوان پروژه" required>
            <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          </Field>
          <Field label="تاریخ شروع" required hint="شمسی یا میلادی">
            <DatePicker className="ltr" value={form.startDate} onValueChange={(value) => setForm((f) => ({ ...f, startDate: value }))} placeholder="1404/11/01" />
          </Field>
          <Field label="تاریخ پایان" required hint="شمسی یا میلادی">
            <DatePicker className="ltr" value={form.endDate} onValueChange={(value) => setForm((f) => ({ ...f, endDate: value }))} placeholder="1404/12/30" />
          </Field>
          <Field label="مدیر پروژه">
            <Select value={form.managerId} onChange={(e) => setForm((f) => ({ ...f, managerId: e.target.value }))}>
              <option value="">— تعیین نشده —</option>
              {employees.rows.map((e) => (
                <option key={e.id} value={e.id}>{e.firstName} {e.lastName} ({e.code})</option>
              ))}
            </Select>
          </Field>
          <Field label="وضعیت">
            <Select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
              {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </Field>
          <Field label="اولویت">
            <Select value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}>
              {Object.entries(PRIORITY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </Field>
          <Field label="رنگ">
            <Select value={form.color} onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}>
              {PALETTE.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="اعضای پروژه">
            <Select
              multiple
              size={Math.min(8, Math.max(3, form.memberIds.length))}
              value={form.memberIds}
              onChange={(e) => {
                const values = Array.from(e.target.selectedOptions).map((o) => o.value);
                setForm((f) => ({ ...f, memberIds: values }));
              }}
            >
              {employees.rows.map((e) => (
                <option key={e.id} value={e.id}>{e.firstName} {e.lastName} ({e.code})</option>
              ))}
            </Select>
          </Field>
          <Field label="توضیحات">
            <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="حذف پروژه"
        message={`آیا از حذف پروژهٔ «${deleteTarget?.title ?? ''}» مطمئنید؟`}
        danger
        onConfirm={removeProject}
        onClose={() => setDeleteTarget(null)}
      />

      {taskFor && (
        <ProjectTasksModal
          project={taskFor}
          employees={employees.rows}
          onClose={() => setTaskFor(null)}
          onChanged={() => { void load(); setTaskFor(null); }}
        />
      )}
    </>
  );
}

/* ==========================================================================
   نمای تقویم پروژه — کارت‌های رنگی به تفکیک تاریخ
   ========================================================================== */

function TimelineView({
  projects,
  onOpen,
  onDelete,
  progressOf,
}: {
  projects: Project[];
  onOpen: (p: Project) => void;
  onDelete: (p: Project) => void;
  progressOf: (p: Project) => number;
}) {
  const groups = useMemo(() => {
    const map = new Map<string, Project[]>();
    for (const p of projects) {
      const key = p.tasks[0]?.phase ?? 'سایر';
      const list = map.get(key) ?? [];
      list.push(p);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [projects]);

  return (
    <div className="col" style={{ gap: 14 }}>
      {groups.map(([phase, list]) => (
        <Card key={phase} title={phase} subtitle={`${toPersianDigits(list.length)} پروژه`}>
          <div className="timeline-grid">
            {list.map((p) => {
              const start = toDate(p.startDate);
              const end = toDate(p.endDate);
              const color = p.color ?? PRIORITY_COLORS[p.priority] ?? '#2563eb';
              return (
                <div key={p.id} className="timeline-card" style={{ borderRightColor: color, borderRightWidth: 5 }}>
                  <div className="timeline-card-head">
                    <div>
                      <div className="fw-600">{p.title}</div>
                      <div className="text-muted text-xs">
                        {formatJalali(start)} تا {formatJalali(end)} · {p.code}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <Badge kind={p.status === 'ACTIVE' ? 'green' : p.status === 'COMPLETED' ? 'blue' : 'amber'}>
                        {STATUS_LABELS[p.status] ?? p.status}
                      </Badge>
                      <Badge kind={p.priority === 'CRITICAL' ? 'red' : p.priority === 'HIGH' ? 'amber' : 'gray'}>
                        {PRIORITY_LABELS[p.priority] ?? p.priority}
                      </Badge>
                    </div>
                  </div>

                  <div className="timeline-progress">
                    <div className="timeline-progress-bar" style={{ width: `${progressOf(p)}%`, background: color }} />
                  </div>
                  <div className="text-muted text-xs" style={{ marginTop: 4 }}>
                    پیشرفت: {toPersianDigits(progressOf(p))}٪ · {toPersianDigits(p.tasks.length)} مرحله
                  </div>

                  {p.tasks.length > 0 && (
                    <div className="timeline-stages">
                      {p.tasks.map((t) => (
                        <div key={t.id} className="timeline-stage" style={{ background: t.color ?? color }}>
                          <span className="timeline-stage-title">{t.title}</span>
                          <span className="timeline-stage-date">
                            {formatJalali(toDate(t.startDate))} — {formatJalali(toDate(t.endDate))}
                          </span>
                          {t.assignee && (
                            <span className="timeline-stage-owner">
                              {t.assignee.firstName} {t.assignee.lastName}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="timeline-card-foot">
                    <div className="avatars">
                      {p.members.slice(0, 4).map((m) => (
                        <span key={m.id} className="avatar" title={`${m.employee.firstName} ${m.employee.lastName}`}>
                          {m.employee.firstName[0]}
                          {m.employee.lastName[0]}
                        </span>
                      ))}
                      {p.members.length > 4 && <span className="avatar avatar-more">+{toPersianDigits(p.members.length - 4)}</span>}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Button size="sm" variant="outline" onClick={() => onOpen(p)}>مراحل</Button>
                      <Button size="sm" variant="danger" onClick={() => onDelete(p)}>
                        <Trash2 size={13} />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      ))}
    </div>
  );
}

/* ==========================================================================
   نمای گانت چارت — میله‌ها روی محور زمان با خطوط وابستگی
   ========================================================================== */

function GanttView({ projects }: { projects: Project[] }) {
  const { start, days, dayWidth } = useMemo(() => {
    let min: number | null = null;
    let max: number | null = null;
    for (const p of projects) {
      const dates = [p.startDate, p.endDate, ...p.tasks.map((t) => t.startDate), ...p.tasks.map((t) => t.endDate)];
      for (const d of dates) {
        const t = new Date(d).getTime();
        if (min === null || t < min) min = t;
        if (max === null || t > max) max = t;
      }
    }
    const from = new Date((min ?? Date.now() - 7 * DAY) - 2 * DAY);
    from.setHours(0, 0, 0, 0);
    const to = new Date((max ?? Date.now() + 30 * DAY) + 3 * DAY);
    to.setHours(0, 0, 0, 0);
    const total = Math.max(1, Math.round((to.getTime() - from.getTime()) / DAY));
    return { start: from, days: total, dayWidth: 38 };
  }, [projects]);

  const rows = useMemo(() => {
    const out: { type: 'project' | 'task'; project: Project; task?: ProjectTask; rowIndex: number }[] = [];
    let idx = 0;
    for (const p of projects) {
      out.push({ type: 'project', project: p, rowIndex: idx++ });
      for (const t of p.tasks) out.push({ type: 'task', project: p, task: t, rowIndex: idx++ });
    }
    return out;
  }, [projects]);

  const rowHeight = 44;
  const chartHeight = rows.length * rowHeight;
  const totalWidth = days * dayWidth;

  /** فاصلهٔ میله از لبهٔ راست (چیدمان راست‌به‌چپ: زودترین تاریخ سمت راست) */
  const rightOf = (d: string) => dayDiff(start, new Date(d)) * dayWidth;
  const barWidth = (s: string, e: string) =>
    Math.max(dayWidth * 0.6, (dayDiff(new Date(s), new Date(e)) + 1) * dayWidth);
  /** مختصات افقی در فضای SVG (SVG از چپ شمارش می‌شود ⇒ تاریخ‌های دیرتر سمت چپ) */
  const svgRightEdge = (d: string) => totalWidth - dayDiff(start, new Date(d)) * dayWidth;
  const svgLeftEdge = (d: string) => totalWidth - (dayDiff(start, new Date(d)) + 1) * dayWidth;

  // خطوط وابستگی
  const links: { x1: number; y1: number; x2: number; y2: number }[] = [];
  const rowIndexByTaskId = new Map<string, number>();
  for (const r of rows) if (r.task) rowIndexByTaskId.set(r.task.id, r.rowIndex);
  for (const r of rows) {
    if (!r.task?.dependsOnId) continue;
    const fromIdx = rowIndexByTaskId.get(r.task.dependsOnId);
    if (fromIdx === undefined) continue;
    const from = rows.find((x) => x.rowIndex === fromIdx)!;
    if (!from.task) continue;
    // خط از انتهای کارِ پیش‌نیاز (لبهٔ چپ آن در فضای SVG) تا ابتدای کارِ وابسته می‌رود
    const x1 = svgLeftEdge(from.task.endDate);
    const y1 = fromIdx * rowHeight + rowHeight / 2;
    const x2 = svgRightEdge(r.task.startDate);
    const y2 = r.rowIndex * rowHeight + rowHeight / 2;
    links.push({ x1, y1, x2, y2 });
  }

  const months: { label: string; span: number }[] = [];
  let cursor = 0;
  let currentMonth = '';
  for (let i = 0; i < days; i++) {
    const d = new Date(start.getTime() + i * DAY);
    const j = jalaliMonthLabel(d);
    if (j !== currentMonth) {
      if (currentMonth) months.push({ label: currentMonth, span: i - cursor });
      currentMonth = j;
      cursor = i;
    }
  }
  if (currentMonth) months.push({ label: currentMonth, span: days - cursor });

  return (
    <Card title="گانت چارت" subtitle="محور زمان بر پایهٔ تقویم شمسی">
      <div className="gantt-scroll">
        <div className="gantt" style={{ width: days * dayWidth + 260 }}>
          {/* سرستون ماه‌ها */}
          <div className="gantt-header-months" style={{ paddingRight: 260 }}>
            {months.map((m, i) => (
              <div key={i} className="gantt-month" style={{ width: m.span * dayWidth }}>
                {m.label}
              </div>
            ))}
          </div>

          {/* سرستون روزها */}
          <div className="gantt-header-days" style={{ paddingRight: 260 }}>
            {Array.from({ length: days }, (_, i) => {
              const d = new Date(start.getTime() + i * DAY);
              const j = jalaliDayLabel(d);
              const weekend = d.getDay() === 5;
              return (
                <div key={i} className={`gantt-day${weekend ? ' weekend' : ''}`} style={{ width: dayWidth }}>
                  <span className="gantt-day-num">{j.day}</span>
                  <span className="gantt-day-name">{j.name}</span>
                </div>
              );
            })}
          </div>

          {/* بدنه */}
          <div className="gantt-body" style={{ height: chartHeight, width: days * dayWidth, marginRight: 260 }}>
            {/* خطوط پس‌زمینهٔ روزها */}
            {Array.from({ length: days }, (_, i) => {
              const d = new Date(start.getTime() + i * DAY);
              return (
                <div
                  key={i}
                  className={`gantt-grid-col${d.getDay() === 5 ? ' weekend' : ''}`}
                  style={{ right: i * dayWidth, width: dayWidth }}
                />
              );
            })}

            {/* خطوط وابستگی */}
            <svg className="gantt-links" width={days * dayWidth} height={chartHeight}>
              {links.map((l, i) => (
                <path
                  key={i}
                  d={`M ${l.x1} ${l.y1} H ${l.x1 - 10} V ${l.y2} H ${l.x2 + 6}`}
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth={1.5}
                  markerEnd="url(#arrow)"
                />
              ))}
              <defs>
                <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                  <path d="M0,0 L0,6 L6,3 z" fill="#94a3b8" />
                </marker>
              </defs>
            </svg>

            {/* ردیف‌ها */}
            {rows.map((r) => {
              if (r.type === 'project') {
                const p = r.project;
                const color = p.color ?? PRIORITY_COLORS[p.priority] ?? '#2563eb';
                return (
                  <div key={p.id} className="gantt-row gantt-row-project" style={{ top: r.rowIndex * rowHeight, height: rowHeight }}>
                    <div className="gantt-label gantt-label-project">
                      <span className="gantt-dot" style={{ background: color }} />
                      <span className="fw-600">{p.title}</span>
                    </div>
                    <div
                      className="gantt-bar gantt-bar-project"
                      style={{ right: rightOf(p.startDate), width: barWidth(p.startDate, p.endDate), background: color }}
                      title={`${p.title} — ${formatJalali(toDate(p.startDate))} تا ${formatJalali(toDate(p.endDate))}`}
                    >
                      <span className="gantt-bar-title">{p.title}</span>
                      <span className="gantt-bar-note">{formatJalali(toDate(p.startDate))}</span>
                    </div>
                  </div>
                );
              }
              const t = r.task!;
              const color = t.color ?? r.project.color ?? '#2563eb';
              return (
                <div key={t.id} className="gantt-row" style={{ top: r.rowIndex * rowHeight, height: rowHeight }}>
                  <div className="gantt-label">
                    <span className="gantt-label-indent" />
                    {t.title}
                  </div>
                  <div
                    className="gantt-bar"
                    style={{ right: rightOf(t.startDate), width: barWidth(t.startDate, t.endDate), background: color }}
                    title={`${t.title} — ${formatJalali(toDate(t.startDate))} تا ${formatJalali(toDate(t.endDate))}`}
                  >
                    <span className="gantt-bar-title">{t.title}</span>
                    {t.assignee && (
                      <span className="gantt-bar-owner">
                        {t.assignee.firstName[0]}{t.assignee.lastName[0]}
                      </span>
                    )}
                    <span className="gantt-bar-progress" style={{ width: `${t.progress}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Card>
  );
}

/** برچسب ماه شمسی برای محور گانت */
function jalaliMonthLabel(d: Date): string {
  const { jy, jm } = toJalaliSafe(d);
  const names = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
  return `${names[jm - 1]} ${toPersianDigits(jy)}`;
}

/** برچسب روز شمسی (شمارهٔ روز + نام روز هفته) */
function jalaliDayLabel(d: Date): { day: string; name: string } {
  const { jd } = toJalaliSafe(d);
  const names = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'];
  return { day: toPersianDigits(jd), name: names[d.getDay()].slice(0, 3) };
}

function toJalaliSafe(d: Date) {
  return toJalali(d);
}

/* ==========================================================================
   مودال مدیریت مراحل پروژه
   ========================================================================== */

function ProjectTasksModal({
  project,
  employees,
  onClose,
  onChanged,
}: {
  project: Project;
  employees: Employee[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: '',
    phase: '',
    startDate: '',
    endDate: '',
    assigneeId: '',
    dependsOnId: '',
    color: PALETTE[1],
  });

  const addTask = async () => {
    setSaving(true);
    try {
      const startDate = parseDateInput(form.startDate);
      const endDate = parseDateInput(form.endDate);
      if (!startDate || !endDate) throw new Error('قالب تاریخ معتبر نیست (نمونه: ۱۴۰۴/۰۱/۰۱).');
      await api.post(`/projects/${project.id}/tasks`, {
        title: form.title.trim(),
        phase: form.phase || undefined,
        startDate,
        endDate,
        assigneeId: form.assigneeId || undefined,
        dependsOnId: form.dependsOnId || undefined,
        color: form.color,
      });
      toast('success', 'مرحله اضافه شد.');
      setForm({ ...form, title: '', phase: '', startDate: '', endDate: '', dependsOnId: '' });
      onChanged();
    } catch (e) {
      toast('error', e instanceof Error ? e.message : apiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const removeTask = async (taskId: string) => {
    try {
      await api.delete(`/projects/tasks/${taskId}`);
      toast('success', 'مرحله حذف شد.');
      onChanged();
    } catch (e) {
      toast('error', apiErrorMessage(e));
    }
  };

  const columns: Column<ProjectTask>[] = [
    { key: 'title', header: 'عنوان مرحله', render: (t) => <span className="fw-600">{t.title}</span> },
    { key: 'phase', header: 'مرحله', render: (t) => t.phase ?? '—' },
    { key: 'dates', header: 'بازه', render: (t) => <span className="ltr">{formatJalali(toDate(t.startDate))} — {formatJalali(toDate(t.endDate))}</span> },
    { key: 'assignee', header: 'مسئول', render: (t) => (t.assignee ? `${t.assignee.firstName} ${t.assignee.lastName}` : '—') },
    { key: 'progress', header: 'پیشرفت', render: (t) => `${toPersianDigits(t.progress)}٪` },
    {
      key: 'actions',
      header: '',
      render: (t) => (
        <Button size="sm" variant="danger" onClick={() => removeTask(t.id)}>
          <Trash2 size={13} />
        </Button>
      ),
    },
  ];

  return (
    <Modal
      open
      title={`مراحل پروژه — ${project.title}`}
      onClose={onClose}
      width={900}
      footer={<Button variant="secondary" onClick={onClose}>بستن</Button>}
    >
      <div className="col" style={{ gap: 14 }}>
        <div className="form-grid">
          <Field label="عنوان مرحله" required>
            <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          </Field>
          <Field label="فاز / دسته">
            <Input value={form.phase} onChange={(e) => setForm((f) => ({ ...f, phase: e.target.value }))} placeholder="تحلیل، توسعه، …" />
          </Field>
          <Field label="تاریخ شروع" required hint="شمسی یا میلادی">
            <DatePicker className="ltr" value={form.startDate} onValueChange={(value) => setForm((f) => ({ ...f, startDate: value }))} placeholder="1404/11/01" />
          </Field>
          <Field label="تاریخ پایان" required hint="شمسی یا میلادی">
            <DatePicker className="ltr" value={form.endDate} onValueChange={(value) => setForm((f) => ({ ...f, endDate: value }))} placeholder="1404/11/20" />
          </Field>
          <Field label="مسئول">
            <Select value={form.assigneeId} onChange={(e) => setForm((f) => ({ ...f, assigneeId: e.target.value }))}>
              <option value="">— تعیین نشده —</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>
              ))}
            </Select>
          </Field>
          <Field label="پیش‌نیاز">
            <Select value={form.dependsOnId} onChange={(e) => setForm((f) => ({ ...f, dependsOnId: e.target.value }))}>
              <option value="">— ندارد —</option>
              {project.tasks.map((t) => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </Select>
          </Field>
        </div>
        <div>
          <Button onClick={addTask} loading={saving}>افزودن مرحله</Button>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>{columns.map((c) => <th key={c.key}>{c.header}</th>)}</tr>
            </thead>
            <tbody>
              {project.tasks.length === 0 ? (
                <tr><td colSpan={columns.length} className="text-muted">مرحله‌ای ثبت نشده است.</td></tr>
              ) : (
                project.tasks.map((t) => (
                  <tr key={t.id}>
                    {columns.map((c) => <td key={c.key}>{c.render ? c.render(t) : String((t as any)[c.key] ?? '—')}</td>)}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
}
