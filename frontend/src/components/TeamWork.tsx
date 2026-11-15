import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, CircleAlert, Clock, Plus, RefreshCw, UserRound } from 'lucide-react';
import { api, apiErrorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useList } from '../lib/useList';
import { getDefaultCompanyId } from '../lib/org';
import { formatJalali, parseDateInput, toPersianDigits } from '../lib/format';
import { Button, Field, Input, Modal, PageHeader, Pagination, Select, Textarea, useToast } from './ui';
import TeamPresence from './TeamPresence';

interface Work {
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

const labels: Record<string, string> = { NEW: 'شروع نشده', IN_PROGRESS: 'در حال انجام', BLOCKED: 'دارای مشکل', DONE: 'انجام‌شده', CANCELLED: 'لغوشده' };
const stateOf = (task: Work) => !['DONE', 'CANCELLED'].includes(task.status) && task.delayReason ? 'BLOCKED' : task.status;
const dateTime = (date: string) => new Intl.DateTimeFormat('fa-IR', { timeZone: 'Asia/Tehran', dateStyle: 'short', timeStyle: 'short' }).format(new Date(date));

export default function TeamWork() {
  const { hasPermission } = useAuth();
  const [tasks, setTasks] = useState<Work[]>([]);
  const [filter, setFilter] = useState('ACTIVE');
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
  const visible = tasks.filter((task) => filter === 'ALL' || (filter === 'ACTIVE' ? !['DONE', 'CANCELLED'].includes(task.status) : stateOf(task) === filter));
  return <>
    <PageHeader title="کارهای تیم" actions={hasPermission('tasks.create') && <Button onClick={() => setCreating(true)}><Plus size={17} /> واگذاری کار</Button>} />
    <div className="team-work-toolbar">
      <Select aria-label="وضعیت کارها" value={filter} onChange={(e) => setFilter(e.target.value)}>
        <option value="ACTIVE">کارهای باز</option>
        <option value="ALL">همه کارها</option>
        {Object.entries(labels).map(([key, label]) => <option key={key} value={key}>{label} ({toPersianDigits(tasks.filter((task) => stateOf(task) === key).length)})</option>)}
      </Select>
      <span className="text-muted text-sm">{toPersianDigits(visible.length)} کار</span>
      <Button variant="outline" size="sm" aria-label="تازه‌سازی کارها" title="تازه‌سازی کارها" onClick={() => void load()}><RefreshCw size={16} /></Button>
      {hasPermission('tasks.view') && <Link to="/tasks" className="text-sm">ویرایش وظایف</Link>}
    </div>
    {error && <div className="alert alert-danger" role="alert">{error} <Button variant="secondary" onClick={() => void load()}>تلاش دوباره</Button></div>}
    {loading ? <div className="skeleton" style={{ height: 180 }} /> : !error && <div className="team-work-list">
      {!visible.length && <div className="empty-state">کاری در این وضعیت نیست.</div>}
      {visible.map((task) => {
        const state = stateOf(task);
        const overdue = task.dueDate && new Date(task.dueDate).getTime() < Date.now() && !['DONE', 'CANCELLED'].includes(state);
        return <article key={task.id} className={`team-work-row state-${state.toLowerCase()}`}>
          <div className="team-work-title"><h3>{task.title}</h3><span className="team-work-state">{state === 'BLOCKED' ? <CircleAlert size={15} /> : <Clock size={15} />}{labels[state] ?? state}</span></div>
          <div className="team-work-meta"><span><UserRound size={15} />{task.assignees.map((a) => a.user?.fullName ?? (a.employee ? `${a.employee.firstName} ${a.employee.lastName}` : '')).filter(Boolean).join('، ') || 'بدون مسئول'}</span>{task.dueDate && <span className={overdue ? 'text-danger' : ''}>مهلت: {formatJalali(task.dueDate)}{overdue ? ' · عقب‌افتاده' : ''}</span>}</div>
          {state === 'BLOCKED' && <p className="team-work-problem"><strong>مشکل:</strong> {task.delayReason}</p>}
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
  const people = useList<{ id: string; fullName: string; username: string }>('/tasks/assignees', { limit: 20 });
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [assignee, setAssignee] = useState<{ id: string; fullName: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const submit = async () => {
    if (saving || !title.trim() || !assignee) return;
    setSaving(true);
    try {
      const date = parseDateInput(dueDate);
      if (dueDate && !date) throw new Error('تاریخ مهلت معتبر نیست.');
      const companyId = await getDefaultCompanyId();
      if (!companyId) throw new Error('شرکتی ثبت نشده است.');
      await api.post('/tasks', { companyId, title: title.trim(), description, assigneeUserIds: [assignee.id], ...(date ? { dueDate: date } : {}) });
      toast('success', 'کار واگذار شد.');
      onCreated();
    } catch (e) { toast('error', e instanceof Error && !('response' in e) ? e.message : apiErrorMessage(e)); }
    finally { setSaving(false); }
  };
  return <Modal open title="واگذاری کار" onClose={() => { if (!saving) onClose(); }} footer={<><Button loading={saving} disabled={!title.trim() || !assignee} onClick={submit}>ثبت کار</Button><Button variant="secondary" disabled={saving} onClick={onClose}>انصراف</Button></>}>
    <div className="col" style={{ gap: 14 }}>
      <Field label="عنوان کار" required><Input aria-label="عنوان کار" maxLength={240} value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
      <Field label="شرح کار"><Textarea aria-label="شرح کار" value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
      <Field label="مهلت"><Input aria-label="مهلت" placeholder="۱۴۰۵/۰۸/۳۰" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></Field>
      <Field label="مسئول کار" required>
        <Input aria-label="جستجوی کارمند" placeholder="نام کارمند" value={people.search} onChange={(e) => people.setSearch(e.target.value)} />
        {assignee && <p className="text-sm">مسئول انتخاب‌شده: {assignee.fullName}</p>}
        {people.error ? <div className="alert alert-danger">{people.error}<Button variant="secondary" onClick={people.reload}>تلاش دوباره</Button></div> : people.loading ? <div className="skeleton" style={{ height: 90 }} /> : <div className="team-work-people">
          {!people.rows.length && <p className="text-muted">کاربری پیدا نشد.</p>}
          {people.rows.map((person) => <label key={person.id}><input type="radio" name="work-assignee" checked={assignee?.id === person.id} onChange={() => setAssignee(person)} /><span>{person.fullName}<small>{person.username}</small></span></label>)}
        </div>}
        <Pagination page={people.page} totalPages={people.totalPages} total={people.total} onChange={people.setPage} />
      </Field>
    </div>
  </Modal>;
}
