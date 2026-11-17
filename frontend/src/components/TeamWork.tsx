import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, CircleAlert, Clock, Plus, RefreshCw, UserRound, ClipboardList, CheckCircle2 } from 'lucide-react';
import { api, apiErrorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useList } from '../lib/useList';
import { getDefaultCompanyId } from '../lib/org';
import CompanyPicker from './CompanyPicker';
import { formatJalali, parseDateInput, toPersianDigits, isPastDueDate } from '../lib/format';
import { DatePicker, Button, Field, Input, Modal, PageHeader, Pagination, Select, Textarea, useToast } from './ui';
import TeamPresence from './TeamPresence';
import TaskCountdown from './TaskCountdown';
import TaskStatusMark from './TaskStatusMark';
import { WorkCategoryPicker, WorkCategoryTag } from './WorkCategory';
import TaskRetryReview from './TaskRetryReview';
import { categoryStyle, WORK_CATEGORIES } from '../lib/workCategories';

interface Work {
  category?: string | null;
  retryStatus?: string | null;
  retryRequester?: { fullName: string } | null;
  id: string;
  title: string;
  description: string | null;
  status: string;
  dueDate: string | null;
  delayReason: string | null;
  createdAt: string;
  completedAt: string | null;
  createdBy: { fullName: string } | null;
  assignees: { user: { fullName: string } | null; employee: { firstName: string; lastName: string } | null }[];
  comments: { id: string; content: string; createdAt: string; author: { fullName: string } | null }[];
}

const labels: Record<string, string> = { NEW: 'شروع نشده', IN_PROGRESS: 'در حال انجام', BLOCKED: 'انجام نشد', DONE: 'انجام‌شده', CANCELLED: 'لغوشده' };
const stateOf = (task: Work) => !['DONE', 'CANCELLED'].includes(task.status) && task.delayReason ? 'BLOCKED' : task.status;
const dateTime = (date: string) => new Intl.DateTimeFormat('fa-IR', { timeZone: 'Asia/Tehran', dateStyle: 'short', timeStyle: 'short' }).format(new Date(date));

export default function TeamWork() {
  const { hasPermission } = useAuth();
  const [tasks, setTasks] = useState<Work[]>([]);
  const [filter, setFilter] = useState('ACTIVE');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const result = await api.get('/dashboard/team-work', { signal });
      if (!signal?.aborted) { setTasks(result.data.data ?? []); setError(''); }
    } catch (e) {
      if (!signal?.aborted) setError(apiErrorMessage(e));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const refresh = () => { if (!document.hidden) void load(controller.signal); };
    void load(controller.signal);
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener('focus', refresh);
    return () => { controller.abort(); window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [load]);
  const visible = tasks.filter((task) => (!category || task.category === category) && (filter === 'ALL' || (filter === 'ACTIVE' ? !['DONE', 'CANCELLED'].includes(task.status) : stateOf(task) === filter)));
  return <>
    <PageHeader title="کارهای تیم" actions={hasPermission('tasks.create') && <Button onClick={() => setCreating(true)}><Plus size={17} /> واگذاری کار</Button>} />
    <div className="work-overview" role="group" aria-label="خلاصه کارهای تیم">
      {[
        { key:'ACTIVE', label:'کارهای باز', count:tasks.filter(task => !['DONE','CANCELLED'].includes(task.status)).length, icon:<ClipboardList size={20} /> },
        { key:'IN_PROGRESS', label:'در حال انجام', count:tasks.filter(task => stateOf(task) === 'IN_PROGRESS').length, icon:<Clock size={20} /> },
        { key:'BLOCKED', label:'دارای مشکل', count:tasks.filter(task => stateOf(task) === 'BLOCKED').length, icon:<CircleAlert size={20} />, className:'has-problem' },
        { key:'DONE', label:'انجام‌شده', count:tasks.filter(task => task.status === 'DONE').length, icon:<CheckCircle2 size={20} />, className:'is-done' },
      ].map(item => <button type="button" key={item.key} data-state={item.key.toLowerCase()} className={item.className} aria-pressed={filter === item.key} onClick={() => setFilter(item.key)}>{item.icon}<span><strong>{loading || error ? '—' : toPersianDigits(item.count)}</strong><small>{item.label}</small></span></button>)}
    </div>
    <div className="team-work-toolbar">
      <Select aria-label="وضعیت کارها" value={filter} onChange={(e) => setFilter(e.target.value)}>
        <option value="ACTIVE">کارهای باز</option>
        <option value="ALL">همه کارها</option>
        {Object.entries(labels).map(([key, label]) => <option key={key} value={key}>{label} ({toPersianDigits(tasks.filter((task) => stateOf(task) === key).length)})</option>)}
      </Select>
      <Select aria-label="دسته‌بندی کارها" value={category} onChange={event => setCategory(event.target.value)}><option value="">همهٔ دسته‌ها</option>{WORK_CATEGORIES.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}</Select>
      <span className="text-muted text-sm">{toPersianDigits(visible.length)} کار</span>
      <Button variant="outline" size="sm" aria-label="تازه‌سازی کارها" title="تازه‌سازی کارها" onClick={() => void load()}><RefreshCw size={16} /></Button>
      {hasPermission('tasks.view') && <Link to="/tasks" className="text-sm">ویرایش task</Link>}
    </div>
    {error && <div className="alert alert-danger" role="alert">{error} <Button variant="secondary" onClick={() => void load()}>تلاش دوباره</Button></div>}
    {loading ? <div className="skeleton" style={{ height: 180 }} /> : !error && <div className="team-work-list">
      {!visible.length && <div className="empty-state">کاری در این وضعیت نیست.</div>}
      {visible.map((task) => {
        const state = stateOf(task);
        const overdue = isPastDueDate(task.dueDate) && !['DONE', 'CANCELLED'].includes(state);
        return <article key={task.id} style={categoryStyle(task.category)} className={`team-work-row state-${state.toLowerCase()}${task.category ? ' has-category' : ''}`}>
          <div className="team-work-title"><div className="team-work-heading"><TaskStatusMark status={state} /><h3>{task.title}</h3></div><span className="team-work-state">{labels[state] ?? state}</span></div>
          <div className="team-work-meta"><span><UserRound size={15} />{task.assignees.map((a) => a.user?.fullName ?? (a.employee ? `${a.employee.firstName} ${a.employee.lastName}` : '')).filter(Boolean).join('، ') || 'بدون مسئول'}</span>{task.dueDate && <span className={overdue ? 'text-danger' : ''}>مهلت: {formatJalali(task.dueDate)}{overdue ? ' · عقب‌افتاده' : ''}</span>}<TaskCountdown dueDate={task.dueDate} status={task.status} /><WorkCategoryTag value={task.category} /></div>
          {state === 'BLOCKED' && <p className="team-work-problem"><strong>مشکل:</strong> {task.delayReason}</p>}
          {hasPermission('tasks.update') && <TaskRetryReview task={task} onReviewed={() => load()} />}
          <details className="team-work-history">
            <summary>جزئیات و تاریخچه <ChevronDown size={15} /></summary>
            {task.description && <p className="team-work-description">{task.description}</p>}
            <ol>
              <li><span>تعریف کار · {task.createdBy?.fullName ?? 'کاربر حذف‌شده'}</span><time dateTime={task.createdAt}>{dateTime(task.createdAt)}</time></li>
              {task.comments.map((event) => <li key={event.id}><span>{event.content}<small>{event.author?.fullName ?? 'کاربر حذف‌شده'}</small></span><time dateTime={event.createdAt}>{dateTime(event.createdAt)}</time></li>)}
            </ol>
            {task.completedAt && <p className="text-muted text-sm">زمان تکمیل فعلی: {dateTime(task.completedAt)}</p>}
          </details>
        </article>;
      })}
    </div>}
    <div className="team-work-presence"><TeamPresence /></div>
    {creating && <AssignWork onClose={() => setCreating(false)} onCreated={() => { setCreating(false); setFilter('ACTIVE'); void load(); }} />}
  </>;
}

