/**
 * انتقال متدهای دارای مسیر پارامتری (مثل :id) به انتهای کلاس کنترلر.
 * دلیل: در NestJS مسیرها به ترتیب اعلان بررسی می‌شوند و مسیرهای پارامتری،
 * مسیرهای ایستای بعد از خود را می‌پوشانند (مثل /evaluations/goals).
 *
 * اجرا: node scripts/fix-route-order.js
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');

function getControllerFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) getControllerFiles(full, out);
    else if (entry.name.endsWith('.controller.ts')) out.push(full);
  }
  return out;
}

/** استخراج اعضای کلاس (بلوک‌های توپ‌سطح داخل کلاس) */
function parseMembers(bodyLines) {
  const members = [];
  let current = null;
  let depth = 0;
  for (const line of bodyLines) {
    const isMemberStart =
      current === null &&
      (/^  @/.test(line) || /^  (public|private|protected|async|constructor|get|set)\b/.test(line));
    if (isMemberStart) {
      current = { lines: [line] };
      depth = 0;
      const open = (line.match(/\{/g) || []).length;
      const close = (line.match(/\}/g) || []).length;
      depth = open - close;
      if (depth <= 0 && !/^\s*\}$/.test(line) && !/\{/.test(line)) {
        // عضو بدون بدنه (فقط اعلان) — ادامه می‌دهیم تا } پایانی
      }
      continue;
    }
    if (current) {
      current.lines.push(line);
      depth += (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
      if (depth <= 0 && /^\s*\}$/.test(line)) {
        members.push(current);
        current = null;
      }
    }
  }
  if (current) members.push(current);
  return members;
}

function isParamRoute(member) {
  const text = member.lines.join('\n');
  const decorators = text.match(/@(Get|Post|Patch|Put|Delete)\(\s*'([^']*)'/g) || [];
  for (const d of decorators) {
    const m = d.match(/@(Get|Post|Patch|Put|Delete)\(\s*'([^']*)'/);
    if (m && m[2].includes(':')) return true;
  }
  return false;
}

function hasGetRoute(member) {
  return /@Get\(/.test(member.lines.join('\n'));
}

const files = getControllerFiles(SRC);
let changedFiles = 0;

for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  const lines = src.split(/\r?\n/);

  const classIdx = lines.findIndex((l) => /^export class \w+/.test(l));
  if (classIdx === -1) continue;
  const classEnd = lines.findIndex((l, i) => i > classIdx && l === '}');
  if (classEnd === -1) continue;

  const bodyLines = lines.slice(classIdx + 1, classEnd);
  const members = parseMembers(bodyLines);
  if (members.length < 2) continue;

  // اعضای بدون مسیر پارامتری و اعضای پارامتریِ غیر-GET دست‌نخورده می‌مانند
  const staticMembers = [];
  const paramMembers = [];
  let tail = []; // اعضای انتهای کلاس (بعد از آخرین عضو)
  for (const m of members) {
    if (isParamRoute(m) && hasGetRoute(m)) paramMembers.push(m);
    else staticMembers.push(m);
  }

  // بررسی: آیا واقعاً جابه‌جایی لازم است؟
  const firstParamIdx = members.findIndex((m) => paramMembers.includes(m));
  const lastStaticIdx = members.map((m) => members.indexOf(m)).filter((i) => !paramMembers.includes(members[i])).pop();
  if (firstParamIdx === -1 || lastStaticIdx === undefined || firstParamIdx > lastStaticIdx) continue;

  const reordered = [...staticMembers, ...paramMembers];
  const newBody = [];
  for (const m of reordered) newBody.push(...m.lines);

  const newLines = [
    ...lines.slice(0, classIdx + 1),
    ...newBody,
    ...lines.slice(classEnd),
  ];
  fs.writeFileSync(file, newLines.join('\r\n'), 'utf8');
  changedFiles++;
  console.log(`↕️  ${path.basename(file)} — ${paramMembers.length} مسیر پارامتری به انتها منتقل شد`);
}

console.log(`\n✅ ${changedFiles} کنترلر اصلاح شد.`);
