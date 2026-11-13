import { useState } from 'react';
import { Plus } from 'lucide-react';
import { api, apiErrorMessage } from '../lib/api';
import { getDefaultCompanyId } from '../lib/org';
import { useList } from '../lib/useList';
import { useAuth } from '../lib/auth';
import {
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
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate?: string | null;
  slaHours?: number | null;
  creator?: { fullName: string } | null;
  assignees?: { employee?: { firstName: string; lastName: string } | null }[];
}

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const STATUSES = ['NEW', 'IN_PROGRESS', 'DONE', 'CANCELLED'];

export default function Tasks() {
  const toast = useToast();
  const { hasPermission } = useAuth();
  const list = useList<Task>('/tasks');
  const employees = useList<{ id: string; code: string; firstName: string; lastName: string }>('/employees', { limit: 200 });
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', priority: 'MEDIUM', dueDate: '', slaHours: '', assigneeIds: [] as string[] });
  const [saving, setSaving] = useState(false);

  const canCreate = hasPermission('tasks.create');
  const canUpdate = hasPermission('tasks.update');

  const submit = async () => {
    setSaving(true);
    try {
      const companyId = await getDefaultCompanyId();
      if (!companyId) throw new Error('شرکتی در ساختار سازمانی ثبت نشده است.');
      const dueDate = parseDateInput(form.dueDate);
      if (form.dueDate && !dueDate) throw new Error('قالب تاریخ مهلت معتبر نیست (نمونه: ۱۴۰۴/۰۱/۰۱).');
      await api.post('/tasks', {
        companyId,
        title: form.title,
        description: form.description || undefined,
        priority: form.priority,
        dueDate: dueDate || undefined,
        slaHours: form.slaHours ? Number(form.slaHours) : undefined,
        assigneeIds: form.assigneeIds,
      });
      toast('success', 'وظیفه ثبت شد.');
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
      toast('success', 'وضعیت وظیفه به‌روزرسانی شد.');
    } catch (e) {
      toast('error', apiErrorMessage(e));
    }
  };

  const cols: Column<Task>[] = [
    { key: 'title', header: 'عنوان', render: (r) => <span className="fw-600">{r.title}</span> },
    { key: 'assignees', header: 'مسئول', render: (r) => (r.assignees ?? []).map((a) => a.employee ? `${a.employee.firstName} ${a.employee.lastName}` : null).filter(Boolean).join('، ') || '—' },
    { key: 'priority', header: 'اولویت', render: (r) => <Badge kind={r.priority === 'CRITICAL' || r.priority === 'HIGH' ? 'red' : r.priority === 'MEDIUM' ? 'amber' : 'gray'}>{statusLabel(r.priority)}</Badge> },
    { key: 'dueDate', header: 'مهلت', render: (r) => (r.dueDate ? formatJalali(r.dueDate) : '—') },
    { key: 'sla', header: 'SLA', render: (r) => (r.slaHours ? `${toPersianDigits(r.slaHours)} ساعت` : '—') },
    {
      key: 'status',
      header: 'وضعیت',
      render: (r) =>
        canUpdate ? (
          <Select value={r.status} onChange={(e) => changeStatus(r.id, e.target.value)} style={{ width: 130 }}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{statusLabel(s)}</option>
            ))}
          </Select>
        ) : (
          <Badge kind={badgeKind(r.status)}>{statusLabel(r.status)}</Badge>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        title="وظایف"
        subtitle="سپردن، پیگیری و تکمیل وظایف"
        actions={canCreate && <Button onClick={() => setCreateOpen(true)}><Plus size={15} /> وظیفهٔ جدید</Button>}
      />
      <Card>
        <div style={{ padding: '14px 14px 0' }}>
          <ListToolbar onSearch={(s) => list.setSearch(s)}>
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
        <DataTable columns={cols} rows={list.rows} loading={list.loading} />
        <div style={{ padding: '0 14px 14px' }}>
          <Pagination page={list.page} totalPages={list.totalPages} total={list.total} onChange={list.setPage} />
        </div>
      </Card>

      <Modal
        open={createOpen}
        title="ثبت وظیفهٔ جدید"
        onClose={() => setCreateOpen(false)}
        footer={
          <>
            <Button onClick={submit} loading={saving}>ثبت</Button>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>انصراف</Button>
          </>
        }
      >
        <div className="col" style={{ gap: 14 }}>
          <Field label="عنوان" required><Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} /></Field>
          <Field label="شرح"><Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></Field>
          <div className="form-grid">
            <Field label="اولویت">
              <Select value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}>
                {PRIORITIES.map((p) => <option key={p} value={p}>{statusLabel(p)}</option>)}
              </Select>
            </Field>
            <Field label="مهلت" hint="شمسی یا میلادی — ۱۴۰۴/۰۱/۰۱"><input className="input ltr" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} placeholder="1404/01/01" /></Field>
            <Field label="SLA (ساعت)"><Input type="number" value={form.slaHours} onChange={(e) => setForm((f) => ({ ...f, slaHours: e.target.value }))} /></Field>
          </div>
          <Field label="نیروهای مسئول">
            <Select
              multiple
              size={Math.min(8, Math.max(3, form.assigneeIds.length))}
              value={form.assigneeIds}
              onChange={(e) => {
                const values = Array.from(e.target.selectedOptions).map((o) => o.value);
                setForm((f) => ({ ...f, assigneeIds: values }));
              }}
            >
              {employees.rows.map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName} ({emp.code})</option>
              ))}
            </Select>
          </Field>
        </div>
      </Modal>
    </>
  );
}