function AssignWork({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [companyId, setCompanyId] = useState('');
  const people = useList<{ id: string; fullName: string; username: string }>('/tasks/assignees', { limit: 20 });
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [category, setCategory] = useState('');
  const [assignee, setAssignee] = useState<{ id: string; fullName: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const submit = async () => {
    if (saving || !title.trim() || !assignee) return;
    setSaving(true);
    try {
      const date = parseDateInput(dueDate);
      if (dueDate && !date) throw new Error('تاریخ مهلت معتبر نیست.');
      const selectedCompany = companyId || await getDefaultCompanyId();
      if (!selectedCompany) throw new Error('شرکتی ثبت نشده است.');
      await api.post('/tasks', { companyId:selectedCompany, title: title.trim(), description, category: category || null, assigneeUserIds: [assignee.id], ...(date ? { dueDate: date } : {}) });
      toast('success', 'کار واگذار شد.');
      onCreated();
    } catch (e) { toast('error', e instanceof Error && !('response' in e) ? e.message : apiErrorMessage(e)); }
    finally { setSaving(false); }
  };
  return <Modal open title="واگذاری کار" onClose={() => { if (!saving) onClose(); }} footer={<><Button loading={saving} disabled={!title.trim() || !assignee} onClick={submit}>ثبت کار</Button><Button variant="secondary" disabled={saving} onClick={onClose}>انصراف</Button></>}>
    <div className="col" style={{ gap: 14 }}>
      <CompanyPicker value={companyId} onValueChange={setCompanyId} disabled={saving} />
      <Field label="عنوان کار" required><Input aria-label="عنوان کار" maxLength={240} value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
      <Field label="شرح کار"><Textarea aria-label="شرح کار" value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
      <WorkCategoryPicker value={category} onChange={setCategory} disabled={saving} />
      <Field label="مهلت"><DatePicker aria-label="مهلت" placeholder="۱۴۰۵/۰۸/۳۰" value={dueDate} onValueChange={(value) => setDueDate(value)} /></Field>
      <Field label="مسئول کار" required>
        <Input aria-label="جستجوی کارمند" placeholder="نام کارمند" value={people.search} onChange={(e) => people.setSearch(e.target.value)} />
        {assignee && <p className="text-sm">مسئول انتخاب‌شده: {assignee.fullName}</p>}
        {people.error ? <div className="alert alert-danger">{people.error}<Button variant="secondary" onClick={people.reload}>تلاش دوباره</Button></div> : people.loading ? <div className="skeleton" style={{ height: 90 }} /> : <div className="team-work-people">
          {!people.rows.length && <p className="text-muted">کاربری پیدا نشد.</p>}
          {people.rows.map((person) => <label key={person.id}><input type="radio" name="work-assignee" checked={assignee?.id === person.id} onChange={() => setAssignee(person)} /><span>{person.fullName}<small>{person.username}</small></span></label>)}
        </div>}
        <Pagination pageSize={people.pageSize} onPageSizeChange={people.setPageSize} page={people.page} totalPages={people.totalPages} total={people.total} onChange={people.setPage} />
      </Field>
    </div>
  </Modal>;
}
