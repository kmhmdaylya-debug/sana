import { useState } from 'react';
import { api, apiErrorMessage } from '../lib/api';
import { getDefaultCompanyId } from '../lib/org';
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
import { formatJalali, formatRial, statusLabel, toPersianDigits } from '../lib/format';

interface Requisition { id: string; title: string; headcount: number; status: string; budget: bigint | number; company?: { name: string } | null; requestedBy?: { fullName: string } | null }
interface Opening { id: string; title: string; employmentType: string; status: string; salaryMin: bigint | number; salaryMax: bigint | number; applicationDeadline?: string | null; _count?: { applicants: number } }
interface Applicant { id: string; firstName: string; lastName: string; mobile?: string; status: string; opening?: { title: string } | null }

const APPLICANT_STAGES = ['APPLIED', 'SCREENING', 'INTERVIEWED', 'OFFERED', 'HIRED', 'REJECTED'];

export default function Recruitment() {
  const toast = useToast();
  const { hasPermission } = useAuth();
  const [tab, setTab] = useState<'requisitions' | 'openings' | 'applicants'>('requisitions');
  const reqs = useList<Requisition>('/recruitment/requisitions');
  const openings = useList<Opening>('/recruitment/openings');
  const apps = useList<Applicant>('/recruitment/applicants');

  const canManage = hasPermission('recruitment.manage');
  const [reqOpen, setReqOpen] = useState(false);
  const [reqForm, setReqForm] = useState({ companyId: '', title: '', headcount: 1, reason: '', budget: 0 });
  const [saving, setSaving] = useState(false);

  const submitRequisition = async () => {
    setSaving(true);
    try {
      const companyId = reqForm.companyId || (await getDefaultCompanyId());
      if (!companyId) throw new Error('شرکتی در ساختار سازمانی ثبت نشده است.');
      await api.post('/recruitment/requisitions', { ...reqForm, companyId });
      toast('success', 'درخواست جذب ثبت شد.');
      setReqOpen(false);
      reqs.reload();
    } catch (e) { toast('error', apiErrorMessage(e)); } finally { setSaving(false); }
  };

  const setReqStatus = async (id: string, status: string) => {
    try {
      await api.patch(`/recruitment/requisitions/${id}/status`, { status });
      toast('success', 'وضعیت به‌روزرسانی شد.');
      reqs.reload();
    } catch (e) { toast('error', apiErrorMessage(e)); }
  };

  const setApplicantStage = async (id: string, status: string) => {
    try {
      await api.patch(`/recruitment/applicants/${id}/status`, { status });
      toast('success', 'مرحلهٔ داوطلب به‌روزرسانی شد.');
      apps.reload();
    } catch (e) { toast('error', apiErrorMessage(e)); }
  };

  const reqCols: Column<Requisition>[] = [
    { key: 'title', header: 'عنوان', render: (r) => <span className="fw-600">{r.title}</span> },
    { key: 'headcount', header: 'تعداد', render: (r) => toPersianDigits(r.headcount) },
    { key: 'budget', header: 'بودجه', render: (r) => (r.budget ? formatRial(Number(r.budget)) : '—') },
    { key: 'requestedBy', header: 'درخواست‌دهنده', render: (r) => r.requestedBy?.fullName ?? '—' },
    {
      key: 'status',
      header: 'وضعیت',
      render: (r) =>
        canManage ? (
          <Select value={r.status} onChange={(e) => setReqStatus(r.id, e.target.value)} style={{ width: 140 }}>
            {['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CLOSED'].map((s) => (
              <option key={s} value={s}>{reqStatus(s)}</option>
            ))}
          </Select>
        ) : (
          <Badge kind={r.status === 'APPROVED' ? 'green' : r.status === 'REJECTED' ? 'red' : 'amber'}>{reqStatus(r.status)}</Badge>
        ),
    },
  ];

  const openingCols: Column<Opening>[] = [
    { key: 'title', header: 'عنوان آگهی', render: (r) => <span className="fw-600">{r.title}</span> },
    { key: 'employmentType', header: 'نوع', render: (r) => statusLabel(r.employmentType) },
    { key: 'salary', header: 'بازهٔ حقوق', render: (r) => `${formatRial(Number(r.salaryMin))} — ${formatRial(Number(r.salaryMax))}` },
    { key: 'deadline', header: 'مهلت', render: (r) => (r.applicationDeadline ? formatJalali(r.applicationDeadline) : '—') },
    { key: 'applicants', header: 'داوطلبان', render: (r) => toPersianDigits(r._count?.applicants ?? 0) },
    { key: 'status', header: 'وضعیت', render: (r) => <Badge kind={r.status === 'OPEN' ? 'green' : 'gray'}>{r.status === 'OPEN' ? 'باز' : 'بسته'}</Badge> },
  ];

  const appCols: Column<Applicant>[] = [
    { key: 'name', header: 'نام', render: (r) => <span className="fw-600">{r.firstName} {r.lastName}</span> },
    { key: 'mobile', header: 'موبایل', render: (r) => <span className="ltr">{r.mobile ?? '—'}</span> },
    { key: 'opening', header: 'آگهی', render: (r) => r.opening?.title ?? '—' },
    {
      key: 'status',
      header: 'مرحله',
      render: (r) =>
        canManage ? (
          <Select value={r.status} onChange={(e) => setApplicantStage(r.id, e.target.value)} style={{ width: 130 }}>
            {APPLICANT_STAGES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
          </Select>
        ) : (
          <Badge kind={r.status === 'HIRED' ? 'green' : r.status === 'REJECTED' ? 'red' : 'amber'}>{statusLabel(r.status)}</Badge>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        title="استخدام و جذب"
        subtitle="درخواست جذب، آگهی و داوطلبان"
        actions={canManage && tab === 'requisitions' && <Button onClick={() => setReqOpen(true)}>درخواست جذب جدید</Button>}
      />

      <div className="tabs mb">
        <button className={`tab${tab === 'requisitions' ? ' active' : ''}`} onClick={() => setTab('requisitions')}>درخواست‌های جذب</button>
        <button className={`tab${tab === 'openings' ? ' active' : ''}`} onClick={() => setTab('openings')}>آگهی‌ها</button>
        <button className={`tab${tab === 'applicants' ? ' active' : ''}`} onClick={() => setTab('applicants')}>داوطلبان</button>
      </div>

      <Card>
        {tab === 'requisitions' && (
          <>
            <div style={{ padding: '14px 14px 0' }}><ListToolbar onSearch={(s) => reqs.setSearch(s)} /></div>
            <DataTable columns={reqCols} rows={reqs.rows} loading={reqs.loading} />
            <div style={{ padding: '0 14px 14px' }}>
              <Pagination page={reqs.page} totalPages={reqs.totalPages} total={reqs.total} onChange={reqs.setPage} />
            </div>
          </>
        )}
        {tab === 'openings' && (
          <>
            <DataTable columns={openingCols} rows={openings.rows} loading={openings.loading} />
            <div style={{ padding: '0 14px 14px' }}>
              <Pagination page={openings.page} totalPages={openings.totalPages} total={openings.total} onChange={openings.setPage} />
            </div>
          </>
        )}
        {tab === 'applicants' && (
          <>
            <div style={{ padding: '14px 14px 0' }}><ListToolbar onSearch={(s) => apps.setSearch(s)} /></div>
            <DataTable columns={appCols} rows={apps.rows} loading={apps.loading} />
            <div style={{ padding: '0 14px 14px' }}>
              <Pagination page={apps.page} totalPages={apps.totalPages} total={apps.total} onChange={apps.setPage} />
            </div>
          </>
        )}
      </Card>

      <Modal
        open={reqOpen} title="درخواست جذب جدید" onClose={() => setReqOpen(false)}
        footer={<><Button onClick={submitRequisition} loading={saving}>ثبت</Button><Button variant="secondary" onClick={() => setReqOpen(false)}>انصراف</Button></>}
      >
        <div className="col" style={{ gap: 14 }}>
          <Field label="عنوان" required><Input value={reqForm.title} onChange={(e) => setReqForm((f) => ({ ...f, title: e.target.value }))} /></Field>
          <div className="form-grid">
            <Field label="تعداد نیرو" required><Input type="number" value={reqForm.headcount} onChange={(e) => setReqForm((f) => ({ ...f, headcount: Number(e.target.value) }))} /></Field>
            <Field label="بودجه (ریال)"><Input type="number" value={reqForm.budget} onChange={(e) => setReqForm((f) => ({ ...f, budget: Number(e.target.value) }))} /></Field>
          </div>
          <Field label="توجیه درخواست"><Textarea value={reqForm.reason} onChange={(e) => setReqForm((f) => ({ ...f, reason: e.target.value }))} /></Field>
        </div>
      </Modal>
    </>
  );
}

function reqStatus(s: string) {
  const m: Record<string, string> = {
    DRAFT: 'پیش‌نویس',
    SUBMITTED: 'ثبت‌شده',
    APPROVED: 'تأییدشده',
    REJECTED: 'ردشده',
    CLOSED: 'بسته‌شده',
  };
  return m[s] ?? s;
}
