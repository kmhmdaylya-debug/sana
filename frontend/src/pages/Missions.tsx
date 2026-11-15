import { useState } from 'react';
import { api, apiErrorMessage } from '../lib/api';
import { useList } from '../lib/useList';
import { useAuth } from '../lib/auth';
import { EntityPicker,
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
import { formatJalali, statusLabel, badgeKind, formatRial, toPersianDigits, MISSION_STATUS_LABELS } from '../lib/format';

interface Mission {
  id: string;
  title: string;
  destination?: string;
  fromAt?: string;
  toAt?: string;
  status: string;
  estimatedCost?: bigint | number;
  employee?: { code: string; firstName: string; lastName: string } | null;
}

export default function Missions() {
  const toast = useToast();
  const { hasPermission } = useAuth();
  const list = useList<Mission>('/missions');
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ employeeId: '', title: '', destination: '', fromAt: '', toAt: '', purpose: '', estimatedCost: 0 });
  const [saving, setSaving] = useState(false);

  const canCreate = hasPermission('missions.create');
  const canApprove = hasPermission('missions.approve');

  const submit = async () => {
    setSaving(true);
    try {
      await api.post('/missions', form);
      toast('success', 'مأموریت ثبت شد.');
      setCreateOpen(false);
      list.reload();
    } catch (e) {
      toast('error', apiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const act = async (id: string, action: 'approve' | 'reject' | 'start' | 'complete') => {
    try {
      await api.post(`/missions/${id}/${action}`);
      toast('success', 'عملیات انجام شد.');
      list.reload();
    } catch (e) {
      toast('error', apiErrorMessage(e));
    }
  };

  const cols: Column<Mission>[] = [
    { key: 'employee', header: 'نیرو', render: (r) => (r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : '—') },
    { key: 'title', header: 'عنوان', render: (r) => <span className="fw-600">{r.title}</span> },
    { key: 'destination', header: 'مقصد' },
    { key: 'fromAt', header: 'از', render: (r) => (r.fromAt ? formatJalali(r.fromAt) : '—') },
    { key: 'toAt', header: 'تا', render: (r) => (r.toAt ? formatJalali(r.toAt) : '—') },
    { key: 'cost', header: 'برآورد هزینه', render: (r) => (r.estimatedCost ? formatRial(Number(r.estimatedCost)) : '—') },
    { key: 'status', header: 'وضعیت', render: (r) => <Badge kind={badgeKind(r.status)}>{statusLabel(r.status)}</Badge> },
  ];

  const pending = (s: string) => ['REQUESTED', 'PENDING', 'PENDING_APPROVAL', 'APPROVED', 'STARTED'].includes(s);

  return (
    <>
      <PageHeader
        title="مأموریت‌ها"
        subtitle="مأموریت‌های اداری و هزینه‌های آن‌ها"
        actions={canCreate && <Button onClick={() => setCreateOpen(true)}>ثبت مأموریت</Button>}
      />
      <Card>
        <div className="list-toolbar-wrap">
          <ListToolbar search={list.search} onSearch={(s) => list.setSearch(s)}>
            <Select onChange={(e) => list.setFilter('status', e.target.value)} style={{ width: 180 }}>
              <option value="">همهٔ وضعیت‌ها</option>
              {Object.entries(MISSION_STATUS_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </Select>
          </ListToolbar>
        </div>
        <DataTable error={list.error} onRetry={list.reload}
          columns={cols}
          rows={list.rows}
          loading={list.loading}
          rowActions={(r) =>
            canApprove && r.status === 'REQUESTED' ? (
              <>
                <Button size="sm" variant="success" onClick={() => act(r.id, 'approve')}>تأیید</Button>
                <Button size="sm" variant="danger" onClick={() => act(r.id, 'reject')}>رد</Button>
              </>
            ) : canApprove && r.status === 'APPROVED' ? (
              <Button size="sm" variant="outline" onClick={() => act(r.id, 'start')}>شروع</Button>
            ) : canApprove && r.status === 'STARTED' ? (
              <Button size="sm" variant="outline" onClick={() => act(r.id, 'complete')}>پایان</Button>
            ) : null
          }
        />
        <div className="list-pagination-wrap">
          <Pagination pageSize={list.pageSize} onPageSizeChange={list.setPageSize} page={list.page} totalPages={list.totalPages} total={list.total} onChange={list.setPage} />
        </div>
      </Card>

      <Modal
        open={createOpen}
        title="ثبت مأموریت جدید"
        onClose={() => setCreateOpen(false)}
        footer={
          <>
            <Button onClick={submit} loading={saving}>ثبت</Button>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>انصراف</Button>
          </>
        }
      >
        <div className="col" style={{ gap: 14 }}>
          <Field label="کارمند" required><EntityPicker value={form.employeeId} onValueChange={(value) => setForm((f) => ({ ...f, employeeId: value }))} endpoint="/employees" title="انتخاب کارمند" /></Field>
          <Field label="عنوان مأموریت" required><Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} /></Field>
          <Field label="مقصد"><Input value={form.destination} onChange={(e) => setForm((f) => ({ ...f, destination: e.target.value }))} /></Field>
          <div className="form-grid">
            <Field label="از (میلادی ISO)" required><Input className="input ltr" value={form.fromAt} onChange={(e) => setForm((f) => ({ ...f, fromAt: e.target.value }))} /></Field>
            <Field label="تا (میلادی ISO)" required><Input className="input ltr" value={form.toAt} onChange={(e) => setForm((f) => ({ ...f, toAt: e.target.value }))} /></Field>
          </div>
          <Field label="برآورد هزینه (ریال)"><Input type="number" value={form.estimatedCost} onChange={(e) => setForm((f) => ({ ...f, estimatedCost: Number(e.target.value) }))} /></Field>
          <Field label="هدف مأموریت"><Textarea value={form.purpose} onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))} /></Field>
        </div>
      </Modal>
    </>
  );
}
