import { useEffect, useState } from 'react';
import { Eye, Plus } from 'lucide-react';
import { api, apiErrorMessage } from '../lib/api';
import { useList, useItem } from '../lib/useList';
import { useAuth } from '../lib/auth';
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
import { formatJalali, statusLabel, badgeKind, EMPLOYMENT_TYPE_LABELS, EMPLOYEE_STATUS_LABELS, parseDateInput } from '../lib/format';

interface Employee {
  id: string;
  code: string;
  firstName: string;
  lastName: string;
  nationalId?: string;
  status: string;
  employmentType: string;
  hireDate?: string;
  mobile?: string;
  position?: { title: string } | null;
}

const emptyForm = {
  companyId: '', // پشت‌صحنه به‌صورت خودکار پر می‌شود (شرکت پیش‌فرض)
  positionId: '',
  code: '',
  firstName: '',
  lastName: '',
  nationalId: '',
  mobile: '',
  email: '',
  hireDate: '',
  employmentType: 'PERMANENT',
  monthlyBaseSalary: '',
};

interface OptionRow {
  id: string;
  code?: string;
  name?: string;
  title?: string;
}

interface OrgOptions {
  companies: OptionRow[];
  positions: OptionRow[];
}

const emptyOptions: OrgOptions = { companies: [], positions: [] };

