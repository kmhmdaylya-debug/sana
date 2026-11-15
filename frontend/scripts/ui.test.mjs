import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import jalaali from 'jalaali-js';

async function loadPureModule(path) {
  const code = ts.transpileModule(fs.readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions:{ module:ts.ModuleKind.ESNext, target:ts.ScriptTarget.ES2022 } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
}
const format = await loadPureModule('../src/lib/format.ts');
const search = await loadPureModule('../src/lib/search.ts');

test('Persian and Arabic digits normalize correctly', () => {
  assert.equal(format.toEnglishDigits('۱۴۰۵/٠٨/۲۴'), '1405/08/24');
  assert.equal(format.toPersianDigits(12345), '۱۲۳۴۵');
});
test('Jalali picker values parse to the existing ISO API contract', () => {
  assert.equal(format.parseDateInput('۱۴۰۵/۰۸/۲۴'), '2026-11-15');
  assert.equal(format.parseDateInput('14050824'), '2026-11-15');
  assert.equal(format.parseDateInput('2026-11-15'), '2026-11-15');
});
test('invalid dates and empty dates are rejected', () => {
  for (const value of ['', '1405/13/01', '1405/07/31', '2026-02-30', 'bad']) assert.equal(format.parseDateInput(value), undefined);
});
test('existing date conversion agrees with jalaali-js across month boundaries', () => {
  for (let month=1; month<=12; month++) {
    for (const day of [1,15,29]) {
      const g=jalaali.toGregorian(1405,month,day);
      const iso=`${g.gy}-${String(g.gm).padStart(2,'0')}-${String(g.gd).padStart(2,'0')}`;
      assert.equal(format.parseDateInput(`1405/${month}/${day}`),iso);
    }
  }
});
test('a deadline today is not overdue, even after its midnight timestamp', () => {
  const now = new Date('2026-11-15T14:00:00Z');
  assert.equal(format.isPastDueDate('2026-11-15',now),false);
  assert.equal(format.isPastDueDate('2026-11-14',now),true);
  assert.equal(format.isPastDueDate('2026-11-16',now),false);
});
test('overdue status changes at Tehran midnight', () => {
  assert.equal(format.isPastDueDate('2026-11-14',new Date('2026-11-14T20:29:59Z')),false);
  assert.equal(format.isPastDueDate('2026-11-14',new Date('2026-11-14T20:30:00Z')),true);
  assert.equal(format.isPastDueDate('invalid'),false);
  assert.equal(format.isPastDueDate(null),false);
});
test('document search uses title and employee fields with Arabic letter normalization', () => {
  const row={title:'گواهی',employee:{firstName:'علي',lastName:'كريمي',code:'EMP-123'}};
  assert.equal(search.matchesDocument(row,'علی کریمی'),true);
  assert.equal(search.matchesDocument(row,'EMP-123'),true);
  assert.equal(search.matchesDocument(row,'رضا'),false);
  assert.equal(search.matchesDocument({title:'قرارداد'},'قرارداد'),true);
});
test('the local variable font is a real WOFF2 asset', () => {
  const font=fs.readFileSync(new URL('../public/fonts/Vazirmatn.woff2',import.meta.url));
  assert.equal(font.subarray(0,4).toString(),'wOF2');
  assert.ok(font.length>100000);
});
test('every sidebar destination still has a route', () => {
  const app=fs.readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
  const layout=fs.readFileSync(new URL('../src/layout/Layout.tsx',import.meta.url),'utf8');
  const paths=new Set([...app.matchAll(/<Route path="([^"]+)"/g)].map(x=>x[1]));
  for (const [,path] of layout.matchAll(/to: '([^']+)'/g)) assert.ok(paths.has(path),`Missing route ${path}`);
  assert.equal(paths.size,30);
});
test('the employee panel has no self-attendance controls', () => {
  const panel=fs.readFileSync(new URL('../src/pages/EmployeePanel.tsx',import.meta.url),'utf8');
  const clock=fs.readFileSync(new URL('../src/components/DailyAttendance.tsx',import.meta.url),'utf8');
  assert.doesNotMatch(panel,/check-in|value="attendance"|submitCheckIn/);
  assert.doesNotMatch(clock,/api\.get|api\.post|api\.patch/);
});
