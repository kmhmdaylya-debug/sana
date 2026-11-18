import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Users, CalendarCheck, Pencil } from 'lucide-react';
import { api, apiErrorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Badge, Button, DataTable, Field, Input, Modal, Select, Textarea, useToast, type Column } from './ui';
import { toPersianDigits } from '../lib/format';

interface Entry {
  employeeId: string; code: string; fullName: string; day: string; timeZone: string; firstIn: string | null;
  status: 'PRESENT' | 'PENDING' | 'ABSENT' | 'LEAVE' | 'MISSION' | 'HOLIDAY';
}
const labels = { PRESENT:'حاضر', PENDING:'ثبت نشده', ABSENT:'غایب', LEAVE:'مرخصی', MISSION:'مأموریت', HOLIDAY:'تعطیل' };
const clock = (value: string | Date, zone: string, locale = 'fa-IR') => new Intl.DateTimeFormat(locale, { timeZone:zone, hour:'2-digit', minute:'2-digit', hourCycle:'h23' }).format(new Date(value));

export default function TeamPresence() {
  const { hasPermission } = useAuth();
  const toast = useToast();
  const [rows, setRows] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<Entry | null>(null);
  const [form, setForm] = useState({ status:'PRESENT', firstIn:'', note:'' });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const canEdit = hasPermission('dashboard.view.management') && hasPermission('attendance.create');
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const config = signal ? { signal } : {};
      const result = await api.get('/dashboard/attendance-today', config);
      if (!signal?.aborted) { setRows(result.data.data ?? []); setError(''); }
    } catch (e) { if (!signal?.aborted) setError(apiErrorMessage(e)); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const refresh = () => { if (!document.hidden) void load(controller.signal); };
    void load(controller.signal);
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener('focus', refresh);
    return () => { controller.abort(); window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [load]);
  const open = (row: Entry) => {
    setEditing(row); setSaveError('');
    setForm({ status:row.status === 'ABSENT' ? 'ABSENT' : 'PRESENT', firstIn:clock(row.firstIn ?? new Date(), row.timeZone, 'en-GB'), note:'' });
  };
  const save = async () => {
    if (!editing || saving) return;
    setSaving(true); setSaveError('');
    try {
      await api.patch(`/attendance/daily/${editing.employeeId}`, { status:form.status, day:editing.day, ...(form.status === 'PRESENT' && form.firstIn ? { firstIn:form.firstIn } : {}), ...(form.note.trim() ? { note:form.note.trim() } : {}) });
      toast('success', 'وضعیت حضور ثبت شد.'); setEditing(null); void load();
    } catch (e) { setSaveError(apiErrorMessage(e)); }
    finally { setSaving(false); }
  };
  const present = rows.filter(row => row.status === 'PRESENT').length;
  const pending = rows.filter(row => row.status === 'PENDING').length;
  const absent = rows.filter(row => row.status === 'ABSENT').length;
  const columns: Column<Entry>[] = [
    { key:'fullName', header:'کارمند', render:row => <span className="fw-600">{row.fullName}</span> },
    { key:'code', header:'کد پرسنلی', render:row => row.code },
    { key:'status', header:'حضور امروز', render:row => <Badge kind={row.status === 'PRESENT' ? 'green' : row.status === 'ABSENT' ? 'red' : 'gray'}>{labels[row.status]}</Badge> },
    { key:'firstIn', header:'ساعت ورود', render:row => row.firstIn ? <time dir="ltr" dateTime={row.firstIn}>{clock(row.firstIn, row.timeZone)}</time> : '—' },
  ];
  return <section className="team-presence mb" aria-labelledby="team-presence-heading">
    <div className="team-presence-header"><h3 id="team-presence-heading"><Users size={18} /> حضور امروز کارکنان</h3><Button variant="outline" size="sm" title="تازه‌سازی حضور" aria-label="تازه‌سازی حضور" disabled={loading} onClick={() => void load()}><RefreshCw size={16} /></Button></div>
    {!error && <div className="team-presence-summary"><span>{toPersianDigits(present)} نفر حاضر</span><span className="text-muted">{toPersianDigits(pending)} نفر ثبت‌نشده</span>{absent > 0 && <span className="text-danger">{toPersianDigits(absent)} نفر غایب</span>}</div>}
    <DataTable error={error} onRetry={() => void load()} columns={columns} rows={rows} loading={loading} {...(canEdit ? { rowActions: (row: Entry) => <Button size="sm" variant="outline" onClick={() => open(row)} aria-label={`ثبت حضور ${row.fullName}`}>{row.status === 'PENDING' ? <CalendarCheck size={14} /> : <Pencil size={14} />}{row.status === 'PENDING' ? 'ثبت حضور' : 'ویرایش'}</Button> } : {})} />
    <Modal open={!!editing} title={`ثبت حضور — ${editing?.fullName ?? ''}`} onClose={() => { if (!saving) setEditing(null); }} width={440} footer={<><Button loading={saving} onClick={save}>ذخیره</Button><Button variant="secondary" disabled={saving} onClick={() => setEditing(null)}>انصراف</Button></>}>
      {saveError && <div className="alert alert-danger" role="alert">{saveError}</div>}
      <div className="col" style={{ gap:16 }}>
        <Field label="وضعیت"><Select value={form.status} onChange={e => setForm(f => ({...f,status:e.target.value}))}><option value="PRESENT">حاضر</option><option value="ABSENT">غایب</option></Select></Field>
        {form.status === 'PRESENT' && <Field label="ساعت ورود"><Input type="time" dir="ltr" value={form.firstIn} onInput={e => { const firstIn=e.currentTarget.value; setForm(f => ({...f,firstIn})); }} onChange={e => setForm(f => ({...f,firstIn:e.target.value}))} /></Field>}
        <Field label="یادداشت"><Textarea maxLength={300} value={form.note} onChange={e => setForm(f => ({...f,note:e.target.value}))} /></Field>
      </div>
    </Modal>
  </section>;
}
