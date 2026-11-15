import api from './api';
import { matchesDocument } from './search';

// The existing documents endpoint paginates but does not implement text search.
export async function searchDocuments(params: Record<string, unknown>, signal: AbortSignal) {
  const { search, page = 1, limit = 20, ...filters } = params;
  const matches: any[] = [];
  let totalPages = 1;
  for (let current = 1; current <= totalPages; current++) {
    const response = await api.get('/documents', { params: { ...filters, page: current, limit: 200 }, signal });
    const rows = response.data.data ?? [];
    matches.push(...rows.filter((row: any) => matchesDocument(row, String(search ?? ''))));
    totalPages = response.data.meta?.totalPages ?? 1;
  }
  const size = Number(limit);
  const current = Number(page);
  const pages = Math.max(1, Math.ceil(matches.length / size));
  return { data: {
    data: matches.slice((current - 1) * size, current * size),
    meta: { total: matches.length, page: current, limit: size, totalPages: pages, hasNext: current < pages, hasPrev: current > 1 },
  } };
}
