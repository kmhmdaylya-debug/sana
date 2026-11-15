import { useState } from 'react';
import { api, apiErrorMessage } from '../lib/api';
import { useList } from '../lib/useList';
import { useAuth } from '../lib/auth';
import { EntityPicker, Input, Tabs,
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

      <Tabs className="tabs mb">
        <button className={`tab${tab === 'defs' ? ' active' : ''}`} onClick={() => setTab('defs')}>تعریف شیفت</button>
        <button className={`tab${tab === 'swaps' ? ' active' : ''}`} onClick={() => setTab('swaps')}>تعویض‌ها</button>
      </Tabs>

      <Card>
        {tab === 'defs' ? (
          <>
            <div className="list-toolbar-wrap">
              <ListToolbar search={defs.search} onSearch={(s) => defs.setSearch(s)} />
            </div>
            <DataTable error={defs.error} onRetry={defs.reload} columns={defCols} rows={defs.rows} loading={defs.loading} />
            <div className="list-pagination-wrap">
              <Pagination pageSize={defs.pageSize} onPageSizeChange={defs.setPageSize} page={defs.page} totalPages={defs.totalPages} total={defs.total} onChange={defs.setPage} />
            </div>
          </>
        ) : (
          <>
            <DataTable error={swaps.error} onRetry={swaps.reload}
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
            <div className="list-pagination-wrap">
              <Pagination pageSize={swaps.pageSize} onPageSizeChange={swaps.setPageSize} page={swaps.page} totalPages={swaps.totalPages} total={swaps.total} onChange={swaps.setPage} />
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
            <Input className="input ltr" value={form.sourceAssignmentId} onChange={(e) => setForm((f) => ({ ...f, sourceAssignmentId: e.target.value }))} />
          </Field>
          <Field label="کارمند جایگزین" required><EntityPicker value={form.toEmployeeId} onValueChange={(value) => setForm((f) => ({ ...f, toEmployeeId: value }))} endpoint="/employees" title="انتخاب کارمند جایگزین" /></Field>
          <Field label="دلیل"><Textarea value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} /></Field>
        </div>
      </Modal>
    </>
  );
}
