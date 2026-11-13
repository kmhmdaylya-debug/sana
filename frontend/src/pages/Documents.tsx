import { useRef, useState } from 'react';
import { Download, Plus } from 'lucide-react';
import { api, apiErrorMessage, downloadFile } from '../lib/api';
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
import { formatJalali, statusLabel, badgeKind } from '../lib/format';

interface Doc {
  id: string;
  title: string;
  documentType: string;
  status: string;
  employee?: { code: string; firstName: string; lastName: string } | null;
  versions?: { id: string; version: number; fileName: string; expiryDate?: string | null }[];
}

export default function Documents() {
  const toast = useToast();
  const { hasPermission } = useAuth();
  const list = useList<Doc>('/documents');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ employeeId: '', documentType: 'OTHER', title: '', note: '', expiryDate: '' });
  const fileRef = useRef<HTMLInputElement>(null);
  void form;

  const canManage = hasPermission('documents.create');

  const submitUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast('warning', 'انتخاب فایل الزامی است.');
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('employeeId', form.employeeId);
      fd.append('documentType', form.documentType);
      fd.append('title', form.title);
      if (form.note) fd.append('note', form.note);
      if (form.expiryDate) fd.append('expiryDate', form.expiryDate);
      await api.post('/documents', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast('success', 'سند آپلود شد.');
      setUploadOpen(false);
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
    { key: 'documentType', header: 'نوع سند', render: (r) => statusLabel(r.documentType) },
    { key: 'status', header: 'وضعیت', render: (r) => <Badge kind={badgeKind(r.status)}>{statusLabel(r.status)}</Badge> },
    {
      key: 'expiry',
      header: 'تاریخ انقضا',
      render: (r) => (r.versions?.[0]?.expiryDate ? formatJalali(r.versions[0].expiryDate) : '—'),
    },
  ];

  return (
    <>
      <PageHeader
        title="مدارک پرسنلی"
        subtitle="اسکن مدارک، نسخه‌ها و انقضای اسناد"
        actions={
          canManage && (
            <Button onClick={() => setUploadOpen(true)}>
              <Plus size={15} /> آپلود سند
            </Button>
          )
        }
      />
      <Card>
        <div style={{ padding: '14px 14px 0' }}>
          <ListToolbar onSearch={(s) => list.setSearch(s)}>
            <Select onChange={(e) => list.setFilter('documentType', e.target.value)} style={{ width: 180 }}>
              <option value="">همهٔ انواع</option>
              <option value="HIRING">استخدام</option>
              <option value="EDUCATION">تحصیلی</option>
              <option value="ID">احراز هویت</option>
              <option value="MILITARY">نظام وظیفه</option>
              <option value="INSURANCE">بیمه</option>
              <option value="CONTRACT">قرارداد</option>
              <option value="OTHER">سایر</option>
            </Select>
          </ListToolbar>
        </div>
        <DataTable columns={columns} rows={list.rows} loading={list.loading} rowActions={(r) => (
          r.versions?.[0]?.id ? (
            <Button size="sm" variant="outline" onClick={() => downloadFile(`/documents/versions/${r.versions[0].id}/download`, r.versions[0].fileName)}>
              <Download size={13} /> دانلود
            </Button>
          ) : null
        )} />
        <div style={{ padding: '0 14px 14px' }}>
          <Pagination page={list.page} totalPages={list.totalPages} total={list.total} onChange={list.setPage} />
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
          <Field label="شناسهٔ نیرو (UUID)" required><Input value={form.employeeId} onChange={(e) => setForm((f) => ({ ...f, employeeId: e.target.value }))} /></Field>
          <Field label="عنوان سند" required><Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} /></Field>
          <Field label="نوع سند">
            <Select value={form.documentType} onChange={(e) => setForm((f) => ({ ...f, documentType: e.target.value }))}>
              <option value="HIRING">استخدام</option>
              <option value="EDUCATION">تحصیلی</option>
              <option value="ID">احراز هویت</option>
              <option value="MILITARY">نظام وظیفه</option>
              <option value="INSURANCE">بیمه</option>
              <option value="CONTRACT">قرارداد</option>
              <option value="OTHER">سایر</option>
            </Select>
          </Field>
          <Field label="تاریخ انقضا (میلادی)"><Input value={form.expiryDate} onChange={(e) => setForm((f) => ({ ...f, expiryDate: e.target.value }))} placeholder="2027-01-01" /></Field>
          <Field label="فایل" required hint="پسوند مجاز: pdf, jpg, png, doc, docx, xls, xlsx — حداکثر ۱۰ مگابایت">
            <input ref={fileRef} type="file" className="input" />
          </Field>
          <Field label="یادداشت"><Textarea value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} /></Field>
        </div>
      </Modal>
    </>
  );
}
