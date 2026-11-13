import { useEffect, useState } from 'react';
import { Download, Play } from 'lucide-react';
import { api, apiErrorMessage, downloadFile } from '../lib/api';
import { getDefaultCompanyId } from '../lib/org';
import { useList } from '../lib/useList';
import {
  Badge,
  Button,
  Card,
  DataTable,
  Field,
  Input,
  PageHeader,
  Pagination,
  Select,
  useToast,
  type Column,
} from '../components/ui';
import { formatJalali, statusLabel, badgeKind, toPersianDigits } from '../lib/format';

interface Definition {
  code: string;
  title: string;
  description?: string;
  needsDateRange?: boolean;
  needsMonth?: boolean;
  needsCompanyId?: boolean;
}

interface Run {
  id: string;
  reportCode: string;
  format: string;
  status: string;
  rowCount?: number;
  createdAt: string;
}

/** دانلود خروجی گزارش با POST (سرور فایل را مستقیم برمی‌گرداند) */
async function runReportDownload(body: Record<string, unknown>, fallbackName: string) {
  const r = await api.post('/reports/run', body, { responseType: 'blob' });
  const blob = new Blob([r.data as ArrayBuffer]);
  const cd = String(r.headers?.['content-disposition'] ?? '');
  const m = /filename="(.+?)"/.exec(cd);
  let name = fallbackName;
  if (m) name = decodeURIComponent(m[1]);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Reports() {
  const toast = useToast();
  const [defs, setDefs] = useState<Definition[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [format, setFormat] = useState<'csv' | 'xlsx'>('csv');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [year, setYear] = useState('');
  const [month, setMonth] = useState('');
  const [running, setRunning] = useState(false);
  const runs = useList<Run>('/reports/runs');

  useEffect(() => {
    let active = true;
    api
      .get('/reports/definitions')
      .then((r) => {
        const items: Definition[] = Array.isArray(r?.data?.data) ? r.data.data : r?.data?.data?.items ?? [];
        if (active) setDefs(items);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const def = defs.find((d) => d.code === selected);

  const run = async () => {
    if (!def) {
      toast('warning', 'ابتدا یک گزارش انتخاب کنید.');
      return;
    }
    setRunning(true);
    try {
      const body: Record<string, unknown> = { reportCode: def.code, format };
      if (def.needsDateRange) {
        if (from) body.from = from;
        if (to) body.to = to;
      }
      if (def.needsMonth) {
        if (year) body.year = Number(year);
        if (month) body.month = Number(month);
      }
      if (def.needsCompanyId) {
        const cid = await getDefaultCompanyId();
        if (cid) body.companyId = cid;
      }
      await runReportDownload(body, `${def.code}-${new Date().toISOString().slice(0, 10)}.${format}`);
      toast('success', 'گزارش اجرا و دانلود شد.');
      runs.reload();
    } catch (e: any) {
      // اگر پاسخ blob خطای JSON است، پیام را استخراج کن
      let msg = '';
      if (e?.response?.data instanceof Blob) {
        try {
          const text = await (e.response.data as Blob).text();
          msg = JSON.parse(text)?.message ?? '';
        } catch { /* ignore */ }
      }
      toast('error', msg || apiErrorMessage(e));
    } finally {
      setRunning(false);
    }
  };

  const runCols: Column<Run>[] = [
    { key: 'reportCode', header: 'گزارش', render: (r) => defs.find((d) => d.code === r.reportCode)?.title ?? r.reportCode },
    { key: 'format', header: 'فرمت', render: (r) => r.format.toUpperCase() },
    { key: 'rows', header: 'تعداد سطر', render: (r) => (r.rowCount != null ? toPersianDigits(r.rowCount) : '—') },
    { key: 'createdAt', header: 'زمان اجرا', render: (r) => formatJalali(r.createdAt) },
    { key: 'status', header: 'وضعیت', render: (r) => <Badge kind={badgeKind(r.status === 'SUCCEEDED' ? 'COMPLETED' : r.status === 'FAILED' ? 'REJECTED' : 'PENDING')}>{statusLabel(r.status === 'SUCCEEDED' ? 'COMPLETED' : r.status === 'FAILED' ? 'REJECTED' : 'PENDING')}</Badge> },
  ];

  return (
    <>
      <PageHeader title="گزارش‌ها" subtitle="گزارش‌های استاندارد سازمان و تاریخچهٔ اجرا" />

      <Card title="اجرای گزارش" subtitle="گزارش را انتخاب و خروجی بگیرید">
        <div className="col" style={{ gap: 14 }}>
          <div className="form-grid">
            <Field label="گزارش" required>
              <Select value={selected} onChange={(e) => setSelected(e.target.value)}>
                <option value="">— انتخاب گزارش —</option>
                {defs.map((d) => (
                  <option key={d.code} value={d.code}>{d.title}</option>
                ))}
              </Select>
            </Field>
            <Field label="فرمت خروجی">
              <Select value={format} onChange={(e) => setFormat(e.target.value as 'csv' | 'xlsx')}>
                <option value="csv">CSV</option>
                <option value="xlsx">Excel (XLSX)</option>
              </Select>
            </Field>
          </div>

          {def?.description && <div className="alert alert-info">{def.description}</div>}

          {(def?.needsDateRange || def?.needsMonth) && (
            <div className="form-grid">
              {def.needsDateRange && (
                <>
                  <Field label="از تاریخ (میلادی)"><Input className="ltr" value={from} onChange={(e) => setFrom(e.target.value)} placeholder="2026-01-01" /></Field>
                  <Field label="تا تاریخ (میلادی)"><Input className="ltr" value={to} onChange={(e) => setTo(e.target.value)} placeholder="2026-12-31" /></Field>
                </>
              )}
              {def.needsMonth && (
                <>
                  <Field label="سال جلالی" hint="مثلاً ۱۴۰۴"><Input className="ltr" value={year} onChange={(e) => setYear(e.target.value)} placeholder="1404" /></Field>
                  <Field label="ماه جلالی (۱ تا ۱۲)"><Input className="ltr" value={month} onChange={(e) => setMonth(e.target.value)} placeholder="1" /></Field>
                </>
              )}
            </div>
          )}

          <div>
            <Button onClick={run} loading={running}>
              <Play size={15} /> اجرا و دانلود
            </Button>
          </div>
        </div>
      </Card>

      <div className="mt-lg">
        <Card title="تاریخچهٔ اجرای گزارش‌ها">
          <DataTable columns={runCols} rows={runs.rows} loading={runs.loading} emptyMessage="هنوز گزارشی اجرا نشده است." />
          <div style={{ padding: '0 14px 14px' }}>
            <Pagination page={runs.page} totalPages={runs.totalPages} total={runs.total} onChange={runs.setPage} />
          </div>
        </Card>
      </div>
    </>
  );
}
