import ExcelJS from 'exceljs';

export interface ExportColumn {
  header: string;
  key: string;
  width?: number;
  /** قالب‌بندی مقادیر تاریخ به تاریخ شمسی */
  date?: boolean;
}

/** ساخت فایل CSV با BOM برای سازگاری با Excel فارسی */
export function buildCsvBuffer(headers: string[], rows: (string | number | null | undefined)[][]): Buffer {
  const escape = (value: string | number | null | undefined): string => {
    if (value === null || value === undefined) return '';
    const raw = String(value);
    // Spreadsheet applications otherwise interpret user-controlled text as formulas.
    const s = typeof value === 'string' && /^[\s\u0000-\u001f]*[=+@-]/.test(raw) ? `'${raw}` : raw;
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [headers.map(escape).join(',')];
  for (const row of rows) lines.push(row.map(escape).join(','));
  return Buffer.from('﻿' + lines.join('\r\n'), 'utf8');
}

/** ساخت فایل Excel (xlsx) */
export async function buildExcelBuffer(
  sheetName: string,
  columns: ExportColumn[],
  rows: Record<string, unknown>[],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'سامانه مدیریت منابع انسانی «سنا»';
  workbook.created = new Date();
  const sheet = workbook.addWorksheet(sheetName, {
    views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }],
  });

  sheet.columns = columns.map((c) => ({
    header: c.header,
    key: c.key,
    width: c.width ?? 18,
  }));

  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E3A8A' },
  };
  sheet.getRow(1).alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(1).height = 22;

  for (const row of rows) sheet.addRow(row);

  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: columns.length },
  };

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export function contentTypeFor(format: string): string {
  return format === 'xlsx'
    ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    : 'text/csv; charset=utf-8';
}

/** ساخت خروجی CSV یا Excel بر اساس فرمت درخواستی */
export async function buildExportBuffer(
  format: string,
  sheetName: string,
  columns: ExportColumn[],
  rows: Record<string, unknown>[],
): Promise<Buffer> {
  if (format === 'xlsx') return buildExcelBuffer(sheetName, columns, rows);
  const headers = columns.map((c) => c.header);
  const body = rows.map((r) => columns.map((c) => (r[c.key] ?? '') as string | number | null));
  return buildCsvBuffer(headers, body);
}
