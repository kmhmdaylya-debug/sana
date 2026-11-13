import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { Check, ChevronLeft, ChevronRight, Info, TriangleAlert, X } from 'lucide-react';
import { toPersianDigits } from '../lib/format';
import { useAuth } from '../lib/auth';

/* ==========================================================================
   دکمه / ورودی / انتخاب / ناحیهٔ متن
   ========================================================================== */

type BtnVariant = 'primary' | 'secondary' | 'outline' | 'danger' | 'success';

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant;
  size?: 'sm' | 'md';
  loading?: boolean;
}

export function Button({ variant = 'primary', size = 'md', loading, className = '', children, disabled, ...rest }: BtnProps) {
  return (
    <button
      className={`btn btn-${variant}${size === 'sm' ? ' btn-sm' : ''} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />}
      {children}
    </button>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className="input" {...props} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className="select" {...props} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className="textarea" {...props} />;
}

interface FieldProps {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
}

export function Field({ label, required, hint, error, children }: FieldProps) {
  return (
    <div className="form-group">
      <label className="form-label">
        {label}
        {required && <span className="req"> *</span>}
      </label>
      {children}
      {error ? <span className="form-error">{error}</span> : hint ? <span className="form-hint">{hint}</span> : null}
    </div>
  );
}

/* ==========================================================================
   کارت / سربرگ صفحه
   ========================================================================== */

export function Card({ title, subtitle, actions, children, style }: {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  style?: React.CSSProperties;
}) {
  if (!title && !actions) return <div className="card" style={style}><div className="card-body">{children}</div></div>;
  return (
    <div className="card" style={style}>
      {(title || actions) && (
        <div className="card-header">
          <div>
            <div className="card-title">{title}</div>
            {subtitle && <div className="card-subtitle">{subtitle}</div>}
          </div>
          {actions && <div className="header-actions" style={{ marginInlineStart: 'auto' }}>{actions}</div>}
        </div>
      )}
      <div className="card-body">{children}</div>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex-between mb" style={{ gap: 12 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{title}</h2>
        {subtitle && <div className="text-muted text-sm">{subtitle}</div>}
      </div>
      {actions && <div className="flex flex-wrap">{actions}</div>}
    </div>
  );
}

/* ==========================================================================
   نشان وضعیت
   ========================================================================== */

export type BadgeKind = 'green' | 'amber' | 'red' | 'blue' | 'sky' | 'violet' | 'gray';

export function Badge({ kind = 'gray', children }: { kind?: string; children: ReactNode }) {
  return <span className={`badge badge-${kind}`}>{children}</span>;
}

/* ==========================================================================
   مودال
   ========================================================================== */

export function Modal({ open, title, onClose, children, footer, width }: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={width ? { width: `min(${width}px, 96vw)` } : undefined}>
        <div className="modal-header">
          <span>{title}</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="بستن" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <X size={16} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'تأیید', danger, onConfirm, onClose, loading }: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  loading?: boolean;
}) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      width={420}
      footer={
        <>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
          <Button variant="secondary" onClick={onClose}>انصراف</Button>
        </>
      }
    >
      <p style={{ margin: 0 }}>{message}</p>
    </Modal>
  );
}

/* ==========================================================================
   جدول داده
   ========================================================================== */

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  width?: number | string;
}

export function DataTable<T extends Record<string, any>>({ columns, rows, loading, emptyMessage = 'موردی برای نمایش وجود ندارد.', rowActions }: {
  columns: Column<T>[];
  rows: T[];
  loading?: boolean;
  emptyMessage?: string;
  rowActions?: (row: T) => ReactNode;
}) {
  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton" style={{ height: 18, marginBottom: 10 }} />
        ))}
      </div>
    );
  }
  if (!rows.length) {
    return (
      <div className="empty-state">
        <div className="icon">
          <Info size={26} />
        </div>
        <div>{emptyMessage}</div>
      </div>
    );
  }
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} style={c.width ? { width: c.width } : undefined}>{c.header}</th>
            ))}
            {rowActions && <th style={{ width: 120 }}>عملیات</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={row.id ?? idx}>
              {columns.map((c) => (
                <td key={c.key}>{c.render ? c.render(row) : (row[c.key] ?? '—')}</td>
              ))}
              {rowActions && <td><div className="table-actions">{rowActions(row)}</div></td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Pagination({ page, totalPages, total, onChange }: {
  page: number;
  totalPages: number;
  total: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1 && !total) return null;
  return (
    <div className="flex-between mt" style={{ padding: '0 4px' }}>
      <span className="text-muted text-sm">
        مجموع {toPersianDigits(total)} رکورد — صفحهٔ {toPersianDigits(page)} از {toPersianDigits(Math.max(1, totalPages))}
      </span>
      <div className="btn-group">
        <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          <ChevronRight size={14} /> قبلی
        </Button>
        <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
          بعدی <ChevronLeft size={14} />
        </Button>
      </div>
    </div>
  );
}

/* ==========================================================================
   توست (پیام شناور)
   ========================================================================== */

type ToastKind = 'success' | 'error' | 'warning' | 'info';
interface ToastItem { id: number; kind: ToastKind; message: string }

const ToastContext = createContext<{ toast: (kind: ToastKind, message: string) => void }>({ toast: () => {} });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const toast = useCallback((kind: ToastKind, message: string) => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev.slice(-4), { id, kind, message }]);
    window.setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 4200);
  }, []);
  const value = useMemo(() => ({ toast }), [toast]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack">
        {items.map((t) => (
          <div key={t.id} className={`toast ${t.kind === 'info' ? '' : t.kind}`}>
            {t.kind === 'success' && <Check size={16} />}
            {t.kind === 'error' && <X size={16} />}
            {t.kind === 'warning' && <TriangleAlert size={16} />}
            {t.kind === 'info' && <Info size={16} />}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext).toast;
}

/* ==========================================================================
   نوار جست‌وجو + فیلتر
   ========================================================================== */

export function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

export function ListToolbar({ search, onSearch, children }: {
  search?: string;
  onSearch?: (s: string) => void;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap mb" style={{ gap: 10 }}>
      {onSearch && (
        <div className="search-box">
          <SearchIcon />
          <input
            className="input"
            placeholder="جست‌وجو…"
            value={search ?? ''}
            onChange={(e) => onSearch(e.target.value)}
          />
        </div>
      )}
      {children}
    </div>
  );
}

/* ==========================================================================
   محافظ مجوز
   ========================================================================== */

export function RequirePermission({ anyOf, children, fallback }: {
  anyOf: string[];
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const ctx = useAuth();
  if (!ctx.user) return <>{children}</>;
  if (ctx.hasAnyPermission(anyOf)) return <>{children}</>;
  return (
    <>
      {fallback ?? (
        <div className="card"><div className="card-body center" style={{ padding: 48 }}>
          <div className="empty-state" style={{ padding: 0 }}>
            <div className="icon"><TriangleAlert size={24} /></div>
            <div className="fw-700">دسترسی ندارید</div>
            <div className="text-muted text-sm mt-sm">برای مشاهدهٔ این بخش مجوز لازم را ندارید.</div>
          </div>
        </div></div>
      )}
    </>
  );
}
