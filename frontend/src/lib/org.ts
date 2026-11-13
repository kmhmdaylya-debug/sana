import { api } from './api';

/**
 * شناسهٔ اولین شرکت فعال — به‌جای انتخاب دستی شرکت در فرم‌ها.
 * سرور فیلد companyId را الزامی می‌داند؛ این تابع آن را پشت‌صحنه پر می‌کند.
 */
export async function getDefaultCompanyId(): Promise<string | null> {
  const r = await api.get('/org/companies/options');
  return r?.data?.data?.[0]?.id ?? null;
}
