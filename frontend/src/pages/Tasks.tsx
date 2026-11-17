import { useState } from 'react';
import { Plus, UserRoundPen } from 'lucide-react';
import { api, apiErrorMessage } from '../lib/api';
import { getDefaultCompanyId } from '../lib/org';
import CompanyPicker from '../components/CompanyPicker';
import { useList } from '../lib/useList';
import { useAuth } from '../lib/auth';
import TaskCountdown from '../components/TaskCountdown';
import TaskStatusMark from '../components/TaskStatusMark';
import { WorkCategoryPicker, WorkCategoryTag } from '../components/WorkCategory';
import TaskRetryReview from '../components/TaskRetryReview';
import { WORK_CATEGORIES } from '../lib/workCategories';
import { DatePicker,
  Badge,
  Button,
  Card,
  DataTable,
  Field,
  Input,
  ListToolbar,
  Modal,
  PageHeader,
  Pagination,
  Select,
  Textarea,
  useToast,
  type Column,
} from '../components/ui';
import { formatJalali, statusLabel, badgeKind, toPersianDigits, parseDateInput } from '../lib/format';

interface Task {
  category?: string | null;
  retryStatus?: string | null;
  id: string;
  title: string;
  description?: string | null;
  delayReason?: string | null;
  status: string;
  priority: string;
  dueDate?: string | null;
  slaHours?: number | null;
  creator?: { fullName: string } | null;
  assignees?: {
    userId?: string | null;
    employee?: { firstName: string; lastName: string } | null;
    user?: { id: string; fullName: string; username: string } | null;
  }[];
}

interface UserOption {
  id: string;
  fullName: string;
  username: string;
  employee?: { code: string; firstName: string; lastName: string } | null;
}

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const STATUSES = ['NEW', 'IN_PROGRESS', 'DONE', 'CANCELLED'];

