import { useState } from 'react';
import { KeyRound, LogOut, Plus } from 'lucide-react';
import { api, apiErrorMessage } from '../lib/api';
import { useList } from '../lib/useList';
import {
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
  useToast,
  type Column,
} from '../components/ui';
import { formatJalali, toPersianDigits } from '../lib/format';

interface UserRow {
  id: string;
  username: string;
  fullName: string;
  email?: string;
  mobile?: string;
  isActive: boolean;
  isSuperAdmin?: boolean;
  lastLoginAt?: string | null;
  employee?: { code: string; firstName: string; lastName: string } | null;
  roles?: { id: string; name: string }[];
}

export default function Users() {
  const toast = useToast();
  const list = useList<UserRow>('/users');
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [form, setForm] = useState({ fullName: '', email: '', mobile: '', isActive: true });
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ username: '', fullName: '', email: '', mobile: '', password: '' });
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [resetId, setResetId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');

  const openEdit = (u: UserRow) => {
    setEditing(u);
    setForm({ fullName: u.fullName ?? '', email: u.email ?? '', mobile: u.mobile ?? '', isActive: u.isActive });
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await api.patch(`/users/${editing.id}`, form);
      toast('success', 'کاربر ویرایش شد.');
      setEditing(null);
      list.reload();
    } catch (e) {
      toast('error', apiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const createUser = async () => {
    setSaving(true);
    try {
      await api.post('/users', createForm);
      toast('success', 'کاربر ایجاد شد.');
      setCreateOpen(false);
      setCreateForm({ username: '', fullName: '', email: '', mobile: '', password: '' });
      list.reload();
    } catch (e) {
      toast('error', apiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const resetPassword = async () => {
    if (!resetId) return;
    setSaving(true);
    try {
      await api.post(`/users/${resetId}/reset-password`, { newPassword });
      toast('success', 'گذرواژه بازنشانی شد.');
      setResetId(null);
      setNewPassword('');
    } catch (e) {
      toast('error', apiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const revokeSessions = async (id: string) => {
    try {
      await api.post(`/users/${id}/revoke-sessions`);
      toast('success', 'نشست‌های کاربر باطل شد.');
    } catch (e) {
      toast('error', apiErrorMessage(e));
    }
  };

  const deleteUser = async () => {
    if (!deleteId) return;
    try {
      await api.delete(`/users/${deleteId}`);
      toast('success', 'کاربر حذف شد (غیرفعال شد).');
      setDeleteId(null);
      list.reload();
    } catch (e) {
      toast('error', apiErrorMessage(e));
    }
  };

  const cols: Column<UserRow>[] = [
    { key: 'username', header: 'نام کاربری', render: (r) => <span className="ltr fw-600">{r.username}</span> },
    { key: 'fullName', header: 'نام', render: (r) => r.fullName ?? '—' },
    { key: 'employee', header: 'نیروی متصل', render: (r) => (r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : '—') },
    { key: 'roles', header: 'نقش‌ها', render: (r) => (r.roles ?? []).map((x) => x.name).join('، ') || '—' },
    { key: 'lastLoginAt', header: 'آخرین ورود', render: (r) => (r.lastLoginAt ? formatJalali(r.lastLoginAt) : '—') },
    {
      key: 'isActive',
      header: 'وضعیت',
      render: (r) => (r.isSuperAdmin ? <Badge kind="violet">مدیر ارشد</Badge> : r.isActive ? <Badge kind="green">فعال</Badge> : <Badge kind="gray">غیرفعال</Badge>),
    },
  ];

  return (
    <>
      <PageHeader
        title="کاربران"
        subtitle={`حساب‌های ورود به سامانه — ${toPersianDigits(list.total)} کاربر`}
        actions={<Button onClick={() => setCreateOpen(true)}><Plus size={15} /> کاربر جدید</Button>}
      />
      <Card>
        <div style={{ padding: '14px 14px 0' }}>
          <ListToolbar onSearch={(s) => list.setSearch(s)} />
        </div>
        <DataTable
          columns={cols}
          rows={list.rows}
          loading={list.loading}
          rowActions={(r) => (
            <>
              <Button size="sm" variant="outline" onClick={() => openEdit(r)}>ویرایش</Button>
              <Button size="sm" variant="outline" onClick={() => { setResetId(r.id); setNewPassword(''); }} title="بازنشانی گذرواژه">
                <KeyRound size={13} />
              </Button>
              <Button size="sm" variant="outline" onClick={() => revokeSessions(r.id)} title="ابطال نشست‌ها">
                <LogOut size={13} />
              </Button>
              {r.isActive && !r.isSuperAdmin && (
                <Button size="sm" variant="danger" onClick={() => setDeleteId(r.id)}>حذف</Button>
              )}
            </>
          )}
        />
        <div style={{ padding: '0 14px 14px' }}>
          <Pagination page={list.page} totalPages={list.totalPages} total={list.total} onChange={list.setPage} />
        </div>
      </Card>

      {/* ویرایش */}
      <Modal
        open={!!editing}
        title={`ویرایش کاربر ${editing?.username ?? ''}`}
        onClose={() => setEditing(null)}
        footer={
          <>
            <Button onClick={saveEdit} loading={saving}>ذخیره</Button>
            <Button variant="secondary" onClick={() => setEditing(null)}>انصراف</Button>
          </>
        }
      >
        <div className="col" style={{ gap: 14 }}>
          <Field label="نام کامل" required><Input value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} /></Field>
          <div className="form-grid">
            <Field label="ایمیل"><Input className="ltr" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></Field>
            <Field label="موبایل"><Input className="ltr" value={form.mobile} onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))} /></Field>
          </div>
          <label className="checkbox-row">
            <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} />
            <span>حساب فعال است</span>
          </label>
        </div>
      </Modal>

      {/* ایجاد */}
      <Modal
        open={createOpen}
        title="ایجاد کاربر جدید"
        onClose={() => setCreateOpen(false)}
        footer={
          <>
            <Button onClick={createUser} loading={saving}>ایجاد</Button>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>انصراف</Button>
          </>
        }
      >
        <div className="col" style={{ gap: 14 }}>
          <Field label="نام کاربری" required><Input className="ltr" value={createForm.username} onChange={(e) => setCreateForm((f) => ({ ...f, username: e.target.value }))} /></Field>
          <Field label="نام کامل" required><Input value={createForm.fullName} onChange={(e) => setCreateForm((f) => ({ ...f, fullName: e.target.value }))} /></Field>
          <div className="form-grid">
            <Field label="ایمیل"><Input className="ltr" value={createForm.email} onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))} /></Field>
            <Field label="موبایل"><Input className="ltr" value={createForm.mobile} onChange={(e) => setCreateForm((f) => ({ ...f, mobile: e.target.value }))} /></Field>
          </div>
          <Field label="گذرواژهٔ اولیه" required hint="حداقل ۸ کاراکتر شامل حرف بزرگ، کوچک و عدد"><Input type="password" className="ltr" value={createForm.password} onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))} /></Field>
        </div>
      </Modal>

      {/* بازنشانی گذرواژه */}
      <Modal
        open={!!resetId}
        title="بازنشانی گذرواژه"
        onClose={() => setResetId(null)}
        footer={
          <>
            <Button onClick={resetPassword} loading={saving}>بازنشانی</Button>
            <Button variant="secondary" onClick={() => setResetId(null)}>انصراف</Button>
          </>
        }
      >
        <Field label="گذرواژهٔ جدید" required hint="حداقل ۸ کاراکتر شامل حرف بزرگ، کوچک و عدد">
          <Input type="password" className="ltr" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
        </Field>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        title="حذف کاربر"
        message="آیا از حذف این کاربر مطمئنید؟ حساب غیرفعال خواهد شد."
        danger
        onConfirm={deleteUser}
        onClose={() => setDeleteId(null)}
      />
    </>
  );
}
