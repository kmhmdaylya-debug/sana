import { useState } from 'react';
import { Check, RotateCcw, X } from 'lucide-react';
import { api, apiErrorMessage } from '../lib/api';
import { Button, Field, Modal, Textarea, useToast } from './ui';

export default function TaskRetryReview({ task, onReviewed }: {
  task: { id: string; title: string; retryStatus?: string | null };
  onReviewed: () => void | Promise<void>;
}) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  if (task.retryStatus !== 'PENDING') return null;
  const review = async (approved: boolean) => {
    if (saving) return;
    if (!approved && !reason.trim()) { setError('دلیل رد درخواست را بنویسید.'); return; }
    setSaving(true);
    try {
      await api.post(`/tasks/${task.id}/retry-request/review`, { approved, ...(!approved ? { reason: reason.trim() } : {}) });
      setRejecting(false);
      toast('success', approved ? 'انجام دوباره تأیید شد.' : 'درخواست رد شد.');
      await onReviewed();
    } catch (e) { toast('error', apiErrorMessage(e)); }
    finally { setSaving(false); }
  };
  return <>
    <div className="task-retry-review" role="group" aria-label={`بررسی درخواست انجام دوبارهٔ ${task.title}`}>
      <span><RotateCcw size={15} />درخواست انجام دوباره</span>
      <div>
        <Button variant="success" size="sm" disabled={saving} loading={saving && !rejecting} onClick={() => review(true)}><Check size={15} />تأیید</Button>
        <Button variant="danger" size="sm" disabled={saving} onClick={() => { setReason(''); setError(''); setRejecting(true); }}><X size={15} />رد</Button>
      </div>
    </div>
    <Modal open={rejecting} title="رد درخواست انجام دوباره" onClose={() => { if (!saving) setRejecting(false); }} footer={<>
      <Button variant="danger" loading={saving} onClick={() => review(false)}>رد درخواست</Button>
      <Button variant="secondary" disabled={saving} onClick={() => setRejecting(false)}>انصراف</Button>
    </>}>
      <p>{task.title}</p>
      <Field label="دلیل رد" required error={error}><Textarea aria-label="دلیل رد درخواست" maxLength={500} value={reason} onChange={event => { setReason(event.target.value); setError(''); }} /></Field>
    </Modal>
  </>;
}
