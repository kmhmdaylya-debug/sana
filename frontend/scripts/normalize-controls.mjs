import fs from 'node:fs';
import ts from 'typescript';
const pages = fs.readdirSync('src/pages').map(name=>`src/pages/${name}`);
let patch='*** Begin Patch\n';
for(const file of pages){
  const before=fs.readFileSync(file,'utf8');
  const source=ts.createSourceFile(file,before,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const edits=[],needed=new Set();
  function walk(node){
    if(ts.isJsxSelfClosingElement(node)||ts.isJsxOpeningElement(node)){
      const tag=node.tagName.getText(source);
      const names={input:'Input',select:'Select',textarea:'Textarea'};
      const type=node.attributes.properties.find(a=>ts.isJsxAttribute(a)&&a.name.getText(source)==='type');
      if(names[tag]&&!(type?.initializer&&ts.isStringLiteral(type.initializer)&&['radio','checkbox'].includes(type.initializer.text))){
        needed.add(names[tag]); edits.push({start:node.tagName.getStart(source),end:node.tagName.end,text:names[tag]});
        if(ts.isJsxOpeningElement(node)) edits.push({start:node.parent.closingElement.tagName.getStart(source),end:node.parent.closingElement.tagName.end,text:names[tag]});
      }
    }
    ts.forEachChild(node,walk);
  }
  walk(source);
  for(const statement of source.statements.filter(ts.isImportDeclaration)){
    if(!statement.moduleSpecifier.text.endsWith('components/ui'))continue;
    const bindings=statement.importClause?.namedBindings;
    if(bindings&&ts.isNamedImports(bindings)){
      const existing=bindings.elements.map(e=>e.name.text);
      const extra=[...needed].filter(name=>!existing.includes(name));
      if(extra.length)edits.push({start:bindings.getStart(source)+1,end:bindings.getStart(source)+1,text:' '+extra.join(', ')+','});
    }
  }
  let after=before;
  for(const edit of edits.sort((a,b)=>b.start-a.start))after=after.slice(0,edit.start)+edit.text+after.slice(edit.end);
  if(after===before)continue;
  patch+=`*** Update File: frontend/${file}\n`;
  const left=before.split(/\r?\n/),right=after.split(/\r?\n/);
  const groups=[];
  left.forEach((line,index)=>{if(line===right[index])return;const last=groups[groups.length-1];if(last&&index<=last.end+5)last.end=index;else groups.push({start:index,end:index});});
  for(const group of groups){patch+='@@\n';for(let i=Math.max(0,group.start-2);i<=Math.min(left.length-1,group.end+2);i++)patch+=left[i]===right[i]?' '+left[i]+'\n':'-'+left[i]+'\n'+'+'+right[i]+'\n';}
}
console.log(JSON.stringify(patch+'*** End Patch'));
