import { useMemo, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Inbox, RefreshCw, TriangleAlert } from 'lucide-react';

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  width?: number | string;
  sortValue?: (row: T) => string | number | null | undefined;
  sortable?: boolean;
}

const collator = new Intl.Collator('fa', { numeric: true, sensitivity: 'base' });
export function DataTable<T extends Record<string, any>>({ columns, rows, loading, error, onRetry, emptyMessage = 'موردی برای نمایش وجود ندارد.', rowActions }: {
  columns: Column<T>[]; rows: T[]; loading?: boolean; error?: string; onRetry?: () => void;
  emptyMessage?: string; rowActions?: (row: T) => ReactNode;
}) {
  const [sort, setSort] = useState<{ key: string; direction: 1 | -1 } | null>(null);
  const ordered = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find(c => c.key === sort.key);
    if (!col) return rows;
    const value = (row: T) => col.sortValue ? col.sortValue(row) : row[col.key];
    return [...rows].sort((a, b) => {
      const left = value(a), right = value(b);
      if (left == null) return right == null ? 0 : 1;
      if (right == null) return -1;
      return sort.direction * (typeof left === 'number' && typeof right === 'number' ? left - right : collator.compare(String(left), String(right)));
    });
  }, [rows, columns, sort]);
  if (error) return <div className="table-state table-error" role="alert"><TriangleAlert size={24} /><strong>اطلاعات دریافت نشد</strong><p>{error}</p>{onRetry && <button type="button" className="btn btn-secondary" onClick={onRetry}><RefreshCw size={15} />تلاش دوباره</button>}</div>;
  if (loading) return <div className="table-loading" role="status" aria-label="در حال دریافت اطلاعات">{[0,1,2,3,4].map(i => <div className="table-loading-row" key={i}><span className="skeleton" /><span className="skeleton" /><span className="skeleton" /></div>)}</div>;
  if (!rows.length) return <div className="table-state"><span className="empty-symbol"><Inbox size={24} /></span><p>{emptyMessage}</p></div>;
  return <div className="table-wrap" tabIndex={0} role="region" aria-label="جدول اطلاعات">
    <table className="data-table">
      <thead><tr>{columns.map(c => {
        const canSort = c.sortable !== false && (!!c.sortValue || rows.some(row => ['string','number','boolean'].includes(typeof row[c.key])));
        const active = sort?.key === c.key;
        return <th key={c.key} scope="col" style={c.width ? { width: c.width } : undefined} aria-sort={active ? (sort.direction === 1 ? 'ascending' : 'descending') : undefined}>
          {canSort ? <button type="button" className="table-sort" title={`مرتب‌سازی ${c.header} در همین صفحه`} onClick={() => setSort(active ? (sort.direction === 1 ? { key: c.key, direction: -1 } : null) : { key: c.key, direction: 1 })}>{c.header}{active ? (sort.direction === 1 ? <ArrowUp size={13} /> : <ArrowDown size={13} />) : <ArrowUpDown size={13} />}</button> : c.header}
        </th>;
      })}{rowActions && <th scope="col" className="table-action-heading">عملیات</th>}</tr></thead>
      <tbody>{ordered.map((row, idx) => <tr key={row.id ?? idx}>{columns.map(c => <td key={c.key} data-label={c.header}>{c.render ? c.render(row) : (row[c.key] ?? '—')}</td>)}{rowActions && <td><div className="table-actions">{rowActions(row)}</div></td>}</tr>)}</tbody>
    </table>
  </div>;
}
