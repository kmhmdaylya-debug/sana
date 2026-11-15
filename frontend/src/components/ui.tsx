import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useId,
  useRef,
  Children,
  cloneElement,
  isValidElement,
  forwardRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { Check, ChevronLeft, ChevronRight, Info, TriangleAlert, X, Search, LoaderCircle } from 'lucide-react';
import { toPersianDigits } from '../lib/format';
import { useAuth } from '../lib/auth';
import { Modal } from './ui/Modal';
export { Modal } from './ui/Modal';
export { DataTable, type Column } from './ui/DataTable';
export { DatePicker } from './ui/DatePicker';
export { EntityPicker } from './ui/EntityPicker';

const FieldContext = createContext<{ id: string; required?: boolean; error?: string; description?: string }>({ id: '' });

export function Tabs({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`tabs ${className}`} role="tablist" aria-label="نماها" onKeyDown={e => {
    if (!['ArrowRight','ArrowLeft','Home','End'].includes(e.key)) return;
    const items = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    const index = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : (current + (e.key === 'ArrowLeft' ? 1 : -1) + items.length) % items.length;
    e.preventDefault(); items[index]?.focus(); items[index]?.click();
  }}>{Children.map(children, child => {
    if (!isValidElement<{ className?: string }>(child)) return child;
    const selected = child.props.className?.split(' ').includes('active') ?? false;
    return cloneElement(child as React.ReactElement<any>, { role:'tab', 'aria-selected':selected, tabIndex:selected ? 0 : -1, type:'button' });
  })}</div>;
}

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
      type="button"
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <LoaderCircle className="button-spinner" size={15} aria-hidden="true" />}
      {children}
    </button>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className = '', ...props }, ref) {
  const field = useContext(FieldContext);
  return <input ref={ref} id={field.id || undefined} aria-required={field.required || undefined} aria-invalid={!!field.error || undefined} aria-describedby={field.description} {...props} className={`input ${className}`} />;
});

export function Select({ className = '', ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  const field = useContext(FieldContext);
  return <select id={field.id || undefined} aria-required={field.required || undefined} aria-invalid={!!field.error || undefined} aria-describedby={field.description} {...props} className={`select ${className}`} />;
}

export function Textarea({ className = '', ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const field = useContext(FieldContext);
  return <textarea id={field.id || undefined} aria-required={field.required || undefined} aria-invalid={!!field.error || undefined} aria-describedby={field.description} {...props} className={`textarea ${className}`} />;
}

interface FieldProps {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
}

export function Field({ label, required, hint, error, children }: FieldProps) {
  const id = useId();
  return (
    <FieldContext.Provider value={{ id, required, error, description: error || hint ? `${id}-hint` : undefined }}>
    <div className={`form-group${error ? ' has-error' : ''}`}>
      <label className="form-label" htmlFor={id}>
        {label}
        {required && <span className="req"> *</span>}
      </label>
      {children}
      {error ? <span id={`${id}-hint`} className="form-error" role="alert">{error}</span> : hint ? <span id={`${id}-hint`} className="form-hint">{hint}</span> : null}
    </div>
    </FieldContext.Provider>
  );
}

/* ==========================================================================
   کارت / سربرگ صفحه
   ========================================================================== */

export function Card({ title, subtitle, actions, children, style, className }: {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  style?: React.CSSProperties;
  className?: string;
}) {
  const cls = className ? `card ${className}` : 'card';
  if (!title && !actions) return <div className={cls} style={style}><div className="card-body">{children}</div></div>;
  return (
    <div className={cls} style={style}>
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
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
        {subtitle && <div className="text-muted text-sm">{subtitle}</div>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
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


export function Pagination({ page, totalPages, total, onChange, pageSize, onPageSizeChange }: {
  page: number;
  totalPages: number;
  total: number;
  onChange: (page: number) => void;
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
}) {
  if (totalPages <= 1 && !total) return null;
  return (
    <FieldContext.Provider value={{ id: '' }}><nav className="pagination" aria-label="صفحه‌بندی">
      <span className="text-muted text-sm">
        مجموع {toPersianDigits(total)} رکورد — صفحهٔ {toPersianDigits(page)} از {toPersianDigits(Math.max(1, totalPages))}
      </span>
      {onPageSizeChange && <label className="pagination-size">تعداد در صفحه<Select aria-label="تعداد رکورد در صفحه" value={pageSize} onChange={e => onPageSizeChange(Number(e.target.value))}>{[10,20,50,100,200].map(size => <option key={size} value={size}>{toPersianDigits(size)}</option>)}</Select></label>}
      <div className="btn-group">
        <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="صفحه قبل" title="صفحه قبل">
          <ChevronRight size={16} />
        </Button>
        <span className="pagination-current" aria-current="page">{toPersianDigits(page)}</span>
        <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => onChange(page + 1)} aria-label="صفحه بعد" title="صفحه بعد">
          <ChevronLeft size={16} />
        </Button>
      </div>
    </nav></FieldContext.Provider>
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
      <div className="toast-stack" role="region" aria-label="پیام‌ها" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast ${t.kind === 'info' ? '' : t.kind}`}>
            {t.kind === 'success' && <Check size={16} />}
            {t.kind === 'error' && <X size={16} />}
            {t.kind === 'warning' && <TriangleAlert size={16} />}
            {t.kind === 'info' && <Info size={16} />}
            <span>{t.message}</span>
            <button type="button" className="toast-dismiss" aria-label="بستن پیام" onClick={() => setItems(prev => prev.filter(item => item.id !== t.id))}><X size={14} /></button>
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
  return <Search size={16} aria-hidden="true" />;
}

export function ListToolbar({ search, onSearch, children }: {
  search?: string;
  onSearch?: (s: string) => void;
  children?: ReactNode;
}) {
  const [query, setQuery] = useState(search ?? '');
  useEffect(() => { if (search !== undefined) setQuery(search); }, [search]);
  return (
    <div className="list-toolbar">
      {onSearch && (
        <div className="search-box">
          <SearchIcon />
          <input
            className="input"
            placeholder="جست‌وجو…"
            aria-label="جست‌وجو در فهرست"
            value={query}
            onChange={(e) => { setQuery(e.target.value); onSearch(e.target.value); }}
          />
          {query && <button type="button" className="search-clear" aria-label="پاک کردن جست‌وجو" title="پاک کردن جست‌وجو" onClick={() => { setQuery(''); onSearch(''); }}><X size={14} /></button>}
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
