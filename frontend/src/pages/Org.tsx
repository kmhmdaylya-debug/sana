import { useState } from 'react';
import { api, apiErrorMessage } from '../lib/api';
import { getDefaultCompanyId } from '../lib/org';
import { useList } from '../lib/useList';
import { Tabs,
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
  useToast,
  type Column,
} from '../components/ui';
import { toPersianDigits } from '../lib/format';

interface Company { id: string; name: string; code?: string; legalName?: string; nationalId?: string; isActive: boolean; }
interface Branch { id: string; name: string; code?: string; phone?: string; address?: string; isActive: boolean; }
interface OrgUnit { id: string; name: string; code?: string; kind?: string; parent?: { name: string } | null; isActive: boolean; }
interface Position { id: string; title: string; code?: string; grade?: string; isActive: boolean; }

const UNIT_KINDS = ['UNIT', 'SUBUNIT', 'DEPARTMENT', 'TEAM'];

export default function Org() {
  const toast = useToast();
  const [tab, setTab] = useState<'companies' | 'branches' | 'units' | 'positions'>('companies');
  const companies = useList<Company>('/org/companies');
  const branches = useList<Branch>('/org/branches');
  const units = useList<OrgUnit>('/org/units');
  const positions = useList<Position>('/org/positions');

  const [modal, setModal] = useState<null | 'company' | 'branch' | 'unit' | 'position'>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; kind: string } | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});

  const openCreate = (kind: 'company' | 'branch' | 'unit' | 'position') => {
    setEditingId(null);
    setForm(
      kind === 'company'
        ? { code: '', name: '', legalName: '', nationalId: '' }
        : kind === 'branch'
          ? { code: '', name: '', phone: '', address: '' }
          : kind === 'unit'
            ? { code: '', name: '', kind: 'UNIT', parentId: '' }
            : { code: '', title: '', grade: '', orgUnitId: '' },
    );
    setModal(kind);
  };

  const openEdit = (kind: 'company' | 'branch' | 'unit' | 'position', row: any) => {
    setEditingId(row.id);
    setForm({
      code: row.code ?? '',
      name: row.name ?? '',
      legalName: row.legalName ?? '',
      nationalId: row.nationalId ?? '',
      phone: row.phone ?? '',
      address: row.address ?? '',
      kind: row.kind ?? 'UNIT',
      parentId: row.parentId ?? '',
      title: row.title ?? '',
      grade: row.grade ?? '',
      orgUnitId: row.orgUnitId ?? '',
    });
    setModal(kind);
  };

  const save = async () => {
    const kind = modal!;
    setSaving(true);
    const urls: Record<string, string> = {
      company: '/org/companies',
      branch: '/org/branches',
      unit: '/org/units',
      position: '/org/positions',
    };
    const payload: Record<string, any> = {};
    if (kind === 'company') {
      payload.code = form.code;
      payload.name = form.name;
      if (form.legalName) payload.legalName = form.legalName;
      if (form.nationalId) payload.nationalId = form.nationalId;
    } else if (kind === 'branch') {
      payload.code = form.code;
      payload.name = form.name;
      if (form.phone) payload.phone = form.phone;
      if (form.address) payload.address = form.address;
    } else if (kind === 'unit') {
      payload.code = form.code;
      payload.name = form.name;
      payload.kind = form.kind || 'UNIT';
      if (form.parentId) payload.parentId = form.parentId;
    } else {
      payload.code = form.code;
      payload.title = form.title;
      if (form.grade) payload.grade = form.grade;
      if (form.orgUnitId) payload.orgUnitId = form.orgUnitId;
    }

    // شرکت از سمت کاربر پرسیده نمی‌شود؛ خودکار به شرکت پیش‌فرض متصل می‌شود
    if (kind !== 'company') {
      const cid = await getDefaultCompanyId();
      if (!cid) {
        toast('error', 'ابتدا یک شرکت بسازید.');
        setSaving(false);
        return;
      }
      payload.companyId = cid;
    }
    try {
      if (editingId) {
        await api.patch(`${urls[kind]}/${editingId}`, payload);
        toast('success', 'به‌روزرسانی شد.');
      } else {
        await api.post(urls[kind], payload);
        toast('success', 'ثبت شد.');
      }
      setModal(null);
      (kind === 'company' ? companies : kind === 'branch' ? branches : kind === 'unit' ? units : positions).reload();
    } catch (e) {
      toast('error', apiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/org/${deleteTarget.kind}/${deleteTarget.id}`);
      toast('success', 'حذف شد.');
      setDeleteTarget(null);
      if (deleteTarget.kind === 'companies') companies.reload();
      else if (deleteTarget.kind === 'branches') branches.reload();
      else if (deleteTarget.kind === 'units') units.reload();
      else positions.reload();
    } catch (e) {
      toast('error', apiErrorMessage(e));
    }
  };

  const actions = (kind: string) => (r: any) => (
    <>
      <Button size="sm" variant="outline" onClick={() => openEdit(kind as any, r)}>ویرایش</Button>
      <Button size="sm" variant="danger" onClick={() => setDeleteTarget({ id: r.id, kind })}>حذف</Button>
    </>
  );

  const companyCols: Column<Company>[] = [
    { key: 'code', header: 'کد', render: (r) => <span className="ltr">{r.code ?? '—'}</span> },
    { key: 'name', header: 'نام', render: (r) => <span className="fw-600">{r.name}</span> },
    { key: 'legalName', header: 'نام حقوقی' },
    { key: 'nationalId', header: 'شناسهٔ ملی', render: (r) => <span className="ltr">{r.nationalId ?? '—'}</span> },
    { key: 'isActive', header: 'وضعیت', render: (r) => <Badge kind={r.isActive ? 'green' : 'gray'}>{r.isActive ? 'فعال' : 'غیرفعال'}</Badge> },
  ];

  const branchCols: Column<Branch>[] = [
    { key: 'name', header: 'شعبه', render: (r) => <span className="fw-600">{r.name}</span> },
    { key: 'code', header: 'کد', render: (r) => <span className="ltr">{r.code ?? '—'}</span> },
    { key: 'phone', header: 'تلفن', render: (r) => <span className="ltr">{r.phone ?? '—'}</span> },
    { key: 'isActive', header: 'وضعیت', render: (r) => <Badge kind={r.isActive ? 'green' : 'gray'}>{r.isActive ? 'فعال' : 'غیرفعال'}</Badge> },
  ];

  const unitCols: Column<OrgUnit>[] = [
    { key: 'name', header: 'واحد', render: (r) => <span className="fw-600">{r.name}</span> },
    { key: 'code', header: 'کد', render: (r) => <span className="ltr">{r.code ?? '—'}</span> },
    { key: 'kind', header: 'نوع', render: (r) => unitKind(r.kind) },
    { key: 'parent', header: 'واحد بالادست', render: (r) => r.parent?.name ?? '—' },
  ];

  const positionCols: Column<Position>[] = [
    { key: 'title', header: 'سمت', render: (r) => <span className="fw-600">{r.title}</span> },
    { key: 'code', header: 'کد', render: (r) => <span className="ltr">{r.code ?? '—'}</span> },
    { key: 'grade', header: 'سطح', render: (r) => r.grade ?? '—' },
  ];

  return (
    <>
      <PageHeader
        title="ساختار سازمانی"
        subtitle="شرکت‌ها، شعب، واحدها و سمت‌ها"
        actions={<Button onClick={() => openCreate(tab === 'companies' ? 'company' : tab === 'branches' ? 'branch' : tab === 'units' ? 'unit' : 'position')}>
          افزودن
        </Button>}
      />

      <Tabs className="tabs mb">
        <button className={`tab${tab === 'companies' ? ' active' : ''}`} onClick={() => setTab('companies')}>شرکت‌ها</button>
        <button className={`tab${tab === 'branches' ? ' active' : ''}`} onClick={() => setTab('branches')}>شعب</button>
        <button className={`tab${tab === 'units' ? ' active' : ''}`} onClick={() => setTab('units')}>واحدهای سازمانی</button>
        <button className={`tab${tab === 'positions' ? ' active' : ''}`} onClick={() => setTab('positions')}>سمت‌ها</button>
      </Tabs>

      <Card>
        {tab === 'companies' && (
          <>
            <DataTable error={companies.error} onRetry={companies.reload} columns={companyCols} rows={companies.rows} loading={companies.loading} rowActions={actions('companies')} />
            <div className="list-pagination-wrap">
              <Pagination pageSize={companies.pageSize} onPageSizeChange={companies.setPageSize} page={companies.page} totalPages={companies.totalPages} total={companies.total} onChange={companies.setPage} />
            </div>
          </>
        )}
        {tab === 'branches' && (
          <>
            <DataTable error={branches.error} onRetry={branches.reload} columns={branchCols} rows={branches.rows} loading={branches.loading} rowActions={actions('branches')} />
            <div className="list-pagination-wrap">
              <Pagination pageSize={branches.pageSize} onPageSizeChange={branches.setPageSize} page={branches.page} totalPages={branches.totalPages} total={branches.total} onChange={branches.setPage} />
            </div>
          </>
        )}
        {tab === 'units' && (
          <>
            <DataTable error={units.error} onRetry={units.reload} columns={unitCols} rows={units.rows} loading={units.loading} rowActions={actions('units')} />
            <div className="list-pagination-wrap">
              <Pagination pageSize={units.pageSize} onPageSizeChange={units.setPageSize} page={units.page} totalPages={units.totalPages} total={units.total} onChange={units.setPage} />
            </div>
          </>
        )}
        {tab === 'positions' && (
          <>
            <DataTable error={positions.error} onRetry={positions.reload} columns={positionCols} rows={positions.rows} loading={positions.loading} rowActions={actions('positions')} />
            <div className="list-pagination-wrap">
              <Pagination pageSize={positions.pageSize} onPageSizeChange={positions.setPageSize} page={positions.page} totalPages={positions.totalPages} total={positions.total} onChange={positions.setPage} />
            </div>
          </>
        )}
      </Card>

      {/* مودال فرم */}
      <Modal
        open={!!modal}
        title={editingId ? 'ویرایش' : 'افزودن'}
        onClose={() => setModal(null)}
        footer={
          <>
            <Button onClick={save} loading={saving}>ذخیره</Button>
            <Button variant="secondary" onClick={() => setModal(null)}>انصراف</Button>
          </>
        }
      >
        <div className="form-grid">
          {modal === 'company' && (
            <>
              <Field label="کد" required><Input className="ltr" value={form.code ?? ''} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} /></Field>
              <Field label="نام" required><Input value={form.name ?? ''} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></Field>
              <Field label="نام حقوقی"><Input value={form.legalName ?? ''} onChange={(e) => setForm((f) => ({ ...f, legalName: e.target.value }))} /></Field>
              <Field label="شناسهٔ ملی"><Input className="ltr" value={form.nationalId ?? ''} onChange={(e) => setForm((f) => ({ ...f, nationalId: e.target.value }))} /></Field>
            </>
          )}
          {modal === 'branch' && (
            <>
              <Field label="نام شعبه" required><Input value={form.name ?? ''} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></Field>
              <Field label="کد" required><Input className="ltr" value={form.code ?? ''} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} /></Field>
              <Field label="تلفن"><Input className="ltr" value={form.phone ?? ''} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} /></Field>
              <Field label="نشانی"><Input value={form.address ?? ''} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} /></Field>
            </>
          )}
          {modal === 'unit' && (
            <>
              <Field label="نام واحد" required><Input value={form.name ?? ''} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></Field>
              <Field label="کد" required><Input className="ltr" value={form.code ?? ''} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} /></Field>
              <Field label="نوع واحد">
                <Select value={form.kind ?? 'UNIT'} onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value }))}>
                  {UNIT_KINDS.map((t) => <option key={t} value={t}>{unitKind(t)}</option>)}
                </Select>
              </Field>
              <Field label="واحد بالادست (اختیاری)">
                <Select value={form.parentId ?? ''} onChange={(e) => setForm((f) => ({ ...f, parentId: e.target.value }))}>
                  <option value="">— ندارد —</option>
                  {units.rows.filter((u) => u.id !== editingId).map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </Select>
              </Field>
            </>
          )}
          {modal === 'position' && (
            <>
              <Field label="عنوان سمت" required><Input value={form.title ?? ''} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} /></Field>
              <Field label="کد" required><Input className="ltr" value={form.code ?? ''} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} /></Field>
              <Field label="سطح"><Input value={form.grade ?? ''} onChange={(e) => setForm((f) => ({ ...f, grade: e.target.value }))} /></Field>
              <Field label="واحد سازمانی (اختیاری)">
                <Select value={form.orgUnitId ?? ''} onChange={(e) => setForm((f) => ({ ...f, orgUnitId: e.target.value }))}>
                  <option value="">— ندارد —</option>
                  {units.rows.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </Select>
              </Field>
            </>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="حذف"
        message="آیا از حذف این رکورد مطمئنید؟ (حذف منطقی)"
        danger
        onConfirm={remove}
        onClose={() => setDeleteTarget(null)}
      />
    </>
  );
}

function unitKind(t?: string) {
  const m: Record<string, string> = {
    UNIT: 'واحد',
    SUBUNIT: 'زیروواحد',
    DEPARTMENT: 'اداره / دپارتمان',
    TEAM: 'تیم',
  };
  return t ? m[t] ?? t : '—';
}
