import { useState } from 'react';
import { api, apiErrorMessage } from '../lib/api';
import { useList } from '../lib/useList';
import { useAuth } from '../lib/auth';
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
import { formatJalali, statusLabel, badgeKind, toPersianDigits } from '../lib/format';

interface EvalRec {
  id: string;
  status: string;
  finalScore?: number | null;
  employee?: { firstName: string; lastName: string } | null;
  form?: { title: string } | null;
  cycle?: { title: string } | null;
}

export default function Evaluations() {
  const toast = useToast();
  const { hasPermission } = useAuth();
  const list = useList<EvalRec>('/evaluations');
  const canRate = hasPermission('evaluations.rate');
  const canApprove = hasPermission('evaluations.approve');

  const act = async (id: string, action: 'self-assess' | 'finalize') => {
    try {
      await api.post(`/evaluations/${id}/${action}`);
      toast('success', 'عملیات انجام شد.');
      list.reload();
    } catch (e) {
      toast('error', apiErrorMessage(e));
    }
  };

  const cols: Column<EvalRec>[] = [
    { key: 'employee', header: 'نیرو', render: (r) => (r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : '—') },
    { key: 'form', header: 'فرم', render: (r) => r.form?.title ?? '—' },
    { key: 'cycle', header: 'دورهٔ ارزیابی', render: (r) => r.cycle?.title ?? '—' },
    { key: 'finalScore', header: 'امتیاز نهایی', render: (r) => (r.finalScore != null ? toPersianDigits(r.finalScore) : '—') },
    { key: 'status', header: 'وضعیت', render: (r) => <Badge kind={badgeKind(r.status)}>{statusLabel(r.status)}</Badge> },
  ];

  return (
    <>
      <PageHeader title="ارزیابی عملکرد" subtitle="فرم‌ها، دوره‌ها و ارزیابی‌ها" />
      <Card>
        <DataTable
          columns={cols}
          rows={list.rows}
          loading={list.loading}
          rowActions={(r) =>
            canRate && (r.status === 'IN_PROGRESS' || r.status === 'PENDING_SELF') ? (
              <Button size="sm" variant="outline" onClick={() => act(r.id, 'self-assess')}>خودارزیابی</Button>
            ) : canApprove && r.status === 'PENDING_FINALIZE' ? (
              <Button size="sm" variant="success" onClick={() => act(r.id, 'finalize')}>نهایی‌سازی</Button>
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
