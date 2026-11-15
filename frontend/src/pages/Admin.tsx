import { useState } from 'react';
import { api, apiErrorMessage } from '../lib/api';
import { useList } from '../lib/useList';
import { useAuth } from '../lib/auth';
import { Tabs,
  Badge,
  Button,
  Card,
  DataTable,
  ListToolbar,
  Modal,
  PageHeader,
  Pagination,
  Select,
  Textarea,
  useToast,
  type Column,
} from '../components/ui';
import { formatJalali, statusLabel, toPersianDigits } from '../lib/format';

interface Corr {
  id: string;
  referenceNo: string;
  subject: string;
  direction: string;
  letterDate: string;
  status: string;
  senderName?: string;
  senderOrg?: string;
  classification?: string;
}

interface Meeting {
  id: string;
  title: string;
  scheduledAt: string;
  location?: string;
  status: string;
  organizer?: { fullName: string } | null;
}

interface Survey { id: string; title: string; status: string; isAnonymous: boolean; _count?: { questions: number; responses: number } }
interface Suggestion { id: string; title: string; category?: string; status: string; isAnonymous: boolean; responsible?: { fullName: string } | null }

export default function Admin() {
  const { hasPermission } = useAuth();
  const [tab, setTab] = useState<'corr' | 'meetings' | 'surveys' | 'suggestions'>('corr');
  const corr = useList<Corr>('/admin/correspondences');
  const meetings = useList<Meeting>('/admin/meetings');
  const surveys = useList<Survey>('/admin/surveys');
  const suggestions = useList<Suggestion>('/admin/suggestions');
  const [respondTo, setRespondTo] = useState<string | null>(null);
  const [response, setResponse] = useState('');
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const canManage = hasPermission('admin.manage');

  const submitResponse = async () => {
    if (!respondTo) return;
    setSaving(true);
    try {
      await api.post(`/admin/referrals/${respondTo}/respond`, { response });
      toast('success', 'پاسخ ثبت شد.');
      setRespondTo(null);
      setResponse('');
    } catch (e) {
      toast('error', apiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const corrCols: Column<Corr>[] = [
    { key: 'referenceNo', header: 'شماره نامه', render: (r) => <span className="ltr">{r.referenceNo}</span> },
    { key: 'subject', header: 'موضوع', render: (r) => <span className="fw-600">{r.subject}</span> },
    { key: 'direction', header: 'نوع', render: (r) => (r.direction === 'INCOMING' ? 'وارده' : 'صادره') },
    { key: 'letterDate', header: 'تاریخ', render: (r) => formatJalali(r.letterDate) },
    { key: 'sender', header: 'فرستنده', render: (r) => r.senderOrg ?? r.senderName ?? '—' },
    { key: 'status', header: 'وضعیت', render: (r) => <Badge kind={corrStatusKind(r.status)}>{corrStatus(r.status)}</Badge> },
  ];

  const meetingCols: Column<Meeting>[] = [
    { key: 'title', header: 'عنوان جلسه', render: (r) => <span className="fw-600">{r.title}</span> },
    { key: 'scheduledAt', header: 'زمان', render: (r) => formatJalali(r.scheduledAt) },
    { key: 'location', header: 'محل برگزاری' },
    { key: 'organizer', header: 'دعوت‌کننده', render: (r) => r.organizer?.fullName ?? '—' },
    { key: 'status', header: 'وضعیت', render: (r) => <Badge kind={r.status === 'HELD' ? 'green' : r.status === 'CANCELLED' ? 'red' : 'blue'}>{meetingStatus(r.status)}</Badge> },
  ];

  const surveyCols: Column<Survey>[] = [
    { key: 'title', header: 'عنوان', render: (r) => <span className="fw-600">{r.title}</span> },
    { key: 'questions', header: 'سؤالات', render: (r) => toPersianDigits(r._count?.questions ?? 0) },
    { key: 'responses', header: 'پاسخ‌ها', render: (r) => toPersianDigits(r._count?.responses ?? 0) },
    { key: 'anonymous', header: 'ناشناس', render: (r) => (r.isAnonymous ? 'بله' : 'خیر') },
    { key: 'status', header: 'وضعیت', render: (r) => <Badge kind={r.status === 'OPEN' ? 'green' : 'gray'}>{surveyStatus(r.status)}</Badge> },
  ];

  const suggestionCols: Column<Suggestion>[] = [
    { key: 'title', header: 'عنوان', render: (r) => <span className="fw-600">{r.title}</span> },
    { key: 'category', header: 'دسته' },
    { key: 'responsible', header: 'مسئول', render: (r) => r.responsible?.fullName ?? '—' },
    { key: 'status', header: 'وضعیت', render: (r) => <Badge kind={suggestionKind(r.status)}>{suggestionStatus(r.status)}</Badge> },
  ];

  return (
    <>
      <PageHeader title="امور اداری" subtitle="مکاتبات، جلسات، نظرسنجی و پیشنهادها" />

      <Tabs className="tabs mb">
        <button className={`tab${tab === 'corr' ? ' active' : ''}`} onClick={() => setTab('corr')}>مکاتبات</button>
        <button className={`tab${tab === 'meetings' ? ' active' : ''}`} onClick={() => setTab('meetings')}>جلسات</button>
        <button className={`tab${tab === 'surveys' ? ' active' : ''}`} onClick={() => setTab('surveys')}>نظرسنجی</button>
        <button className={`tab${tab === 'suggestions' ? ' active' : ''}`} onClick={() => setTab('suggestions')}>صندوق پیشنهادها</button>
      </Tabs>

      <Card>
        {tab === 'corr' && (
          <>
            <div className="list-toolbar-wrap">
              <ListToolbar search={corr.search} onSearch={(s) => corr.setSearch(s)}>
                <Select onChange={(e) => corr.setFilter('direction', e.target.value)} style={{ width: 140 }}>
                  <option value="">وارده و صادره</option>
                  <option value="INCOMING">وارده</option>
                  <option value="OUTGOING">صادره</option>
                </Select>
              </ListToolbar>
            </div>
            <DataTable error={corr.error} onRetry={corr.reload} columns={corrCols} rows={corr.rows} loading={corr.loading} />
            <div className="list-pagination-wrap">
              <Pagination pageSize={corr.pageSize} onPageSizeChange={corr.setPageSize} page={corr.page} totalPages={corr.totalPages} total={corr.total} onChange={corr.setPage} />
            </div>
          </>
        )}
        {tab === 'meetings' && (
          <>
            <DataTable error={meetings.error} onRetry={meetings.reload} columns={meetingCols} rows={meetings.rows} loading={meetings.loading} />
            <div className="list-pagination-wrap">
              <Pagination pageSize={meetings.pageSize} onPageSizeChange={meetings.setPageSize} page={meetings.page} totalPages={meetings.totalPages} total={meetings.total} onChange={meetings.setPage} />
            </div>
          </>
        )}
        {tab === 'surveys' && (
          <>
            <DataTable error={surveys.error} onRetry={surveys.reload} columns={surveyCols} rows={surveys.rows} loading={surveys.loading} />
            <div className="list-pagination-wrap">
              <Pagination pageSize={surveys.pageSize} onPageSizeChange={surveys.setPageSize} page={surveys.page} totalPages={surveys.totalPages} total={surveys.total} onChange={surveys.setPage} />
            </div>
          </>
        )}
        {tab === 'suggestions' && (
          <>
            <div className="alert alert-info mb" style={{ margin: '14px 14px 0' }}>
              ارسال پیشنهاد با گزینهٔ ناشناس از طریق دکمهٔ «ثبت پیشنهاد» امکان‌پذیر است.
            </div>
            <DataTable error={suggestions.error} onRetry={suggestions.reload} columns={suggestionCols} rows={suggestions.rows} loading={suggestions.loading} />
            <div className="list-pagination-wrap">
              <Pagination pageSize={suggestions.pageSize} onPageSizeChange={suggestions.setPageSize} page={suggestions.page} totalPages={suggestions.totalPages} total={suggestions.total} onChange={suggestions.setPage} />
            </div>
          </>
        )}
      </Card>

      <Modal
        open={!!respondTo} title="پاسخ به ارجاع" onClose={() => setRespondTo(null)}
        footer={<><Button onClick={submitResponse} loading={saving}>ارسال پاسخ</Button><Button variant="secondary" onClick={() => setRespondTo(null)}>انصراف</Button></>}
      >
        <Textarea value={response} onChange={(e) => setResponse(e.target.value)} placeholder="متن پاسخ…" style={{ minHeight: 120 }} />
      </Modal>
    </>
  );
}

function corrStatus(s: string) {
  const m: Record<string, string> = { REGISTERED: 'ثبت‌شده', IN_PROGRESS: 'در جریان', ANSWERED: 'پاسخ داده‌شده', ARCHIVED: 'بایگانی' };
  return m[s] ?? s;
}
function corrStatusKind(s: string) {
  const m: Record<string, string> = { REGISTERED: 'blue', IN_PROGRESS: 'amber', ANSWERED: 'green', ARCHIVED: 'gray' };
  return m[s] ?? 'gray';
}
function meetingStatus(s: string) {
  const m: Record<string, string> = { PLANNED: 'برنامه‌ریزی‌شده', HELD: 'برگزار شده', CANCELLED: 'لغو شده' };
  return m[s] ?? s;
}
function surveyStatus(s: string) {
  const m: Record<string, string> = { DRAFT: 'پیش‌نویس', OPEN: 'باز', CLOSED: 'بسته', ANALYZED: 'تحلیل‌شده' };
  return m[s] ?? s;
}
function suggestionStatus(s: string) {
  const m: Record<string, string> = { NEW: 'جدید', UNDER_REVIEW: 'در حال بررسی', ACCEPTED: 'پذیرفته‌شده', IMPLEMENTED: 'اجرا شده', REJECTED: 'ردشده' };
  return m[s] ?? s;
}
function suggestionKind(s: string) {
  const m: Record<string, string> = { NEW: 'blue', UNDER_REVIEW: 'amber', ACCEPTED: 'green', IMPLEMENTED: 'green', REJECTED: 'red' };
  return m[s] ?? 'gray';
}
