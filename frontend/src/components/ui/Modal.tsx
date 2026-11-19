import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const openDialogs: symbol[] = [];
let savedOverflow = '';

function getFocusableElements(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];
  const selectors = 'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]';
  return Array.from(container.querySelectorAll<HTMLElement>(selectors)).filter(el => el.getClientRects().length > 0 && !el.hasAttribute('data-focus-guard'));
}

export function Modal({ open, title, onClose, children, footer, width }: {
  open: boolean; title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; width?: number;
}) {
  const titleId = useId();
  const dialog = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  const previousActiveElement = useRef<HTMLElement | null>(null);
  close.current = onClose;

  useEffect(() => {
    if (!open) return;

    const token = Symbol();
    if (!openDialogs.length) savedOverflow = document.body.style.overflow;
    openDialogs.push(token);

    // Store the previously focused element
    previousActiveElement.current = document.activeElement as HTMLElement | null;

    document.body.style.overflow = 'hidden';

    // Initial focus: first focusable input or the dialog itself
    const focusableElements = getFocusableElements(dialog.current);
    const firstInput = focusableElements.find(el => el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT');
    (firstInput ?? focusableElements[0] ?? dialog.current)?.focus();

    const onKey = (e: KeyboardEvent) => {
      // Only handle keys for the topmost modal
      if (openDialogs.at(-1) !== token) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        close.current();
        return;
      }

      if (e.key !== 'Tab') return;

      const items = getFocusableElements(dialog.current);
      if (!items.length) {
        e.preventDefault();
        dialog.current?.focus();
        return;
      }

      const start = items[0];
      const end = items[items.length - 1];

      if (e.shiftKey && (document.activeElement === start || document.activeElement === dialog.current)) {
        e.preventDefault();
        end.focus();
      } else if (!e.shiftKey && (document.activeElement === end || document.activeElement === dialog.current)) {
        e.preventDefault();
        start.focus();
      }
    };

    document.addEventListener('keydown', onKey);

    return () => {
      openDialogs.splice(openDialogs.indexOf(token), 1);
      document.removeEventListener('keydown', onKey);

      if (!openDialogs.length) document.body.style.overflow = savedOverflow;

      // Restore focus to the element that opened the modal
      if (previousActiveElement.current?.isConnected) {
        previousActiveElement.current.focus();
      }
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) close.current(); }}>
      <div
        ref={dialog}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        style={width ? { width: `min(${width}px, calc(100vw - 32px))` } : undefined}
      >
        <div className="modal-header">
          <h2 id={titleId}>{title}</h2>
          <button
            type="button"
            className="icon-button"
            onClick={close.current}
            aria-label="بستن"
            title="بستن"
          >
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
