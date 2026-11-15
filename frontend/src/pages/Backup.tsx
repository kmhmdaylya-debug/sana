import { useState } from 'react';
import { DatabaseBackup, Download, Play } from 'lucide-react';
import { api, apiErrorMessage, downloadFile } from '../lib/api';
import { useList } from '../lib/useList';
import { useAuth } from '../lib/auth';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  PageHeader,
  Pagination,
  useToast,
  type Column,
} from '../components/ui';
import { formatJalali, toPersianDigits } from '../lib/format';

interface BackupRow {
  id: string;
  createdAt: string;
  status: string;
  sizeBytes?: bigint | number;
  durationMs?: number;
  createdBy?: { fullName: string } | null;
  note?: string;
}

export default function Backup() {
  const toast = useToast();
  const { user } = useAuth();
  const list = useList<BackupRow>('/backup/history');
  const [confirmRun, setConfirmRun] = useState(false);
  const [running, setRunning] = useState(false);

  const runBackup = async () => {
    setRunning(true);
    try {
      await api.post('/backup/run');
      toast('success', 'پشتیبان‌گیری انجام شد.');
      setConfirmRun(false);
      list.reload();
    } catch (e) {
      toast('error', apiErrorMessage(e));
    } finally {
      setRunning(false);
    }
  };

  const download = (row: BackupRow) => {
    downloadFile(`/backup/${row.id}`, `backup-${row.id}.sql`).catch((e) => toast('error', apiErrorMessage(e)));
  };

  const sizeLabel = (bytes?: bigint | number) => {
    if (!bytes) return '—';
    const mb = Number(bytes) / (1024 * 1024);
    if (mb >= 1) return `${toPersianDigits(mb.toFixed(1))} مگابایت`;
    const kb = Number(bytes) / 1024;
    return `${toPersianDigits(kb.toFixed(0))} کیلوبایت`;
  };

  const cols: Column<BackupRow>[] = [
    { key: 'createdAt', header: 'زمان ایجاد', render: (r) => formatJalali(r.createdAt) },
    { key: 'createdBy', header: 'ایجادکننده', render: (r) => r.createdBy?.fullName ?? 'سیستم' },
    { key: 'size', header: 'حجم', render: (r) => sizeLabel(r.sizeBytes) },
    { key: 'duration', header: 'مدت', render: (r) => (r.durationMs ? `${toPersianDigits(Math.round(r.durationMs / 1000))} ثانیه` : '—') },
    {
      key: 'status',
      header: 'وضعیت',
      render: (r) => (
        <Badge kind={r.status === 'COMPLETED' || r.status === 'SUCCESS' ? 'green' : r.status === 'FAILED' ? 'red' : 'amber'}>
          {r.status === 'COMPLETED' || r.status === 'SUCCESS' ? 'موفق' : r.status === 'FAILED' ? 'ناموفق' : 'در جریان'}
        </Badge>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="پشتیبان‌گیری"
        subtitle="تهیهٔ نسخهٔ پشتیبان از پایگاه داده و دانلود آن"
        actions={
          user?.isSuperAdmin && (
            <Button onClick={() => setConfirmRun(true)}>
              <Play size={15} /> اجرای پشتیبان‌گیری
            </Button>
          )
        }
      />

      <Card>
        <div className="alert alert-info mb" style={{ margin: '14px 14px 0' }}>
          <DatabaseBackup size={15} style={{ verticalAlign: 'middle' }} /> پیشنهاد می‌شود روزانه یک نسخهٔ پشتیبان تهیه و خارج از سرور نگهداری شود.
        </div>
        <DataTable error={list.error} onRetry={list.reload}
          columns={cols}
          rows={list.rows}
          loading={list.loading}
          emptyMessage="هنوز نسخهٔ پشتیبانی تهیه نشده است."
          rowActions={(r) =>
            r.status === 'COMPLETED' || r.status === 'SUCCESS' ? (
              <Button size="sm" variant="outline" onClick={() => download(r)}>
                <Download size={13} /> دانلود
              </Button>
            ) : null
          }
        />
        <div className="list-pagination-wrap">
          <Pagination pageSize={list.pageSize} onPageSizeChange={list.setPageSize} page={list.page} totalPages={list.totalPages} total={list.total} onChange={list.setPage} />
        </div>
      </Card>

      <ConfirmDialog
        open={confirmRun}
        title="اجرای پشتیبان‌گیری"
        message="یک نسخهٔ پشتیبان کامل از پایگاه داده تهیه شود؟"
        confirmLabel="اجرا"
        loading={running}
        onConfirm={runBackup}
        onClose={() => setConfirmRun(false)}
      />
    </>
  );
}
