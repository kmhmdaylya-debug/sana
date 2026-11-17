import { api } from './api';

/**
 * تنها در صورت نبود ابهام، شرکت یگانه را انتخاب می‌کند.
 */
export async function getDefaultCompanyId(): Promise<string | null> {
  const r = await api.get('/org/companies/options');
  const companies: { id:string }[] = r?.data?.data ?? [];
  if (companies.length > 1) throw new Error('شرکت موردنظر را در فرم انتخاب کنید.');
  return companies[0]?.id ?? null;
}
