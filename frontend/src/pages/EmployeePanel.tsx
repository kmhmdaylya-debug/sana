import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Check, ClipboardList, FolderKanban, Receipt, Wallet, CalendarDays, ChevronDown, Pin, RefreshCw, RotateCcw, X } from 'lucide-react';
import { api, apiErrorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useList } from '../lib/useList';
import TaskCountdown from '../components/TaskCountdown';
import TaskStatusMark from '../components/TaskStatusMark';
import { WorkCategoryTag } from '../components/WorkCategory';
import { categoryColor, categoryStyle } from '../lib/workCategories';
import { DatePicker,
  Badge,
  Button,
  Card,
  DataTable,
  Field,
  Modal,
  PageHeader,
  Select,
  Textarea,
  useToast,
  type Column,
} from '../components/ui';
import { formatJalali, toPersianDigits, parseDateInput, formatRial, statusLabel, isPastDueDate } from '../lib/format';

interface PanelSummary {
  myProjects: number;
  openStages: number;
  attendedToday: number;
  monthAttendance: { days: number; workMinutes: number; overtimeMinutes: number; lateMinutes: number; absenceMinutes: number };
  pendingLeaves: number;
  approvedLeaves: number;
  myMissions: number;
  leaveBalanceMinutes: number;
  activeContracts: number;
  lastPayslip: {
    grossAmount: number;
    deductionAmount: number;
    netAmount: number;
    status: string;
    publishedAt: string | null;
    period: { year: number; month: number; status: string };
  } | null;
  nextPayment: { netAmount: number; publishedAt: string | null; period: { year: number; month: number } } | null;
}

interface PanelStage {
  category?: string | null;
  id: string;
  title: string;
  phase?: string | null;
  startDate: string;
  endDate: string;
  progress: number;
  status: string;
  color?: string | null;
  isMine: boolean;
  attendedToday: boolean;
  totalMinutes: number;
  assignee?: { id: string; firstName: string; lastName: string } | null;
  dependsOn?: { id: string; title: string } | null;
  attendance: { id: string; workDate: string; minutes: number; note?: string | null }[];
}

interface PanelProject {
  category?: string | null;
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
  manager?: { firstName: string; lastName: string } | null;
  members: { id: string; role: string; employee: { id: string; firstName: string; lastName: string } }[];
  tasks: PanelStage[];
}

interface PanelLeave {
  id: string;
  startAt: string;
  endAt: string;
  durationMinutes: number;
  status: string;
  reason?: string | null;
  leaveType: { id: string; code: string; name: string; color?: string | null };
  createdAt: string;
}

interface PanelMission {
  id: string;
  title: string;
  destination: string;
  purpose?: string | null;
  startAt: string;
  endAt: string;
  status: string;
  estimatedCost: number;
  actualCost: number;
  report?: string | null;
  expenses: { id: string; description: string; amount: number; spentAt: string; status: string }[];
}

interface PanelPayslip {
  id: string;
  grossAmount: number;
  deductionAmount: number;
  netAmount: number;
  status: string;
  publishedAt: string | null;
  period: { year: number; month: number; status: string };
  items: { id: string; amount: number; component: { code: string; name: string; type: string } }[];
}

interface PanelProfile {
  id: string;
  code: string;
  firstName: string;
  lastName: string;
  nationalId?: string | null;
  mobile?: string | null;
  email?: string | null;
  hireDate: string;
  employmentType: string;
  status: string;
  monthlyBaseSalary?: number;
  position?: { title: string } | null;
  orgUnit?: { name: string } | null;
  contracts: { id: string; status: string; versions: { startDate: string; endDate: string | null; baseSalary: number; workHoursPerDay: number }[] }[];
  bankAccounts: { bankName: string; accountNumber: string; sheba?: string | null }[];
  skills: { skill: string; level: number }[];
  documents: { id: string; title: string; docType: string; expiryDate?: string | null }[];
  leaveBalances: { leaveType: { id: string; code: string; name: string; color?: string | null }; minutes: number }[];
}

const LEAVE_STATUS: Record<string, string> = {
  DRAFT: 'پیش‌نویس',
  SUBMITTED: 'ثبت‌شده',
  PENDING_SUPERVISOR: 'در انتظار سرپرست',
  PENDING_MANAGER: 'در انتظار مدیر',
  PENDING_HR: 'در انتظار منابع انسانی',
  APPROVED: 'تأییدشده',
  REJECTED: 'ردشده',
  CANCELLED: 'لغوشده',
  NEEDS_REVISION: 'نیازمند اصلاح',
  REFERRED: 'ارجاع‌شده',
  EXPIRED: 'منقضی‌شده',
};

