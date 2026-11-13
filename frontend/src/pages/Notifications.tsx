import { useState } from 'react';
import { CheckCheck } from 'lucide-react';
import { api, apiErrorMessage } from '../lib/api';
import { useList } from '../lib/useList';
import {
  Badge,
  Button,
  Card,
  DataTable,
  ListToolbar,
  PageHeader,
  Pagination,
  Select,
  useToast,
  type Column,
} from '../components/ui';
import { formatJalali, statusLabel, toPersianDigits } from '../lib/format';

interface Notification {
  id: string;
  type: string;
  title: string;
  body?: string;
  isRead: boolean;
  readAt?: string | null;
  createdAt: string;
  link?: string | null;
}

export default function Notifications() {
  const toast = useToast();
  const list = useList<Notification>('/notifications');
  const [onlyUnread, setOnlyUnread] = useState('');

  const markRead = async (id: string) => {
    try {
      await api.post(`/notifications/${id}/read`);
      list.reload();
    } catch (e) {
      toast('error', apiErrorMessage(e));
    }
  };

  const markAll = async () => {
    try {
      await api.post('/notifications/read-all');
      toast('success', 'همهٔ اعلان‌ها خوانده‌شده علامت خوردند.');
      list.reload();
    } catch (e) {
      toast('error', apiErrorMessage(e));
    }
  };

  const cols: Column<Notification>[] = [
    {
      key: 'title',
      header: 'اعلان',
      render: (r) => (
        <div>
          <div className="fw-600" style={{ opacity: r.isRead ? 0.65 : 1 }}>{r.title}</div>
          {r.body && <div className="text-muted text-sm" style={{ whiteSpace: 'pre-wrap' }}>{r.body}</div>}
        </div>
      ),
    },
    { key: 'type', header: 'نوع', render: (r) => statusLabel(r.type) },
    { key: 'createdAt', header: 'زمان', render: (r) => formatJalali(r.createdAt) },
    {
      key: 'isRead',
      header: 'وضعیت',
      width: 110,
      render: (r) => (r.isRead ? <Badge kind="gray">خوانده‌شده</Badge> : <Badge kind="blue">جدید</Badge>),
    },
  ];

  return (
    <>
      <PageHeader
        title="اعلان‌های من"
        subtitle="اعلان‌های سامانه مربوط به شما"
        actions={
          <Button variant="outline" onClick={markAll}>
            <CheckCheck size={15} /> خواندن همه
          </Button>
        }
      />
      <Card>
        <div style={{ padding: '14px 14px 0' }}>
          <ListToolbar onSearch={(s) => list.setSearch(s)}>
            <Select value={onlyUnread} onChange={(e) => { setOnlyUnread(e.target.value); list.setFilter('isRead', e.target.value); }} style={{ width: 170 }}>
              <option value="">همه</option>
              <option value="false">فقط خوانده‌نشده</option>
              <option value="true">فقط خوانده‌شده</option>
            </Select>
          </ListToolbar>
        </div>
        <DataTable
          columns={cols}
          rows={list.rows}
          loading={list.loading}
          rowActions={(r) =>
            !r.isRead ? (
              <Button size="sm" variant="outline" onClick={() => markRead(r.id)}>خوانده شد</Button>
            ) : null
          }
        />
        <div style={{ padding: '0 14px 14px' }}>
          <Pagination page={list.page} totalPages={list.totalPages} total={list.total} onChange={list.setPage} />
        </div>
      </Card>
    </>
  );
}
