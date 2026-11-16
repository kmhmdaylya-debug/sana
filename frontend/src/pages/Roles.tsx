import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { api, apiErrorMessage } from '../lib/api';
import { useList } from '../lib/useList';
import { useAuth } from '../lib/auth';
import {
  Badge,
  Button,
  Card,
  DataTable,
  Field,
  Input,
  Modal,
  PageHeader,
  Textarea,
  useToast,
  type Column,
} from '../components/ui';
import { toPersianDigits } from '../lib/format';

interface RoleRow {
  id: string;
  code: string;
  name: string;
  description?: string;
  isActive: boolean;
  userCount: number;
  permissions: string[];
  isSystem?: boolean;
}

interface PermGroup {
  group: string;
  label: string;
  permissions: { code: string; label: string; description?: string }[];
}

export default function Roles() {
  const { user } = useAuth();
  const toast = useToast();
  const list = useList<RoleRow>('/roles');
  const [groups, setGroups] = useState<PermGroup[]>([]);
  const [editing, setEditing] = useState<RoleRow | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ code: '', name: '', description: '' });
  const [createChecked, setCreateChecked] = useState<Set<string>>(new Set());

  useEffect(() => {
    api
      .get('/roles/permissions')
      .then((r) => setGroups(r?.data?.data?.groups ?? []))
      .catch(() => {});
  }, []);

  const openEdit = (role: RoleRow) => {
    setEditing(role);
    setName(role.name);
    setDescription(role.description ?? '');
    setChecked(new Set(role.permissions));
  };

  const toggle = (code: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const toggleCreate = (code: string) => {
    setCreateChecked((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const save = async () => {
    if (!editing || saving || !user?.isSuperAdmin) return;
    setSaving(true);
    try {
      await api.patch(`/roles/${editing.id}`, { name, description: description || undefined, permissions: Array.from(checked) });
      toast('success', 'نقش به‌روزرسانی شد.');
      setEditing(null);
      list.reload();
    } catch (e) {
      toast('error', apiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const create = async () => {
    if (saving || !user?.isSuperAdmin) return;
    if (createChecked.size === 0) {
      toast('warning', 'حداقل یک مجوز انتخاب کنید.');
      return;
    }
    setSaving(true);
    try {
      await api.post('/roles', { ...createForm, permissions: Array.from(createChecked) });
      toast('success', 'نقش ایجاد شد.');
      setCreateOpen(false);
      setCreateForm({ code: '', name: '', description: '' });
      setCreateChecked(new Set());
      list.reload();
    } catch (e) {
      toast('error', apiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const cols: Column<RoleRow>[] = [
    { key: 'name', header: 'نقش', render: (r) => <span className="fw-600">{r.name}</span> },
    { key: 'code', header: 'کد', render: (r) => <span className="ltr">{r.code}</span> },
    { key: 'users', header: 'کاربران', render: (r) => toPersianDigits(r.userCount ?? 0) },
    { key: 'perms', header: 'تعداد مجوز', render: (r) => toPersianDigits(r.permissions?.length ?? 0) },
    {
      key: 'status',
      header: 'نوع',
      render: (r) => (r.isSystem ? <Badge kind="violet">سیستمی</Badge> : <Badge kind="blue">سفارشی</Badge>),
    },
  ];

  const permMatrix = (checkSet: Set<string>, onToggle: (c: string) => void) => (
    <div className="col" style={{ gap: 14, maxHeight: '55vh', overflowY: 'auto' }}>
      {groups.map((g) => (
        <div key={g.group}>
          <div className="fw-700 text-sm mb-sm">{g.label}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
            {g.permissions.map((p) => (
              <label key={p.code} className="checkbox-row" title={p.description}>
                <input type="checkbox" checked={checkSet.has(p.code)} onChange={() => onToggle(p.code)} />
                <span className="text-sm">{p.label}</span>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <>
      <PageHeader
        title="نقش‌ها و مجوزها"
        subtitle="مدیریت نقش‌ها و ماتریس دسترسی"
        actions={user?.isSuperAdmin ? <Button onClick={() => setCreateOpen(true)}><Plus size={15} /> نقش جدید</Button> : undefined}
      />
      <Card>
        <DataTable error={list.error} onRetry={list.reload}
          columns={cols}
          rows={list.rows}
          loading={list.loading}
          rowActions={(r) => user?.isSuperAdmin && r.code !== 'SUPER_ADMIN' ? (
            <Button size="sm" variant="outline" onClick={() => openEdit(r)}>ویرایش مجوزها</Button>
          ) : null}
        />
      </Card>

      {/* ویرایش نقش */}
      <Modal
        open={!!editing}
        title={`مجوزهای نقش «${editing?.name ?? ''}»`}
        onClose={() => setEditing(null)}
        width={760}
        footer={
          <>
            <Button onClick={save} loading={saving}>ذخیره</Button>
            <Button variant="secondary" onClick={() => setEditing(null)}>انصراف</Button>
          </>
        }
      >
        <div className="col" style={{ gap: 12 }}>
          <Field label="نام نقش" required><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="توضیحات"><Textarea value={description} onChange={(e) => setDescription(e.target.value)} style={{ minHeight: 60 }} /></Field>
          {permMatrix(checked, toggle)}
        </div>
      </Modal>

      {/* ایجاد نقش */}
      <Modal
        open={createOpen}
        title="ایجاد نقش جدید"
        onClose={() => setCreateOpen(false)}
        width={760}
        footer={
          <>
            <Button onClick={create} loading={saving}>ایجاد</Button>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>انصراف</Button>
          </>
        }
      >
        <div className="col" style={{ gap: 12 }}>
          <div className="form-grid">
            <Field label="کد نقش" required hint="مثلاً unit_manager"><Input className="ltr" value={createForm.code} onChange={(e) => setCreateForm((f) => ({ ...f, code: e.target.value }))} /></Field>
            <Field label="نام نقش" required><Input value={createForm.name} onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))} /></Field>
          </div>
          <Field label="توضیحات"><Textarea value={createForm.description} onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))} style={{ minHeight: 60 }} /></Field>
          {permMatrix(createChecked, toggleCreate)}
        </div>
      </Modal>
    </>
  );
}
