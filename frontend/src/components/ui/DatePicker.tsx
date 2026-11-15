import { useEffect, useId, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react';
import jalaali from 'jalaali-js';
import { Input } from './base';
import { parseDateInput, toPersianDigits } from '../../lib/format';

const months = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
export function DatePicker({ value, onValueChange, output = 'jalali', disabled, ...props }: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: string; onValueChange: (value: string) => void; output?: 'iso' | 'jalali';
}) {
  const today = jalaali.toJalaali(new Date(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran', year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date()) + 'T12:00:00'));
  const [open, setOpen] = useState(false);
  const [view, setView] = useState({ year: today.jy, month: today.jm });
  const wrapper = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => { if (!wrapper.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open]);
  const choose = (day: number, year = view.year, month = view.month) => {
    const gregorian = jalaali.toGregorian(year, month, day);
    const pad = (n: number) => String(n).padStart(2,'0');
    onValueChange(output === 'iso' ? `${gregorian.gy}-${pad(gregorian.gm)}-${pad(gregorian.gd)}` : `${year}/${pad(month)}/${pad(day)}`);
    setOpen(false); toggle.current?.focus();
  };
  const move = (delta: number) => setView(previous => {
    const date = new Date(previous.year, previous.month - 1 + delta, 1);
    return { year: date.getFullYear(), month: date.getMonth() + 1 };
  });
  const first = jalaali.toGregorian(view.year, view.month, 1);
  const offset = (new Date(first.gy, first.gm - 1, first.gd).getDay() + 1) % 7;
  const length = jalaali.jalaaliMonthLength(view.year, view.month);
  const parsed = parseDateInput(value);
  const selected = parsed ? jalaali.toJalaali(new Date(parsed + 'T12:00:00')) : null;
  return <div className="date-picker" ref={wrapper} onKeyDown={e => { if (e.key === 'Escape' && open) { e.stopPropagation(); setOpen(false); toggle.current?.focus(); } }}>
    <Input {...props} disabled={disabled} value={value} onChange={e => onValueChange(e.target.value)} placeholder={props.placeholder ?? (output === 'iso' ? '2026-11-15' : '۱۴۰۵/۰۸/۲۴')} dir="ltr" className={`date-input ${props.className ?? ''}`} />
    <button ref={toggle} type="button" className="date-toggle" disabled={disabled} aria-label="انتخاب تاریخ" title="انتخاب تاریخ" aria-expanded={open} aria-controls={id} onClick={() => { if (selected) setView({ year:selected.jy, month:selected.jm }); setOpen(v => !v); }}><CalendarDays size={17} /></button>
    {open && <div className="date-calendar" id={id} role="dialog" aria-label="تقویم شمسی">
      <div className="calendar-heading"><button type="button" className="icon-button" title="ماه قبل" aria-label="ماه قبل" onClick={() => move(-1)}><ChevronRight size={16} /></button><strong>{months[view.month-1]} {toPersianDigits(view.year)}</strong><button type="button" className="icon-button" title="ماه بعد" aria-label="ماه بعد" onClick={() => move(1)}><ChevronLeft size={16} /></button></div>
      <div className="calendar-grid" role="group" aria-label="روزهای ماه">
        {['ش','ی','د','س','چ','پ','ج'].map((day, index) => <span className="calendar-weekday" key={index}>{day}</span>)}
        {Array.from({ length:offset }, (_,i) => <span key={`blank-${i}`} />)}
        {Array.from({ length }, (_,i) => i+1).map(day => <button key={day} type="button" data-day={day} aria-label={`${day} ${months[view.month-1]} ${view.year}`} aria-pressed={selected?.jy === view.year && selected?.jm === view.month && selected?.jd === day} className={today.jy === view.year && today.jm === view.month && today.jd === day ? 'is-today' : ''} onClick={() => choose(day)} onKeyDown={e => {
          const delta = { ArrowLeft:1, ArrowRight:-1, ArrowDown:7, ArrowUp:-7 }[e.key];
          if (delta) { e.preventDefault(); wrapper.current?.querySelector<HTMLButtonElement>(`[data-day="${Math.max(1,Math.min(length,day+delta))}"]`)?.focus(); }
        }}>{toPersianDigits(day)}</button>)}
      </div>
      <div className="calendar-footer"><button type="button" className="btn btn-secondary btn-sm" onClick={() => choose(today.jd,today.jy,today.jm)}>امروز</button><button type="button" className="icon-button" title="پاک کردن تاریخ" aria-label="پاک کردن تاریخ" onClick={() => { onValueChange(''); setOpen(false); toggle.current?.focus(); }}><X size={15} /></button></div>
    </div>}
  </div>;
}
