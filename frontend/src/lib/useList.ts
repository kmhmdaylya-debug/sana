import { useCallback, useEffect, useRef, useState } from 'react';
import api, { apiErrorMessage } from './api';
import { useLocation } from 'react-router-dom';
import { searchDocuments } from './documentSearch';

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
  const location = useLocation();
  const [rows, setRows] = useState<T[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearchValue] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [pageSize, setPageSizeValue] = useState(Number(baseParams.limit ?? 20));
  const request = useRef<AbortController | null>(null);
  const [filters, setFiltersState] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const paramsKey = JSON.stringify(baseParams);
  const filtersKey = JSON.stringify(filters);

  useEffect(() => {
    if (url.split('?')[0] === location.pathname) setSearchValue(new URLSearchParams(location.search).get('search') ?? '');
  }, [location.pathname, location.search, url]);

  const load = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError('');
    try {
      const params = {
          page,
          ...JSON.parse(paramsKey),
          limit: pageSize,
          ...(debouncedSearch ? { search: debouncedSearch } : {}),
          ...JSON.parse(filtersKey),
      };
      const r = url === '/documents' && debouncedSearch
        ? await searchDocuments(params, controller.signal)
        : await api.get(url, { params, signal: controller.signal });
      if (controller.signal.aborted) return;
      const payload = r?.data?.data;
      const meta: ListMeta | undefined = r?.data?.meta;
      const items = Array.isArray(payload)
        ? payload
        : (payload?.items ?? payload?.rows ?? []);
      setRows(Array.isArray(items) ? items : []);
      setTotalPages(meta?.totalPages ?? 1);
      setTotal(meta?.total ?? (Array.isArray(items) ? items.length : 0));
    } catch (e) {
      if (controller.signal.aborted) return;
      setError(apiErrorMessage(e));
      setRows([]);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [url, page, pageSize, debouncedSearch, paramsKey, filtersKey]);

  useEffect(() => {
    void load();
    return () => request.current?.abort();
  }, [load]);

  useEffect(() => {
    const timer = window.setTimeout(() => { setPage(1); setDebouncedSearch(search); }, 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  const setPageSize = useCallback((size: number) => { setPage(1); setPageSizeValue(Math.min(200, Math.max(1, size))); }, []);

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
    pageSize,
    setPageSize,
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
  const request = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setItem(null);
    setError('');
    if (!url) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const r = await api.get(url, { signal: controller.signal });
      if (!controller.signal.aborted) setItem(r?.data?.data ?? null);
    } catch (e) {
      if (!controller.signal.aborted) setError(apiErrorMessage(e));
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  useEffect(() => {
    void load();
    return () => request.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, ...deps]);

  return { item, loading, error, reload: load };
}
