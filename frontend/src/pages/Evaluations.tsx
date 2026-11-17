import { useEffect, useState } from 'react';
import { Check, ClipboardCheck, Eye, Save } from 'lucide-react';
import { api, apiErrorMessage } from '../lib/api';
import { useList, useItem } from '../lib/useList';
import { useAuth } from '../lib/auth';
import { Badge, Button, Card, DataTable, Field, Input, Modal, PageHeader, Pagination, Textarea, useToast, type Column } from '../components/ui';
import { statusLabel, badgeKind, toPersianDigits } from '../lib/format';

interface EvalRec {
  id: string; employeeId: string; evaluatorId?: string | null;
  evaluationType: string; status: string; lockedAt?: string | null;
  selfScore?: number | null; supervisorScore?: number | null; finalScore?: number | null;
  employee?: { firstName: string; lastName: string } | null;
  cycle?: { name: string } | null;
}
interface EvaluationItem { id: string; title: string; minScore: number; maxScore: number; weight: number }
interface EvaluationDetail extends EvalRec {
  items: EvaluationItem[];
  scores: { itemId: string; score: number; comment?: string | null }[];
}

export default function Evaluations() {
  const toast = useToast();
  const { user, hasPermission } = useAuth();
  const list = useList<EvalRec>('/evaluations');
  const [selected, setSelected] = useState<{ id: string; action: 'view' | 'self-assess' | 'supervisor-assess' } | null>(null);
  const [finalizing, setFinalizing] = useState<string | null>(null);
  const finalize = async (row: EvalRec) => {
    if (finalizing) return;
    setFinalizing(row.id);
    try {
      await api.post(`/evaluations/${row.id}/finalize`);
      toast('success', 'ارزیابی نهایی شد.');
      void list.reload();
    } catch (e) { toast('error', apiErrorMessage(e)); }
    finally { setFinalizing(null); }
  };
  const columns: Column<EvalRec>[] = [
    { key: 'employee', header: 'نیرو', render: r => r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : '—' },
    { key: 'cycle', header: 'دوره', render: r => r.cycle?.name ?? '—' },
    { key: 'evaluationType', header: 'نوع', render: r => r.evaluationType === 'SELF' ? 'خودارزیابی' : 'ارزیابی سرپرست' },
    { key: 'finalScore', header: 'امتیاز نهایی', render: r => r.finalScore != null ? toPersianDigits(r.finalScore) : '—' },
    { key: 'status', header: 'وضعیت', render: r => <Badge kind={badgeKind(r.status)}>{statusLabel(r.status)}</Badge> },
  ];
  return <>
    <PageHeader title="ارزیابی عملکرد" />
    <Card>
      <DataTable error={list.error} onRetry={list.reload} columns={columns} rows={list.rows} loading={list.loading} rowActions={r => <>
        <Button size="sm" variant="outline" onClick={() => setSelected({ id:r.id, action:'view' })}><Eye size={15} />جزئیات</Button>
        {!r.lockedAt && r.status !== 'FINALIZED' && <>
          {r.evaluationType === 'SELF' && (user?.employee?.id === r.employeeId || hasPermission('evaluations.manage')) && <Button size="sm" onClick={() => setSelected({ id:r.id, action:'self-assess' })}><ClipboardCheck size={15} />خودارزیابی</Button>}
          {r.evaluationType !== 'SELF' && hasPermission('evaluations.rate') && <Button size="sm" onClick={() => setSelected({ id:r.id, action:'supervisor-assess' })}><ClipboardCheck size={15} />امتیازدهی</Button>}
          {hasPermission('evaluations.approve') && (r.selfScore != null || r.supervisorScore != null) && (user?.isSuperAdmin || (user?.employee?.id !== r.employeeId && r.evaluatorId !== user?.id)) && <Button size="sm" variant="success" loading={finalizing === r.id} disabled={!!finalizing} onClick={() => void finalize(r)}><Check size={15} />نهایی‌سازی</Button>}
        </>}
      </>} />
      <Pagination pageSize={list.pageSize} onPageSizeChange={list.setPageSize} page={list.page} totalPages={list.totalPages} total={list.total} onChange={list.setPage} />
    </Card>
    {selected && <EvaluationEditor id={selected.id} action={selected.action} onClose={() => setSelected(null)} onSaved={() => { setSelected(null); void list.reload(); }} />}
  </>;
}

export function EvaluationEditor({ id, action, onClose, onSaved }: { id:string; action:'view' | 'self-assess' | 'supervisor-assess'; onClose:()=>void; onSaved:()=>void }) {
  const { item, loading, error, reload } = useItem<EvaluationDetail>(`/evaluations/${id}`);
  const [values, setValues] = useState<Record<string, { score:string; comment:string }>>({});
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState('');
  useEffect(() => {
    if (!item) return;
    setValues(Object.fromEntries(item.items.map(question => {
      const existing = item.scores.find(score => score.itemId === question.id);
      return [question.id, { score:existing ? String(existing.score) : '', comment:existing?.comment ?? '' }];
    })));
  }, [item]);
  const readOnly = action === 'view';
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!item || saving || readOnly) return;
    setSubmitError('');
    const scores = item.items.map(question => ({ itemId:question.id, score:Number(values[question.id]?.score), comment:values[question.id]?.comment || undefined }));
    if (!scores.length || item.items.some((question, index) => !values[question.id]?.score.trim() || !Number.isFinite(scores[index].score) || scores[index].score < question.minScore || scores[index].score > question.maxScore)) {
      setSubmitError('برای تمام سؤال‌ها، امتیازی در بازه مشخص‌شده وارد کنید.'); return;
    }
    setSaving(true);
    try { await api.post(`/evaluations/${id}/${action}`, { scores }); onSaved(); }
    catch (e) { setSubmitError(apiErrorMessage(e)); }
    finally { setSaving(false); }
  };
  return <Modal open title={readOnly ? 'جزئیات ارزیابی' : 'ثبت امتیاز ارزیابی'} onClose={() => { if (!saving) onClose(); }} width={720}>
    {loading ? <div className="skeleton" style={{ height:180 }} /> : error ? <div role="alert" className="alert alert-danger">{error}<Button onClick={reload}>تلاش دوباره</Button></div> : item && <form onSubmit={submit}>
      <div className="col" style={{ gap:20 }}>
        {item.items.map(question => <section key={question.id}>
          <Field label={question.title} required={!readOnly} hint={`از ${toPersianDigits(question.minScore)} تا ${toPersianDigits(question.maxScore)}`}>
            <Input type="number" min={question.minScore} max={question.maxScore} step="any" required={!readOnly} disabled={readOnly || saving} value={values[question.id]?.score ?? ''} onChange={e => setValues(previous => ({ ...previous, [question.id]: { ...previous[question.id], score:e.target.value } }))} />
          </Field>
          <Field label="توضیح"><Textarea disabled={readOnly || saving} maxLength={1000} value={values[question.id]?.comment ?? ''} onChange={e => setValues(previous => ({ ...previous, [question.id]: { ...previous[question.id], comment:e.target.value } }))} /></Field>
        </section>)}
        {!item.items.length && <div className="empty-state">سؤالی برای این ارزیابی ثبت نشده است.</div>}
        {submitError && <div className="alert alert-danger" role="alert">{submitError}</div>}
        {!readOnly && <Button type="submit" loading={saving} disabled={!item.items.length}><Save size={16} />ثبت امتیازها</Button>}
      </div>
    </form>}
  </Modal>;
}
