import { useState } from 'react';
import { api, apiErrorMessage, downloadReport } from '../lib/api';
import { useList } from '../lib/useList';
import { useAuth } from '../lib/auth';
import { attendanceCorrectionPayload } from '../lib/workflowPayloads';
import { EntityPicker, DatePicker, Input, Tabs,
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
import { formatJalali, statusLabel, badgeKind, toPersianDigits, parseDateInput, ATTENDANCE_STATUS_LABELS } from '../lib/format';

interface Record {
  id: string;
  workDate: string;
  firstIn?: string | null;
  lastOut?: string | null;
  workMinutes: number;
  overtimeMinutes: number;
  lateMinutes: number;
  status: string;
  employee?: { code: string; firstName: string; lastName: string } | null;
}

interface Correction {
  id: string;
  workDate: string;
  status: string;
  reason?: string;
  employee?: { code: string; firstName: string; lastName: string } | null;
}

const hhmm = (iso?: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const pad = (n: number) => String(n).padStart(2, '0');
  return toPersianDigits(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
};

export default function Attendance() {
  const toast = useToast();
  const { hasPermission } = useAuth();
  const [tab, setTab] = useState<'records' | 'corrections'>('records');
  const records = useList<Record>('/attendance/records');
  const corrections = useList<Correction>('/attendance/corrections');
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ employeeId: '', workDate: '', field: 'firstIn' as 'firstIn' | 'lastOut', newValue: '', reason: '' });
  const [saving, setSaving] = useState(false);

  const canApprove = hasPermission('attendance.approve');
  const canCreate = hasPermission('attendance.create');

  const submitCorrection = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await api.post('/attendance/corrections', attendanceCorrectionPayload(form));
      toast('success', 'درخواست اصلاح ثبت شد.');
      setCreateOpen(false);
      corrections.reload();
    } catch (e) {
      toast('error', apiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const decide = async (id: string, decision: 'APPROVE' | 'REJECT') => {
    try {
      await api.post(`/attendance/corrections/${id}/decide`, { decision });
      toast('success', decision === 'APPROVE' ? 'اصلاح تأیید شد.' : 'اصلاح رد شد.');
      corrections.reload();
    } catch (e) {
      toast('error', apiErrorMessage(e));
    }
  };

  const recordCols: Column<Record>[] = [
    { key: 'employee', header: 'نیرو', render: (r) => (r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : '—') },
    { key: 'workDate', header: 'تاریخ', render: (r) => formatJalali(r.workDate) },
    { key: 'firstIn', header: 'ورود', render: (r) => hhmm(r.firstIn) },
    { key: 'lastOut', header: 'خروج', render: (r) => hhmm(r.lastOut) },
    { key: 'workMinutes', header: 'کارکرد', render: (r) => `${toPersianDigits(Math.floor(r.workMinutes / 60))}:${toPersianDigits(r.workMinutes % 60)}` },
    { key: 'overtime', header: 'اضافه‌کاری', render: (r) => (r.overtimeMinutes ? toPersianDigits(r.overtimeMinutes) + ' د' : '—') },
    { key: 'late', header: 'تأخیر', render: (r) => (r.lateMinutes ? toPersianDigits(r.lateMinutes) + ' د' : '—') },
    { key: 'status', header: 'وضعیت', render: (r) => <Badge kind={badgeKind(r.status)}>{statusLabel(r.status)}</Badge> },
  ];

  const correctionCols: Column<Correction>[] = [
    { key: 'employee', header: 'نیرو', render: (r) => (r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : '—') },
    { key: 'workDate', header: 'تاریخ', render: (r) => formatJalali(r.workDate) },
    { key: 'reason', header: 'دلیل' },
    { key: 'status', header: 'وضعیت', render: (r) => <Badge kind={badgeKind(r.status)}>{statusLabel(r.status)}</Badge> },
  ];

  return (
    <>
      <PageHeader
        title="حضور و غیاب"
        subtitle="کارت‌های حضور، کارکرد روزانه و اصلاحات"
        actions={
          <>
            {hasPermission('attendance.export') && (
              <Button variant="outline" onClick={() => downloadReport('/attendance/records?format=csv', 'attendance.csv').catch((e) => toast('error', apiErrorMessage(e)))}>
                خروجی CSV
              </Button>
            )}
            {canCreate && (
              <Button onClick={() => setCreateOpen(true)}>درخواست اصلاح</Button>
            )}
          </>
        }
      />

      <Tabs className="tabs mb">
        <button className={`tab${tab === 'records' ? ' active' : ''}`} onClick={() => setTab('records')}>کارت‌های حضور</button>
        <button className={`tab${tab === 'corrections' ? ' active' : ''}`} onClick={() => setTab('corrections')}>اصلاحات</button>
      </Tabs>

      <Card>
        {tab === 'records' ? (
          <>
            <div className="list-toolbar-wrap">
              <ListToolbar search={records.search} onSearch={(s) => records.setSearch(s)}>
                <Select onChange={(e) => records.setFilter('status', e.target.value)} style={{ width: 170 }}>
                  <option value="">همهٔ وضعیت‌ها</option>
                  {Object.entries(ATTENDANCE_STATUS_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </Select>
              </ListToolbar>
            </div>
            <DataTable error={records.error} onRetry={records.reload} columns={recordCols} rows={records.rows} loading={records.loading} />
            <div className="list-pagination-wrap">
              <Pagination pageSize={records.pageSize} onPageSizeChange={records.setPageSize} page={records.page} totalPages={records.totalPages} total={records.total} onChange={records.setPage} />
            </div>
          </>
        ) : (
          <>
            <DataTable error={corrections.error} onRetry={corrections.reload}
              columns={correctionCols}
              rows={corrections.rows}
              loading={corrections.loading}
              rowActions={(r) =>
                canApprove && r.status === 'PENDING' ? (
                  <>
                    <Button size="sm" variant="success" onClick={() => decide(r.id, 'APPROVE')}>تأیید</Button>
                    <Button size="sm" variant="danger" onClick={() => decide(r.id, 'REJECT')}>رد</Button>
                  </>
                ) : null
              }
            />
            <div className="list-pagination-wrap">
              <Pagination pageSize={corrections.pageSize} onPageSizeChange={corrections.setPageSize} page={corrections.page} totalPages={corrections.totalPages} total={corrections.total} onChange={corrections.setPage} />
            </div>
          </>
        )}
      </Card>

      <Modal
        open={createOpen}
        title="درخواست اصلاح کارت حضور"
        onClose={() => setCreateOpen(false)}
        footer={
          <>
            <Button onClick={submitCorrection} loading={saving}>ثبت درخواست</Button>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>انصراف</Button>
          </>
        }
      >
        <div className="col" style={{ gap: 14 }}>
          <Field label="کارمند" required><EntityPicker value={form.employeeId} onValueChange={(value) => setForm((f) => ({ ...f, employeeId: value }))} endpoint="/employees" title="انتخاب کارمند" /></Field>
          <Field label="تاریخ کارکرد" required hint="شمسی یا میلادی — ۱۴۰۴/۰۱/۰۱"><DatePicker className="input ltr" value={form.workDate} onValueChange={(value) => setForm((f) => ({ ...f, workDate: value }))} placeholder="1404/01/01" /></Field>
          <Field label="مورد اصلاح" required><Select value={form.field} onChange={event => setForm(value => ({ ...value, field: event.target.value as 'firstIn' | 'lastOut' }))}><option value="firstIn">ساعت ورود</option><option value="lastOut">ساعت خروج</option></Select></Field>
          <Field label="ساعت صحیح تهران" required><Input type="time" className="ltr" value={form.newValue} onChange={event => setForm(value => ({ ...value, newValue: event.target.value }))} /></Field>
          <Field label="دلیل اصلاح" required><Textarea value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} /></Field>
        </div>
      </Modal>
    </>
  );
}
