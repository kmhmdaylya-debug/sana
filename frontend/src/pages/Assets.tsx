import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { api, apiErrorMessage } from '../lib/api';
import { useList } from '../lib/useList';
import { useAuth } from '../lib/auth';
import { assetPayload } from '../lib/workflowPayloads';
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
import { statusLabel, badgeKind, formatRial, toPersianDigits, ASSET_STATUS_LABELS } from '../lib/format';

interface Asset {
  id: string;
  code: string;
  name: string;
  category?: string;
  status: string;
  serialNumber?: string;
  purchasePrice?: bigint | number;
  custodian?: { firstName: string; lastName: string } | null;
}

export default function Assets() {
  const toast = useToast();
  const { hasPermission, user } = useAuth();
  const list = useList<Asset>('/assets');
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ code: '', name: '', category: '', serialNumber: '', purchasePrice: 0, note: '' });
  const [saving, setSaving] = useState(false);
  const [companyId, setCompanyId] = useState(user?.employee?.company?.id ?? '');
  const [companies, setCompanies] = useState<Array<{ id: string; name: string }>>([]);
  const [companyLoading, setCompanyLoading] = useState(false);
  const [companyError, setCompanyError] = useState('');

  useEffect(() => {
    if (!createOpen) return;
    const controller = new AbortController();
    setCompanyLoading(true);
    setCompanyError('');
    api.get('/org/companies/options', { signal: controller.signal }).then(response => {
      if (controller.signal.aborted) return;
      const rows: Array<{ id: string; name: string }> = response.data.data ?? [];
      setCompanies(rows);
      setCompanyId(current => rows.some(row => row.id === current) ? current : rows.length === 1 ? rows[0].id : '');
    }).catch(error => {
      if (!controller.signal.aborted) setCompanyError(apiErrorMessage(error));
    }).finally(() => { if (!controller.signal.aborted) setCompanyLoading(false); });
    return () => controller.abort();
  }, [createOpen]);

  const canManage = hasPermission('assets.manage');

  const submit = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await api.post('/assets', assetPayload(form, companyId));
      toast('success', 'دارایی ثبت شد.');
      setCreateOpen(false);
      list.reload();
    } catch (e) {
      toast('error', apiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const cols: Column<Asset>[] = [
    { key: 'code', header: 'کد دارایی', render: (r) => <span className="ltr">{r.code}</span> },
    { key: 'name', header: 'نام', render: (r) => <span className="fw-600">{r.name}</span> },
    { key: 'category', header: 'دسته' },
    { key: 'serialNumber', header: 'شمارهٔ سری', render: (r) => <span className="ltr">{r.serialNumber ?? '—'}</span> },
    { key: 'custodian', header: 'نگهدارنده', render: (r) => (r.custodian ? `${r.custodian.firstName} ${r.custodian.lastName}` : '—') },
    { key: 'purchasePrice', header: 'ارزش خرید', render: (r) => (r.purchasePrice != null ? formatRial(Number(r.purchasePrice)) : '—') },
    { key: 'status', header: 'وضعیت', render: (r) => <Badge kind={badgeKind(r.status)}>{statusLabel(r.status)}</Badge> },
  ];

  return (
    <>
      <PageHeader
        title="دارایی‌ها"
        subtitle="تجهیزات و ابزار کار تحت تحویل نیروها"
        actions={canManage && <Button onClick={() => setCreateOpen(true)}><Plus size={15} /> دارایی جدید</Button>}
      />
      <Card>
        <div className="list-toolbar-wrap">
          <ListToolbar search={list.search} onSearch={(s) => list.setSearch(s)}>
            <Select onChange={(e) => list.setFilter('status', e.target.value)} style={{ width: 170 }}>
              <option value="">همهٔ وضعیت‌ها</option>
              {Object.entries(ASSET_STATUS_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </Select>
          </ListToolbar>
        </div>
        <DataTable error={list.error} onRetry={list.reload} columns={cols} rows={list.rows} loading={list.loading} />
        <div className="list-pagination-wrap">
          <Pagination pageSize={list.pageSize} onPageSizeChange={list.setPageSize} page={list.page} totalPages={list.totalPages} total={list.total} onChange={list.setPage} />
        </div>
      </Card>

      <Modal
        open={createOpen}
        title="ثبت دارایی جدید"
        onClose={() => setCreateOpen(false)}
        footer={
          <>
            <Button onClick={submit} loading={saving} disabled={companyLoading || !!companyError || !companyId}>ثبت</Button>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>انصراف</Button>
          </>
        }
      >
        <div className="form-grid">
          <Field label="شرکت" required>
            <Select value={companyId} disabled={companyLoading} onChange={event => setCompanyId(event.target.value)}>
              <option value="">{companyLoading ? 'در حال دریافت شرکت‌ها' : 'انتخاب شرکت'}</option>
              {companies.map(company => <option key={company.id} value={company.id}>{company.name}</option>)}
            </Select>
            {companyError && <span className="text-danger" role="alert">{companyError}</span>}
          </Field>
          <Field label="کد دارایی" required><Input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} /></Field>
          <Field label="نام دارایی" required><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></Field>
          <Field label="دسته" required><Input value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} placeholder="لپ‌تاپ / موبایل / ابزار" /></Field>
          <Field label="شمارهٔ سری"><Input value={form.serialNumber} onChange={(e) => setForm((f) => ({ ...f, serialNumber: e.target.value }))} /></Field>
          <Field label="ارزش خرید (ریال)"><Input type="number" min={0} step={1} value={form.purchasePrice} onChange={(e) => setForm((f) => ({ ...f, purchasePrice: Number(e.target.value) }))} /></Field>
        </div>
        <div className="mt"><Field label="توضیحات"><Textarea value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} /></Field></div>
      </Modal>
    </>
  );
}
