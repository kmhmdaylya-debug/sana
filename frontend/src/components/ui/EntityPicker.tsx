import { useState } from 'react';
import { Check, Search, UserRound } from 'lucide-react';
import { useList } from '../../lib/useList';
import { Button, Field, Input, Modal, Pagination } from '../ui';

export function EntityPicker({ value, onValueChange, endpoint = '/employees', title = 'انتخاب کارمند' }: {
  value: string; onValueChange: (value: string) => void; endpoint?: string; title?: string;
}) {
  const [open,setOpen] = useState(false);
  const [selected,setSelected] = useState<{id:string;label:string} | null>(null);
  return <>
    <div className="entity-picker"><Input value={selected?.id === value ? selected.label : value} readOnly placeholder={title} onClick={()=>setOpen(true)} onKeyDown={e=>{if(e.key==='Enter'||e.key==='ArrowDown'){e.preventDefault();setOpen(true);}}} /><button type="button" className="entity-toggle" title={title} aria-label={title} onClick={()=>setOpen(true)}><UserRound size={17} /></button></div>
    {open && <EntityOptions endpoint={endpoint} title={title} value={value} onClose={()=>setOpen(false)} onSelect={(id,label)=>{onValueChange(id);setSelected({id,label});setOpen(false);}} />}
  </>;
}

function EntityOptions({endpoint,title,value,onClose,onSelect}:{endpoint:string;title:string;value:string;onClose:()=>void;onSelect:(id:string,label:string)=>void}) {
  const list=useList<any>(endpoint,{limit:10});
  const [manual,setManual]=useState(value);
  const label=(row:any)=>row.fullName ?? ([row.firstName,row.lastName].filter(Boolean).join(' ') || row.title || row.name || row.code || row.id);
  return <Modal open title={title} onClose={onClose} width={520}>
    <Field label="جست‌وجو"><div className="global-search-input"><Search size={17} /><Input value={list.search} onChange={e=>list.setSearch(e.target.value)} /></div></Field>
    {list.error ? <div className="alert alert-warning" role="alert">{list.error}<Button variant="secondary" onClick={list.reload}>تلاش دوباره</Button></div> : list.loading ? <div className="skeleton entity-skeleton" /> : <div className="entity-options">
      {!list.rows.length && <div className="empty-state">موردی پیدا نشد.</div>}
      {list.rows.map(row=><button type="button" key={row.id} aria-pressed={value===row.id} onClick={()=>onSelect(row.id,label(row))}><span>{label(row)}<small>{row.code ?? row.username}</small></span>{value===row.id&&<Check size={17} />}</button>)}
    </div>}
    <Pagination page={list.page} total={list.total} totalPages={list.totalPages} onChange={list.setPage} />
    <details className="entity-manual"><summary>انتخاب با شناسه</summary><Field label="شناسه"><Input dir="ltr" value={manual} onChange={e=>setManual(e.target.value)} /></Field><Button size="sm" disabled={!manual.trim()} onClick={()=>onSelect(manual.trim(),manual.trim())}>انتخاب</Button></details>
  </Modal>;
}
