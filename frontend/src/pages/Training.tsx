import { useState } from 'react';
import { api, apiErrorMessage } from '../lib/api';
import { getDefaultCompanyId } from '../lib/org';
import CompanyPicker from '../components/CompanyPicker';
import { useList } from '../lib/useList';
import { useAuth } from '../lib/auth';
import { EntityPicker, DatePicker, Tabs,
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
  useToast,
  type Column,
} from '../components/ui';
import { formatJalali, formatRial, toPersianDigits, parseDateInput } from '../lib/format';

interface Course { id: string; code: string; title: string; instructor?: string; durationHours: number; cost: bigint | number; isActive: boolean }
interface TRecord { id: string; employee?: { firstName: string; lastName: string } | null; course?: { code: string; title: string } | null; attendanceDate: string; status: string; score?: number | null }
interface Cert { id: string; name: string; employee?: { firstName: string; lastName: string } | null; issueDate?: string | null; expiryDate?: string | null }

const RECORD_STATUSES = ['ENROLLED', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'DROPPED'];

export default function Training() {
  const toast = useToast();
  const { hasPermission } = useAuth();
  const [tab, setTab] = useState<'courses' | 'records' | 'certs'>('courses');
  const courses = useList<Course>('/training/courses');
  const records = useList<TRecord>('/training/records');
  const certs = useList<Cert>('/training/certificates');

  const canManage = hasPermission('training.manage');
  const [courseOpen, setCourseOpen] = useState(false);
  const [courseForm, setCourseForm] = useState({ companyId: '', code: '', title: '', instructor: '', durationHours: 0, cost: 0, description: '' });
  const [recordOpen, setRecordOpen] = useState(false);
  const [recordForm, setRecordForm] = useState({ employeeId: '', courseId: '', attendanceDate: '', status: 'COMPLETED', score: '' });
  const [saving, setSaving] = useState(false);

  const submitCourse = async () => {
    setSaving(true);
    try {
      const companyId = courseForm.companyId || (await getDefaultCompanyId());
      if (!companyId) throw new Error('شرکتی در ساختار سازمانی ثبت نشده است.');
      await api.post('/training/courses', { ...courseForm, companyId });
      toast('success', 'دوره ثبت شد.');
      setCourseOpen(false);
      courses.reload();
    } catch (e) { toast('error', apiErrorMessage(e)); } finally { setSaving(false); }
  };

  const submitRecord = async () => {
    setSaving(true);
    try {
      const attendanceDate = parseDateInput(recordForm.attendanceDate);
      if (!attendanceDate) throw new Error('قالب تاریخ حضور معتبر نیست (نمونه: ۱۴۰۴/۰۱/۰۱).');
      await api.post('/training/records', {
        ...recordForm,
        attendanceDate,
        score: recordForm.score ? Number(recordForm.score) : undefined,
      });
      toast('success', 'سابقهٔ آموزش ثبت شد.');
      setRecordOpen(false);
      records.reload();
    } catch (e) { toast('error', e instanceof Error ? e.message : apiErrorMessage(e)); } finally { setSaving(false); }
  };

  const courseCols: Column<Course>[] = [
    { key: 'code', header: 'کد', render: (r) => <span className="ltr">{r.code}</span> },
    { key: 'title', header: 'عنوان دوره', render: (r) => <span className="fw-600">{r.title}</span> },
    { key: 'instructor', header: 'مدرس' },
    { key: 'duration', header: 'ساعت', render: (r) => toPersianDigits(r.durationHours) },
    { key: 'cost', header: 'هزینه', render: (r) => formatRial(Number(r.cost)) },
    { key: 'isActive', header: 'وضعیت', render: (r) => <Badge kind={r.isActive ? 'green' : 'gray'}>{r.isActive ? 'فعال' : 'غیرفعال'}</Badge> },
  ];

  const recordCols: Column<TRecord>[] = [
    { key: 'employee', header: 'نیرو', render: (r) => (r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : '—') },
    { key: 'course', header: 'دوره', render: (r) => r.course?.title ?? '—' },
    { key: 'attendanceDate', header: 'تاریخ', render: (r) => formatJalali(r.attendanceDate) },
    { key: 'score', header: 'امتیاز', render: (r) => (r.score != null ? toPersianDigits(r.score) : '—') },
    { key: 'status', header: 'وضعیت', render: (r) => <Badge kind={r.status === 'COMPLETED' ? 'green' : r.status === 'FAILED' ? 'red' : 'amber'}>{toPersianDigits(r.status === 'COMPLETED' ? 'پاس‌شده' : r.status === 'FAILED' ? 'مردود' : r.status)}</Badge> },
  ];

  const certCols: Column<Cert>[] = [
    { key: 'name', header: 'گواهینامه', render: (r) => <span className="fw-600">{r.name}</span> },
    { key: 'employee', header: 'نیرو', render: (r) => (r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : '—') },
    { key: 'issueDate', header: 'صدور', render: (r) => (r.issueDate ? formatJalali(r.issueDate) : '—') },
    { key: 'expiryDate', header: 'انقضا', render: (r) => (r.expiryDate ? formatJalali(r.expiryDate) : '—') },
  ];

  return (
    <>
      <PageHeader
        title="آموزش و گواهینامه"
        subtitle="دوره‌ها، سوابق آموزش و گواهینامه‌ها"
        actions={canManage && (
          <>
            <Button variant="outline" onClick={() => setRecordOpen(true)}>ثبت سابقهٔ آموزش</Button>
            <Button onClick={() => setCourseOpen(true)}>دورهٔ جدید</Button>
          </>
        )}
      />

      <Tabs className="tabs mb">
        <button className={`tab${tab === 'courses' ? ' active' : ''}`} onClick={() => setTab('courses')}>دوره‌ها</button>
        <button className={`tab${tab === 'records' ? ' active' : ''}`} onClick={() => setTab('records')}>سوابق آموزش</button>
        <button className={`tab${tab === 'certs' ? ' active' : ''}`} onClick={() => setTab('certs')}>گواهینامه‌ها</button>
      </Tabs>

      <Card>
        {tab === 'courses' && (
          <>
            <div className="list-toolbar-wrap"><ListToolbar search={courses.search} onSearch={(s) => courses.setSearch(s)} /></div>
            <DataTable error={courses.error} onRetry={courses.reload} columns={courseCols} rows={courses.rows} loading={courses.loading} />
            <div className="list-pagination-wrap">
              <Pagination pageSize={courses.pageSize} onPageSizeChange={courses.setPageSize} page={courses.page} totalPages={courses.totalPages} total={courses.total} onChange={courses.setPage} />
            </div>
          </>
        )}
        {tab === 'records' && (
          <>
            <DataTable error={records.error} onRetry={records.reload} columns={recordCols} rows={records.rows} loading={records.loading} />
            <div className="list-pagination-wrap">
              <Pagination pageSize={records.pageSize} onPageSizeChange={records.setPageSize} page={records.page} totalPages={records.totalPages} total={records.total} onChange={records.setPage} />
            </div>
          </>
        )}
        {tab === 'certs' && (
          <>
            <DataTable error={certs.error} onRetry={certs.reload} columns={certCols} rows={certs.rows} loading={certs.loading} />
            <div className="list-pagination-wrap">
              <Pagination pageSize={certs.pageSize} onPageSizeChange={certs.setPageSize} page={certs.page} totalPages={certs.totalPages} total={certs.total} onChange={certs.setPage} />
            </div>
          </>
        )}
      </Card>

      <Modal
        open={courseOpen} title="دورهٔ آموزشی جدید" onClose={() => setCourseOpen(false)}
        footer={<><Button onClick={submitCourse} loading={saving}>ثبت</Button><Button variant="secondary" onClick={() => setCourseOpen(false)}>انصراف</Button></>}
      >
        <div className="form-grid">
          <CompanyPicker value={courseForm.companyId} onValueChange={companyId => setCourseForm(f => ({ ...f, companyId }))} disabled={saving} />
          <Field label="کد دوره" required><Input className="input ltr" value={courseForm.code} onChange={(e) => setCourseForm((f) => ({ ...f, code: e.target.value }))} /></Field>
          <Field label="عنوان" required><Input value={courseForm.title} onChange={(e) => setCourseForm((f) => ({ ...f, title: e.target.value }))} /></Field>
          <Field label="مدرس"><Input value={courseForm.instructor} onChange={(e) => setCourseForm((f) => ({ ...f, instructor: e.target.value }))} /></Field>
          <Field label="مدت (ساعت)"><Input type="number" value={courseForm.durationHours} onChange={(e) => setCourseForm((f) => ({ ...f, durationHours: Number(e.target.value) }))} /></Field>
          <Field label="هزینه (ریال)"><Input type="number" value={courseForm.cost} onChange={(e) => setCourseForm((f) => ({ ...f, cost: Number(e.target.value) }))} /></Field>
        </div>
      </Modal>

      <Modal
        open={recordOpen} title="ثبت سابقهٔ آموزش" onClose={() => setRecordOpen(false)}
        footer={<><Button onClick={submitRecord} loading={saving}>ثبت</Button><Button variant="secondary" onClick={() => setRecordOpen(false)}>انصراف</Button></>}
      >
        <div className="col" style={{ gap: 14 }}>
          <Field label="کارمند" required><EntityPicker value={recordForm.employeeId} onValueChange={(value) => setRecordForm((f) => ({ ...f, employeeId: value }))} endpoint="/employees" title="انتخاب کارمند" /></Field>
          <Field label="دوره آموزشی" required><EntityPicker value={recordForm.courseId} onValueChange={(value) => setRecordForm((f) => ({ ...f, courseId: value }))} endpoint="/training/courses" title="انتخاب دوره آموزشی" /></Field>
          <div className="form-grid">
            <Field label="تاریخ حضور" required hint="شمسی یا میلادی — ۱۴۰۴/۰۱/۰۱"><DatePicker className="input ltr" value={recordForm.attendanceDate} onValueChange={(value) => setRecordForm((f) => ({ ...f, attendanceDate: value }))} placeholder="1404/01/01" /></Field>
            <Field label="وضعیت">
              <Select value={recordForm.status} onChange={(e) => setRecordForm((f) => ({ ...f, status: e.target.value }))}>
                {RECORD_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </Field>
          </div>
          <Field label="امتیاز (۰ تا ۱۰۰)"><Input type="number" value={recordForm.score} onChange={(e) => setRecordForm((f) => ({ ...f, score: e.target.value }))} /></Field>
        </div>
      </Modal>
    </>
  );
}
