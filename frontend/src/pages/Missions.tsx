import { useState } from 'react';
import { api, apiErrorMessage } from '../lib/api';
import { useList } from '../lib/useList';
import { useAuth } from '../lib/auth';
import { missionPayload, missionCompletionPayload } from '../lib/workflowPayloads';
import { EntityPicker, DatePicker,
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
  startAt?: string;
  endAt?: string;
  status: string;
  estimatedCost?: bigint | number;
  employee?: { id: string; code: string; firstName: string; lastName: string } | null;
}

export default function Missions() {
  const toast = useToast();
  const { user, hasPermission } = useAuth();
  const list = useList<Mission>('/missions');
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ employeeId: '', title: '', destination: '', startDate: '', startTime: '08:00', endDate: '', endTime: '16:00', purpose: '', estimatedCost: 0 });
  const [saving, setSaving] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [completionId, setCompletionId] = useState<string | null>(null);
  const [completion, setCompletion] = useState({ report: '', actualCost: 0 });

  const canCreate = hasPermission('missions.create');
  const canApprove = hasPermission('missions.approve');

  const submit = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await api.post('/missions', missionPayload(form));
      toast('success', 'مأموریت ثبت شد.');
      setCreateOpen(false);
      list.reload();
    } catch (e) {
      toast('error', apiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const act = async (id: string, action: 'approve' | 'reject' | 'start') => {
    if (actingId) return;
    setActingId(id);
    try {
      await api.post(`/missions/${id}/${action}`);
      toast('success', 'عملیات انجام شد.');
      list.reload();
    } catch (e) {
      toast('error', apiErrorMessage(e));
    } finally {
      setActingId(null);
    }
  };

  const complete = async () => {
    if (actingId || !completionId) return;
    setActingId(completionId);
    try {
      await api.post(`/missions/${completionId}/complete`, missionCompletionPayload(completion.report, completion.actualCost));
      toast('success', 'گزارش پایان مأموریت ثبت شد.');
      setCompletionId(null);
      list.reload();
    } catch (error) {
      toast('error', apiErrorMessage(error));
    } finally {
      setActingId(null);
    }
  };

  const cols: Column<Mission>[] = [
    { key: 'employee', header: 'نیرو', render: (r) => (r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : '—') },
    { key: 'title', header: 'عنوان', render: (r) => <span className="fw-600">{r.title}</span> },
    { key: 'destination', header: 'مقصد' },
    { key: 'startAt', header: 'از', render: (r) => (r.startAt ? formatJalali(r.startAt) : '—') },
    { key: 'endAt', header: 'تا', render: (r) => (r.endAt ? formatJalali(r.endAt) : '—') },
    { key: 'cost', header: 'برآورد هزینه', render: (r) => (r.estimatedCost ? formatRial(Number(r.estimatedCost)) : '—') },
    { key: 'status', header: 'وضعیت', render: (r) => <Badge kind={badgeKind(r.status)}>{statusLabel(r.status)}</Badge> },
  ];

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
                <Button size="sm" variant="success" disabled={!!actingId} onClick={() => act(r.id, 'approve')}>تأیید</Button>
                <Button size="sm" variant="danger" disabled={!!actingId} onClick={() => act(r.id, 'reject')}>رد</Button>
              </>
            ) : (canCreate || r.employee?.id === user?.employee?.id) && r.status === 'APPROVED' ? (
              <Button size="sm" variant="outline" disabled={!!actingId} onClick={() => act(r.id, 'start')}>شروع</Button>
            ) : (canCreate || r.employee?.id === user?.employee?.id) && r.status === 'IN_PROGRESS' ? (
              <Button size="sm" variant="outline" disabled={!!actingId} onClick={() => { setCompletion({ report: '', actualCost: Number(r.estimatedCost ?? 0) }); setCompletionId(r.id); }}>پایان</Button>
            ) : null
          }
        />
        <div className="list-pagination-wrap">
          <Pagination pageSize={list.pageSize} onPageSizeChange={list.setPageSize} page={list.page} totalPages={list.totalPages} total={list.total} onChange={list.setPage} />
        </div>
      </Card>

      <Modal open={!!completionId} title="پایان مأموریت" onClose={() => { if (!actingId) setCompletionId(null); }} footer={<Button onClick={complete} loading={!!actingId}>ثبت گزارش</Button>}>
        <div className="col" style={{ gap: 14 }}>
          <Field label="گزارش پایان" required><Textarea value={completion.report} onChange={e => setCompletion(f => ({ ...f, report: e.target.value }))} /></Field>
          <Field label="هزینه واقعی (ریال)" required><Input type="number" min="0" value={completion.actualCost} onChange={e => setCompletion(f => ({ ...f, actualCost: Number(e.target.value) }))} /></Field>
        </div>
      </Modal>

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
            <Field label="تاریخ شروع" required><DatePicker output="iso" value={form.startDate} onValueChange={value => setForm(f => ({ ...f, startDate: value }))} /></Field>
            <Field label="ساعت شروع تهران" required><Input type="time" className="ltr" value={form.startTime} onChange={event => setForm(f => ({ ...f, startTime: event.target.value }))} /></Field>
            <Field label="تاریخ پایان" required><DatePicker output="iso" value={form.endDate} onValueChange={value => setForm(f => ({ ...f, endDate: value }))} /></Field>
            <Field label="ساعت پایان تهران" required><Input type="time" className="ltr" value={form.endTime} onChange={event => setForm(f => ({ ...f, endTime: event.target.value }))} /></Field>
          </div>
          <Field label="برآورد هزینه (ریال)"><Input type="number" value={form.estimatedCost} onChange={(e) => setForm((f) => ({ ...f, estimatedCost: Number(e.target.value) }))} /></Field>
          <Field label="هدف مأموریت"><Textarea value={form.purpose} onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))} /></Field>
        </div>
      </Modal>
    </>
  );
}
