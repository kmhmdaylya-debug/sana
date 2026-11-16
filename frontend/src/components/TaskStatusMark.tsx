import { Check, MoreHorizontal, X } from 'lucide-react';

export default function TaskStatusMark({ status, blocked = false }: { status: string; blocked?: boolean }) {
  const state = status === 'DONE' ? 'done' : status === 'CANCELLED' ? 'cancelled' : blocked || status === 'BLOCKED' ? 'blocked' : status === 'IN_PROGRESS' ? 'progress' : 'new';
  return <span className={`task-status-mark is-${state}`} aria-hidden="true">
    {state === 'done' ? <Check size={16} /> : state === 'blocked' || state === 'cancelled' ? <X size={14} /> : state === 'progress' ? <MoreHorizontal size={18} /> : null}
  </span>;
}
