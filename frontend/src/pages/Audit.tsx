import { apiErrorMessage } from '../lib/api';
import { useList } from '../lib/useList';
import {
  Badge,
  Card,
  DataTable,
  ListToolbar,
  PageHeader,
  Pagination,
  Select,
  type Column,
} from '../components/ui';
import { formatJalali, toPersianDigits } from '../lib/format';

interface AuditRow {
  id: string;
  action: string;
  entity: string;
  entityId?: string;
  createdAt: string;
  ip?: string;
  summary?: string;
  actor?: { fullName: string } | null;
  actorId?: string;
}

const ACTIONS = [
  { v: 'CREATE', l: 'ایجاد' },
  { v: 'UPDATE', l: 'ویرایش' },
  { v: 'DELETE', l: 'حذف' },
  { v: 'LOGIN', l: 'ورود' },
  { v: 'LOGOUT', l: 'خروج' },
  { v: 'APPROVE', l: 'تأیید' },
  { v: 'REJECT', l: 'رد' },
  { v: 'CANCEL', l: 'لغو' },
  { v: 'VIEW_SENSITIVE', l: 'مشاهدهٔ اطلاعات حساس' },
  { v: 'EXPORT', l: 'خروجی' },
  { v: 'BACKUP', l: 'پشتیبان' },
  { v: 'SETTINGS_CHANGE', l: 'تغییر تنظیمات' },
];

function actionInfo(a: string): { label: string; kind: string } {
  const f = ACTIONS.find((x) => x.v === a);
  const label = f?.l ?? a;
  let kind = 'gray';
  if (a === 'CREATE' || a === 'APPROVE' || a === 'LOGIN') kind = 'green';
  else if (a === 'DELETE' || a === 'REJECT' || a === 'VIEW_SENSITIVE') kind = 'red';
  else if (a === 'UPDATE' || a === 'EXPORT' || a === 'SETTINGS_CHANGE') kind = 'amber';
  else if (a === 'BACKUP') kind = 'sky';
  return { label, kind };
}

export default function Audit() {
  const list = useList<AuditRow>('/audit-log');

  const cols: Column<AuditRow>[] = [
    { key: 'createdAt', header: 'زمان', width: 150, render: (r) => formatJalali(r.createdAt) },
    {
      key: 'action',
      header: 'عملیات',
      width: 150,
      render: (r) => {
        const a = actionInfo(r.action);
        return <Badge kind={a.kind}>{a.label}</Badge>;
      },
    },
    { key: 'actor', header: 'کاربر', render: (r) => r.actor?.fullName ?? '—' },
    { key: 'entity', header: 'موجودیت', render: (r) => r.entity ?? '—' },
    { key: 'entityId', header: 'شناسه', render: (r) => (r.entityId ? <span className="ltr text-xs">{r.entityId.slice(0, 8)}…</span> : '—') },
    { key: 'ip', header: 'IP', render: (r) => (r.ip ? <span className="ltr">{r.ip}</span> : '—') },
    { key: 'summary', header: 'شرح', render: (r) => r.summary ?? '—' },
  ];

  return (
    <>
      <PageHeader title="لاگ ممیزی" subtitle={`ثبت کامل رخدادهای حساس سامانه — ${toPersianDigits(list.total)} رکورد`} />
      <Card>
        <div className="list-toolbar-wrap">
          <ListToolbar search={list.search} onSearch={(s) => list.setSearch(s)}>
            <Select onChange={(e) => list.setFilter('action', e.target.value)} style={{ width: 200 }}>
              <option value="">همهٔ عملیات</option>
              {ACTIONS.map((a) => (
                <option key={a.v} value={a.v}>{a.l}</option>
              ))}
            </Select>
          </ListToolbar>
        </div>
        <DataTable error={list.error} onRetry={list.reload} columns={cols} rows={list.rows} loading={list.loading} emptyMessage="رخدادی ثبت نشده است." />
        <div className="list-pagination-wrap">
          <Pagination pageSize={list.pageSize} onPageSizeChange={list.setPageSize} page={list.page} totalPages={list.totalPages} total={list.total} onChange={list.setPage} />
        </div>
      </Card>
    </>
  );
}
