import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';

/**
 * کلاینت API — توکن دسترسی (access token) فقط در حافظه نگهداری می‌شود
 * و از localStorage استفاده نمی‌کنیم.
 */
export let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

/**
 * ایجاد AbortController برای لغو درخواست در هنگام Unmount کامپوننت.
 * استفاده: const controller = new AbortController(); api.get(url, { signal: controller.signal });
 */
export function createAbortController(): AbortController {
  return new AbortController();
}

export const api = axios.create({
  baseURL: '/api/v1',
  withCredentials: true, // ارسال cookie با refresh token
  timeout: 30000,
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

let refreshing: Promise<string | null> | null = null;

/**
 * تازه‌سازی توکن دسترسی.
 * نکتهٔ مهم: سرور توکن refresh را با هر بار استفاده می‌چرخاند (rotation) و توکن قبلی را
 * باطل می‌کند؛ بنابراین دو درخواست هم‌زمان باعث می‌شود درخواست دوم با توکن کهنه رد شود
 * و کاربر به‌اشتباه از حساب خارج شود. با این تابع، همهٔ فراخوانی‌ها یک درخواست مشترک دارند.
 */
export async function refreshAccessToken(): Promise<string | null> {
  if (!refreshing) {
    refreshing = axios
      .post('/api/v1/auth/refresh', {}, { withCredentials: true })
      .then((r) => {
        const token = r?.data?.data?.accessToken ?? null;
        setAccessToken(token);
        return token;
      })
      .catch(() => {
        setAccessToken(null);
        return null;
      })
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retried?: boolean };
    if (error.response?.status === 401 && original && !original._retried && !original.url?.includes('/auth/')) {
      original._retried = true;
      const token = await refreshAccessToken();
      if (token) return api.request(original);
    }
    return Promise.reject(error);
  },
);

/** پیام خطای استاندارد فارسی از پاسخ سرور */
export function apiErrorMessage(e: unknown): string {
  const err = e as AxiosError<{ message?: string | string[]; error?: { message?: string } }>;
  const body = err.response?.data;
  const m = body?.error?.message ?? body?.message;
  if (Array.isArray(m)) return m.join('، ');
  if (typeof m === 'string') return m;
  if (err.message === 'Network Error') return 'ارتباط با سرور برقرار نشد.';
  if (!axios.isAxiosError(e) && e instanceof Error) return e.message;
  return 'خطای غیرمنتظره رخ داد.';
}

/** دانلود فایل (گزارش CSV/Excel) */
export async function downloadFile(
  url: string,
  filename: string,
  params?: Record<string, unknown>,
) {
  const res = await api.get(url, { params, responseType: 'blob' });
  const blob = new Blob([res.data]);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

/** دانلود فایل با نام فارسی (Content-Disposition) */
export async function downloadReport(url: string, fallbackName: string, params?: Record<string, unknown>) {
  const res = await api.get(url, { params, responseType: 'blob' });
  saveReportResponse(res, fallbackName);
}

export async function generateReport(body: Record<string, unknown>, fallbackName: string) {
  const res = await api.post('/reports/run', body, { responseType: 'blob', timeout:120000 });
  saveReportResponse(res, fallbackName);
}

function saveReportResponse(res: { data: BlobPart; headers: Record<string, unknown> }, fallbackName: string) {
  if (/application\/json|text\/html/i.test(String(res.headers?.['content-type'] ?? ''))) throw new Error('سرور فایل گزارش معتبر برنگرداند.');
  const disposition = res.headers?.['content-disposition'] as string | undefined;
  let name = fallbackName;
  if (disposition) {
    const match = /filename\*?=(?:UTF-8'')?"?([^;"]+)"?/i.exec(disposition);
    if (match && match[1]) {
      try {
        name = decodeURIComponent(match[1]);
      } catch {
        name = match[1];
      }
    }
  }
  const blob = new Blob([res.data]);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default api;
