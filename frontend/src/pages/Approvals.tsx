import { useState } from 'react';
import { api, apiErrorMessage } from '../lib/api';
import { useList } from '../lib/useList';
import {
  Badge,
  Button,
  Card,
  DataTable,
  PageHeader,
  Pagination,
  useToast,
  type Column,
} from '../components/ui';
import { formatJalali, statusLabel, badgeKind } from '../lib/format';

interface Instance {
  id: string;
  subjectType: string;
  subjectId: string;
  status: string;
  createdAt: string;
}

export default function Approvals() {
  const toast = useToast();
  const inbox = useList<any>('/approvals/inbox');
  const instances = useList<Instance>('/approvals/instances');
  const [saving, setSaving] = useState(false);

  const decide = async (taskId: string, decision: 'APPROVE' | 'REJECT') => {
    setSaving(true);
    try {
      await api.post(`/approvals/tasks/${taskId}/decide`, { decision });
      toast('success', decision === 'APPROVE' ? 'تأیید شد.' : 'رد شد.');
      inbox.reload();
    } catch (e) {
      toast('error', apiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const cols: Column<any>[] = [
    { key: 'instance', header: 'گردش', render: (r) => r.task?.instanceId ?? r.instanceId ?? '—' },
    { key: 'subject', header: 'موضوع', render: (r) => r.task?.instance?.subjectType ?? r.subjectType ?? '—' },
    { key: 'title', header: 'مرحله', render: (r) => r.task?.title ?? r.title ?? '—' },
    { key: 'assigned', header: 'واگذارشده به', render: (r) => r.assignee?.fullName ?? '—' },
    { key: 'createdAt', header: 'تاریخ', render: (r) => formatJalali(r.createdAt ?? r.task?.createdAt) },
    { key: 'status', header: 'وضعیت', render: (r) => <Badge kind={badgeKind(r.status ?? r.task?.status)}>{statusLabel(r.status ?? r.task?.status)}</Badge> },
  ];

  return (
    <>
      <PageHeader title="صندوق تأییدها" subtitle="کارهای در انتظار تصمیم شما" />
      <Card>
        <DataTable error={inbox.error} onRetry={inbox.reload}
          columns={cols}
          rows={inbox.rows}
          loading={inbox.loading}
          rowActions={(r) =>
            (r.status ?? r.task?.status) === 'PENDING' && (r.task?.id || r.id) ? (
              <>
                <Button size="sm" variant="success" loading={saving} onClick={() => decide(r.task?.id ?? r.id, 'APPROVE')}>تأیید</Button>
                <Button size="sm" variant="danger" onClick={() => decide(r.task?.id ?? r.id, 'REJECT')}>رد</Button>
              </>
            ) : null
          }
        />
        <div className="list-pagination-wrap">
          <Pagination pageSize={inbox.pageSize} onPageSizeChange={inbox.setPageSize} page={inbox.page} totalPages={inbox.totalPages} total={inbox.total} onChange={inbox.setPage} />
        </div>
      </Card>

      <div className="mt-lg">
        <Card title="گردش‌های تأیید اخیر">
          <DataTable error={instances.error} onRetry={instances.reload}
            columns={[
              { key: 'subjectType', header: 'موضوع' },
              { key: 'status', header: 'وضعیت', render: (r: any) => <Badge kind={badgeKind(r.status)}>{statusLabel(r.status)}</Badge> },
              { key: 'createdAt', header: 'تاریخ', render: (r: any) => formatJalali(r.createdAt) },
            ]}
            rows={instances.rows}
            loading={instances.loading}
            emptyMessage="گردشی ثبت نشده است."
          />
        </Card>
      </div>
    </>
  );
}
