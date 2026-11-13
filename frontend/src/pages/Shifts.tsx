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
  ListToolbar,
  Modal,
  PageHeader,
  Pagination,
  Select,
  Textarea,
  useToast,
  type Column,
} from '../components/ui';
import { formatJalali, statusLabel, badgeKind } from '../lib/format';

interface Shift {
  id: string;
  name: string;
  kind: string;
  startTime: string;
  endTime: string;
  graceMinutes?: number;
  isActive?: boolean;
}

interface Swap {
  id: string;
  status: string;
  workDate?: string;
  reason?: string;
  fromEmployeeId: string;
  toEmployeeId?: string | null;
  sourceAssignment?: { shift?: { name: string }; workDate: string } | null;
}

export default function Shifts() {
  const toast = useToast();
  const { hasPermission, user } = useAuth();
  const [tab, setTab] = useState<'defs' | 'swaps'>('defs');
  const defs = useList<Shift>('/shifts');
  const swaps = useList<Swap>('/shifts/swaps');
  const [swapOpen, setSwapOpen] = useState(false);
  const [form, setForm] = useState({ sourceAssignmentId: '', toEmployeeId: '', reason: '' });
  const [saving, setSaving] = useState(false);

  const canManage = hasPermission('shifts.manage');
  const canSwap = hasPermission('shifts.swap');
  const canApprove = hasPermission('shifts.approve');

  const submitSwap = async () => {
    setSaving(true);
    try {
      await api.post('/shifts/swaps', form);
      toast('success', 'درخواست تعویض ثبت شد.');
      setSwapOpen(false);
      swaps.reload();
    } catch (e) {
      toast('error', apiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const decide = async (id: string, decision: 'APPROVE' | 'REJECT') => {
    try {
      await api.post(`/shifts/swaps/${id}/decide`, { decision });
      toast('success', 'تصمیم ثبت شد.');
      swaps.reload();
    } catch (e) {
      toast('error', apiErrorMessage(e));
    }
  };

  const defCols: Column<Shift>[] = [
    { key: 'name', header: 'نام شیفت', render: (r) => <span className="fw-600">{r.name}</span> },
    { key: 'kind', header: 'نوع', render: (r) => statusLabel(r.kind) },
    { key: 'startTime', header: 'شروع', render: (r) => <span className="ltr">{r.startTime}</span> },
    { key: 'endTime', header: 'پایان', render: (r) => <span className="ltr">{r.endTime}</span> },
    { key: 'grace', header: 'گراس (دقیقه)', render: (r) => (r.graceMinutes != null ? String(r.graceMinutes) : '—') },
    { key: 'isActive', header: 'وضعیت', render: (r) => <Badge kind={r.isActive ? 'green' : 'gray'}>{r.isActive ? 'فعال' : 'غیرفعال'}</Badge> },
  ];

  const swapCols: Column<Swap>[] = [
    { key: 'date', header: 'تاریخ', render: (r) => (r.sourceAssignment?.workDate ? formatJalali(r.sourceAssignment.workDate) : r.workDate ? formatJalali(r.workDate) : '—') },
    { key: 'shift', header: 'شیفت', render: (r) => r.sourceAssignment?.shift?.name ?? '—' },
    { key: 'reason', header: 'دلیل' },
    { key: 'status', header: 'وضعیت', render: (r) => <Badge kind={badgeKind(r.status)}>{statusLabel(r.status)}</Badge> },
  ];

  return (
    <>
      <PageHeader
        title="شیفت‌ها"
        subtitle="تعریف شیفت، برنامه‌ریزی و تعویض شیفت"
        actions={canSwap && <Button onClick={() => setSwapOpen(true)}>درخواست تعویض شیفت</Button>}
      />

      <div className="tabs mb">
        <button className={`tab${tab === 'defs' ? ' active' : ''}`} onClick={() => setTab('defs')}>تعریف شیفت</button>
        <button className={`tab${tab === 'swaps' ? ' active' : ''}`} onClick={() => setTab('swaps')}>تعویض‌ها</button>
      </div>

      <Card>
        {tab === 'defs' ? (
          <>
            <div style={{ padding: '14px 14px 0' }}>
              <ListToolbar onSearch={(s) => defs.setSearch(s)} />
            </div>
            <DataTable columns={defCols} rows={defs.rows} loading={defs.loading} />
            <div style={{ padding: '0 14px 14px' }}>
              <Pagination page={defs.page} totalPages={defs.totalPages} total={defs.total} onChange={defs.setPage} />
            </div>
          </>
        ) : (
          <>
            <DataTable
              columns={swapCols}
              rows={swaps.rows}
              loading={swaps.loading}
              rowActions={(r) =>
                canApprove && r.status === 'PENDING' && r.fromEmployeeId !== user?.employee?.id ? (
                  <>
                    <Button size="sm" variant="success" onClick={() => decide(r.id, 'APPROVE')}>تأیید</Button>
                    <Button size="sm" variant="danger" onClick={() => decide(r.id, 'REJECT')}>رد</Button>
                  </>
                ) : null
              }
            />
            <div style={{ padding: '0 14px 14px' }}>
              <Pagination page={swaps.page} totalPages={swaps.totalPages} total={swaps.total} onChange={swaps.setPage} />
            </div>
          </>
        )}
      </Card>

      <Modal
        open={swapOpen}
        title="درخواست تعویض شیفت"
        onClose={() => setSwapOpen(false)}
        footer={
          <>
            <Button onClick={submitSwap} loading={saving}>ثبت</Button>
            <Button variant="secondary" onClick={() => setSwapOpen(false)}>انصراف</Button>
          </>
        }
      >
        <div className="col" style={{ gap: 14 }}>
          <Field label="شناسهٔ ساعت کاری منبع (UUID)" required hint="شناسهٔ shiftAssignment خودتان">
            <input className="input ltr" value={form.sourceAssignmentId} onChange={(e) => setForm((f) => ({ ...f, sourceAssignmentId: e.target.value }))} />
          </Field>
          <Field label="شناسهٔ نیروی جایگزین (UUID)" required><input className="input ltr" value={form.toEmployeeId} onChange={(e) => setForm((f) => ({ ...f, toEmployeeId: e.target.value }))} /></Field>
          <Field label="دلیل"><Textarea value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} /></Field>
        </div>
      </Modal>
    </>
  );
}
