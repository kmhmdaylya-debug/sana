import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import React, { act } from 'react';
import ts from 'typescript';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://unit-test.invalid' });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import('react-dom/client');
const { Simulate } = await import('react-dom/test-utils');
const require = createRequire(import.meta.url);
const h = React.createElement;
let root;
let container;
let requests;
let errors;
let reloads;
let post;
const companies = [{ id: 'synthetic-company-a', name: 'Synthetic A' }, { id: 'synthetic-company-b', name: 'Synthetic B' }];
const api = {
  get: async () => ({ data: { data: companies } }),
  post: async (url, body) => { requests.push({ url, body }); return post(); },
};

function load(path, mocks) {
  const source = fs.readFileSync(new URL(path, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, AbortController, window: dom.window,
    require: id => Object.hasOwn(mocks, id) ? mocks[id] : require(id),
  }, { filename: path });
  return module.exports;
}

const format = load('../src/lib/format.ts', {});
const workflow = load('../src/lib/workflowPayloads.ts', { './format': format });
const ui = {
  PageHeader: ({ title, actions }) => h('header', null, h('h1', null, title), actions),
  Modal: ({ open, title, children, footer }) => open ? h('section', { role: 'dialog', 'aria-label': title }, children, footer) : null,
  Field: ({ label, children }) => h('label', null, h('span', null, label), children),
  Button: ({ loading, disabled, variant: _variant, size: _size, children, ...props }) => h('button', { ...props, disabled: disabled || loading }, children),
  Select: props => h('select', props),
  Input: props => h('input', props),
  Textarea: props => h('textarea', props),
  Card: ({ children }) => h('div', null, children),
  Badge: ({ children }) => h('span', null, children),
  DataTable: () => null,
  Pagination: () => null,
  ListToolbar: ({ children }) => h('div', null, children),
  useToast: () => (kind, message) => { if (kind === 'error') errors.push(message); },
};
const list = { rows: [], search: '', setSearch() {}, setFilter() {}, reload() { reloads++; } };
const { default: Assets } = load('../src/pages/Assets.tsx', {
  '../lib/api': { api, apiErrorMessage: error => error.message },
  '../lib/auth': { useAuth: () => ({ user: null, hasPermission: () => true }) },
  '../lib/useList': { useList: () => list },
  '../lib/workflowPayloads': workflow,
  '../lib/format': format,
  '../components/ui': ui,
});

async function mount() {
  requests = []; errors = []; reloads = 0; post = async () => ({});
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(h(Assets)));
  const create = [...container.querySelectorAll('button')].find(button => button.textContent.includes('دارایی جدید'));
  await act(async () => create.click());
}
function field(label) {
  return [...container.querySelectorAll('label')].find(element => element.firstElementChild?.textContent === label)?.querySelector('input,select,textarea');
}
function saveButton() { return [...container.querySelectorAll('[role="dialog"] button')].find(button => button.textContent === 'ثبت'); }
function change(label, value) { act(() => Simulate.change(field(label), { target: { value } })); }
function fill() { change('شرکت', companies[1].id); change('کد دارایی', 'AST-SYNTHETIC'); change('نام دارایی', 'Synthetic device'); change('دسته', 'EQUIPMENT'); change('ارزش خرید (ریال)', '1000'); }
afterEach(async () => { if (root) await act(async () => root.unmount()); root = null; container?.remove(); });

test('asset form requires an explicit company when multiple companies are available and sends the selected company', async () => {
  await mount();
  assert.equal(field('شرکت').value, '');
  assert.equal(saveButton().disabled, true);
  fill();
  await act(async () => saveButton().click());
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, '/assets');
  assert.equal(requests[0].body.companyId, companies[1].id);
  assert.equal(requests[0].body.purchasePrice, 1000);
  assert.equal('purchaseValue' in requests[0].body, false);
  assert.equal(reloads, 1);
  assert.equal(container.querySelector('[role="dialog"]'), null);
});

test('asset API rejection preserves all form input and permits a corrected retry', async () => {
  await mount(); fill();
  post = async () => { throw new Error('Synthetic validation failure'); };
  await act(async () => saveButton().click());
  assert.equal(field('نام دارایی').value, 'Synthetic device');
  assert.equal(field('ارزش خرید (ریال)').value, '1000');
  assert.equal(field('شرکت').value, companies[1].id);
  assert.equal(saveButton().disabled, false);
  assert.deepEqual(errors, ['Synthetic validation failure']);
  assert.equal(reloads, 0);
});

test('asset pending submission blocks a second click until the request finishes', async () => {
  await mount(); fill();
  let complete;
  post = () => new Promise(resolve => { complete = resolve; });
  await act(async () => saveButton().click());
  assert.equal(saveButton().disabled, true);
  await act(async () => saveButton().click());
  assert.equal(requests.length, 1);
  await act(async () => complete({}));
  assert.equal(reloads, 1);
});
