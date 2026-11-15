import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const openDialogs: symbol[] = [];
let savedOverflow = '';

export function Modal({ open, title, onClose, children, footer, width }: {
  open: boolean; title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; width?: number;
}) {
  const titleId = useId();
  const dialog = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!open) return;
    const token = Symbol();
    if (!openDialogs.length) savedOverflow = document.body.style.overflow;
    openDialogs.push(token);
    const previous = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';
    const selectors = 'button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]';
    const controls = () => Array.from(dialog.current?.querySelectorAll<HTMLElement>(selectors) ?? []).filter(el => el.getClientRects().length > 0);
    const first = dialog.current?.querySelector<HTMLElement>('input:not(:disabled),select:not(:disabled),textarea:not(:disabled)');
    (first ?? dialog.current)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (openDialogs.at(-1) !== token) return;
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close.current(); }
      if (e.key !== 'Tab') return;
      const items = controls();
      if (!items.length) { e.preventDefault(); dialog.current?.focus(); return; }
      const start = items[0], end = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === start || document.activeElement === dialog.current)) { e.preventDefault(); end.focus(); }
      else if (!e.shiftKey && (document.activeElement === end || document.activeElement === dialog.current)) { e.preventDefault(); start.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      openDialogs.splice(openDialogs.indexOf(token), 1);
      document.removeEventListener('keydown', onKey);
      if (!openDialogs.length) document.body.style.overflow = savedOverflow;
      if (previous?.isConnected) previous.focus();
    };
  }, [open]);
  if (!open) return null;
  return createPortal(<div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) close.current(); }}>
    <div ref={dialog} className="modal" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} style={width ? { width: `min(${width}px, calc(100vw - 32px))` } : undefined}>
      <div className="modal-header"><h2 id={titleId}>{title}</h2><button type="button" className="icon-button" onClick={onClose} aria-label="بستن" title="بستن"><X size={18} /></button></div>
      <div className="modal-body">{children}</div>
      {footer && <div className="modal-footer">{footer}</div>}
    </div>
  </div>, document.body);
}