export default function Tasks() {
  const toast = useToast();
  const { hasPermission } = useAuth();
  const list = useList<Task>('/tasks');
  const users = useList<UserOption>('/tasks/assignees', { limit: 50 });
  const [createOpen, setCreateOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [form, setForm] = useState({ title: '', description: '', priority: 'MEDIUM', category: '', dueDate: '', slaHours: '', assigneeIds: [] as string[] });
  const [saving, setSaving] = useState(false);
  const [companyId, setCompanyId] = useState('');

  const canCreate = hasPermission('tasks.create');
  const canUpdate = hasPermission('tasks.update');

  const openTask = (task?: Task) => {
    setEditingTask(task ?? null);
    setForm({ title: task?.title ?? '', description: task?.description ?? '', priority: task?.priority ?? 'MEDIUM', category: task?.category ?? '', dueDate: task?.dueDate?.slice(0, 10) ?? '', slaHours: task?.slaHours?.toString() ?? '', assigneeIds: (task?.assignees ?? []).map((a) => a.userId ?? a.user?.id).filter((id): id is string => !!id) });
    users.reload();
    setCreateOpen(true);
  };

  const submit = async () => {
    setSaving(true);
    try {
      if (!form.title.trim()) throw new Error('عنوان task را وارد کنید.');
      const dueDate = parseDateInput(form.dueDate);
      if (form.dueDate && !dueDate) throw new Error('قالب تاریخ مهلت معتبر نیست (نمونه: ۱۴۰۴/۰۱/۰۱).');
      const payload = {
        title: form.title,
        description: form.description,
        priority: form.priority,
        category: form.category || null,
        dueDate: dueDate || (editingTask ? null : undefined),
        slaHours: form.slaHours ? Number(form.slaHours) : (editingTask ? null : undefined),
        assigneeUserIds: form.assigneeIds,
      };
      if (editingTask) {
        await api.patch(`/tasks/${editingTask.id}`, payload);
      } else {
        const selectedCompany = companyId || await getDefaultCompanyId();
        if (!selectedCompany) throw new Error('شرکتی در ساختار سازمانی ثبت نشده است.');
        await api.post('/tasks', { ...payload, companyId:selectedCompany });
      }
      toast('success', editingTask ? 'task و مسئولان به‌روزرسانی شدند.' : 'task ثبت شد.');
      setCreateOpen(false);
      list.reload();
    } catch (e) {
      toast('error', e instanceof Error ? e.message : apiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (id: string, status: string) => {
    try {
      await api.patch(`/tasks/${id}`, { status });
      list.reload();
      toast('success', 'وضعیت task به‌روزرسانی شد.');
    } catch (e) {
      toast('error', apiErrorMessage(e));
    }
  };

  const cols: Column<Task>[] = [
    { key: 'title', header: 'عنوان', render: (r) => <span className="task-table-title"><TaskStatusMark status={r.status} blocked={!!r.delayReason} /><span className="fw-600">{r.title}</span></span> },
    { key: 'category', header: 'دسته', render: r => r.category ? <WorkCategoryTag value={r.category} /> : '—' },
    { key: 'retry', header: 'انجام دوباره', render: r => canUpdate ? <TaskRetryReview task={r} onReviewed={list.reload} /> : r.retryStatus === 'PENDING' ? 'در انتظار تأیید مدیر' : '—' },
    { key: 'delayReason', header: 'دلیل انجام نشدن', render: (r) => r.delayReason || '—' },
    { key: 'assignees', header: 'مسئول', render: (r) => (r.assignees ?? []).map((a) => a.employee ? `${a.employee.firstName} ${a.employee.lastName}` : a.user?.fullName ?? null).filter(Boolean).join('، ') || '—' },
    { key: 'priority', header: 'اولویت', render: (r) => <Badge kind={r.priority === 'CRITICAL' || r.priority === 'HIGH' ? 'red' : r.priority === 'MEDIUM' ? 'amber' : 'gray'}>{statusLabel(r.priority)}</Badge> },
    { key: 'dueDate', header: 'مهلت', render: (r) => <div className="task-deadline-cell"><span>{r.dueDate ? formatJalali(r.dueDate) : '—'}</span><TaskCountdown dueDate={r.dueDate} status={r.status} /></div> },
    { key: 'sla', header: 'SLA', render: (r) => (r.slaHours ? `${toPersianDigits(r.slaHours)} ساعت` : '—') },
    {
      key: 'status',
      header: 'وضعیت',
      render: (r) =>
        canUpdate ? (
          <Select value={r.status} onChange={(e) => changeStatus(r.id, e.target.value)} style={{ width: 130 }}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s === 'IN_PROGRESS' && r.delayReason ? 'انجام نشد' : statusLabel(s)}</option>
            ))}
          </Select>
        ) : (
          <Badge kind={badgeKind(r.status)}>{statusLabel(r.status)}</Badge>
        ),
    },
    ...(canUpdate ? [{ key: 'actions', header: 'مسئولان', render: (r: Task) => (
      <Button variant="secondary" size="sm" title="ویرایش task و مسئولان" aria-label="ویرایش task و مسئولان" onClick={() => openTask(r)}><UserRoundPen size={16} /></Button>
    ) }] : []),
  ];

  return (
    <>
      <PageHeader
        title="task"
        subtitle="سپردن، پیگیری و تکمیل task"
        actions={canCreate && <Button onClick={() => openTask()}><Plus size={15} /> task جدید</Button>}
      />
      <Card>
        <div className="list-toolbar-wrap">
          <ListToolbar search={list.search} onSearch={(s) => list.setSearch(s)}>
            <Select aria-label="دسته‌بندی task" onChange={event => list.setFilter('category', event.target.value)}><option value="">همهٔ دسته‌ها</option>{WORK_CATEGORIES.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}</Select>
            <Select onChange={(e) => list.setFilter('status', e.target.value)} style={{ width: 160 }}>
              <option value="">همهٔ وضعیت‌ها</option>
              {STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
            </Select>
            <Select onChange={(e) => list.setFilter('priority', e.target.value)} style={{ width: 150 }}>
              <option value="">همهٔ اولویت‌ها</option>
              {PRIORITIES.map((p) => <option key={p} value={p}>{statusLabel(p)}</option>)}
            </Select>
          </ListToolbar>
        </div>
        <DataTable error={list.error} onRetry={list.reload} columns={cols} rows={list.rows} loading={list.loading} rowClassName={task => `task-state-${task.status === 'DONE' ? 'done' : task.status !== 'CANCELLED' && task.delayReason ? 'blocked' : task.status.toLowerCase()}`} />
        <div className="list-pagination-wrap">
          <Pagination pageSize={list.pageSize} onPageSizeChange={list.setPageSize} page={list.page} totalPages={list.totalPages} total={list.total} onChange={list.setPage} />
        </div>
      </Card>

      <Modal
        open={createOpen}
        title={editingTask ? 'ویرایش task و مسئولان' : 'ثبت task جدید'}
        onClose={() => setCreateOpen(false)}
        footer={
          <>
            <Button onClick={submit} loading={saving} disabled={!form.title.trim() || !!users.error}>ثبت</Button>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>انصراف</Button>
          </>
        }
      >
        <div className="col" style={{ gap: 14 }}>
          {!editingTask && <CompanyPicker value={companyId} onValueChange={setCompanyId} disabled={saving} />}
          <Field label="عنوان" required><Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} /></Field>
          <Field label="شرح"><Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></Field>
          <WorkCategoryPicker value={form.category} onChange={category => setForm(value => ({ ...value, category }))} disabled={saving} />
          <div className="form-grid">
            <Field label="اولویت">
              <Select value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}>
                {PRIORITIES.map((p) => <option key={p} value={p}>{statusLabel(p)}</option>)}
              </Select>
            </Field>
            <Field label="مهلت" hint="شمسی یا میلادی — ۱۴۰۴/۰۱/۰۱"><DatePicker className="input ltr" value={form.dueDate} onValueChange={(value) => setForm((f) => ({ ...f, dueDate: value }))} placeholder="1404/01/01" /></Field>
            <Field label="SLA (ساعت)"><Input type="number" value={form.slaHours} onChange={(e) => setForm((f) => ({ ...f, slaHours: e.target.value }))} /></Field>
          </div>
          <Field label={`کاربران مسئول (${toPersianDigits(form.assigneeIds.length)})`} error={users.error}>
            <Input aria-label="جستجوی مسئول" placeholder="جستجوی نام یا نام کاربری" value={users.search} onChange={(e) => users.setSearch(e.target.value)} />
            <div style={{ maxHeight: 220, overflowY: 'auto', marginTop: 8 }}>
              {users.loading ? <p role="status">در حال دریافت کاربران...</p> : users.rows.map((u) => (
                <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.assigneeIds.includes(u.id)} onChange={(e) => setForm((f) => ({ ...f, assigneeIds: e.target.checked ? [...f.assigneeIds, u.id] : f.assigneeIds.filter((id) => id !== u.id) }))} />
                  <span>{u.fullName} ({u.username})</span>
                </label>
              ))}
              {!users.loading && !users.error && !users.rows.length && <p>کاربری یافت نشد.</p>}
            </div>
            <Pagination pageSize={users.pageSize} onPageSizeChange={users.setPageSize} page={users.page} totalPages={users.totalPages} total={users.total} onChange={users.setPage} />
          </Field>
        </div>
      </Modal>
    </>
  );
}
