import { useState } from 'react';
import { Plus } from 'lucide-react';
import { api, apiErrorMessage } from '../lib/api';
import { getDefaultCompanyId } from '../lib/org';
import { useList } from '../lib/useList';
import { useAuth } from '../lib/auth';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  Field,
  Input,
  Modal,
  PageHeader,
  Pagination,
  Select,
  Textarea,
  useToast,
  type Column,
} from '../components/ui';
import { formatJalali, toPersianDigits } from '../lib/format';

interface Announcement {
  id: string;
  title: string;
  body: string;
  targetType: string;
  requiresAck: boolean;
  publishedBy?: { fullName: string } | null;
  publishedAt: string;
  expiresAt?: string | null;
  ackCount?: number;
  acknowledgedByMe?: string | null;
}

export default function Announcements() {
  const toast = useToast();
  const { hasPermission } = useAuth();
  const list = useList<Announcement>('/announcements');
  const [createOpen, setCreateOpen] = useState(false);
  const [viewing, setViewing] = useState<Announcement | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ companyId: '', title: '', body: '', targetType: 'ALL', targetId: '', requiresAck: false, expiresAt: '' });

  const canManage = hasPermission('announcements.manage');

  const submit = async () => {
    setSaving(true);
    try {
      const companyId = form.companyId || (await getDefaultCompanyId());
      if (!companyId) throw new Error('شرکتی در ساختار سازمانی ثبت نشده است.');
      await api.post('/announcements', {
        ...form,
        companyId,
        targetId: form.targetId || undefined,
        expiresAt: form.expiresAt || undefined,
        requiresAck: form.requiresAck,
      });
      toast('success', 'اعلامیه منتشر شد.');
      setCreateOpen(false);
      list.reload();
    } catch (e) {
      toast('error', apiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const acknowledge = async (id: string) => {
    try {
      await api.post(`/announcements/${id}/acknowledge`);
      toast('success', 'مطالعه تأیید شد.');
      setViewing(null);
      list.reload();
    } catch (e) {
      toast('error', apiErrorMessage(e));
    }
  };

  const remove = async () => {
    if (!confirmId) return;
    try {
      await api.delete(`/announcements/${confirmId}`);
      toast('success', 'اعلامیه حذف شد.');
      setConfirmId(null);
      list.reload();
    } catch (e) {
      toast('error', apiErrorMessage(e));
    }
  };

  const cols: Column<Announcement>[] = [
    { key: 'title', header: 'عنوان', render: (r) => <a onClick={(e) => { e.preventDefault(); setViewing(r); }} href="#" className="fw-600">{r.title}</a> },
    { key: 'publishedBy', header: 'انتشاردهنده', render: (r) => r.publishedBy?.fullName ?? '—' },
    { key: 'publishedAt', header: 'تاریخ انتشار', render: (r) => formatJalali(r.publishedAt) },
    { key: 'target', header: 'مخاطب', render: (r) => targetLabel(r.targetType) },
    { key: 'ack', header: 'تأیید مطالعه', render: (r) => (r.acknowledgedByMe ? <Badge kind="green">تأیید شد</Badge> : r.requiresAck ? <Badge kind="amber">نیازمند تأیید</Badge> : '—') },
  ];

  return (
    <>
      <PageHeader
        title="اعلامیه‌ها"
        subtitle="اطلاعیه‌های سازمانی"
        actions={canManage && <Button onClick={() => setCreateOpen(true)}><Plus size={15} /> اعلامیهٔ جدید</Button>}
      />
      <Card>
        <DataTable
          columns={cols}
          rows={list.rows}
          loading={list.loading}
          rowActions={(r) =>
            canManage ? (
              <Button size="sm" variant="danger" onClick={() => setConfirmId(r.id)}>حذف</Button>
            ) : null
          }
        />
        <div style={{ padding: '0 14px 14px' }}>
          <Pagination page={list.page} totalPages={list.totalPages} total={list.total} onChange={list.setPage} />
        </div>
      </Card>

      <Modal
        open={!!viewing}
        title={viewing?.title ?? ''}
        onClose={() => setViewing(null)}
        footer={
          viewing?.requiresAck && !viewing?.acknowledgedByMe ? (
            <Button onClick={() => acknowledge(viewing.id)}>تأیید مطالعه</Button>
          ) : (
            <Button variant="secondary" onClick={() => setViewing(null)}>بستن</Button>
          )
        }
      >
        <div className="text-muted text-xs mb">انتشار: {viewing?.publishedBy?.fullName ?? '—'} — {viewing ? formatJalali(viewing.publishedAt) : ''}</div>
        <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{viewing?.body}</p>
      </Modal>

      <ConfirmDialog
        open={!!confirmId}
        title="حذف اعلامیه"
        message="آیا از حذف این اعلامیه مطمئنید؟"
        danger
        onConfirm={remove}
        onClose={() => setConfirmId(null)}
      />

      <Modal
        open={createOpen} title="اعلامیهٔ جدید" onClose={() => setCreateOpen(false)}
        footer={<><Button onClick={submit} loading={saving}>انتشار</Button><Button variant="secondary" onClick={() => setCreateOpen(false)}>انصراف</Button></>}
      >
        <div className="col" style={{ gap: 14 }}>
          <Field label="عنوان" required><Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} /></Field>
          <Field label="متن اعلامیه" required><Textarea value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} style={{ minHeight: 120 }} /></Field>
          <div className="form-grid">
            <Field label="مخاطب">
              <Select value={form.targetType} onChange={(e) => setForm((f) => ({ ...f, targetType: e.target.value }))}>
                <option value="ALL">همه</option>
                <option value="POSITION">سمت خاص</option>
              </Select>
            </Field>
            <Field label="شناسهٔ مخاطب (در صورت انتخاب خاص)"><input className="input ltr" value={form.targetId} onChange={(e) => setForm((f) => ({ ...f, targetId: e.target.value }))} /></Field>
          </div>
          <label className="checkbox-row">
            <input type="checkbox" checked={form.requiresAck} onChange={(e) => setForm((f) => ({ ...f, requiresAck: e.target.checked }))} />
            <span>نیازمند تأیید مطالعه است</span>
          </label>
        </div>
      </Modal>
    </>
  );
}

function targetLabel(t: string) {
  const m: Record<string, string> = { ALL: 'همه', ORG_UNIT: 'واحد سازمانی', BRANCH: 'شعبه', POSITION: 'سمت' };
  return m[t] ?? t;
}
