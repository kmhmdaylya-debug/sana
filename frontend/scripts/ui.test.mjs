import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import jalaali from 'jalaali-js';
import { JSDOM } from 'jsdom';

async function loadPureModule(path) {
  const code = ts.transpileModule(fs.readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions:{ module:ts.ModuleKind.ESNext, target:ts.ScriptTarget.ES2022 } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
}
const format = await loadPureModule('../src/lib/format.ts');
const search = await loadPureModule('../src/lib/search.ts');
const deadline = await loadPureModule('../src/lib/deadline.ts');
const categories = await loadPureModule('../src/lib/workCategories.ts');

const require = createRequire(import.meta.url);
function loadIsolatedModule(path, mocks, globals = {}) {
  const source = fs.readFileSync(new URL(path, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, { ...globals, module, exports: module.exports,
    require: id => Object.hasOwn(mocks, id) ? mocks[id] : require(id),
  }, { filename: path });
  return module.exports;
}

const workflow = loadIsolatedModule('../src/lib/workflowPayloads.ts', { './format': format });

test('Tehran form times do not depend on the phone timezone and preserve historical daylight saving', () => {
  assert.equal(workflow.tehranDateTime('۱۴۰۵/۰۸/۲۵', '۰۸:۳۰'), '2026-11-16T05:00:00.000Z');
  assert.equal(workflow.tehranDateTime('2020-07-01', '08:00'), '2020-07-01T03:30:00.000Z');
  for (const time of ['', '25:00', '12:80', 'bad']) assert.throws(() => workflow.tehranDateTime('2026-11-16', time));
});

test('attendance corrections send the actual field/newValue DTO and retain the input on errors', () => {
  const form = { employeeId: 'synthetic-employee', workDate: '1405/08/25', field: 'firstIn', newValue: '08:00', reason: '  Synthetic correction  ' };
  const output = workflow.attendanceCorrectionPayload(form);
  assert.deepEqual(JSON.parse(JSON.stringify(output)), { employeeId: form.employeeId, workDate: '2026-11-16', field: 'firstIn', newValue: '2026-11-16T04:30:00.000Z', reason: 'Synthetic correction' });
  const before = JSON.stringify(form);
  assert.throws(() => workflow.attendanceCorrectionPayload({ ...form, newValue: 'invalid' }));
  assert.equal(JSON.stringify(form), before);
  assert.ok(!('firstIn' in output) && !('lastOut' in output));
});

test('mission form sends startAt/endAt and rejects reversed intervals and unsafe costs', () => {
  const form = { employeeId: 'synthetic-employee', title: 'Synthetic mission', destination: 'Synthetic destination', startDate: '1405/08/25', startTime: '08:00', endDate: '1405/08/25', endTime: '16:00', purpose: '', estimatedCost: 1000 };
  const payload = workflow.missionPayload(form);
  assert.equal(payload.startAt, '2026-11-16T04:30:00.000Z');
  assert.equal(payload.endAt, '2026-11-16T12:30:00.000Z');
  assert.ok(!('fromAt' in payload) && !('toAt' in payload) && !('startDate' in payload));
  assert.throws(() => workflow.missionPayload({ ...form, endTime: '07:00' }));
  assert.throws(() => workflow.missionPayload({ ...form, estimatedCost: -10 }));
});

test('asset form includes companyId and purchasePrice without the old purchaseValue field', () => {
  const form = { code: 'AST-TEST', name: 'Synthetic asset', category: 'EQUIPMENT', serialNumber: '', purchasePrice: 1000, note: '' };
  const payload = workflow.assetPayload(form, 'synthetic-company');
  assert.equal(payload.companyId, 'synthetic-company');
  assert.equal(payload.purchasePrice, 1000);
  assert.ok(!('purchaseValue' in payload));
  assert.throws(() => workflow.assetPayload(form, null));
  for (const price of [-1, 1.2, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => workflow.assetPayload({ ...form, purchasePrice: price }, 'synthetic-company'));
});

test('leave form includes the employee and sends Tehran timestamps without mutating failed input', () => {
  const form = { employeeId: 'synthetic-employee', leaveTypeId: 'synthetic-type', startDate: '1405/08/25', startTime: '08:00', endDate: '1405/08/25', endTime: '09:00', reason: '  Synthetic leave  ' };
  const payload = workflow.leavePayload(form);
  assert.equal(payload.employeeId, form.employeeId);
  assert.equal(payload.startAt, '2026-11-16T04:30:00.000Z');
  assert.equal(payload.endAt, '2026-11-16T05:30:00.000Z');
  assert.equal(payload.reason, 'Synthetic leave');
  const before = JSON.stringify(form);
  assert.throws(() => workflow.leavePayload({ ...form, endTime: '07:00' }));
  assert.throws(() => workflow.leavePayload({ ...form, employeeId: '' }));
  assert.equal(JSON.stringify(form), before);
});

test('mission completion requires a report and a safe integer cost', () => {
  const payload = workflow.missionCompletionPayload('  Synthetic completion  ', 2000);
  assert.equal(payload.report, 'Synthetic completion');
  assert.equal(payload.actualCost, 2000);
  assert.throws(() => workflow.missionCompletionPayload('', 100));
  for (const amount of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => workflow.missionCompletionPayload('Synthetic report', amount));
});

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

test('task calendar deadlines end at the next Tehran midnight regardless of device timezone', () => {
  const end = Date.parse('2026-11-15T20:30:00Z');
  for (const date of ['2026-11-15', '2026-11-15T00:00:00.000Z', '2026-11-15T00:00:00Z']) {
    assert.equal(deadline.taskDeadlineAt(date), end);
  }
  for (const day of ['2026-01-31', '2026-02-28', '2026-12-31']) {
    const next = new Date(`${day}T00:00:00Z`).getTime() + 86400000 - 12600000;
    assert.equal(deadline.taskDeadlineAt(day), next);
  }
});

test('explicit deadline times are preserved and invalid deadlines are ignored', () => {
  for (const date of ['2026-11-15T15:45:00Z', '2026-11-15T23:59:00+03:30']) {
    assert.equal(deadline.taskDeadlineAt(date), Date.parse(date));
  }
  for (const date of [null, undefined, '', 'bad', '2026-02-30', '2026-13-01', '2026-02-30T10:00:00Z']) {
    assert.equal(deadline.taskDeadlineAt(date), null);
  }
});

test('countdown enters the 72-hour window and never resets to 72 hours on refresh', () => {
  const end = Date.parse('2026-11-18T20:30:00Z');
  assert.equal(deadline.taskCountdown(end, 'NEW', end - deadline.COUNTDOWN_WINDOW_MS - 1), null);
  assert.equal(deadline.taskCountdown(end, 'NEW', end - deadline.COUNTDOWN_WINDOW_MS).text, '72:00:00');
  assert.equal(deadline.taskCountdown(end, 'IN_PROGRESS', end - 48 * 3600000).text, '48:00:00');
  assert.equal(deadline.taskCountdown(end, 'IN_PROGRESS', end - 48 * 3600000 + 1000).text, '47:59:59');
  assert.equal(deadline.taskCountdown(end, 'NEW', end - 100).text, '00:00:01');
});

test('urgent, expired and finished task countdown states are correct', () => {
  const now = Date.parse('2026-11-15T20:30:00Z');
  assert.equal(deadline.taskCountdown(now + 25 * 3600000, 'NEW', now).urgent, false);
  assert.equal(deadline.taskCountdown(now + 24 * 3600000, 'NEW', now).urgent, true);
  for (const end of [now, now - 1000]) {
    const counter = deadline.taskCountdown(end, 'IN_PROGRESS', now);
    assert.equal(counter.expired, true);
    assert.equal(counter.text, '00:00:00');
    assert.equal(counter.fraction, 0);
  }
  for (const status of ['DONE', 'CANCELLED']) assert.equal(deadline.taskCountdown(now, status, now), null);
  assert.equal(deadline.taskCountdown(null, 'NEW', now), null);
  assert.equal(deadline.taskCountdown(NaN, 'NEW', now), null);
});

test('all countdowns share one clock, pause in background and catch up without drift', () => {
  let time = 1000;
  let nextId = 0;
  const intervals = new Map();
  const documentEvents = new Map();
  const windowEvents = new Map();
  const document = {
    hidden: false,
    addEventListener: (type, listener) => documentEvents.set(type, listener),
    removeEventListener: type => documentEvents.delete(type),
  };
  const window = {
    setInterval: (listener, delay) => { assert.equal(delay, 1000); intervals.set(++nextId, listener); return nextId; },
    clearInterval: id => intervals.delete(id),
    addEventListener: (type, listener) => windowEvents.set(type, listener),
    removeEventListener: type => windowEvents.delete(type),
  };
  const clock = loadIsolatedModule('../src/lib/useDeadlineClock.ts', {
    react: { useSyncExternalStore: (subscribe, snapshot) => ({ subscribe, snapshot }) },
  }, { document, window, Date: { now: () => time } });
  const first = clock.useDeadlineClock(true);
  const second = clock.useDeadlineClock(true);
  const unsubscribeFirst = first.subscribe(() => {});
  const unsubscribeSecond = second.subscribe(() => {});
  assert.equal(intervals.size, 1);
  time += 7000;
  [...intervals.values()][0]();
  assert.equal(first.snapshot(), time);
  assert.equal(second.snapshot(), time);
  document.hidden = true;
  documentEvents.get('visibilitychange')();
  assert.equal(intervals.size, 0);
  time += 60000;
  document.hidden = false;
  documentEvents.get('visibilitychange')();
  assert.equal(first.snapshot(), time);
  assert.equal(intervals.size, 1);
  time += 3000;
  windowEvents.get('focus')();
  assert.equal(second.snapshot(), time);
  assert.equal(intervals.size, 1);
  unsubscribeFirst();
  assert.equal(intervals.size, 1);
  unsubscribeSecond();
  assert.equal(intervals.size, 0);
  assert.equal(documentEvents.size + windowEvents.size, 0);
  clock.useDeadlineClock(false).subscribe(() => {})();
  assert.equal(intervals.size, 0);
  clock.useDeadlineClock(true).subscribe(() => {})();
  assert.equal(intervals.size, 0);
});

test('countdown markup uses Persian LTR digits, a quiet timer and no timer for finished tasks', () => {
  const now = Date.parse('2026-11-15T20:30:00Z');
  const Countdown = loadIsolatedModule('../src/components/TaskCountdown.tsx', {
    '../lib/deadline': deadline, '../lib/format': format,
    '../lib/useDeadlineClock': { useDeadlineClock: () => now },
  }, { Date: { now: () => now } }).default;
  const render = (dueDate, status = 'NEW') => renderToStaticMarkup(React.createElement(Countdown, { dueDate, status }));
  const html = render('2026-11-17');
  assert.match(html, /۴۸:۰۰:۰۰/);
  assert.match(html, /role="timer"/);
  assert.match(html, /aria-live="off"/);
  assert.match(html, /dir="ltr"/);
  assert.doesNotMatch(html, /is-urgent/);
  assert.match(render('2026-11-16'), /is-urgent/);
  assert.match(render('2026-11-15'), /مهلت تمام شد/);
  for (const status of ['DONE', 'CANCELLED']) assert.equal(render('2026-11-17', status), '');
  assert.equal(render('2026-11-20'), '');
  assert.equal(render(null), '');
});

test('all task views use the shared countdown and motion respects reduced-motion preference', () => {
  for (const path of ['pages/EmployeePanel.tsx', 'components/TeamWork.tsx', 'pages/Tasks.tsx', 'pages/Dashboard.tsx']) {
    const source = fs.readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');
    assert.match(source, /<TaskCountdown dueDate=\{/);
  }
  const motion = fs.readFileSync(new URL('../src/styles/motion.css', import.meta.url), 'utf8');
  const tokens = fs.readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8');
  assert.match(motion, /@media \(prefers-reduced-motion: no-preference\)/);
  assert.match(tokens, /prefers-reduced-motion: reduce/);
  assert.match(tokens, /transition-duration: \.01ms !important/);
  assert.match(motion, /font-variant-numeric: tabular-nums/);
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
  assert.ok(paths.has('/employees'));
  assert.ok(paths.has('/employees/:employeeId'));
  assert.equal(paths.size,32);
});
test('the employee panel has no self-attendance controls', () => {
  const panel=fs.readFileSync(new URL('../src/pages/EmployeePanel.tsx',import.meta.url),'utf8');
  const clock=fs.readFileSync(new URL('../src/components/DailyAttendance.tsx',import.meta.url),'utf8');
  assert.doesNotMatch(panel,/check-in|value="attendance"|submitCheckIn/);
  assert.doesNotMatch(clock,/api\.get|api\.post|api\.patch/);
});
test('the employee home has no service selector and personal services remain reachable', () => {
  const panel=fs.readFileSync(new URL('../src/pages/EmployeePanel.tsx',import.meta.url),'utf8');
  const layout=fs.readFileSync(new URL('../src/layout/Layout.tsx',import.meta.url),'utf8');
  assert.doesNotMatch(panel,/employee-panel-nav|aria-label="خدمات پرسنلی"/);
  assert.match(panel,/searchParams\.get\('view'\)/);
  for (const view of ['projects','leaves','missions','payroll','profile']) {
    assert.ok(layout.includes(`/panel?view=${view}`),`Missing personal view ${view}`);
  }
});
test('compact employee task buttons retain accessible action names and reason handling', () => {
  const panel=fs.readFileSync(new URL('../src/pages/EmployeePanel.tsx',import.meta.url),'utf8');
  const source=ts.createSourceFile('EmployeePanel.tsx',panel,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const buttons=[];
  const attribute=(button,name)=>button.openingElement.attributes.properties.find(prop=>ts.isJsxAttribute(prop) && prop.name.getText(source)===name)?.initializer;
  const walk=node=>{
    if (ts.isJsxElement(node) && node.openingElement.tagName.getText(source)==='Button') buttons.push(node);
    ts.forEachChild(node,walk);
  };
  walk(source);
  const find=className=>{
    const button=buttons.find(node=>attribute(node,'className')?.text?.split(' ').includes(className));
    assert.ok(button,`Missing ${className}`);
    return button;
  };
  const visibleText=button=>button.children.filter(ts.isJsxText).map(node=>node.text.trim()).filter(Boolean).join(' ');
  const start=find('employee-task-start');
  assert.equal(visibleText(start),'شروع');
  for (const [className,label,icon] of [['employee-task-done','انجام شد','Check'],['employee-task-unable','نتوانستم انجام بدهم','X']]) {
    const button=find(className);
    assert.equal(visibleText(button),'');
    assert.equal(attribute(button,'aria-label')?.text,label);
    assert.equal(attribute(button,'title')?.text,label);
    assert.ok(button.children.some(node=>ts.isJsxSelfClosingElement(node) && node.tagName.getText(source)===icon));
  }
  const done=find('employee-task-done');
  const unable=find('employee-task-unable');
  assert.match(attribute(done,'onClick').expression.getText(source),/report\(task, 'DONE'\)/);
  assert.equal(attribute(unable,'variant')?.text,'danger');
  assert.match(attribute(unable,'onClick').expression.getText(source),/setUnableTask\(task\)/);
  assert.match(panel,/result === 'UNABLE' && !reason\.trim\(\)/);
});

test('circular task status marks distinguish progress, problems, completion and cancellation', () => {
  const Mark = loadIsolatedModule('../src/components/TaskStatusMark.tsx', {}).default;
  for (const [status, blocked, state] of [
    ['NEW', false, 'new'], ['IN_PROGRESS', false, 'progress'],
    ['IN_PROGRESS', true, 'blocked'], ['BLOCKED', false, 'blocked'],
    ['DONE', true, 'done'], ['CANCELLED', true, 'cancelled'],
  ]) {
    const html = renderToStaticMarkup(React.createElement(Mark, { status, blocked }));
    assert.ok(html.includes(`task-status-mark is-${state}`));
    assert.match(html, /aria-hidden="true"/);
    assert.doesNotMatch(html, /<button/);
  }
});

test('employee task redesign renders real progress and retains all task actions on one screen', () => {
  const now = Date.parse('2026-11-15T20:30:00Z');
  const Countdown = loadIsolatedModule('../src/components/TaskCountdown.tsx', {
    '../lib/deadline': deadline, '../lib/format': format,
    '../lib/useDeadlineClock': { useDeadlineClock: () => now },
  }, { Date: { now: () => now } }).default;
  const Mark = loadIsolatedModule('../src/components/TaskStatusMark.tsx', {}).default;
  const rows = [
    { id: '1', title: 'کار در حال انجام', status: 'IN_PROGRESS', priority: 'MEDIUM', dueDate: '2026-11-17' },
    { id: '2', title: 'کار جدید با عنوان بلند و کاراکتر <خاص>', status: 'NEW', priority: 'HIGH' },
    { id: '3', title: 'کار دارای مشکل', status: 'IN_PROGRESS', priority: 'MEDIUM', delayReason: 'در انتظار تأیید مدیر' },
    { id: '4', title: 'کار تمام شده', status: 'DONE', priority: 'MEDIUM' },
    { id: '5', title: 'کار لغو شده', status: 'CANCELLED', priority: 'MEDIUM' },
  ];
  const list = { rows, total: rows.length, loading: false, error: '' };
  const WorkCategory = loadIsolatedModule('../src/components/WorkCategory.tsx', { '../lib/workCategories': categories });
  const Panel = loadIsolatedModule('../src/pages/EmployeePanel.tsx', {
    'react-router-dom': { useSearchParams: () => [new URLSearchParams()] },
    '../lib/auth': { useAuth: () => ({ user: { fullName: 'کارمند نمونه', employee: {} } }) },
    '../lib/useList': { useList: () => list },
    '../lib/api': { api: {}, apiErrorMessage: () => '' },
    '../lib/format': format,
    '../components/TaskCountdown': { default: Countdown },
    '../components/TaskStatusMark': { default: Mark },
    '../components/WorkCategory': WorkCategory,
    '../lib/workCategories': categories,
    '../components/ui': {
      useToast: () => () => {}, Modal: () => null,
      DatePicker: () => null, Select: () => null, Textarea: () => null,
      Field: ({ children }) => React.createElement('div', null, children),
      PageHeader: ({ title }) => React.createElement('h1', null, title),
      Button: ({ children, variant, loading, size, ...props }) => React.createElement('button', props, children),
    },
  }).default;
  const render = () => renderToStaticMarkup(React.createElement(Panel));
  const html = render();
  assert.match(html, /<h1>task<\/h1>/);
  assert.match(html, /aria-label="پیشرفت task"[^>]+aria-valuenow="25"/);
  assert.match(html, /<dt>کار باز<\/dt><dd>۳<\/dd>/);
  assert.match(html, /<dt>در حال انجام<\/dt><dd>۱<\/dd>/);
  assert.match(html, /<dt>انجام‌شده<\/dt><dd>۱<\/dd>/);
  assert.equal((html.match(/class="employee-task-row/g) ?? []).length, 5);
  assert.equal((html.match(/class="employee-task-row is-pinned/g) ?? []).length, 1);
  assert.match(html, /<details class="employee-task-row is-complete">/);
  assert.match(html, /حذف کار تمام شده از فهرست من/);
  assert.match(html, /کار جدید با عنوان بلند و کاراکتر &lt;خاص&gt;/);
  assert.match(html, /در انتظار تأیید مدیر/);
  assert.match(html, /۴۸:۰۰:۰۰/);
  assert.equal((html.match(/aria-label="انجام شد"/g) ?? []).length, 2);
  assert.equal((html.match(/aria-label="نتوانستم انجام بدهم"/g) ?? []).length, 2);
  assert.match(html, /درخواست انجام دوباره/);
  assert.doesNotMatch(html, /type="search"|جستجوی task|employee-panel-nav/);
  list.loading = true;
  assert.doesNotMatch(render(), /role="progressbar"|class="employee-task-row/);
  list.loading = false;
  list.error = 'خطا در دریافت';
  assert.match(render(), /role="alert"/);
  assert.doesNotMatch(render(), /role="progressbar"/);
  list.error = '';
  list.rows = [];
  assert.match(render(), /task برای نمایش نیست/);
  assert.doesNotMatch(render(), /role="progressbar"/);
  list.rows = [{ ...rows[2], retryStatus: 'PENDING' }];
  const pending = render();
  assert.match(pending, /در انتظار تأیید مدیر برای انجام دوباره/);
  assert.doesNotMatch(pending, /class="employee-task-retry"|aria-label="انجام شد"/);
});

test('reference palette has readable foreground contrast in both themes', () => {
  const postcss = require('postcss');
  const css = postcss.parse(fs.readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8'));
  const theme = {};
  const luminance = hex => {
    const values = hex.slice(1).match(/../g).map(value => parseInt(value, 16) / 255)
      .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
    return values[0] * .2126 + values[1] * .7152 + values[2] * .0722;
  };
  for (const selector of [':root', "html[data-theme='light']"]) {
    const rule = css.nodes.find(node => node.selector === selector);
    rule.walkDecls(decl => { theme[decl.prop] = decl.value; });
    for (const [foreground, background] of [
      ['--text', '--surface'], ['--text-muted', '--surface'], ['--text-soft', '--surface-2'],
      ['--on-primary', '--primary'], ['--on-primary', '--primary-hover'],
      ['--green-600', '--green-50'], ['--red-600', '--red-50'],
      ['--task-active-text', '--task-active-bg'], ['--text', '--task-done-bg'], ['--text', '--task-blocked-bg'],
    ]) {
      const values = [luminance(theme[foreground]), luminance(theme[background])].sort((a, b) => b - a);
      const contrast = (values[0] + .05) / (values[1] + .05);
      assert.ok(contrast >= 4.5, `${selector} ${foreground} on ${background}: ${contrast.toFixed(2)}`);
    }
  }
});

test('shared categories have stable validated colors and match the persisted enum', () => {
  const schema = fs.readFileSync(new URL('../../backend/prisma/schema.prisma', import.meta.url), 'utf8');
  const keys = schema.match(/enum WorkCategory\s*\{([^}]+)\}/)[1].trim().split(/\s+/);
  assert.deepEqual(categories.WORK_CATEGORIES.map(item => item.key).sort(), keys.sort());
  assert.equal(new Set(categories.WORK_CATEGORIES.map(item => item.color)).size, 6);
  for (const item of categories.WORK_CATEGORIES) {
    assert.match(item.color, /^#[0-9a-f]{6}$/i);
    assert.equal(categories.categoryColor(item.key), item.color);
    assert.equal(categories.categoryStyle(item.key)['--category-color'], item.color);
  }
  for (const key of [null, undefined, '', 'red', 'url(evil)']) {
    assert.equal(categories.getWorkCategory(key), undefined);
    assert.equal(categories.categoryStyle(key), undefined);
  }
});

test('category choices use labeled native radios and visible selected swatches', () => {
  const { WorkCategoryPicker, WorkCategoryTag } = loadIsolatedModule('../src/components/WorkCategory.tsx', { '../lib/workCategories': categories });
  const picker = renderToStaticMarkup(React.createElement(WorkCategoryPicker, { value: 'DESIGN', onChange: () => {} }));
  assert.match(picker, /<legend>دسته‌بندی رنگی<\/legend>/);
  assert.equal((picker.match(/type="radio"/g) ?? []).length, 7);
  assert.equal((picker.match(/checked=""/g) ?? []).length, 1);
  assert.match(picker.match(/<input[^>]*checked=""[^>]*>/)?.[0] ?? '', /value="DESIGN"/);
  assert.match(picker, /طراحی/);
  assert.match(picker, /background:#bca3e8/);
  assert.equal(renderToStaticMarkup(React.createElement(WorkCategoryTag, { value: 'unknown' })), '');
  assert.match(renderToStaticMarkup(React.createElement(WorkCategoryTag, { value: 'DESIGN' })), /طراحی/);
});

test('retry review controls are limited to pending requests and request rejection retains a reason field', () => {
  const Review = loadIsolatedModule('../src/components/TaskRetryReview.tsx', {
    '../lib/api': { api: {}, apiErrorMessage: () => '' },
    './ui': {
      useToast: () => () => {}, Modal: () => null,
      Field: ({ children }) => React.createElement('div', null, children), Textarea: () => null,
      Button: ({ children, variant, loading, size, ...props }) => React.createElement('button', props, children),
    },
  }).default;
  const render = retryStatus => renderToStaticMarkup(React.createElement(Review, { task: { id: '1', title: 'Task', retryStatus }, onReviewed: () => {} }));
  assert.match(render('PENDING'), /درخواست انجام دوباره/);
  assert.match(render('PENDING'), /تأیید/);
  assert.match(render('PENDING'), /رد/);
  for (const state of ['APPROVED', 'REJECTED', null]) assert.equal(render(state), '');
  const source = fs.readFileSync(new URL('../src/components/TaskRetryReview.tsx', import.meta.url), 'utf8');
  assert.match(source, /!approved && !reason\.trim\(\)/);
});

test('optional task row colors do not change other tables', () => {
  const Table = loadIsolatedModule('../src/components/ui/DataTable.tsx', {}).DataTable;
  const props = { columns: [{ key: 'title', header: 'عنوان' }], rows: [{ id: '1', title: 'Task' }] };
  const plain = renderToStaticMarkup(React.createElement(Table, props));
  assert.doesNotMatch(plain, /task-state/);
  const colored = renderToStaticMarkup(React.createElement(Table, { ...props, rowClassName: () => 'task-state-done' }));
  const document = new JSDOM(colored).window.document;
  assert.equal(document.querySelector('tbody tr').classList.contains('task-state-done'), true);
  assert.equal(document.querySelector('tbody td').dataset.label, 'عنوان');
  assert.equal(document.querySelector('tbody td').textContent, 'Task');
});

test('icon navigation keeps employee permissions, personal links and saved sidebar preference', () => {
  const stored = new Map();
  const Anchor = ({ to, end, className, children, ...props }) => React.createElement('a', {
    ...props, href: to, className: typeof className === 'function' ? className({ isActive: to === '/panel' }) : className,
  }, children);
  const Layout = loadIsolatedModule('../src/layout/Layout.tsx', {
    'react-router-dom': {
      Link: Anchor, NavLink: Anchor, Outlet: () => React.createElement('div', { 'data-outlet': true }),
      useNavigate: () => () => {}, useLocation: () => ({ pathname: '/panel', search: '' }),
    },
    '../lib/auth': { useAuth: () => ({
      user: { fullName: 'کارمند نمونه', username: 'employee', employee: {}, roles: [] },
      logout: () => {}, hasPermission: permission => ['panel.view', 'notifications.view'].includes(permission),
    }) },
    '../lib/api': { api: {} }, '../lib/format': format,
    '../lib/theme': { readTheme: () => 'dark', applyTheme: () => {} },
    '../components/ChangePassword': { default: () => null },
    '../components/DailyAttendance': { default: () => null },
    '../components/GlobalSearch': { default: () => null },
    '../components/PageBoundary': { default: ({ children }) => children },
  }, { localStorage: { getItem: key => stored.get(key) ?? null } }).default;
  const render = () => renderToStaticMarkup(React.createElement(Layout));
  const compact = render();
  assert.match(compact, /class="app-shell sidebar-collapsed"/);
  assert.match(compact, /class="sidebar-link-icon" aria-hidden="true"/);
  assert.match(compact, /title="task"/);
  assert.match(compact, /class="profile-summary-copy"/);
  assert.doesNotMatch(compact, /href="\/attendance"|href="\/users"|href="\/"/);
  for (const view of ['projects', 'leaves', 'missions', 'payroll', 'profile']) assert.ok(compact.includes(`/panel?view=${view}`));
  assert.match(compact, /data-outlet="true"/);
  stored.set('sana-sidebar', 'expanded');
  assert.match(render(), /class="app-shell"/);
});
