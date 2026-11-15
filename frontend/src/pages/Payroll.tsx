import { useState } from 'react';
import { api, apiErrorMessage, downloadReport } from '../lib/api';
import { useList, useItem } from '../lib/useList';
import { useAuth } from '../lib/auth';
import {
  Badge,
  Button,
  Card,
  DataTable,
  PageHeader,
  Pagination,
  Modal,
  useToast,
  type Column,
} from '../components/ui';
import { formatJalali, formatRial, statusLabel, badgeKind, toPersianDigits } from '../lib/format';

interface Period {
  id: string;
  year: number;
  month: number;
  status: string;
  employeeCount?: number;
  totalGross?: bigint | number;
  totalNet?: bigint | number;
}

export default function Payroll() {
  const toast = useToast();
  const { hasPermission } = useAuth();
  const periods = useList<Period>('/payroll/periods');
  const [payslipPeriod, setPayslipPeriod] = useState<string | null>(null);

  const canManage = hasPermission('payroll.create');
  const canReview = hasPermission('payroll.review');
  const canApprove = hasPermission('payroll.approve');
  const canPublish = hasPermission('payroll.publish');

  const transition = async (id: string, action: 'generate' | 'review' | 'lock' | 'publish') => {
    try {
      await api.post(`/payroll/periods/${id}/${action}`);
      toast('success', 'عملیات انجام شد.');
      periods.reload();
    } catch (e) {
      toast('error', apiErrorMessage(e));
    }
  };

  const cols: Column<Period>[] = [
    { key: 'period', header: 'دوره', render: (r) => <span className="fw-600">{toPersianDigits(r.year)}/{toPersianDigits(String(r.month).padStart(2, '0'))}</span> },
    { key: 'employees', header: 'نیروها', render: (r) => toPersianDigits(r.employeeCount ?? 0) },
    { key: 'gross', header: 'ناخالص', render: (r) => (r.totalGross ? formatRial(Number(r.totalGross)) : '—') },
    { key: 'net', header: 'خالص', render: (r) => (r.totalNet ? formatRial(Number(r.totalNet)) : '—') },
    { key: 'status', header: 'وضعیت', render: (r) => <Badge kind={badgeKind(r.status)}>{statusLabel(r.status)}</Badge> },
  ];

  return (
    <>
      <PageHeader title="حقوق و دستمزد" subtitle="دوره‌های حقوق، فیش حقوقی و انتشار" />
      <Card>
        <DataTable error={periods.error} onRetry={periods.reload}
          columns={cols}
          rows={periods.rows}
          loading={periods.loading}
          rowActions={(r) => (
            <>
              <Button size="sm" variant="outline" onClick={() => setPayslipPeriod(r.id)}>فیش‌ها</Button>
              {canManage && r.status === 'DRAFT' && <Button size="sm" onClick={() => transition(r.id, 'generate')}>محاسبه</Button>}
              {canReview && r.status === 'GENERATED' && <Button size="sm" onClick={() => transition(r.id, 'review')}>بررسی</Button>}
              {canApprove && r.status === 'REVIEWED' && <Button size="sm" onClick={() => transition(r.id, 'lock')}>قفل</Button>}
              {canPublish && r.status === 'LOCKED' && <Button size="sm" variant="success" onClick={() => transition(r.id, 'publish')}>انتشار</Button>}
              {hasPermission('payroll.export') && (
                <Button size="sm" variant="outline" onClick={() => downloadReport(`/payroll/periods/${r.id}/report?format=csv`, `payroll-${r.year}-${r.month}.csv`).catch((e) => toast('error', apiErrorMessage(e)))}>
                  خروجی
                </Button>
              )}
            </>
          )}
        />
        <div className="list-pagination-wrap">
          <Pagination pageSize={periods.pageSize} onPageSizeChange={periods.setPageSize} page={periods.page} totalPages={periods.totalPages} total={periods.total} onChange={periods.setPage} />
        </div>
      </Card>

      {payslipPeriod && <Payslips periodId={payslipPeriod} onClose={() => setPayslipPeriod(null)} />}
    </>
  );
}

function Payslips({ periodId, onClose }: { periodId: string; onClose: () => void }) {
  const list = useList<any>(`/payroll/periods/${periodId}/payslips`);
  const [detailId, setDetailId] = useState<string | null>(null);

  const cols: Column<any>[] = [
    { key: 'employee', header: 'نیرو', render: (r) => (r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : '—') },
    { key: 'gross', header: 'ناخالص', render: (r) => formatRial(Number(r.grossPay ?? r.totalGross ?? 0)) },
    { key: 'deductions', header: 'کسورات', render: (r) => formatRial(Number(r.totalDeductions ?? 0)) },
    { key: 'net', header: 'خالص', render: (r) => formatRial(Number(r.netPay ?? r.totalNet ?? 0)) },
    { key: 'status', header: 'وضعیت', render: (r) => <Badge kind={badgeKind(r.status)}>{statusLabel(r.status)}</Badge> },
  ];

  return (
    <>
      <Modal open title="فیش‌های حقوقی دوره" onClose={onClose} width={820}>
        <DataTable error={list.error} onRetry={list.reload} columns={cols} rows={list.rows} loading={list.loading} rowActions={(r) => (
          <Button size="sm" variant="outline" onClick={() => setDetailId(r.id)}>جزئیات</Button>
        )} />
        <Pagination pageSize={list.pageSize} onPageSizeChange={list.setPageSize} page={list.page} totalPages={list.totalPages} total={list.total} onChange={list.setPage} />
      </Modal>
      {detailId && <PayslipDetail id={detailId} onClose={() => setDetailId(null)} />}
    </>
  );
}

function PayslipDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const { item: slip, loading } = useItem<any>(`/payroll/payslips/${id}`);
  if (loading) return <Modal open title="فیش حقوقی" onClose={onClose}><div className="skeleton" style={{ height: 180 }} /></Modal>;
  if (!slip) return <Modal open title="فیش حقوقی" onClose={onClose}><div className="alert alert-danger">یافت نشد.</div></Modal>;

  const lines = slip.lines ?? [];
  return (
    <Modal open title={`فیش حقوقی ${slip.employee ? `${slip.employee.firstName} ${slip.employee.lastName}` : ''}`} onClose={onClose} width={680}>
      <DataTable
        rows={lines}
        columns={[
          { key: 'name', header: 'سطر', render: (r: any) => r.title ?? r.componentName ?? '—' },
          { key: 'type', header: 'نوع', render: (r: any) => (r.kind === 'DEDUCTION' || r.type === 'DEDUCTION' ? 'کسور' : 'حقوق و مزایا') },
          { key: 'amount', header: 'مبلغ', render: (r: any) => formatRial(Number(r.amount ?? 0)) },
        ]}
        emptyMessage="سطری ثبت نشده است."
      />
      <div className="divider" />
      <div className="flex-between">
        <span className="fw-700">خالص پرداختی</span>
        <span className="fw-800 text-success">{formatRial(Number(slip.netPay ?? slip.totalNet ?? 0))}</span>
      </div>
    </Modal>
  );
}
