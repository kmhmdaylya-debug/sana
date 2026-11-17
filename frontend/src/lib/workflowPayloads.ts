import { parseDateInput, toEnglishDigits } from './format';

export function tehranDateTime(date: string, time: string): string {
  const day = parseDateInput(date);
  const clock = toEnglishDigits(time).trim();
  if (!day || !/^([01]\d|2[0-3]):[0-5]\d$/.test(clock)) throw new Error('تاریخ و ساعت معتبر را وارد کنید.');
  const naive = Date.parse(`${day}T${clock}:00Z`);
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  let instant = naive;
  for (let i = 0; i < 3; i += 1) {
    const parts = Object.fromEntries(formatter.formatToParts(instant).map(part => [part.type, part.value]));
    const displayed = Date.parse(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}Z`);
    instant += naive - displayed;
  }
  const parts = Object.fromEntries(formatter.formatToParts(instant).map(part => [part.type, part.value]));
  if (`${parts.year}-${parts.month}-${parts.day}` !== day || `${parts.hour}:${parts.minute}` !== clock) throw new Error('این ساعت در منطقه زمانی تهران معتبر نیست.');
  return new Date(instant).toISOString();
}

export function attendanceCorrectionPayload(form: { employeeId: string; workDate: string; field: 'firstIn' | 'lastOut'; newValue: string; reason: string }) {
  const workDate = parseDateInput(form.workDate);
  if (!form.employeeId || !workDate || form.reason.trim().length < 3) throw new Error('کارمند، تاریخ و دلیل اصلاح را کامل کنید.');
  return { employeeId: form.employeeId, workDate, field: form.field, newValue: tehranDateTime(workDate, form.newValue), reason: form.reason.trim() };
}

export function missionPayload(form: { employeeId: string; title: string; destination: string; startDate: string; startTime: string; endDate: string; endTime: string; purpose: string; estimatedCost: number }) {
  if (!form.employeeId || form.title.trim().length < 3 || form.destination.trim().length < 2) throw new Error('کارمند، عنوان و مقصد مأموریت را کامل کنید.');
  const startAt = tehranDateTime(form.startDate, form.startTime);
  const endAt = tehranDateTime(form.endDate, form.endTime);
  if (startAt >= endAt) throw new Error('پایان مأموریت باید بعد از شروع آن باشد.');
  if (!Number.isSafeInteger(form.estimatedCost) || form.estimatedCost < 0) throw new Error('هزینه باید عدد صحیح و غیرمنفی باشد.');
  return { employeeId: form.employeeId, title: form.title.trim(), destination: form.destination.trim(), purpose: form.purpose.trim(), startAt, endAt, estimatedCost: form.estimatedCost };
}

export function leavePayload(form: { employeeId: string; leaveTypeId: string; startDate: string; startTime: string; endDate: string; endTime: string; reason: string }) {
  if (!form.employeeId || !form.leaveTypeId) throw new Error('کارمند و نوع مرخصی را انتخاب کنید.');
  const startAt = tehranDateTime(form.startDate, form.startTime);
  const endAt = tehranDateTime(form.endDate, form.endTime);
  if (startAt >= endAt) throw new Error('پایان مرخصی باید بعد از شروع آن باشد.');
  return { employeeId: form.employeeId, leaveTypeId: form.leaveTypeId, startAt, endAt, reason: form.reason.trim() };
}

export function missionCompletionPayload(report: string, actualCost: number) {
  if (report.trim().length < 3) throw new Error('گزارش پایان مأموریت را وارد کنید.');
  if (!Number.isSafeInteger(actualCost) || actualCost < 0) throw new Error('هزینه واقعی باید عدد صحیح و غیرمنفی باشد.');
  return { report: report.trim(), actualCost };
}

export function assetPayload(form: { code: string; name: string; category: string; serialNumber: string; purchasePrice: number; note: string }, companyId: string | null) {
  if (!companyId || !form.code.trim() || !form.name.trim() || !form.category.trim()) throw new Error('شرکت، کد، نام و دسته دارایی را کامل کنید.');
  if (!Number.isSafeInteger(form.purchasePrice) || form.purchasePrice < 0) throw new Error('قیمت خرید باید عدد صحیح و غیرمنفی باشد.');
  return { companyId, code: form.code.trim(), name: form.name.trim(), category: form.category.trim(), serialNumber: form.serialNumber.trim(), purchasePrice: form.purchasePrice, note: form.note.trim() };
}
