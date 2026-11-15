import { useState } from 'react';
import { api, apiErrorMessage } from '../lib/api';
import { useList } from '../lib/useList';
import { useAuth } from '../lib/auth';
import { EntityPicker,
  Badge,
  Button,
  Card,
  ConfirmDialog,
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
import { formatJalali, formatRial, toPersianDigits, LOAN_STATUS_LABELS } from '../lib/format';

interface Loan {
  id: string;
  loanType: string;
  amount: bigint | number;
  installmentCount: number;
  status: string;
  employee?: { code: string; firstName: string; lastName: string } | null;
  installments?: { id: string; dueDate: string; amount: bigint | number; paidAmount: bigint | number; status: string }[];
}

export default function Loans() {
  const toast = useToast();
  const { hasPermission } = useAuth();
  const list = useList<Loan>('/loans');
  const [createOpen, setCreateOpen] = useState(false);
  const [detail, setDetail] = useState<Loan | null>(null);
  const [form, setForm] = useState({ employeeId: '', loanType: 'LOAN', amount: 0, installmentCount: 6, purpose: '' });
  const [saving, setSaving] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const canCreate = hasPermission('loans.create');
  const canApprove = hasPermission('loans.approve');

  const submit = async () => {
    setSaving(true);
    try {
      await api.post('/loans', form);
      toast('success', 'درخواست وام ثبت شد.');
      setCreateOpen(false);
      list.reload();
    } catch (e) {
      toast('error', apiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const decide = async () => {
    if (!confirmId) return;
    setSaving(true);
    try {
      await api.post(`/loans/${confirmId}/decide`, { decision: 'APPROVE' });
      toast('success', 'وام تأیید شد.');
      setConfirmId(null);
      list.reload();
    } catch (e) {
      toast('error', apiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const reject = async (id: string) => {
    try {
      await api.post(`/loans/${id}/decide`, { decision: 'REJECT' });
      toast('success', 'وام رد شد.');
      list.reload();
    } catch (e) {
      toast('error', apiErrorMessage(e));
    }
  };

  const cols: Column<Loan>[] = [
    { key: 'employee', header: 'نیرو', render: (r) => (r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : '—') },
    { key: 'loanType', header: 'نوع', render: (r) => (r.loanType === 'LOAN' ? 'وام' : 'مساعده') },
    { key: 'amount', header: 'مبلغ', render: (r) => formatRial(Number(r.amount)) },
    { key: 'installments', header: 'اقساط', render: (r) => toPersianDigits(r.installmentCount) },
    {
      key: 'status',
      header: 'وضعیت',
      render: (r) => <Badge kind={r.status === 'SETTLED' ? 'green' : r.status === 'REJECTED' ? 'red' : r.status === 'PENDING_APPROVAL' ? 'amber' : 'blue'}>{loanStatusLabel(r.status)}</Badge>,
    },
  ];

  return (
    <>
      <PageHeader
        title="وام و مساعده"
        subtitle="درخواست، تأیید و اقساط وام"
        actions={canCreate && <Button onClick={() => setCreateOpen(true)}>درخواست وام</Button>}
      />
      <Card>
        <div className="list-toolbar-wrap">
          <ListToolbar search={list.search} onSearch={(s) => list.setSearch(s)}>
            <Select onChange={(e) => list.setFilter('status', e.target.value)} style={{ width: 180 }}>
              <option value="">همهٔ وضعیت‌ها</option>
              {Object.entries(LOAN_STATUS_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </Select>
          </ListToolbar>
        </div>
        <DataTable error={list.error} onRetry={list.reload}
          columns={cols}
          rows={list.rows}
          loading={list.loading}
          rowActions={(r) => (
            <>
              <Button size="sm" variant="outline" onClick={() => setDetail(r)}>اقساط</Button>
              {canApprove && r.status === 'PENDING_APPROVAL' && (
                <>
                  <Button size="sm" variant="success" onClick={() => setConfirmId(r.id)}>تأیید</Button>
                  <Button size="sm" variant="danger" onClick={() => reject(r.id)}>رد</Button>
                </>
              )}
            </>
          )}
        />
        <div className="list-pagination-wrap">
          <Pagination pageSize={list.pageSize} onPageSizeChange={list.setPageSize} page={list.page} totalPages={list.totalPages} total={list.total} onChange={list.setPage} />
        </div>
      </Card>

      {/* اقساط */}
      <Modal open={!!detail} title={`اقساط ${detail?.employee ? detail.employee.firstName + ' ' + detail.employee.lastName : ''}`} onClose={() => setDetail(null)} width={640}>
        <DataTable
          rows={detail?.installments ?? []}
          columns={[
            { key: 'dueDate', header: 'سررسید', render: (r: any) => formatJalali(r.dueDate) },
            { key: 'amount', header: 'مبلغ قسط', render: (r: any) => formatRial(Number(r.amount)) },
            { key: 'paid', header: 'پرداخت‌شده', render: (r: any) => formatRial(Number(r.paidAmount)) },
            { key: 'status', header: 'وضعیت', render: (r: any) => <Badge kind={r.status === 'PAID' ? 'green' : r.status === 'PARTIAL' ? 'amber' : 'gray'}>{r.status === 'PAID' ? 'پرداخت‌شده' : r.status === 'PARTIAL' ? 'جزئی' : 'در انتظار'}</Badge> },
          ]}
        />
      </Modal>

      <ConfirmDialog
        open={!!confirmId}
        title="تأیید وام"
        message="آیا از تأیید این درخواست وام مطمئنید؟"
        confirmLabel="تأیید وام"
        onConfirm={decide}
        onClose={() => setConfirmId(null)}
        loading={saving}
      />

      <Modal
        open={createOpen} title="درخواست وام جدید" onClose={() => setCreateOpen(false)}
        footer={<><Button onClick={submit} loading={saving}>ثبت</Button><Button variant="secondary" onClick={() => setCreateOpen(false)}>انصراف</Button></>}
      >
        <div className="col" style={{ gap: 14 }}>
          <Field label="کارمند" required><EntityPicker value={form.employeeId} onValueChange={(value) => setForm((f) => ({ ...f, employeeId: value }))} endpoint="/employees" title="انتخاب کارمند" /></Field>
          <div className="form-grid">
            <Field label="نوع">
              <Select value={form.loanType} onChange={(e) => setForm((f) => ({ ...f, loanType: e.target.value }))}>
                <option value="LOAN">وام</option>
                <option value="ADVANCE">مساعده</option>
              </Select>
            </Field>
            <Field label="تعداد اقساط" required><Input type="number" value={form.installmentCount} onChange={(e) => setForm((f) => ({ ...f, installmentCount: Number(e.target.value) }))} /></Field>
          </div>
          <Field label="مبلغ (ریال)" required><Input type="number" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: Number(e.target.value) }))} /></Field>
          <Field label="علت"><Textarea value={form.purpose} onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))} /></Field>
        </div>
      </Modal>
    </>
  );
}

function loanStatusLabel(s: string) {
  const m: Record<string, string> = {
    PENDING_APPROVAL: 'در انتظار تأیید',
    APPROVED: 'تأییدشده',
    SETTLING: 'در حال تسویه',
    SETTLED: 'تسویه‌شده',
    REJECTED: 'ردشده',
    CANCELLED: 'لغوشده',
  };
  return m[s] ?? s;
}
