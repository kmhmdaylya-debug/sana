import { useState } from 'react';
import { api, apiErrorMessage, generateReport } from '../lib/api';
import { useList } from '../lib/useList';
import { useAuth } from '../lib/auth';
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
import { formatJalali, statusLabel, badgeKind, CONTRACT_STATUS_LABELS } from '../lib/format';

interface Contract {
  id: string;
  code: string;
  status: string;
  type?: string;
  employee?: { code: string; firstName: string; lastName: string } | null;
  versions?: { version: number; startDate: string; endDate: string }[];
}

export default function Contracts() {
  const toast = useToast();
  const { hasPermission } = useAuth();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const list = useList<Contract>('/contracts');
  void list.search;
  void search;

  const columns: Column<Contract>[] = [
    { key: 'code', header: 'شماره قرارداد', width: 140, render: (r) => <span className="ltr">{r.code ?? r.id.slice(0, 8)}</span> },
    {
      key: 'employee',
      header: 'نیرو',
      render: (r) => (r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : '—'),
    },
    {
      key: 'version',
      header: 'آخرین نسخه',
      render: (r) => r.versions?.[0]?.version ?? '—',
    },
    {
      key: 'endDate',
      header: 'تاریخ پایان',
      render: (r) => (r.versions?.[0]?.endDate ? formatJalali(r.versions[0].endDate) : '—'),
    },
    {
      key: 'status',
      header: 'وضعیت',
      render: (r) => <Badge kind={badgeKind(r.status)}>{statusLabel(r.status)}</Badge>,
    },
  ];

  const expiring = hasPermission('contracts.view') && hasPermission('reports.export') && (
    <Button
      variant="outline"
      onClick={async () => {
        try {
          await generateReport({ reportCode:'contracts.expiring', format:'csv' }, 'contracts-expiring.csv');
        } catch (e) {
          toast('error', apiErrorMessage(e));
        }
      }}
    >
      در حال انقضا
    </Button>
  );

  return (
    <>
      <PageHeader title="قراردادها" subtitle="قراردادهای کاری نیروها و نسخه‌های آن‌ها" actions={expiring} />
      <Card>
        <div className="list-toolbar-wrap">
          <ListToolbar search={list.search} onSearch={(s) => list.setSearch(s)}>
            <Select value={status} onChange={(e) => { setStatus(e.target.value); list.setFilter('status', e.target.value); }} style={{ width: 180 }}>
              <option value="">همهٔ وضعیت‌ها</option>
              {Object.entries(CONTRACT_STATUS_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </Select>
          </ListToolbar>
        </div>
        <DataTable error={list.error} onRetry={list.reload} columns={columns} rows={list.rows} loading={list.loading} />
        <div className="list-pagination-wrap">
          <Pagination pageSize={list.pageSize} onPageSizeChange={list.setPageSize} page={list.page} totalPages={list.totalPages} total={list.total} onChange={list.setPage} />
        </div>
      </Card>
    </>
  );
}
