import { useEffect, useState } from 'react';
import { api, apiErrorMessage } from '../lib/api';
import { getDefaultCompanyId } from '../lib/org';
import CompanyPicker from '../components/CompanyPicker';
import { useList } from '../lib/useList';
import { Tabs,
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
import { toPersianDigits } from '../lib/format';

interface SettingRow {
  id: string;
  key: string;
  value: string;
  label: string;
  group: string;
  description?: string;
}

interface CustomField {
  id: string;
  code: string;
  label: string;
  entity: string;
  dataType: string;
  options?: string;
  isActive: boolean;
}

const ENTITIES = ['EMPLOYEE', 'CONTRACT', 'ASSET', 'TASK', 'LOAN'];
const ENTITY_LABELS: Record<string, string> = {
  EMPLOYEE: 'نیرو',
  CONTRACT: 'قرارداد',
  ASSET: 'دارایی',
  TASK: 'task',
  LOAN: 'وام',
};

export default function Settings() {
  const toast = useToast();
  const [tab, setTab] = useState<'settings' | 'fields'>('settings');
  const list = useList<SettingRow>('/settings');
  const fields = useList<CustomField>('/settings/custom-fields');
  const [editKey, setEditKey] = useState<SettingRow | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [fieldOpen, setFieldOpen] = useState(false);
  const [fieldForm, setFieldForm] = useState({ companyId: '', entity: 'EMPLOYEE', code: '', label: '', dataType: 'text', options: '' });
  const [deleteField, setDeleteField] = useState<CustomField | null>(null);
  const [groups, setGroups] = useState<string[]>([]);

  useEffect(() => {
    api
      .get('/settings/groups')
      .then((r) => setGroups(r?.data?.data ?? []))
      .catch(() => {});
  }, []);

  const openEdit = (s: SettingRow) => {
    setEditKey(s);
    setEditValue(s.value ?? '');
  };

  const saveSetting = async () => {
    if (!editKey) return;
    setSaving(true);
    try {
      await api.patch(`/settings/${editKey.key}`, { value: editValue });
      toast('success', 'تنظیم ذخیره شد.');
      setEditKey(null);
      list.reload();
    } catch (e) {
      toast('error', apiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const createField = async () => {
    setSaving(true);
    try {
      const companyId = fieldForm.companyId || (await getDefaultCompanyId());
      if (!companyId) throw new Error('شرکتی در ساختار سازمانی ثبت نشده است.');
      await api.post('/settings/custom-fields', {
        companyId,
        entity: fieldForm.entity,
        code: fieldForm.code,
        label: fieldForm.label,
        dataType: fieldForm.dataType,
        options: fieldForm.options || undefined,
      });
      toast('success', 'فیلد سفارشی ایجاد شد.');
      setFieldOpen(false);
      setFieldForm({ companyId: '', entity: 'EMPLOYEE', code: '', label: '', dataType: 'text', options: '' });
      fields.reload();
    } catch (e) {
      toast('error', apiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const removeField = async () => {
    if (!deleteField) return;
    try {
      await api.delete(`/settings/custom-fields/${deleteField.id}`);
      toast('success', 'فیلد حذف شد.');
      setDeleteField(null);
      fields.reload();
    } catch (e) {
      toast('error', apiErrorMessage(e));
    }
  };

  const settingCols: Column<SettingRow>[] = [
    { key: 'label', header: 'تنظیم', render: (r) => <span className="fw-600">{r.label}</span> },
    { key: 'key', header: 'کلید', render: (r) => <span className="ltr text-xs">{r.key}</span> },
    { key: 'group', header: 'گروه', render: (r) => <Badge kind="sky">{r.group}</Badge> },
    { key: 'value', header: 'مقدار', render: (r) => <span className="ltr">{r.value ?? '—'}</span> },
    { key: 'description', header: 'توضیح', render: (r) => <span className="text-muted text-sm">{r.description ?? '—'}</span> },
  ];

  const fieldCols: Column<CustomField>[] = [
    { key: 'label', header: 'برچسب', render: (r) => <span className="fw-600">{r.label}</span> },
    { key: 'code', header: 'کد', render: (r) => <span className="ltr">{r.code}</span> },
    { key: 'entity', header: 'موجودیت', render: (r) => ENTITY_LABELS[r.entity] ?? r.entity },
    { key: 'dataType', header: 'نوع داده', render: (r) => dataTypeLabel(r.dataType) },
    { key: 'options', header: 'گزینه‌ها', render: (r) => (r.options ? r.options.split('|').join('، ') : '—') },
    { key: 'isActive', header: 'وضعیت', render: (r) => <Badge kind={r.isActive ? 'green' : 'gray'}>{r.isActive ? 'فعال' : 'غیرفعال'}</Badge> },
  ];

  return (
    <>
      <PageHeader title="تنظیمات" subtitle="تنظیمات سیستمی و فیلدهای سفارشی" />

      <Tabs className="tabs mb">
        <button className={`tab${tab === 'settings' ? ' active' : ''}`} onClick={() => setTab('settings')}>تنظیمات سیستمی</button>
        <button className={`tab${tab === 'fields' ? ' active' : ''}`} onClick={() => setTab('fields')}>فیلدهای سفارشی</button>
      </Tabs>

      <Card>
        {tab === 'settings' && (
          <>
            <div className="list-toolbar-wrap">
              <ListToolbar search={list.search} onSearch={(s) => list.setSearch(s)}>
                <Select onChange={(e) => list.setFilter('group', e.target.value)} style={{ width: 200 }}>
                  <option value="">همهٔ گروه‌ها</option>
                  {groups.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </Select>
              </ListToolbar>
            </div>
            <DataTable error={list.error} onRetry={list.reload}
              columns={settingCols}
              rows={list.rows}
              loading={list.loading}
              rowActions={(r) => (
                <Button size="sm" variant="outline" onClick={() => openEdit(r)}>تغییر مقدار</Button>
              )}
            />
            <div className="list-pagination-wrap">
              <Pagination pageSize={list.pageSize} onPageSizeChange={list.setPageSize} page={list.page} totalPages={list.totalPages} total={list.total} onChange={list.setPage} />
            </div>
          </>
        )}

        {tab === 'fields' && (
          <>
            <div className="flex-between" style={{ padding: '14px 14px 0' }}>
              <span className="text-muted text-sm">{toPersianDigits(fields.total)} فیلد سفارشی</span>
              <Button onClick={() => setFieldOpen(true)}>فیلد جدید</Button>
            </div>
            <DataTable error={fields.error} onRetry={fields.reload}
              columns={fieldCols}
              rows={fields.rows}
              loading={fields.loading}
              rowActions={(r) => (
                <Button size="sm" variant="danger" onClick={() => setDeleteField(r)}>حذف</Button>
              )}
            />
            <div className="list-pagination-wrap">
              <Pagination pageSize={fields.pageSize} onPageSizeChange={fields.setPageSize} page={fields.page} totalPages={fields.totalPages} total={fields.total} onChange={fields.setPage} />
            </div>
          </>
        )}
      </Card>

      {/* تغییر مقدار تنظیم */}
      <Modal
        open={!!editKey}
        title={`تغییر «${editKey?.label ?? ''}»`}
        onClose={() => setEditKey(null)}
        footer={
          <>
            <Button onClick={saveSetting} loading={saving}>ذخیره</Button>
            <Button variant="secondary" onClick={() => setEditKey(null)}>انصراف</Button>
          </>
        }
      >
        <Field label="مقدار جدید" hint={editKey?.description}>
          <Input className="ltr" value={editValue} onChange={(e) => setEditValue(e.target.value)} />
        </Field>
      </Modal>

      {/* فیلد سفارشی جدید */}
      <Modal
        open={fieldOpen}
        title="ایجاد فیلد سفارشی"
        onClose={() => setFieldOpen(false)}
        footer={
          <>
            <Button onClick={createField} loading={saving}>ایجاد</Button>
            <Button variant="secondary" onClick={() => setFieldOpen(false)}>انصراف</Button>
          </>
        }
      >
        <div className="col" style={{ gap: 14 }}>
          <CompanyPicker value={fieldForm.companyId} onValueChange={companyId => setFieldForm(f => ({ ...f, companyId }))} disabled={saving} />
          <div className="form-grid">
            <Field label="موجودیت" required>
              <Select value={fieldForm.entity} onChange={(e) => setFieldForm((f) => ({ ...f, entity: e.target.value }))}>
                {ENTITIES.map((x) => <option key={x} value={x}>{ENTITY_LABELS[x]}</option>)}
              </Select>
            </Field>
            <Field label="نوع داده">
              <Select value={fieldForm.dataType} onChange={(e) => setFieldForm((f) => ({ ...f, dataType: e.target.value }))}>
                <option value="text">متن</option>
                <option value="number">عدد</option>
                <option value="date">تاریخ</option>
                <option value="select">انتخابی</option>
              </Select>
            </Field>
          </div>
          <div className="form-grid">
            <Field label="کد فیلد" required hint="مثلاً shirtSize"><Input className="ltr" value={fieldForm.code} onChange={(e) => setFieldForm((f) => ({ ...f, code: e.target.value }))} /></Field>
            <Field label="برچسب" required hint="مثلاً سایز پیراهن"><Input value={fieldForm.label} onChange={(e) => setFieldForm((f) => ({ ...f, label: e.target.value }))} /></Field>
          </div>
          {fieldForm.dataType === 'select' && (
            <Field label="گزینه‌ها" required hint="جدا با |"><Input value={fieldForm.options} onChange={(e) => setFieldForm((f) => ({ ...f, options: e.target.value }))} placeholder="S|M|L|XL" /></Field>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteField}
        title="حذف فیلد سفارشی"
        message="آیا از حذف این فیلد مطمئنید؟"
        danger
        onConfirm={removeField}
        onClose={() => setDeleteField(null)}
      />
    </>
  );
}

function dataTypeLabel(t: string) {
  const m: Record<string, string> = { text: 'متن', number: 'عدد', date: 'تاریخ', select: 'انتخابی' };
  return m[t] ?? t;
}
