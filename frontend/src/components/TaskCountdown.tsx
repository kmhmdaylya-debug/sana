import { useMemo, type CSSProperties } from 'react';
import { Hourglass, TimerOff } from 'lucide-react';
import { taskCountdown, taskDeadlineAt } from '../lib/deadline';
import { toPersianDigits } from '../lib/format';
import { useDeadlineClock } from '../lib/useDeadlineClock';

export default function TaskCountdown({ dueDate, status }: { dueDate?: string | null; status: string }) {
  const deadline = useMemo(() => taskDeadlineAt(dueDate), [dueDate]);
  const active = deadline !== null && deadline > Date.now() && !['DONE', 'CANCELLED'].includes(status);
  const now = useDeadlineClock(active);
  const countdown = taskCountdown(deadline, status, active ? now : Date.now());
  if (!countdown) return null;
  const label = countdown.expired ? 'مهلت تمام شد' : `${toPersianDigits(countdown.hours)} ساعت و ${toPersianDigits(countdown.minutes)} دقیقه و ${toPersianDigits(countdown.seconds)} ثانیه باقی‌مانده`;
  return <span className={`task-countdown${countdown.urgent ? ' is-urgent' : ''}${countdown.expired ? ' is-expired' : ''}`}
    style={{ '--deadline-progress': countdown.fraction } as CSSProperties}>
    {countdown.expired ? <TimerOff size={15} aria-hidden="true" /> : <Hourglass size={15} aria-hidden="true" />}
    {countdown.expired ? <span>{label}</span> : <>
      <time className="task-countdown-digits" role="timer" aria-live="off" aria-label={label}
        dateTime={`PT${countdown.hours}H${countdown.minutes}M${countdown.seconds}S`} dir="ltr">{toPersianDigits(countdown.text)}</time>
      <span aria-hidden="true">باقی‌مانده</span>
    </>}
  </span>;
}