const MISSION_STATUS: Record<string, string> = {
  REQUESTED: 'درخواست‌شده',
  PENDING_APPROVAL: 'در انتظار تأیید',
  APPROVED: 'تأییدشده',
  IN_PROGRESS: 'در جریان',
  COMPLETED: 'پایان‌یافته',
  REJECTED: 'ردشده',
  CANCELLED: 'لغوشده',
};

const fmtMinutes = (m: number) => {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (h && mm) return `${toPersianDigits(h)} ساعت و ${toPersianDigits(mm)} دقیقه`;
  if (h) return `${toPersianDigits(h)} ساعت`;
  return `${toPersianDigits(mm)} دقیقه`;
};

const toDate = (v: string) => new Date(v);

export default function EmployeePanel() {
  const toast = useToast();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const requestedView = searchParams.get('view');
  const tab = ['projects', 'leaves', 'missions', 'payroll', 'profile'].includes(requestedView ?? '') ? requestedView : 'tasks';
  const [summary, setSummary] = useState<PanelSummary | null>(null);
  const [projects, setProjects] = useState<PanelProject[]>([]);
  const [leaves, setLeaves] = useState<PanelLeave[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<{ id: string; name: string; code: string }[]>([]);
  const [missions, setMissions] = useState<PanelMission[]>([]);
  const [payslips, setPayslips] = useState<PanelPayslip[]>([]);
  const [profile, setProfile] = useState<PanelProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ leaveTypeId: '', startDate: '', endDate: '', reason: '' });
  const loadController = useRef<AbortController | null>(null);

  const load = async () => {
    loadController.current?.abort();
    const controller = new AbortController();
    loadController.current = controller;
    const get = (path: string) => api.get(path, { signal: controller.signal });
    setLoading(true);
    setLoadError('');
    try {
      if (tab === 'tasks') {
        return;
      } else if (tab === 'projects') {
        const p = await get('/panel/projects');
        setProjects(p.data.data ?? []);
      } else if (tab === 'leaves') {
        const [l, lt] = await Promise.all([get('/panel/leaves'), get('/panel/leave-types')]);
        setLeaves(l.data.data ?? []);
        setLeaveTypes(lt.data.data ?? []);
      } else if (tab === 'missions') {
        setMissions((await get('/panel/missions')).data.data ?? []);
      } else if (tab === 'payroll') {
        const [s, ps] = await Promise.all([get('/panel'), get('/panel/payslips')]);
        setSummary(s.data.data ?? null);
        setPayslips(ps.data.data ?? []);
      } else if (tab === 'profile') {
        setProfile((await get('/panel/profile')).data.data ?? null);
      }
    } catch (e) {
      if (!controller.signal.aborted) setLoadError(apiErrorMessage(e));
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    return () => loadController.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const submitLeave = async () => {
    setSaving(true);
    try {
      const startAt = parseDateInput(leaveForm.startDate);
      const endAt = parseDateInput(leaveForm.endDate);
      if (!startAt || !endAt) throw new Error('قالب تاریخ معتبر نیست (نمونه: ۱۴۰۴/۱۱/۰۱).');
      await api.post('/panel/leaves', {
        leaveTypeId: leaveForm.leaveTypeId,
        startAt: `${startAt}T08:00:00.000Z`,
        endAt: `${endAt}T16:00:00.000Z`,
        reason: leaveForm.reason || undefined,
      });
      toast('success', 'درخواست مرخصی ثبت شد و برای تأیید ارسال گردید.');
      setLeaveOpen(false);
      setLeaveForm({ leaveTypeId: '', startDate: '', endDate: '', reason: '' });
      void load();
    } catch (e) {
      toast('error', e instanceof Error ? e.message : apiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        title="task"
        subtitle={[user?.fullName, user?.employee?.position?.title, user?.employee?.orgUnit?.name].filter(Boolean).join(' · ')}
      />

      {tab === 'tasks' ? <MyTasks /> : tab === 'projects' ? (
          <section className="employee-work-section" aria-labelledby="my-projects-heading">
            <h3 id="my-projects-heading" className="employee-work-heading"><FolderKanban size={18} /> پروژه‌های من {!loading && !loadError && <Badge kind="gray">{toPersianDigits(projects.length)}</Badge>}</h3>
            {loading ? <div className="skeleton" style={{ height: 180 }} /> : loadError ? <div className="alert alert-danger" role="alert">{loadError} <Button variant="secondary" onClick={load}>تلاش دوباره</Button></div> : <ProjectsTab projects={projects} />}
          </section>
      ) : loading ? (
        <Card><div className="skeleton" style={{ height: 220 }} /></Card>
      ) : loadError ? (
        <div className="alert alert-danger" role="alert">{loadError} <Button variant="secondary" onClick={load}>تلاش دوباره</Button></div>
      ) : tab === 'leaves' ? (
        <LeavesTab
          leaves={leaves}
          leaveTypes={leaveTypes}
          onNew={() => setLeaveOpen(true)}
        />
      ) : tab === 'missions' ? (
        <MissionsTab missions={missions} />
      ) : tab === 'payroll' ? (
        <PayrollTab payslips={payslips} summary={summary} />
      ) : (
        <ProfileTab profile={profile} />
      )}

      {/* مودال درخواست مرخصی */}
      <Modal
        open={leaveOpen}
        title="درخواست مرخصی"
        onClose={() => setLeaveOpen(false)}
        footer={
          <>
            <Button onClick={submitLeave} loading={saving}>ثبت درخواست</Button>
            <Button variant="secondary" onClick={() => setLeaveOpen(false)}>انصراف</Button>
          </>
        }
      >
        <div className="col" style={{ gap: 14 }}>
          <Field label="نوع مرخصی" required>
            <Select value={leaveForm.leaveTypeId} onChange={(e) => setLeaveForm((f) => ({ ...f, leaveTypeId: e.target.value }))}>
              <option value="">— انتخاب کنید —</option>
              {leaveTypes.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </Select>
          </Field>
          <div className="form-grid">
            <Field label="تاریخ شروع" required hint="شمسی یا میلادی">
              <DatePicker className="ltr" value={leaveForm.startDate} onValueChange={(value) => setLeaveForm((f) => ({ ...f, startDate: value }))} placeholder="1404/11/20" />
            </Field>
            <Field label="تاریخ پایان" required hint="شمسی یا میلادی">
              <DatePicker className="ltr" value={leaveForm.endDate} onValueChange={(value) => setLeaveForm((f) => ({ ...f, endDate: value }))} placeholder="1404/11/22" />
            </Field>
          </div>
          <Field label="دلیل">
            <Textarea value={leaveForm.reason} onChange={(e) => setLeaveForm((f) => ({ ...f, reason: e.target.value }))} />
          </Field>
        </div>
      </Modal>

    </>
  );
}

/* ==========================================================================
   تب کارهای من (پروژه‌ها)
   ========================================================================== */

interface AssignedTask {
  category?: string | null;
  retryStatus?: string | null;
  id: string;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  dueDate?: string | null;
  projectName?: string | null;
  delayReason?: string | null;
}

function MyTasks() {
  const list = useList<AssignedTask>('/panel/tasks');
  const toast = useToast();
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savingResult, setSavingResult] = useState<'START' | 'DONE' | 'UNABLE' | 'RETRY' | null>(null);
  const [unableTask, setUnableTask] = useState<AssignedTask | null>(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');
  const completed = list.rows.filter(task => task.status === 'DONE').length;
  const openTasks = list.rows.filter(task => !['DONE', 'CANCELLED'].includes(task.status)).length;
  const working = list.rows.filter(task => task.status === 'IN_PROGRESS' && !task.delayReason).length;
  const progress = completed + openTasks ? Math.round(completed * 100 / (completed + openTasks)) : 0;
  useEffect(() => {
    const refresh = () => { if (!document.hidden) void list.reload(); };
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [list.reload]);
  const requestRetry = async (task: AssignedTask) => {
    if (savingId || task.retryStatus === 'PENDING') return;
    setSavingId(task.id);
    setSavingResult('RETRY');
    try {
      await api.post(`/panel/tasks/${task.id}/retry-request`);
      toast('success', 'درخواست انجام دوباره برای مدیر ارسال شد.');
      await list.reload();
    } catch (e) { toast('error', apiErrorMessage(e)); }
    finally { setSavingId(null); setSavingResult(null); }
  };
  const dismiss = async (task: AssignedTask) => {
    if (savingId) return;
    setSavingId(task.id);
    try {
      await api.post(`/panel/tasks/${task.id}/dismiss`);
      await list.reload();
      toast('success', 'کار از فهرست شما حذف شد.');
    } catch (e) {
      toast('error', apiErrorMessage(e));
    } finally { setSavingId(null); }
  };
  const report = async (task: AssignedTask, result: 'START' | 'DONE' | 'UNABLE') => {
    if (savingId) return;
    if (result === 'UNABLE' && !reason.trim()) {
      setReasonError('دلیل انجام نشدن کار را بنویسید.');
      return;
    }
    setSavingResult(result);
    setSavingId(task.id);
    try {
      await api.post(`/panel/tasks/${task.id}/result`, { result, ...(result === 'UNABLE' ? { reason: reason.trim() } : {}) });
      setUnableTask(null);
      setReason('');
      toast('success', result === 'START' ? 'شروع کار ثبت شد.' : result === 'DONE' ? 'کار انجام‌شده ثبت شد.' : 'دلیل انجام نشدن کار ثبت شد.');
      await list.reload();
    } catch (e) {
      toast('error', apiErrorMessage(e));
    } finally {
      setSavingId(null);
      setSavingResult(null);
    }
  };
  return (
    <section className="employee-work-section employee-tasks" aria-labelledby="my-tasks-heading">
      <div className="employee-tasks-header">
        <h3 id="my-tasks-heading" className="employee-work-heading"><ClipboardList size={18} /> task من</h3>
        <div className="employee-task-header-actions">{!list.loading && !list.error && <span className="employee-tasks-count">{toPersianDigits(list.total)} task</span>}<Button variant="outline" size="sm" title="تازه‌سازی task" aria-label="تازه‌سازی task" disabled={list.loading || !!savingId} onClick={list.reload}><RefreshCw size={15} /></Button></div>
      </div>
      {!list.loading && !list.error && list.rows.length > 0 && <div className="employee-task-overview">
        <dl className="employee-task-stats">
          <div><dt>کار باز</dt><dd>{toPersianDigits(openTasks)}</dd></div>
          <div><dt>در حال انجام</dt><dd>{toPersianDigits(working)}</dd></div>
          <div><dt>انجام‌شده</dt><dd>{toPersianDigits(completed)}</dd></div>
        </dl>
        <div className="employee-task-progress">
          <span className="task-progress-ring" role="progressbar" aria-label="پیشرفت task" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} style={{ '--task-progress': `${progress}%` } as CSSProperties}><strong>{toPersianDigits(progress)}٪</strong></span>
          <span>پیشرفت کارها</span>
        </div>
      </div>}
      {list.loading ? <div className="skeleton" style={{ height: 180, marginTop: 12 }} /> : list.error ? (
        <div className="alert alert-danger" role="alert">{list.error} <Button variant="secondary" onClick={list.reload}>تلاش دوباره</Button></div>
      ) : list.rows.length ? <>
        <div className="employee-task-list">
          {list.rows.map((task) => {
            const pinned = task.status === 'IN_PROGRESS' && !task.delayReason;
            const overdue = isPastDueDate(task.dueDate) && !['DONE', 'CANCELLED'].includes(task.status);
            const TaskContainer = task.status === 'DONE' ? 'details' : 'article';
            const heading = <div className="employee-task-heading"><TaskStatusMark status={task.status} blocked={!!task.delayReason} /><div className="employee-task-title">
                <h4>{task.title}</h4>
                {task.status === 'DONE' ? <span className="employee-task-result employee-task-complete">انجام شد</span> : task.status === 'CANCELLED' ? <span className="text-muted text-sm">لغو شده</span> : task.delayReason ? <span className="employee-task-result employee-task-failed">انجام نشد</span> : pinned ? <span className="employee-task-result employee-task-pinned" title="پین‌شده در بالای فهرست" aria-label="در حال انجام؛ پین‌شده"><Pin size={15} /> در حال انجام</span> : null}
              </div></div>;
            return <TaskContainer key={task.id} style={categoryStyle(task.category)} className={`employee-task-row${task.category ? ' has-category' : ''}${pinned ? ' is-pinned' : ''}${task.status === 'DONE' ? ' is-complete' : task.status === 'CANCELLED' ? ' is-cancelled' : task.delayReason ? ' is-blocked' : overdue ? ' is-overdue' : ''}`}>
              {task.status === 'DONE' ? <summary className="employee-task-summary">{heading}<ChevronDown className="employee-task-chevron" size={18} /><button type="button" className="employee-task-dismiss" title="حذف از فهرست من" aria-label={`حذف ${task.title} از فهرست من`} disabled={!!savingId} onClick={(event) => { event.preventDefault(); event.stopPropagation(); void dismiss(task); }}><X size={16} /></button></summary> : heading}
              <div className="employee-task-details">
              {task.description && <p className="employee-task-description">{task.description}</p>}
              <div className="employee-task-meta text-xs">
                <span className={`employee-task-date${overdue ? ' is-overdue' : ''}`}><CalendarDays size={15} />{task.dueDate ? `مهلت: ${formatJalali(task.dueDate)}${overdue ? ' · عقب‌افتاده' : ''}` : 'بدون مهلت'}</span>
                <TaskCountdown dueDate={task.dueDate} status={task.status} />
                <WorkCategoryTag value={task.category} />
                {['HIGH', 'CRITICAL'].includes(task.priority) && <span className="employee-task-priority">اولویت: {statusLabel(task.priority)}</span>}
                {task.projectName && <span className="text-muted">{task.projectName}</span>}
              </div>
              {task.delayReason && <div className="employee-task-reason"><strong>دلیل انجام نشدن:</strong> {task.delayReason}</div>}
              {task.retryStatus === 'PENDING' && <p className="task-retry-pending" role="status"><RotateCcw size={15} />در انتظار تأیید مدیر برای انجام دوباره</p>}
              {task.retryStatus === 'REJECTED' && <p className="task-retry-rejected">درخواست انجام دوباره تأیید نشد.</p>}
              {!['DONE', 'CANCELLED'].includes(task.status) && <div className="employee-task-actions">
                {task.status === 'NEW' && !task.delayReason && <Button className="employee-task-start" loading={savingId === task.id && savingResult === 'START'} disabled={!!savingId} onClick={() => report(task, 'START')}>شروع</Button>}
                {task.delayReason && task.retryStatus !== 'PENDING' && <Button className="employee-task-retry" variant="outline" loading={savingId === task.id && savingResult === 'RETRY'} disabled={!!savingId} onClick={() => requestRetry(task)}><RotateCcw size={16} />درخواست انجام دوباره</Button>}
                {!task.delayReason && <>
                <Button className="employee-task-icon employee-task-done" variant="success" title="انجام شد" aria-label="انجام شد" loading={savingId === task.id && savingResult === 'DONE'} disabled={!!savingId} onClick={() => report(task, 'DONE')}><Check size={20} aria-hidden="true" /></Button>
                <Button className="employee-task-icon employee-task-unable" variant="danger" title="نتوانستم انجام بدهم" aria-label="نتوانستم انجام بدهم" disabled={!!savingId} onClick={() => { setUnableTask(task); setReason(task.delayReason ?? ''); setReasonError(''); }}><X size={20} aria-hidden="true" /></Button>
                </>}
              </div>}
              </div>
            </TaskContainer>;
          })}
        </div>
      </> : <div className="empty-state">task برای نمایش نیست.</div>}
      <Modal open={!!unableTask} title="دلیل انجام نشدن کار" onClose={() => { if (!savingId) setUnableTask(null); }} footer={<>
        <Button loading={!!savingId} onClick={() => unableTask && report(unableTask, 'UNABLE')}>ثبت دلیل</Button>
        <Button variant="secondary" disabled={!!savingId} onClick={() => setUnableTask(null)}>انصراف</Button>
      </>}>
        <p className="fw-600">{unableTask?.title}</p>
        <Field label="دلیل" required error={reasonError}>
          <Textarea aria-label="دلیل انجام نشدن کار" rows={4} maxLength={500} value={reason} onChange={(e) => { setReason(e.target.value); setReasonError(''); }} />
        </Field>
      </Modal>
    </section>
  );
}

function ProjectsTab({ projects }: { projects: PanelProject[] }) {
  if (!projects.length) {
    return <div className="empty-state">هنوز پروژه‌ای به شما واگذار نشده است.</div>;
  }
  return (
    <div className="col" style={{ gap: 14 }}>
      {projects.map((p) => {
        const myStages = p.tasks.filter((t) => t.isMine);
        return (
          <Card
            key={p.id}
            title={p.title}
            subtitle={`${p.code} · ${formatJalali(toDate(p.startDate))} تا ${formatJalali(toDate(p.endDate))}`}
            actions={
              <div style={{ display: 'flex', gap: 6 }}>
                <WorkCategoryTag value={p.category} />
                <Badge kind={p.status === 'ACTIVE' ? 'green' : p.status === 'COMPLETED' ? 'blue' : 'amber'}>
                  {statusLabel(p.status)}
                </Badge>
                <Badge kind={p.priority === 'CRITICAL' ? 'red' : p.priority === 'HIGH' ? 'amber' : 'gray'}>
                  {statusLabel(p.priority)}
                </Badge>
              </div>
            }
          >
            <div className="timeline-progress mb">
                    <div className="timeline-progress-bar" style={{ width: `${p.progress}%`, background: categoryColor(p.category) ?? p.color ?? '#a3a878' }} />
            </div>
            <div className="text-muted text-xs mb">
              پیشرفت کل پروژه: {toPersianDigits(p.progress)}٪ · مدیر: {p.manager ? `${p.manager.firstName} ${p.manager.lastName}` : '—'}
            </div>

            {myStages.length > 0 && <details>
              <summary className="employee-stage-summary">مراحل من ({toPersianDigits(myStages.length)})</summary>
            <div className="col" style={{ gap: 8, marginTop: 10 }}>
              {myStages.map((t) => (
                <div key={t.id} className="panel-stage" style={categoryStyle(t.category ?? p.category)}>
                  <div className="panel-stage-main">
                    <WorkCategoryTag value={t.category ?? p.category} />
                    <div className="flex" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span className="fw-600">{t.title}</span>
                      {t.phase && <Badge kind="gray">{t.phase}</Badge>}
                    </div>
                    <div className="text-muted text-xs">
                      {formatJalali(toDate(t.startDate))} تا {formatJalali(toDate(t.endDate))}
                      {t.assignee ? ` · مسئول: ${t.assignee.firstName} ${t.assignee.lastName}` : ''}
                      {t.totalMinutes ? ` · مجموع کارکرد: ${fmtMinutes(t.totalMinutes)}` : ''}
                    </div>
                  </div>
                  <div className="panel-stage-actions">
                    <span className="text-muted text-xs">{toPersianDigits(t.progress)}٪</span>
                  </div>
                </div>
              ))}
            </div>
            </details>}
          </Card>
        );
      })}
    </div>
  );
}

/* ==========================================================================
   تب مرخصی‌ها
   ========================================================================== */

function LeavesTab({
  leaves,
  leaveTypes,
  onNew,
}: {
  leaves: PanelLeave[];
  leaveTypes: { id: string; name: string }[];
  onNew: () => void;
}) {
  const columns: Column<PanelLeave>[] = [
    { key: 'type', header: 'نوع مرخصی', render: (l) => <span className="fw-600">{l.leaveType.name}</span> },
    { key: 'range', header: 'بازه', render: (l) => <span className="ltr">{formatJalali(l.startAt)} — {formatJalali(l.endAt)}</span> },
    { key: 'duration', header: 'مدت', render: (l) => fmtMinutes(l.durationMinutes) },
    { key: 'status', header: 'وضعیت', render: (l) => <Badge kind={l.status === 'APPROVED' ? 'green' : l.status === 'REJECTED' ? 'red' : 'amber'}>{LEAVE_STATUS[l.status] ?? l.status}</Badge> },
    { key: 'reason', header: 'دلیل', render: (l) => l.reason ?? '—' },
  ];
  return (
    <Card
      title="درخواست‌های مرخصی من"
      subtitle={`${toPersianDigits(leaves.length)} درخواست`}
      actions={<Button onClick={onNew}>درخواست جدید</Button>}
    >
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>{columns.map((c) => <th key={c.key}>{c.header}</th>)}</tr>
          </thead>
          <tbody>
            {leaves.length === 0 ? (
              <tr><td colSpan={columns.length} className="text-muted">درخواستی ثبت نشده است.</td></tr>
            ) : (
              leaves.map((l) => (
                <tr key={l.id}>
                  {columns.map((c) => <td key={c.key}>{c.render ? c.render(l) : String((l as any)[c.key] ?? '—')}</td>)}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ==========================================================================
   تب مأموریت‌ها
   ========================================================================== */

function MissionsTab({ missions }: { missions: PanelMission[] }) {
  if (!missions.length) {
    return <Card><div className="empty-state">مأموریتی برای شما ثبت نشده است.</div></Card>;
  }
  return (
    <div className="col" style={{ gap: 12 }}>
      {missions.map((m) => (
        <Card
          key={m.id}
          title={m.title}
          subtitle={`${m.destination} · ${formatJalali(m.startAt)} تا ${formatJalali(m.endAt)}`}
          actions={<Badge kind={m.status === 'COMPLETED' ? 'green' : m.status === 'APPROVED' ? 'blue' : 'amber'}>{MISSION_STATUS[m.status] ?? m.status}</Badge>}
        >
          {m.purpose && <p className="text-muted" style={{ marginTop: 0 }}>{m.purpose}</p>}
          {m.report && (
            <div className="alert alert-info">گزارش: {m.report}</div>
          )}
          <div className="flex" style={{ gap: 16, flexWrap: 'wrap' }}>
            <span className="text-muted text-xs">هزینهٔ برآوردی: {formatRial(m.estimatedCost)}</span>
            <span className="text-muted text-xs">هزینهٔ واقعی: {formatRial(m.actualCost)}</span>
          </div>
          {m.expenses.length > 0 && (
            <div className="table-wrap mt">
              <table className="data-table">
                <thead>
                  <tr><th>شرح هزینه</th><th>مبلغ</th><th>تاریخ</th><th>وضعیت</th></tr>
                </thead>
                <tbody>
                  {m.expenses.map((e) => (
                    <tr key={e.id}>
                      <td>{e.description}</td>
                      <td>{formatRial(e.amount)}</td>
                      <td className="ltr">{formatJalali(e.spentAt)}</td>
                      <td>
                        <Badge kind={e.status === 'APPROVED' ? 'green' : e.status === 'REJECTED' ? 'red' : 'amber'}>
                          {statusLabel(e.status)}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

/* ==========================================================================
   تب حقوق
   ========================================================================== */

function PayrollTab({ payslips, summary }: { payslips: PanelPayslip[]; summary: PanelSummary | null }) {
  if (!payslips.length) {
    return <Card><div className="empty-state">هنوز فیش حقوقی برای شما صادر نشده است.</div></Card>;
  }
  return (
    <div className="col" style={{ gap: 12 }}>
      {summary?.nextPayment && (
        <Card title="پرداخت آینده" subtitle={`دورهٔ ${toPersianDigits(summary.nextPayment.period.year)}/${toPersianDigits(summary.nextPayment.period.month)}`}>
          <div className="flex" style={{ gap: 18, flexWrap: 'wrap' }}>
            <div>
              <div className="text-muted text-xs">مبلغ خالص</div>
              <div className="fw-600">{formatRial(summary.nextPayment.netAmount)}</div>
            </div>
            <div>
              <div className="text-muted text-xs">زمان پرداخت</div>
              <div className="fw-600">
                {summary.nextPayment.publishedAt ? formatJalali(summary.nextPayment.publishedAt) : 'در انتظار انتشار'}
              </div>
            </div>
          </div>
        </Card>
      )}

      {payslips.map((p) => (
        <Card
          key={p.id}
          title={`فیش حقوقی ${toPersianDigits(p.period.year)}/${toPersianDigits(p.period.month)}`}
          subtitle={`زمان پرداخت: ${p.publishedAt ? formatJalali(p.publishedAt) : 'منتشر نشده'}`}
          actions={<Badge kind={p.status === 'PUBLISHED' ? 'green' : 'gray'}>{statusLabel(p.status)}</Badge>}
        >
          <div className="flex" style={{ gap: 18, flexWrap: 'wrap', marginBottom: 10 }}>
            <div>
              <div className="text-muted text-xs">ناخالص</div>
              <div className="fw-600">{formatRial(p.grossAmount)}</div>
            </div>
            <div>
              <div className="text-muted text-xs">کسورات</div>
              <div className="fw-600">{formatRial(p.deductionAmount)}</div>
            </div>
            <div>
              <div className="text-muted text-xs">خالص</div>
              <div className="fw-600" style={{ color: 'var(--green-700)' }}>{formatRial(p.netAmount)}</div>
            </div>
          </div>
          {p.items.length > 0 && (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr><th>عنوان</th><th>نوع</th><th>مبلغ</th></tr>
                </thead>
                <tbody>
                  {p.items.map((it) => (
                    <tr key={it.id}>
                      <td>{it.component.name}</td>
                      <td>
                        <Badge kind={it.component.type === 'DEDUCTION' ? 'red' : 'green'}>
                          {it.component.type === 'DEDUCTION' ? 'کسورات' : 'پرداختی'}
                        </Badge>
                      </td>
                      <td>{formatRial(it.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

/* ==========================================================================
   تب پروندهٔ من
   ========================================================================== */

function ProfileTab({ profile }: { profile: PanelProfile | null }) {
  if (!profile) return <Card><div className="empty-state">پرونده‌ای یافت نشد.</div></Card>;
  const version = profile.contracts?.[0]?.versions?.[0];
  return (
    <div className="col" style={{ gap: 12 }}>
      <Card title="اطلاعات پرسنلی">
        <div className="form-grid">
          <InfoRow label="نام و نام خانوادگی" value={`${profile.firstName} ${profile.lastName}`} />
          <InfoRow label="کد پرسنلی" value={profile.code} ltr />
          <InfoRow label="کد ملی" value={profile.nationalId ?? '—'} ltr />
          <InfoRow label="سمت" value={profile.position?.title ?? '—'} />
          <InfoRow label="واحد سازمانی" value={profile.orgUnit?.name ?? '—'} />
          <InfoRow label="موبایل" value={profile.mobile ?? '—'} ltr />
          <InfoRow label="ایمیل" value={profile.email ?? '—'} ltr />
          <InfoRow label="تاریخ استخدام" value={formatJalali(profile.hireDate)} />
          <InfoRow label="نوع استخدام" value={statusLabel(profile.employmentType)} />
          <InfoRow label="حقوق پایهٔ ماهانه" value={formatRial(Number(profile.monthlyBaseSalary ?? 0))} />
        </div>
      </Card>

      {version && (
        <Card title="قرارداد فعال">
          <div className="form-grid">
            <InfoRow label="شروع" value={formatJalali(version.startDate)} />
            <InfoRow label="پایان" value={version.endDate ? formatJalali(version.endDate) : 'دائمی'} />
            <InfoRow label="ساعت کاری روزانه" value={toPersianDigits(version.workHoursPerDay)} />
            <InfoRow label="حقوق قرارداد" value={formatRial(version.baseSalary)} />
          </div>
        </Card>
      )}

      <div className="col" style={{ gap: 12 }}>
        <Card title="مانده مرخصی">
          {profile.leaveBalances.length === 0 ? (
            <div className="text-muted text-sm">مانده‌ای ثبت نشده است.</div>
          ) : (
            profile.leaveBalances.map((b) => (
              <div key={b.leaveType.id} className="flex" style={{ justifyContent: 'space-between', padding: '6px 0' }}>
                <span>{b.leaveType.name}</span>
                <span className="fw-600">{fmtMinutes(b.minutes)}</span>
              </div>
            ))
          )}
        </Card>

        <Card title="مهارت‌ها">
          {profile.skills.length === 0 ? (
            <div className="text-muted text-sm">مهارتی ثبت نشده است.</div>
          ) : (
            <div className="flex" style={{ gap: 8, flexWrap: 'wrap' }}>
              {profile.skills.map((s) => (
                <Badge key={s.skill} kind="blue">{s.skill} · {toPersianDigits(s.level)}</Badge>
              ))}
            </div>
          )}
        </Card>

        <Card title="مدارک">
          {profile.documents.length === 0 ? (
            <div className="text-muted text-sm">مدرکی ثبت نشده است.</div>
          ) : (
            profile.documents.map((d) => (
              <div key={d.id} className="flex" style={{ justifyContent: 'space-between', padding: '6px 0' }}>
                <span>{d.title}</span>
                <span className="text-muted text-xs">
                  {d.expiryDate ? `انقضا: ${formatJalali(d.expiryDate)}` : 'بدون انقضا'}
                </span>
              </div>
            ))
          )}
        </Card>

        {profile.bankAccounts.length > 0 && (
          <Card title="حساب بانکی">
            {profile.bankAccounts.map((b) => (
              <div key={b.accountNumber} className="form-grid">
                <InfoRow label="بانک" value={b.bankName} />
                <InfoRow label="شمارهٔ شبا" value={b.sheba ?? b.accountNumber} ltr />
              </div>
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value, ltr }: { label: string; value?: string | null; ltr?: boolean }) {
  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <div className={`input${ltr ? ' ltr' : ''}`} style={{ background: 'var(--surface-2)' }}>{value ?? '—'}</div>
    </div>
  );
}
