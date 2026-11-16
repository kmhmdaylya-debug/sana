import { useState } from 'react';
import { Download, Play, RotateCcw } from 'lucide-react';
import { api, apiErrorMessage, downloadFile } from '../lib/api';
import { useList } from '../lib/useList';
import { useAuth } from '../lib/auth';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  Field,
  Input,
  Modal,
  PageHeader,
  Pagination,
  useToast,
  type Column,
} from '../components/ui';
import { formatJalali, toPersianDigits } from '../lib/format';

interface BackupRow {
  id: string;
  fileName: string;
  startedAt: string;
  finishedAt?: string;
  result: string;
  size?: number;
  createdBy?: { fullName: string } | null;
  note?: string;
}

export default function Backup() {
  const toast = useToast();
  const { user } = useAuth();
  const list = useList<BackupRow>('/backup/history');
  const [confirmRun, setConfirmRun] = useState(false);
  const [running, setRunning] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [restoreRow, setRestoreRow] = useState<BackupRow | null>(null);
  const [restoreForm, setRestoreForm] = useState({ currentPassword: '', confirmationDatabase: '' });
  const [restoring, setRestoring] = useState(false);

  const runBackup = async () => {
    if (running) return;
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

  const download = async (row: BackupRow) => {
    if (downloading) return;
    setDownloading(row.id);
    try { await downloadFile(`/backup/${row.id}/download`, row.fileName); }
    catch (error) { toast('error', apiErrorMessage(error)); }
    finally { setDownloading(null); }
  };

  const restore = async () => {
    if (!restoreRow || restoring) return;
    setRestoring(true);
    try {
      await api.post('/backup/restore', { backupId: restoreRow.id, ...restoreForm }, { timeout: 300000 });
      toast('success', 'بازیابی در دیتابیس مجزا انجام شد.');
      setRestoreRow(null);
      setRestoreForm({ currentPassword: '', confirmationDatabase: '' });
      list.reload();
    } catch (error) { toast('error', apiErrorMessage(error)); }
    finally { setRestoring(false); }
  };

  const sizeLabel = (bytes?: bigint | number) => {
    if (!bytes) return '—';
    const mb = Number(bytes) / (1024 * 1024);
    if (mb >= 1) return `${toPersianDigits(mb.toFixed(1))} مگابایت`;
    const kb = Number(bytes) / 1024;
    return `${toPersianDigits(kb.toFixed(0))} کیلوبایت`;
  };

  const cols: Column<BackupRow>[] = [
    { key: 'startedAt', header: 'زمان ایجاد', render: (r) => formatJalali(r.startedAt) },
    { key: 'createdBy', header: 'ایجادکننده', render: (r) => r.createdBy?.fullName ?? 'سیستم' },
    { key: 'size', header: 'حجم', render: (r) => sizeLabel(r.size) },
    { key: 'duration', header: 'مدت', render: (r) => (r.finishedAt ? `${toPersianDigits(Math.max(0, Math.round((Date.parse(r.finishedAt) - Date.parse(r.startedAt)) / 1000)))} ثانیه` : '—') },
    {
      key: 'status',
      header: 'وضعیت',
      render: (r) => (
        <Badge kind={r.result === 'SUCCESS' ? 'green' : 'red'}>
          {r.result === 'SUCCESS' ? 'موفق' : 'ناموفق'}
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
        <DataTable error={list.error} onRetry={list.reload}
          columns={cols}
          rows={list.rows}
          loading={list.loading}
          emptyMessage="هنوز نسخهٔ پشتیبانی تهیه نشده است."
          rowActions={(r) =>
            user?.isSuperAdmin && r.result === 'SUCCESS' && r.fileName.endsWith('.pgdump.enc') ? (
              <>
                <Button size="sm" variant="outline" title="دانلود پشتیبان" aria-label="دانلود پشتیبان" disabled={!!downloading} loading={downloading === r.id} onClick={() => void download(r)}><Download size={15} /></Button>
                <Button size="sm" variant="outline" title="بازیابی در دیتابیس مجزا" aria-label="بازیابی در دیتابیس مجزا" onClick={() => setRestoreRow(r)}><RotateCcw size={15} /></Button>
              </>
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
      <Modal open={!!restoreRow} title="بازیابی در دیتابیس مجزا" onClose={() => { if (!restoring) { setRestoreRow(null); setRestoreForm({ currentPassword: '', confirmationDatabase: '' }); } }} footer={<Button onClick={() => void restore()} loading={restoring} disabled={!restoreForm.currentPassword || !restoreForm.confirmationDatabase}><RotateCcw size={15} /> بازیابی</Button>}>
        <div className="form-grid">
          <Field label="نام دیتابیس مقصد" required><Input className="ltr" value={restoreForm.confirmationDatabase} onChange={event => setRestoreForm(form => ({ ...form, confirmationDatabase: event.target.value }))} /></Field>
          <Field label="گذرواژه فعلی مدیر ارشد" required><Input type="password" autoComplete="current-password" value={restoreForm.currentPassword} onChange={event => setRestoreForm(form => ({ ...form, currentPassword: event.target.value }))} /></Field>
        </div>
      </Modal>
    </>
  );
}
