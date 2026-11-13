import { useState } from 'react';
import { api, apiErrorMessage } from '../lib/api';
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
import { formatJalali, statusLabel, badgeKind, parseDateInput } from '../lib/format';

interface Onboarding { id: string; employee?: { firstName: string; lastName: string } | null; template?: { name: string } | null; status: string; startedAt: string; completedAt?: string | null; _count?: { items: number } }
interface Offboarding { id: string; employee?: { firstName: string; lastName: string } | null; reason: string; terminationDate: string; status: string; _count?: { items: number } }
interface Termination { id: string; employee?: { firstName: string; lastName: string } | null; reason: string; terminationDate: string; status: string; approvedBy?: { fullName: string } | null }

export default function Lifecycle() {
  const toast = useToast();
  const { hasPermission } = useAuth();
  const [tab, setTab] = useState<'onboarding' | 'offboarding' | 'terminations'>('onboarding');
  const onboarding = useList<Onboarding>('/lifecycle/onboarding');
  const offboarding = useList<Offboarding>('/lifecycle/offboarding');
  const terminations = useList<Termination>('/lifecycle/terminations');
  const [termOpen, setTermOpen] = useState(false);
  const [form, setForm] = useState({ employeeId: '', reason: 'RESIGNATION', terminationDate: '', note: '' });
  const [saving, setSaving] = useState(false);

  const canManage = hasPermission('lifecycle.manage');

  const submitTermination = async () => {
    setSaving(true);
    try {
      const terminationDate = parseDateInput(form.terminationDate);
      if (!terminationDate) throw new Error('قالب تاریخ خاتمه معتبر نیست (نمونه: ۱۴۰۴/۰۱/۰۱).');
      await api.post('/lifecycle/terminations', { ...form, terminationDate });
      toast('success', 'درخواست خاتمه ثبت شد.');
      setTermOpen(false);
      terminations.reload();
    } catch (e) { toast('error', e instanceof Error ? e.message : apiErrorMessage(e)); } finally { setSaving(false); }
  };

  const decide = async (id: string, decision: 'APPROVE' | 'REJECT') => {
    try {
      await api.post(`/lifecycle/terminations/${id}/decide`, { decision });
      toast('success', 'تصمیم ثبت شد.');
      terminations.reload();
    } catch (e) { toast('error', apiErrorMessage(e)); }
  };

  const onbCols: Column<Onboarding>[] = [
    { key: 'employee', header: 'نیرو', render: (r) => (r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : '—') },
    { key: 'template', header: 'قالب', render: (r) => r.template?.name ?? '—' },
    { key: 'items', header: 'اقلام', render: (r) => (r._count?.items != null ? String(r._count.items) : '—') },
    { key: 'startedAt', header: 'شروع', render: (r) => formatJalali(r.startedAt) },
    { key: 'status', header: 'وضعیت', render: (r) => <Badge kind={r.status === 'COMPLETED' ? 'green' : 'amber'}>{checklistStatus(r.status)}</Badge> },
  ];

  const offbCols: Column<Offboarding>[] = [
    { key: 'employee', header: 'نیرو', render: (r) => (r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : '—') },
    { key: 'reason', header: 'دلیل خروج' },
    { key: 'terminationDate', header: 'تاریخ خاتمه', render: (r) => formatJalali(r.terminationDate) },
    { key: 'status', header: 'وضعیت', render: (r) => <Badge kind={r.status === 'COMPLETED' ? 'green' : 'amber'}>{checklistStatus(r.status)}</Badge> },
  ];

  const termCols: Column<Termination>[] = [
    { key: 'employee', header: 'نیرو', render: (r) => (r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : '—') },
    { key: 'reason', header: 'دلیل' },
    { key: 'terminationDate', header: 'تاریخ خاتمه', render: (r) => formatJalali(r.terminationDate) },
    { key: 'status', header: 'وضعیت', render: (r) => <Badge kind={badgeKind(r.status)}>{statusLabel(r.status)}</Badge> },
    { key: 'approvedBy', header: 'تأییدکننده', render: (r) => r.approvedBy?.fullName ?? '—' },
  ];

  return (
    <>
      <PageHeader
        title="ورود و خروج نیرو"
        subtitle="چک‌لیست ورود، تسویهٔ خروج و درخواست خاتمهٔ همکاری"
        actions={canManage && tab === 'terminations' && <Button onClick={() => setTermOpen(true)}>درخواست خاتمه</Button>}
      />

      <div className="tabs mb">
        <button className={`tab${tab === 'onboarding' ? ' active' : ''}`} onClick={() => setTab('onboarding')}>ورود نیرو</button>
        <button className={`tab${tab === 'offboarding' ? ' active' : ''}`} onClick={() => setTab('offboarding')}>تسویهٔ خروج</button>
        <button className={`tab${tab === 'terminations' ? ' active' : ''}`} onClick={() => setTab('terminations')}>درخواست‌های خاتمه</button>
      </div>

      <Card>
        {tab === 'onboarding' && (
          <>
            <DataTable columns={onbCols} rows={onboarding.rows} loading={onboarding.loading} />
            <div style={{ padding: '0 14px 14px' }}>
              <Pagination page={onboarding.page} totalPages={onboarding.totalPages} total={onboarding.total} onChange={onboarding.setPage} />
            </div>
          </>
        )}
        {tab === 'offboarding' && (
          <>
            <DataTable columns={offbCols} rows={offboarding.rows} loading={offboarding.loading} />
            <div style={{ padding: '0 14px 14px' }}>
              <Pagination page={offboarding.page} totalPages={offboarding.totalPages} total={offboarding.total} onChange={offboarding.setPage} />
            </div>
          </>
        )}
        {tab === 'terminations' && (
          <>
            <div style={{ padding: '14px 14px 0' }}><ListToolbar onSearch={(s) => terminations.setSearch(s)} /></div>
            <DataTable
              columns={termCols}
              rows={terminations.rows}
              loading={terminations.loading}
              rowActions={(r) =>
                canManage && r.status === 'REQUESTED' ? (
                  <>
                    <Button size="sm" variant="success" onClick={() => decide(r.id, 'APPROVE')}>تأیید</Button>
                    <Button size="sm" variant="danger" onClick={() => decide(r.id, 'REJECT')}>رد</Button>
                  </>
                ) : null
              }
            />
            <div style={{ padding: '0 14px 14px' }}>
              <Pagination page={terminations.page} totalPages={terminations.totalPages} total={terminations.total} onChange={terminations.setPage} />
            </div>
          </>
        )}
      </Card>

      <Modal
        open={termOpen} title="درخواست خاتمهٔ همکاری" onClose={() => setTermOpen(false)}
        footer={<><Button onClick={submitTermination} loading={saving}>ثبت</Button><Button variant="secondary" onClick={() => setTermOpen(false)}>انصراف</Button></>}
      >
        <div className="col" style={{ gap: 14 }}>
          <Field label="شناسهٔ نیرو (UUID)" required><input className="input ltr" value={form.employeeId} onChange={(e) => setForm((f) => ({ ...f, employeeId: e.target.value }))} /></Field>
          <Field label="دلیل" required>
            <Select value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}>
              <option value="RESIGNATION">استعفا</option>
              <option value="RETIREMENT">بازنشستگی</option>
              <option value="CONTRACT_END">پایان قرارداد</option>
              <option value="DISMISSAL">اخراج</option>
              <option value="OTHER">سایر</option>
            </Select>
          </Field>
          <Field label="تاریخ خاتمه" required hint="شمسی یا میلادی — ۱۴۰۴/۰۱/۰۱"><input className="input ltr" value={form.terminationDate} onChange={(e) => setForm((f) => ({ ...f, terminationDate: e.target.value }))} placeholder="1404/01/01" /></Field>
          <Field label="توضیحات"><Textarea value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} /></Field>
        </div>
      </Modal>
    </>
  );
}

function checklistStatus(s: string) {
  const m: Record<string, string> = {
    IN_PROGRESS: 'در جریان',
    COMPLETED: 'تکمیل‌شده',
    CANCELLED: 'لغوشده',
    PENDING: 'در انتظار',
  };
  return m[s] ?? s;
}