export default function Employees() {
  const toast = useToast();
  const { hasPermission, user } = useAuth();
  const list = useList<Employee>('/employees');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [options, setOptions] = useState<OrgOptions>(emptyOptions);

  void list.search;

  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  /** بارگذاری سمت‌ها و تعیین خودکار شرکت پیش‌فرض (سرور شرکت را الزامی می‌خواهد) */
  const loadOptions = () => {
    Promise.all([
      api.get('/org/companies/options'),
      api.get('/org/positions/options'),
    ])
      .then(([co, po]) => {
        const companies: OptionRow[] = co?.data?.data ?? [];
        setOptions({ companies, positions: po?.data?.data ?? [] });
        if (companies[0]?.id) setForm((f) => ({ ...f, companyId: companies[0].id }));
      })
      .catch(() => toast('error', 'بارگذاری فهرست‌های انتخابی ناموفق بود.'));
  };

  /** فقط فیلدهای پُر به سرور ارسال می‌شوند؛ فیلد خالی معادل «انتخاب نشده» است */
  const buildPayload = () => {
    const payload: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(form)) {
      if (typeof v === 'string') {
        const s = v.trim();
        if (!s) continue;
        if (k === 'hireDate') {
          const iso = parseDateInput(s);
          if (!iso) throw new Error('قالب تاریخ استخدام معتبر نیست (نمونه: ۱۴۰۴/۰۱/۰۱).');
          payload[k] = iso;
          continue;
        }
        payload[k] = k === 'monthlyBaseSalary' ? Number(s) : s;
      } else if (v !== undefined && v !== null) {
        payload[k] = v;
      }
    }
    return payload;
  };

  const submitCreate = async () => {
    if (!form.companyId) {
      toast('error', 'هیچ شرکتی در ساختار سازمانی ثبت نشده است؛ ابتدا یک شرکت بسازید.');
      return;
    }
    setSaving(true);
    try {
      await api.post('/employees', buildPayload());
      toast('success', 'نیروی جدید ثبت شد.');
      setCreateOpen(false);
      setForm({ ...emptyForm });
      list.reload();
    } catch (e) {
      toast('error', e instanceof Error ? e.message : apiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const columns: Column<Employee>[] = [
    { key: 'code', header: 'کد پرسنلی', width: 110, render: (r) => <span className="ltr">{r.code}</span> },
    {
      key: 'name',
      header: 'نام و نام خانوادگی',
      render: (r) => (
        <span className="fw-600">
          {r.firstName} {r.lastName}
        </span>
      ),
    },
    { key: 'nationalId', header: 'کد ملی', render: (r) => <span className="ltr">{r.nationalId ?? '—'}</span> },
    { key: 'position', header: 'سمت', render: (r) => r.position?.title ?? '—' },
    { key: 'employmentType', header: 'نوع استخدام', render: (r) => statusLabel(r.employmentType) },
    { key: 'hireDate', header: 'تاریخ استخدام', render: (r) => (r.hireDate ? formatJalali(r.hireDate) : '—') },
    {
      key: 'status',
      header: 'وضعیت',
      render: (r) => <Badge kind={badgeKind(r.status)}>{statusLabel(r.status)}</Badge>,
    },
  ];

  return (
    <>
      <PageHeader
        title="نیروهای سازمان"
        subtitle={user?.scope?.unrestricted ? 'همهٔ شرکت‌ها' : 'در محدودهٔ دسترسی شما'}
        actions={
          hasPermission('employees.create') && (
            <Button onClick={() => { setCreateOpen(true); loadOptions(); }}>
              <Plus size={15} /> نیروی جدید
            </Button>
          )
        }
      />

      <Card>
        <div style={{ padding: '14px 14px 0' }}>
          <ListToolbar search={search} onSearch={(s) => { setSearch(s); list.setSearch(s); }}>
            <Select value={status} onChange={(e) => { setStatus(e.target.value); list.setFilter('status', e.target.value); }} style={{ width: 170 }}>
              <option value="">همهٔ وضعیت‌ها</option>
              {Object.entries(EMPLOYEE_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
          </ListToolbar>
        </div>
        <DataTable columns={columns} rows={list.rows} loading={list.loading} rowActions={(r) => (
          <Button size="sm" variant="outline" onClick={() => setDetailId(r.id)}>
            <Eye size={14} /> پرونده
          </Button>
        )} />
        <div style={{ padding: '0 14px 14px' }}>
          <Pagination page={list.page} totalPages={list.totalPages} total={list.total} onChange={list.setPage} />
        </div>
      </Card>

      {detailId && <EmployeeDetail id={detailId} onClose={() => setDetailId(null)} />}

      <Modal
        open={createOpen}
        title="ثبت نیروی جدید"
        onClose={() => setCreateOpen(false)}
        footer={
          <>
            <Button onClick={submitCreate} loading={saving}>ثبت</Button>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>انصراف</Button>
          </>
        }
      >
        <div className="form-grid">
          <Field label="کد پرسنلی" required><Input value={form.code} onChange={(e) => set('code', e.target.value)} /></Field>
          <Field label="نوع استخدام" required>
            <Select value={form.employmentType} onChange={(e) => set('employmentType', e.target.value)}>
              {Object.entries(EMPLOYMENT_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
          </Field>
          <Field label="نام" required><Input value={form.firstName} onChange={(e) => set('firstName', e.target.value)} /></Field>
          <Field label="نام خانوادگی" required><Input value={form.lastName} onChange={(e) => set('lastName', e.target.value)} /></Field>
          <Field label="کد ملی" required><Input value={form.nationalId} onChange={(e) => set('nationalId', e.target.value)} /></Field>
          <Field label="موبایل"><Input value={form.mobile} onChange={(e) => set('mobile', e.target.value)} placeholder="09xxxxxxxxx" /></Field>
          <Field label="ایمیل"><Input value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="name@company.com" /></Field>
          <Field label="تاریخ استخدام" required hint="شمسی یا میلادی — ۱۴۰۴/۰۱/۰۱ یا 2026-01-01"><Input value={form.hireDate} onChange={(e) => set('hireDate', e.target.value)} placeholder="1404/01/01" /></Field>
          <Field label="حقوق پایهٔ ماهانه (ریال)"><Input type="number" min={0} value={form.monthlyBaseSalary} onChange={(e) => set('monthlyBaseSalary', e.target.value)} placeholder="50000000" /></Field>
          <Field label="سمت">
            <Select value={form.positionId} onChange={(e) => set('positionId', e.target.value)}>
              <option value="">— بدون سمت —</option>
              {options.positions.map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </Select>
          </Field>
        </div>
      </Modal>
    </>
  );
}

/* ==========================================================================
   پروندهٔ نیرو (مودال بزرگ با تب‌ها)
   ========================================================================== */

function EmployeeDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const { item: emp, loading, error } = useItem<any>(`/employees/${id}`);
  const [tab, setTab] = useState<'info' | 'contracts' | 'attendance' | 'leaves'>('info');
  const [sub, setSub] = useState<any[]>([]);
  const [subLoading, setSubLoading] = useState(false);

  const subUrl =
    tab === 'contracts' ? `/contracts?employeeId=${id}` :
    tab === 'attendance' ? `/attendance/records?employeeId=${id}` :
    tab === 'leaves' ? `/leaves/requests?employeeId=${id}` : null;

  useEffect(() => {
    if (!subUrl) return;
    let active = true;
    setSubLoading(true);
    api
      .get(subUrl)
      .then((r) => {
        if (active) setSub(Array.isArray(r?.data?.data) ? r.data.data : r?.data?.data?.items ?? []);
      })
      .catch(() => active && setSub([]))
      .finally(() => active && setSubLoading(false));
    return () => {
      active = false;
    };
  }, [subUrl]);

  if (loading) return <Modal open title="پروندهٔ نیرو" onClose={onClose}><div className="skeleton" style={{ height: 200 }} /></Modal>;
  if (error || !emp) return <Modal open title="پروندهٔ نیرو" onClose={onClose}><div className="alert alert-danger">{error || 'یافت نشد.'}</div></Modal>;

  return (
    <Modal open title={`پروندهٔ ${emp.firstName} ${emp.lastName}`} onClose={onClose} width={860}>
      <div className="tabs mb">
        <button className={`tab${tab === 'info' ? ' active' : ''}`} onClick={() => setTab('info')}>مشخصات</button>
        <button className={`tab${tab === 'contracts' ? ' active' : ''}`} onClick={() => setTab('contracts')}>قراردادها</button>
        <button className={`tab${tab === 'attendance' ? ' active' : ''}`} onClick={() => setTab('attendance')}>حضور و غیاب</button>
        <button className={`tab${tab === 'leaves' ? ' active' : ''}`} onClick={() => setTab('leaves')}>مرخصی‌ها</button>
      </div>

      {tab === 'info' && (
        <div className="form-grid">
          <InfoRow label="کد پرسنلی" value={emp.code} />
          <InfoRow label="کد ملی" value={emp.nationalId} ltr />
          <InfoRow label="وضعیت" value={statusLabel(emp.status)} />
          <InfoRow label="نوع استخدام" value={statusLabel(emp.employmentType)} />
          <InfoRow label="تاریخ استخدام" value={emp.hireDate ? formatJalali(emp.hireDate) : '—'} />
          <InfoRow label="سمت" value={emp.position?.title} />
          <InfoRow label="مدیر مستقیم" value={emp.manager ? `${emp.manager.firstName} ${emp.manager.lastName}` : '—'} />
          <InfoRow label="موبایل" value={emp.mobile} ltr />
          <InfoRow label="ایمیل" value={emp.email} ltr />
        </div>
      )}

      {tab !== 'info' && (
        <DataTable
          loading={subLoading}
          rows={sub}
          columns={
            tab === 'contracts'
              ? ([
                  { key: 'code', header: 'شماره' },
                  { key: 'status', header: 'وضعیت', render: (r: any) => <Badge kind={badgeKind(r.status)}>{statusLabel(r.status)}</Badge> },
                  { key: 'type', header: 'نوع' },
                ] as Column<any>[])
              : tab === 'attendance'
                ? ([
                    { key: 'workDate', header: 'تاریخ', render: (r: any) => formatJalali(r.workDate) },
                    { key: 'workMinutes', header: 'کارکرد (دقیقه)' },
                    { key: 'status', header: 'وضعیت', render: (r: any) => <Badge kind={badgeKind(r.status)}>{statusLabel(r.status)}</Badge> },
                  ] as Column<any>[])
                : ([
                    { key: 'startAt', header: 'از', render: (r: any) => formatJalali(r.startAt) },
                    { key: 'endAt', header: 'تا', render: (r: any) => formatJalali(r.endAt) },
                    { key: 'status', header: 'وضعیت', render: (r: any) => <Badge kind={badgeKind(r.status)}>{statusLabel(r.status)}</Badge> },
                  ] as Column<any>[])
          }
        />
      )}
    </Modal>
  );
}

function InfoRow({ label, value, ltr }: { label: string; value?: string | null; ltr?: boolean }) {
  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <div className={`input${ltr ? ' ltr' : ''}`} style={{ background: 'var(--surface-2)' }}>{value ?? '—'}</div>
    </div>
  );
}
