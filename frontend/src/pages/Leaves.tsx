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
import { formatJalali, statusLabel, badgeKind, toPersianDigits } from '../lib/format';

interface LeaveReq {
  id: string;
  startAt: string;
  endAt: string;
  durationMinutes?: number;
  status: string;
  reason?: string;
  employee?: { code: string; firstName: string; lastName: string } | null;
  leaveType?: { name: string; code: string } | null;
}

export default function Leaves() {
  const toast = useToast();
  const { hasPermission } = useAuth();
  const [tab, setTab] = useState<'requests' | 'balance'>('requests');
  const requests = useList<LeaveReq>('/leaves/requests');
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ leaveTypeId: '', startAt: '', endAt: '', reason: '' });
  const [saving, setSaving] = useState(false);

  const canCreate = hasPermission('leaves.create');
  const canApprove = hasPermission('leaves.approve');

  const submit = async () => {
    setSaving(true);
    try {
      await api.post('/leaves/requests', form);
      toast('success', 'درخواست مرخصی ثبت شد.');
      setCreateOpen(false);
      requests.reload();
    } catch (e) {
      toast('error', apiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const decide = async (id: string, decision: 'APPROVE' | 'REJECT') => {
    try {
      await api.post(`/leaves/requests/${id}/decide`, { decision });
      toast('success', decision === 'APPROVE' ? 'مرخصی تأیید شد.' : 'مرخصی رد شد.');
      requests.reload();
    } catch (e) {
      toast('error', apiErrorMessage(e));
    }
  };

  const cols: Column<LeaveReq>[] = [
    { key: 'employee', header: 'نیرو', render: (r) => (r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : '—') },
    { key: 'type', header: 'نوع', render: (r) => r.leaveType?.name ?? statusLabel(r.leaveType?.code) },
    { key: 'startAt', header: 'از', render: (r) => formatJalali(r.startAt) },
    { key: 'endAt', header: 'تا', render: (r) => formatJalali(r.endAt) },
    { key: 'duration', header: 'مدت', render: (r) => (r.durationMinutes ? toPersianDigits(Math.round(r.durationMinutes / 60)) + ' ساعت' : '—') },
    { key: 'reason', header: 'دلیل' },
    { key: 'status', header: 'وضعیت', render: (r) => <Badge kind={badgeKind(r.status)}>{statusLabel(r.status)}</Badge> },
  ];

  return (
    <>
      <PageHeader
        title="مرخصی‌ها"
        subtitle="درخواست، تأیید و ماندهٔ مرخصی"
        actions={canCreate && <Button onClick={() => setCreateOpen(true)}>درخواست مرخصی</Button>}
      />

      <div className="tabs mb">
        <button className={`tab${tab === 'requests' ? ' active' : ''}`} onClick={() => setTab('requests')}>درخواست‌ها</button>
        <button className={`tab${tab === 'balance' ? ' active' : ''}`} onClick={() => setTab('balance')}>ماندهٔ مرخصی</button>
      </div>

      <Card>
        {tab === 'requests' ? (
          <>
            <div style={{ padding: '14px 14px 0' }}>
              <ListToolbar onSearch={(s) => requests.setSearch(s)}>
                <Select onChange={(e) => requests.setFilter('status', e.target.value)} style={{ width: 180 }}>
                  <option value="">همهٔ وضعیت‌ها</option>
                  <option value="SUBMITTED">ثبت‌شده</option>
                  <option value="PENDING_SUPERVISOR">در انتظار سرپرست</option>
                  <option value="PENDING_MANAGER">در انتظار مدیر</option>
                  <option value="APPROVED">تأییدشده</option>
                  <option value="REJECTED">ردشده</option>
                  <option value="CANCELLED">لغوشده</option>
                </Select>
              </ListToolbar>
            </div>
            <DataTable
              columns={cols}
              rows={requests.rows}
              loading={requests.loading}
              rowActions={(r) =>
                canApprove && (r.status === 'SUBMITTED' || r.status.startsWith('PENDING')) ? (
                  <>
                    <Button size="sm" variant="success" onClick={() => decide(r.id, 'APPROVE')}>تأیید</Button>
                    <Button size="sm" variant="danger" onClick={() => decide(r.id, 'REJECT')}>رد</Button>
                  </>
                ) : null
              }
            />
            <div style={{ padding: '0 14px 14px' }}>
              <Pagination page={requests.page} totalPages={requests.totalPages} total={requests.total} onChange={requests.setPage} />
            </div>
          </>
        ) : (
          <BalanceTab />
        )}
      </Card>

      <Modal
        open={createOpen}
        title="درخواست مرخصی جدید"
        onClose={() => setCreateOpen(false)}
        footer={
          <>
            <Button onClick={submit} loading={saving}>ثبت</Button>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>انصراف</Button>
          </>
        }
      >
        <div className="col" style={{ gap: 14 }}>
          <Field label="شناسهٔ نوع مرخصی (UUID)" hint="از تنظیمات انواع مرخصی">
            <input className="input ltr" value={form.leaveTypeId} onChange={(e) => setForm((f) => ({ ...f, leaveTypeId: e.target.value }))} />
          </Field>
          <div className="form-grid">
            <Field label="از (میلادی ISO)" required><input className="input ltr" value={form.startAt} onChange={(e) => setForm((f) => ({ ...f, startAt: e.target.value }))} placeholder="2026-05-01T08:00" /></Field>
            <Field label="تا (میلادی ISO)" required><input className="input ltr" value={form.endAt} onChange={(e) => setForm((f) => ({ ...f, endAt: e.target.value }))} placeholder="2026-05-02T17:00" /></Field>
          </div>
          <Field label="دلیل" required><Textarea value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} /></Field>
        </div>
      </Modal>
    </>
  );
}

function BalanceTab() {
  const [employeeId, setEmployeeId] = useState('');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [balances, setBalances] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/leaves/balance', { params: { employeeId, year } });
      setBalances(Array.isArray(r?.data?.data) ? r.data.data : r?.data?.data ? [r.data.data] : []);
    } catch (e) {
      toast('error', apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="flex mb" style={{ padding: '14px 14px 0' }}>
        <input className="input ltr" placeholder="شناسهٔ نیرو (UUID)" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} style={{ maxWidth: 320 }} />
        <input className="input ltr" placeholder="سال" value={year} onChange={(e) => setYear(e.target.value)} style={{ maxWidth: 110 }} />
        <Button onClick={load} loading={loading}>نمایش مانده</Button>
      </div>
      <DataTable
        loading={loading}
        rows={balances}
        columns={[
          { key: 'leaveType', header: 'نوع مرخصی', render: (r: any) => r.leaveType?.name ?? r.leaveTypeName ?? '—' },
          { key: 'entitled', header: 'سهم سالانه', render: (r: any) => toPersianDigits(r.entitled ?? r.annualEntitlement ?? '—') },
          { key: 'used', header: 'استفاده‌شده', render: (r: any) => toPersianDigits(r.used ?? '—') },
          { key: 'remaining', header: 'مانده', render: (r: any) => toPersianDigits(r.remaining ?? r.balance ?? '—') },
        ]}
        emptyMessage="ابتدا شناسهٔ نیرو را وارد و «نمایش مانده» را بزنید."
      />
    </>
  );
}
