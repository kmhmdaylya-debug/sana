import { useCallback, useEffect, useState } from 'react';
import api, { apiErrorMessage } from './api';

export interface ListMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/** هوک لیست با pagination، جستجو و فیلترها — الگوی استاندارد همه جدول‌ها */
export function useList<T = any>(url: string, baseParams: Record<string, unknown> = {}) {
  const [rows, setRows] = useState<T[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearchValue] = useState('');
  const [filters, setFiltersState] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const paramsKey = JSON.stringify(baseParams);
  const filtersKey = JSON.stringify(filters);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await api.get(url, {
        params: {
          page,
          limit: 20,
          ...(search ? { search } : {}),
          ...JSON.parse(paramsKey),
          ...JSON.parse(filtersKey),
        },
      });
      const payload = r?.data?.data;
      const meta: ListMeta | undefined = r?.data?.meta;
      const items = Array.isArray(payload)
        ? payload
        : (payload?.items ?? payload?.rows ?? []);
      setRows(Array.isArray(items) ? items : []);
      setTotalPages(meta?.totalPages ?? 1);
      setTotal(meta?.total ?? (Array.isArray(items) ? items.length : 0));
    } catch (e) {
      setError(apiErrorMessage(e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [url, page, search, paramsKey, filtersKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const setSearch = useCallback((s: string) => {
    setPage(1);
    setSearchValue(s);
  }, []);

  const setFilter = useCallback((key: string, value: unknown) => {
    setPage(1);
    setFiltersState((prev) => {
      const next = { ...prev };
      if (value === '' || value === null || value === undefined) {
        delete next[key];
      } else {
        next[key] = value;
      }
      return next;
    });
  }, []);

  const clearFilters = useCallback(() => {
    setPage(1);
    setFiltersState({});
  }, []);

  return {
    rows,
    page,
    totalPages,
    total,
    search,
    setSearch,
    filters,
    setFilter,
    clearFilters,
    setPage,
    loading,
    error,
    reload: load,
  };
}

/** هوک دریافت یک رکورد تنها */
export function useItem<T = any>(url: string | null, deps: unknown[] = []) {
  const [item, setItem] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!url) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const r = await api.get(url);
      setItem(r?.data?.data ?? null);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, ...deps]);

  return { item, loading, error, reload: load };
}
