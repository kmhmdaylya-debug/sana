import { useCallback, useEffect, useRef, useState } from 'react';
import { CalendarDays, CheckCircle2, Clock } from 'lucide-react';
import { api, apiErrorMessage } from '../lib/api';
import { Button } from './ui';

interface DailyStatus {
  day: string;
  timeZone: string;
  serverNow: string;
  status: 'PRESENT' | 'PENDING' | 'HOLIDAY' | 'LEAVE' | 'MISSION';
  firstIn: string | null;
  canConfirm: boolean;
}

export default function DailyAttendance({ attendance = true }: { attendance?: boolean }) {
  const [now, setNow] = useState(() => Date.now());
  const [zone, setZone] = useState('Asia/Tehran');
  const [status, setStatus] = useState<DailyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const offset = useRef(0);
  const request = useRef<AbortController | null>(null);
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);

  const apply = useCallback((data: DailyStatus) => {
    offset.current = new Date(data.serverNow).getTime() - Date.now();
    setNow(Date.now() + offset.current);
    setZone(data.timeZone);
    setStatus(data);
    setError('');
  }, []);

  const load = useCallback(async (showLoading = true) => {
    if (!attendance) { setLoading(false); return; }
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    if (showLoading) setLoading(true);
    try {
      const response = await api.get('/attendance/daily', { signal: controller.signal });
      if (!controller.signal.aborted) apply(response.data.data);
    } catch (e) {
      if (!controller.signal.aborted) setError(apiErrorMessage(e));
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [apply, attendance]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now() + offset.current), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    void load();
    return () => request.current?.abort();
  }, [day, load]);

  useEffect(() => {
    const refresh = () => { if (!document.hidden) void load(false); };
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [load]);

  const dateText = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { timeZone: zone, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).format(now);
  const timeText = new Intl.DateTimeFormat('fa-IR', { timeZone: zone, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(now);
  const labels = { PRESENT: 'ورود امروز ثبت شد', PENDING: 'ورود امروز ثبت نشده', HOLIDAY: 'روز تعطیل', LEAVE: 'مرخصی تأییدشده', MISSION: 'مأموریت تأییدشده' };

  return <>
    <div className="employee-day-bar">
      <span className="employee-day-date"><CalendarDays size={17} />{dateText}</span>
      <time className="employee-day-time" dateTime={new Date(now).toISOString()}><Clock size={16} /><span dir="ltr">{timeText}</span></time>
      {attendance && <div className="employee-day-presence">
        {error ? <Button size="sm" variant="outline" onClick={() => void load()}>تلاش دوباره</Button> : loading ? <span className="text-muted text-xs">در حال بررسی ورود...</span> : status ? <span className={`employee-day-status${status.status === 'PRESENT' ? ' is-present' : ''}`}><CheckCircle2 size={16} />{labels[status.status]}</span> : null}
      </div>}
    </div>
    {error && <div className="alert alert-danger" role="alert">{error}</div>}
  </>;
}
