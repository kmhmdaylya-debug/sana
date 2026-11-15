import { useRef, useState } from 'react';
import { Download, Plus } from 'lucide-react';
import { api, apiErrorMessage, downloadFile } from '../lib/api';
import { useList } from '../lib/useList';
import { useAuth } from '../lib/auth';
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
import { formatJalali } from '../lib/format';

interface Doc {
  id: string;
  title: string;
  docType: string;
  confidentiality: string;
  expiryDate?: string | null;
  employee?: { code: string; firstName: string; lastName: string } | null;
  versions?: { id: string; version: number; fileName: string; expiryDate?: string | null }[];
}

const DOC_TYPES = { NATIONAL_ID:'کارت ملی', BIRTH_CERTIFICATE:'شناسنامه', DEGREE:'مدرک تحصیلی', WORK_EXPERIENCE:'سابقه کار', CONTRACT:'قرارداد', NDA:'محرمانگی', CERTIFICATE:'گواهینامه', RESUME:'رزومه', OTHER:'سایر' };
const CONFIDENTIALITY = { NORMAL:'عادی', CONFIDENTIAL:'محرمانه', SECRET:'سری' };

export default function Documents() {
  const toast = useToast();
  const { hasPermission } = useAuth();
  const list = useList<Doc>('/documents');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [form, setForm] = useState({ employeeId: '', documentType: 'OTHER', title: '', note: '', expiryDate: '' });
  const fileRef = useRef<HTMLInputElement>(null);

  const canManage = hasPermission('documents.create');

  const submitUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast('warning', 'انتخاب فایل الزامی است.');
      return;
    }
    setSaving(true);
    try {
      let id = createdId;
      if (!id) {
        const response = await api.post('/documents', {
          employeeId: form.employeeId, docType: form.documentType, title: form.title,
          ...(form.expiryDate ? { expiryDate: form.expiryDate } : {}),
        });
        id = response.data.data.id;
        setCreatedId(id);
      }
      const fd = new FormData();
      fd.append('file', file);
      if (form.note) fd.append('note', form.note);
      await api.post(`/documents/${id}/versions`, fd);
      toast('success', 'سند آپلود شد.');
      setUploadOpen(false);
      setCreatedId(null);
      setForm({ employeeId:'', documentType:'OTHER', title:'', note:'', expiryDate:'' });
      list.reload();
    } catch (e) {
      toast('error', apiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const columns: Column<Doc>[] = [
    { key: 'title', header: 'عنوان سند', render: (r) => <span className="fw-600">{r.title}</span> },
    { key: 'employee', header: 'نیرو', render: (r) => (r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : '—') },
    { key: 'docType', header: 'نوع سند', render: (r) => DOC_TYPES[r.docType as keyof typeof DOC_TYPES] ?? r.docType },
    { key: 'confidentiality', header: 'محرمانگی', render: (r) => <Badge kind={r.confidentiality === 'NORMAL' ? 'gray' : 'amber'}>{CONFIDENTIALITY[r.confidentiality as keyof typeof CONFIDENTIALITY] ?? r.confidentiality}</Badge> },
    {
      key: 'expiry',
      header: 'تاریخ انقضا',
      render: (r) => (r.expiryDate ? formatJalali(r.expiryDate) : '—'),
    },
  ];

  return (
    <>
      <PageHeader
        title="مدارک پرسنلی"
        subtitle="اسکن مدارک، نسخه‌ها و انقضای اسناد"
        actions={
          canManage && (
            <Button onClick={() => { setCreatedId(null); setUploadOpen(true); }}>
              <Plus size={15} /> آپلود سند
            </Button>
          )
        }
      />
      <Card>
        <div className="list-toolbar-wrap">
          <ListToolbar search={list.search} onSearch={(s) => list.setSearch(s)}>
            <Select aria-label="نوع مدرک" onChange={(e) => list.setFilter('docType', e.target.value)} style={{ width: 180 }}>
              <option value="">همهٔ انواع</option>
              {Object.entries(DOC_TYPES).map(([value,label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
          </ListToolbar>
        </div>
        <DataTable error={list.error} onRetry={list.reload} columns={columns} rows={list.rows} loading={list.loading} rowActions={(r) => (
          r.versions?.[0]?.id ? (
            <Button size="sm" variant="outline" onClick={() => downloadFile(`/documents/versions/${r.versions[0].id}/download`, r.versions[0].fileName)}>
              <Download size={13} /> دانلود
            </Button>
          ) : null
        )} />
        <div className="list-pagination-wrap">
          <Pagination pageSize={list.pageSize} onPageSizeChange={list.setPageSize} page={list.page} totalPages={list.totalPages} total={list.total} onChange={list.setPage} />
        </div>
      </Card>

      <Modal
        open={uploadOpen}
        title="آپلود سند جدید"
        onClose={() => setUploadOpen(false)}
        footer={
          <>
            <Button onClick={submitUpload} loading={saving}>آپلود</Button>
            <Button variant="secondary" onClick={() => setUploadOpen(false)}>انصراف</Button>
          </>
        }
      >
        <div className="col" style={{ gap: 14 }}>
          {createdId && <div className="alert alert-warning" role="status">مشخصات سند ذخیره شد؛ برای تکمیل، فایل را دوباره آپلود کنید.</div>}
          <fieldset disabled={!!createdId || saving} className="document-metadata form-grid">
          <Field label="کارمند" required><EntityPicker value={form.employeeId} onValueChange={(value) => setForm((f) => ({ ...f, employeeId: value }))} endpoint="/employees" title="انتخاب کارمند" /></Field>
          <Field label="عنوان سند" required><Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} /></Field>
          <Field label="نوع سند">
            <Select value={form.documentType} onChange={(e) => setForm((f) => ({ ...f, documentType: e.target.value }))}>
              {Object.entries(DOC_TYPES).map(([value,label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
          </Field>
          <Field label="تاریخ انقضا (میلادی)"><DatePicker output="iso" value={form.expiryDate} onValueChange={(value) => setForm((f) => ({ ...f, expiryDate: value }))} placeholder="2027-01-01" /></Field>
          </fieldset>
          <Field label="فایل" required hint="پسوند مجاز: pdf, jpg, png, doc, docx, xls, xlsx — حداکثر ۱۰ مگابایت">
            <Input ref={fileRef} type="file" className="input" />
          </Field>
          <Field label="یادداشت"><Textarea value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} /></Field>
        </div>
      </Modal>
    </>
  );
}
