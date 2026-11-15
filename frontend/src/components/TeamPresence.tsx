import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Users } from 'lucide-react';
import { api, apiErrorMessage } from '../lib/api';
import { Badge, Button, DataTable, type Column } from './ui';
import { toPersianDigits } from '../lib/format';

interface Entry {
  employeeId: string;
  code: string;
  fullName: string;
  day: string;
  timeZone: string;
  firstIn: string | null;
  status: 'PRESENT' | 'PENDING';
}

export default function TeamPresence() {
  const [rows, setRows] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const result = await api.get('/dashboard/attendance-today', { signal });
      if (!signal?.aborted) { setRows(result.data.data ?? []); setError(''); }
    } catch (e) {
      if (!signal?.aborted) setError(apiErrorMessage(e));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const refresh = () => { if (!document.hidden) void load(controller.signal); };
    void load(controller.signal);
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener('focus', refresh);
    return () => { controller.abort(); window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [load]);
  const present = rows.filter((row) => row.status === 'PRESENT').length;
  const columns: Column<Entry>[] = [
    { key: 'fullName', header: 'کارمند', render: (row) => <span className="fw-600">{row.fullName}</span> },
    { key: 'code', header: 'کد پرسنلی', render: (row) => row.code },
    { key: 'status', header: 'ورود امروز', render: (row) => <Badge kind={row.status === 'PRESENT' ? 'green' : 'gray'}>{row.status === 'PRESENT' ? 'وارد شده' : 'هنوز وارد نشده'}</Badge> },
    { key: 'firstIn', header: 'اولین ورود', render: (row) => row.firstIn ? <time dir="ltr" dateTime={row.firstIn}>{new Intl.DateTimeFormat('fa-IR', { timeZone: row.timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(row.firstIn))}</time> : '—' },
  ];
  return <section className="team-presence mb" aria-labelledby="team-presence-heading">
    <div className="team-presence-header">
      <h3 id="team-presence-heading"><Users size={18} /> ورود امروز کارکنان</h3>
      <Button variant="outline" size="sm" title="تازه‌سازی وضعیت ورود" aria-label="تازه‌سازی وضعیت ورود" disabled={loading} onClick={() => void load()}><RefreshCw size={16} /></Button>
    </div>
    {!error && <div className="team-presence-summary"><span>{toPersianDigits(present)} نفر وارد شده‌اند</span><span className="text-muted">{toPersianDigits(rows.length - present)} نفر هنوز وارد نشده‌اند</span></div>}
    {error ? <div className="alert alert-danger" role="alert">{error}</div> : <DataTable columns={columns} rows={rows} loading={loading} />}
  </section>;
}
