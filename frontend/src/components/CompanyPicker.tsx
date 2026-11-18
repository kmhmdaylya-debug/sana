import { useEffect, useState } from 'react';
import { api, apiErrorMessage } from '../lib/api';
import { Button, Field, Select } from './ui';

export default function CompanyPicker({ value, onValueChange, disabled }: { value:string; onValueChange:(id:string)=>void; disabled?:boolean }) {
  const [companies, setCompanies] = useState<{ id:string; name:string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    api.get('/org/companies/options', { signal:controller.signal }).then(response => {
      if (!controller.signal.aborted) setCompanies(response.data.data ?? []);
    }).catch(e => { if (!controller.signal.aborted) setError(apiErrorMessage(e)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [attempt]);
  useEffect(() => {
    if (!loading && !error && !value && companies.length > 0) {
      const firstCompany = companies[0];
      if (firstCompany) onValueChange(firstCompany.id);
    }
  }, [companies, loading, error, value, onValueChange]);
  return <Field label="شرکت" required>
    <Select value={value} disabled={disabled || loading || !!error} required onChange={event => onValueChange(event.target.value)}>
      <option value="">{loading ? 'در حال دریافت شرکت‌ها' : 'انتخاب شرکت'}</option>
      {companies.map(company => <option key={company.id} value={company.id}>{company.name}</option>)}
    </Select>
    {error && <div role="alert" className="text-danger">{error}<Button size="sm" variant="outline" onClick={() => setAttempt(n => n + 1)}>تلاش دوباره</Button></div>}
  </Field>;
}
