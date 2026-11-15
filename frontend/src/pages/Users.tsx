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
  Select,
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
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'ARCHIVED';
  isSuperAdmin?: boolean;
  lastLoginAt?: string | null;
  employee?: { id: string; code: string; firstName: string; lastName: string } | null;
  roles?: { id: string; name: string; code: string }[];
  scopeAssignments?: { id: string; scopeType: string; companyId?: string | null; orgUnitId?: string | null; employeeId?: string | null }[];
}

interface RoleOption {
  id: string;
  code: string;
  name: string;
  description?: string;
  userCount?: number;
}

interface EmployeeOption {
  id: string;
  code: string;
  firstName: string;
  lastName: string;
  position?: { title: string } | null;
}

const USER_STATUS_LABELS = { ACTIVE: 'فعال', INACTIVE: 'غیرفعال', SUSPENDED: 'تعلیق‌شده', ARCHIVED: 'بایگانی‌شده' };

export default function Users() {
  const toast = useToast();
  const list = useList<UserRow>('/users');
  const roles = useList<RoleOption>('/roles');
  const employees = useList<EmployeeOption>('/employees', { limit: 200 });
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [form, setForm] = useState({ fullName: '', email: '', mobile: '', status: 'ACTIVE' as UserRow['status'], employeeId: '', roleIds: [] as string[] });
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ username: '', fullName: '', email: '', mobile: '', password: '', employeeId: '', roleIds: [] as string[], mustChangePassword: true });
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [resetId, setResetId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const openEdit = (u: UserRow) => {
    setEditing(u);
    setForm({
      fullName: u.fullName ?? '',
      email: u.email ?? '',
      mobile: u.mobile ?? '',
      status: u.status,
      employeeId: u.employee?.id ?? '',
      roleIds: (u.roles ?? []).map((r) => r.id),
    });
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await api.patch(`/users/${editing.id}`, {
        fullName: form.fullName,
        email: form.email || undefined,
        mobile: form.mobile || undefined,
        status: form.status,
        employeeId: form.employeeId || undefined,
        roleIds: form.roleIds,
      });
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
      await api.post('/users', {
        username: createForm.username,
        fullName: createForm.fullName,
        email: createForm.email || undefined,
        mobile: createForm.mobile || undefined,
        password: createForm.password,
        employeeId: createForm.employeeId || undefined,
        roleIds: createForm.roleIds,
        mustChangePassword: createForm.mustChangePassword,
      });
      toast('success', 'کاربر ایجاد شد.');
      setCreateOpen(false);
      setCreateForm({ username: '', fullName: '', email: '', mobile: '', password: '', employeeId: '', roleIds: [], mustChangePassword: true });
      list.reload();
    } catch (e) {
      toast('error', apiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const resetPassword = async () => {
    if (!resetId) return;
    if (newPassword !== confirmPassword) {
      toast('error', 'تکرار گذرواژه با گذرواژهٔ جدید یکسان نیست.');
      return;
    }
    setSaving(true);
    try {
      await api.post(`/users/${resetId}/reset-password`, { password: newPassword });
      toast('success', 'گذرواژه بازنشانی شد.');
      setResetId(null);
      setNewPassword('');
      setConfirmPassword('');
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
    { key: 'roles', header: 'نقش‌ها', render: (r) => ((r.roles ?? []).length ? (r.roles ?? []).map((x) => <Badge key={x.id} kind="blue">{x.name}</Badge>) : <span className="text-muted">—</span>) },
    { key: 'lastLoginAt', header: 'آخرین ورود', render: (r) => (r.lastLoginAt ? formatJalali(r.lastLoginAt) : '—') },
    {
      key: 'status',
      header: 'وضعیت',
      render: (r) => <Badge kind={r.status === 'ACTIVE' ? 'green' : 'gray'}>{USER_STATUS_LABELS[r.status] ?? r.status}</Badge>,
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
        <div className="list-toolbar-wrap">
          <ListToolbar search={list.search} onSearch={(s) => list.setSearch(s)} />
        </div>
        <DataTable error={list.error} onRetry={list.reload}
          columns={cols}
          rows={list.rows}
          loading={list.loading}
          rowActions={(r) => (
            <>
              <Button size="sm" variant="outline" onClick={() => openEdit(r)}>ویرایش</Button>
              <Button size="sm" variant="outline" onClick={() => { setResetId(r.id); setNewPassword(''); setConfirmPassword(''); }} title="بازنشانی گذرواژه" aria-label={`بازنشانی گذرواژهٔ ${r.fullName}`}>
                <KeyRound size={13} />
              </Button>
              <Button size="sm" variant="outline" onClick={() => revokeSessions(r.id)} title="ابطال نشست‌ها">
                <LogOut size={13} />
              </Button>
              {r.status === 'ACTIVE' && !r.isSuperAdmin && (
                <Button size="sm" variant="danger" onClick={() => setDeleteId(r.id)}>حذف</Button>
              )}
            </>
          )}
        />
        <div className="list-pagination-wrap">
          <Pagination pageSize={list.pageSize} onPageSizeChange={list.setPageSize} page={list.page} totalPages={list.totalPages} total={list.total} onChange={list.setPage} />
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
          <Field label="نیروی متصل" hint="برای دسترسی به پروندهٔ پرسنلی، مرخصی، حقوق و پنل کارمند">
            <Select value={form.employeeId} onChange={(e) => setForm((f) => ({ ...f, employeeId: e.target.value }))}>
              <option value="">— بدون پروندهٔ پرسنلی —</option>
              {employees.rows.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.firstName} {e.lastName} ({e.code}){e.position?.title ? ` — ${e.position.title}` : ''}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="نقش‌ها" hint="می‌توانید چند نقش انتخاب کنید — مجوزها از نقش‌ها گرفته می‌شود">
            <Select
              multiple
              size={Math.min(8, Math.max(3, form.roleIds.length))}
              value={form.roleIds}
              onChange={(e) => {
                const values = Array.from(e.target.selectedOptions).map((o) => o.value);
                setForm((f) => ({ ...f, roleIds: values }));
              }}
            >
              {roles.rows.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.code}){r.userCount ? ` — ${toPersianDigits(r.userCount)} کاربر` : ''}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="وضعیت حساب">
            <Select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as UserRow['status'] }))}>
              {Object.entries(USER_STATUS_LABELS).map(([value,label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
          </Field>
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
          <Field label="نیروی متصل" hint="برای دسترسی به پروندهٔ پرسنلی، مرخصی، حقوق و پنل کارمند">
            <Select value={createForm.employeeId} onChange={(e) => setCreateForm((f) => ({ ...f, employeeId: e.target.value }))}>
              <option value="">— بدون پروندهٔ پرسنلی —</option>
              {employees.rows.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.firstName} {e.lastName} ({e.code}){e.position?.title ? ` — ${e.position.title}` : ''}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="نقش‌ها" hint="حداقل یک نقش انتخاب کنید — مجوزها از نقش‌ها گرفته می‌شود">
            <Select
              multiple
              size={Math.min(8, Math.max(3, createForm.roleIds.length))}
              value={createForm.roleIds}
              onChange={(e) => {
                const values = Array.from(e.target.selectedOptions).map((o) => o.value);
                setCreateForm((f) => ({ ...f, roleIds: values }));
              }}
            >
              {roles.rows.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.code}){r.userCount ? ` — ${toPersianDigits(r.userCount)} کاربر` : ''}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="گذرواژهٔ اولیه" required hint="حداقل ۱۰ کاراکتر شامل حرف بزرگ، حرف کوچک، عدد و نماد">
            <Input type="password" className="ltr" value={createForm.password} onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))} />
          </Field>
          <label className="checkbox-row">
            <input type="checkbox" checked={createForm.mustChangePassword} onChange={(e) => setCreateForm((f) => ({ ...f, mustChangePassword: e.target.checked }))} />
            <span>در اولین ورود، گذرواژه را تغییر دهد</span>
          </label>
        </div>
      </Modal>

      {/* بازنشانی گذرواژه */}
      <Modal
        open={!!resetId}
        title="بازنشانی گذرواژه"
        onClose={() => setResetId(null)}
        footer={
          <>
            <Button onClick={resetPassword} loading={saving} disabled={!newPassword || !confirmPassword}>بازنشانی</Button>
            <Button variant="secondary" onClick={() => setResetId(null)}>انصراف</Button>
          </>
        }
      >
        <div className="col" style={{ gap: 14 }}>
          <Field label="گذرواژهٔ جدید" required hint="حداقل ۱۰ کاراکتر شامل حرف بزرگ، حرف کوچک، عدد و نماد">
            <Input type="password" className="ltr" autoComplete="new-password" maxLength={128} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </Field>
          <Field label="تکرار گذرواژهٔ جدید" required>
            <Input type="password" className="ltr" autoComplete="new-password" maxLength={128} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </Field>
        </div>
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
