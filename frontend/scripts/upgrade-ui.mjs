import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const files = [...fs.readdirSync('src/pages').map(name => `src/pages/${name}`), 'src/components/TeamWork.tsx', 'src/components/TeamPresence.tsx'];
let patch = '*** Begin Patch\n';
const summary = [];
for (const file of files) {
  const original = fs.readFileSync(file, 'utf8');
  const source = ts.createSourceFile(file, original, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const edits = [];
  const add = (start,end,text) => edits.push({start,end,text});
  let datePickers = 0, tabs = 0;
  const attributes = node => new Map(node.attributes.properties.filter(ts.isJsxAttribute).map(a => [a.name.getText(source),a]));
  const expression = attribute => attribute?.initializer && ts.isJsxExpression(attribute.initializer) ? attribute.initializer.expression : undefined;
  function walk(node) {
    if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
      const tag = node.tagName.getText(source), attrs = attributes(node);
      if (tag === 'DataTable' && !attrs.has('error')) {
        const rows = expression(attrs.get('rows'));
        if (rows && ts.isPropertyAccessExpression(rows) && rows.name.text === 'rows') {
          const owner = rows.expression.getText(source);
          add(node.tagName.end,node.tagName.end,` error={${owner}.error} onRetry={${owner}.reload}`);
        }
      }
      if (tag === 'Pagination' && !attrs.has('onPageSizeChange')) {
        const page = expression(attrs.get('page'));
        if (page && ts.isPropertyAccessExpression(page) && page.name.text === 'page') {
          const owner = page.expression.getText(source);
          add(node.tagName.end,node.tagName.end,` pageSize={${owner}.pageSize} onPageSizeChange={${owner}.setPageSize}`);
        }
      }
      if (tag === 'ListToolbar' && !attrs.has('search')) {
        let owner;
        const callback = expression(attrs.get('onSearch'));
        const find = child => { if (ts.isPropertyAccessExpression(child) && child.name.text === 'setSearch') owner = child.expression.getText(source); ts.forEachChild(child,find); };
        if (callback) find(callback);
        if (owner) add(node.tagName.end,node.tagName.end,` search={${owner}.search}`);
      }
      if (tag === 'Input' && node.parent && ts.isJsxElement(node.parent) && node.parent.openingElement.tagName.getText(source) === 'Field') {
        const label = attributes(node.parent.openingElement).get('label')?.initializer;
        const labelText = label && ts.isStringLiteral(label) ? label.text : '';
        const change = attrs.get('onChange'), callback = expression(change);
        if (/تاریخ|مهلت/.test(labelText) && callback && ts.isArrowFunction(callback) && callback.parameters.length === 1) {
          const parameter = callback.parameters[0].name.getText(source);
          const valueReads = [];
          const find = child => {
            if (ts.isPropertyAccessExpression(child) && child.getText(source) === `${parameter}.target.value`) { valueReads.push(child); return; }
            ts.forEachChild(child,find);
          };
          find(callback.body);
          if (valueReads.length) {
            datePickers++;
            add(node.tagName.getStart(source),node.tagName.end,'DatePicker');
            add(change.name.getStart(source),change.name.end,'onValueChange');
            add(callback.parameters[0].name.getStart(source),callback.parameters[0].name.end,'value');
            for (const read of valueReads) add(read.getStart(source),read.end,'value');
            if (/میلادی/.test(labelText)) add(node.tagName.end,node.tagName.end,' output="iso"');
          }
        }
      }
      if (tag === 'div' && attrs.get('className')?.initializer && ts.isStringLiteral(attrs.get('className').initializer) && /\btabs\b/.test(attrs.get('className').initializer.text) && ts.isJsxOpeningElement(node)) {
        add(node.tagName.getStart(source),node.tagName.end,'Tabs');
        add(node.parent.closingElement.tagName.getStart(source),node.parent.closingElement.tagName.end,'Tabs'); tabs++;
      }
      const style = attrs.get('style'), styleExpression = expression(style);
      if (styleExpression && ts.isObjectLiteralExpression(styleExpression) && styleExpression.properties.length === 1) {
        const property = styleExpression.properties[0];
        if (ts.isPropertyAssignment(property) && property.name.getText(source) === 'padding' && ts.isStringLiteral(property.initializer) && !attrs.has('className')) {
          const className = { '14px 14px 0':'list-toolbar-wrap', '0 14px 14px':'list-pagination-wrap' }[property.initializer.text];
          if (className) add(style.getStart(source),style.end,`className="${className}"`);
        }
      }
    }
    ts.forEachChild(node,walk);
  }
  walk(source);
  if (datePickers || tabs) {
    for (const declaration of source.statements.filter(ts.isImportDeclaration)) {
      if (!/components\/ui$|^\.\/ui$/.test(declaration.moduleSpecifier.text)) continue;
      const bindings = declaration.importClause?.namedBindings;
      if (bindings && ts.isNamedImports(bindings)) {
        const existing = bindings.elements.map(element => element.name.text);
        const extra = [...(datePickers && !existing.includes('DatePicker') ? ['DatePicker'] : []), ...(tabs && !existing.includes('Tabs') ? ['Tabs'] : [])];
        if (extra.length) add(bindings.getStart(source)+1,bindings.getStart(source)+1,' '+extra.join(', ')+',');
      }
    }
  }
  let result = original;
  for (const edit of edits.sort((a,b) => b.start-a.start)) result=result.slice(0,edit.start)+edit.text+result.slice(edit.end);
  if (result !== original) {
    const before = original.split(/\r?\n/), after = result.split(/\r?\n/);
    const changed = before.map((line,index) => line !== after[index] ? index : -1).filter(index => index >= 0);
    const groups = [];
    for (const index of changed) {
      const last = groups[groups.length-1];
      if (last && index <= last.end + 5) last.end = index;
      else groups.push({start:index,end:index});
    }
    patch += `*** Update File: frontend/${file}\n`;
    for (const group of groups) {
      patch += '@@\n';
      for (let i=Math.max(0,group.start-2);i<=Math.min(before.length-1,group.end+2);i++) {
        if (before[i] === after[i]) patch += ' '+before[i]+'\n';
        else patch += '-'+before[i]+'\n'+'+'+after[i]+'\n';
      }
    }
    summary.push({ file, edits:edits.length, datePickers, tabs });
  }
}
patch += '*** End Patch';
console.log(JSON.stringify({patch,summary}));
