import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, FileText, Users, ClipboardList, FolderKanban } from 'lucide-react';
import { api, apiErrorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Input, Modal } from './ui';
import { searchDocuments } from '../lib/documentSearch';
import { normalizeSearch } from '../lib/search';

interface Result { id: string; title: string; category: string; to: string; icon: ReactNode }
const sources = [
  { path:'/users', permission:'users.view', category:'کاربران', icon:<Users size={17} />, title:(row:any) => row.fullName },
  { path:'/tasks', permission:'tasks.view', category:'وظایف', icon:<ClipboardList size={17} />, title:(row:any) => row.title },
  { path:'/documents', permission:'documents.view', category:'مدارک', icon:<FileText size={17} />, title:(row:any) => row.title },
  { path:'/projects', permission:'projects.view', category:'پروژه‌ها', icon:<FolderKanban size={17} />, title:(row:any) => row.title },
];

export default function GlobalSearch({ open, onClose, links }: { open:boolean; onClose:()=>void; links:{to:string;label:string;icon:ReactNode}[] }) {
  const [query,setQuery] = useState('');
  const [results,setResults] = useState<Result[]>([]);
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState('');
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!open) { setQuery(''); setResults([]); return; }
    const controller = new AbortController();
    if (query.trim().length >= 2) setLoading(true);
    const timer = window.setTimeout(async () => {
      if (query.trim().length < 2) { setResults([]); setError(''); setLoading(false); return; }
      setLoading(true); setError('');
      const allowed = sources.filter(source => hasPermission(source.permission));
      const responses = await Promise.allSettled(allowed.map(async source => {
        const params = { search:query.trim(), limit:5 };
        const response = source.path === '/documents'
          ? await searchDocuments(params, controller.signal)
          : await api.get(source.path, { params, signal:controller.signal });
        const payload = response.data.data;
        const rows = Array.isArray(payload) ? payload : (payload?.items ?? []);
        return rows.slice(0,5).map((row:any) => ({ id:`${source.path}-${row.id}`, title:source.title(row), category:source.category, icon:source.icon, to:`${source.path}?search=${encodeURIComponent(query.trim())}` }));
      }));
      if (controller.signal.aborted) return;
      setResults(responses.flatMap(result => result.status === 'fulfilled' ? result.value : []));
      const failed = responses.filter(result => result.status === 'rejected');
      if (failed.length) setError(failed.length === responses.length ? 'جست‌وجوی اطلاعات در دسترس نیست. ' + apiErrorMessage((failed[0] as PromiseRejectedResult).reason) : 'بخشی از نتایج دریافت نشد.');
      setLoading(false);
    },250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [open, query, hasPermission]);
  const matches = links.filter(link => !query || normalizeSearch(link.label).includes(normalizeSearch(query)));
  const go = (to:string) => { onClose(); navigate(to); };
  return <Modal open={open} onClose={onClose} title="جست‌وجوی سراسری" width={620}>
    <div className="global-search-input"><Search size={18} /><Input autoFocus aria-label="جست‌وجوی سراسری" placeholder="نام، کار، پروژه یا مدرک" value={query} onChange={e=>setQuery(e.target.value)} /></div>
    <div className="global-search-results" aria-busy={loading}>
      {matches.length > 0 && <><h3>بخش‌ها</h3>{matches.map(link => <button type="button" key={link.to} onClick={()=>go(link.to)}>{link.icon}<span>{link.label}</span><ArrowLeft size={14} /></button>)}</>}
      {loading && <div className="search-loading" role="status">در حال جست‌وجو…</div>}
      {error && <div className="alert alert-warning" role="alert">{error}</div>}
      {results.length > 0 && <><h3>نتایج</h3>{results.map(result => <button type="button" key={result.id} onClick={()=>go(result.to)}>{result.icon}<span>{result.title}<small>{result.category}</small></span><ArrowLeft size={14} /></button>)}</>}
      {!loading && query.trim().length >= 2 && !results.length && !matches.length && !error && <div className="empty-state">نتیجه‌ای پیدا نشد.</div>}
    </div>
  </Modal>;
}
