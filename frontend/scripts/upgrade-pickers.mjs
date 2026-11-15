import fs from 'node:fs';
import ts from 'typescript';
const options={employeeId:['/employees','کارمند'],toEmployeeId:['/employees','کارمند جایگزین'],courseId:['/training/courses','دوره آموزشی'],leaveTypeId:['/leaves/types','نوع مرخصی']};
let patch='*** Begin Patch\n';
for(const name of fs.readdirSync('src/pages')){
 const file=`src/pages/${name}`,before=fs.readFileSync(file,'utf8'),source=ts.createSourceFile(file,before,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),edits=[];
 const attr=(node,key)=>node.attributes.properties.find(a=>ts.isJsxAttribute(a)&&a.name.getText(source)===key);
 function visit(node){
  if(ts.isJsxSelfClosingElement(node)&&node.tagName.getText(source)==='Input'&&ts.isJsxElement(node.parent)&&node.parent.openingElement.tagName.getText(source)==='Field'){
   const value=attr(node,'value')?.initializer?.expression,change=attr(node,'onChange')?.initializer?.expression;
   const config=value&&ts.isPropertyAccessExpression(value)?options[value.name.text]:null;
   if(config&&change&&ts.isArrowFunction(change)){
    const parameter=change.parameters[0].name.getText(source);let body=change.body.getText(source);
    body=body.split(`${parameter}.target.value`).join('value');
    edits.push({start:node.getStart(source),end:node.end,text:`<EntityPicker value={${value.getText(source)}} onValueChange={(value) => ${body}} endpoint="${config[0]}" title="انتخاب ${config[1]}" />`});
    const label=attr(node.parent.openingElement,'label');if(label)edits.push({start:label.initializer.getStart(source),end:label.initializer.end,text:JSON.stringify(config[1])});
   }
  }
  ts.forEachChild(node,visit);
 }
 visit(source);if(!edits.length)continue;
 for(const statement of source.statements.filter(ts.isImportDeclaration))if(statement.moduleSpecifier.text.endsWith('components/ui')){const bindings=statement.importClause?.namedBindings;if(bindings&&ts.isNamedImports(bindings)&&!bindings.elements.some(e=>e.name.text==='EntityPicker'))edits.push({start:bindings.getStart(source)+1,end:bindings.getStart(source)+1,text:' EntityPicker,'});}
 let after=before;for(const e of edits.sort((a,b)=>b.start-a.start))after=after.slice(0,e.start)+e.text+after.slice(e.end);
 patch+=`*** Update File: frontend/${file}\n`;const left=before.split(/\r?\n/),right=after.split(/\r?\n/),groups=[];
 left.forEach((line,i)=>{if(line===right[i])return;const last=groups[groups.length-1];if(last&&i<=last.end+5)last.end=i;else groups.push({start:i,end:i});});
 for(const group of groups){patch+='@@\n';for(let i=Math.max(0,group.start-2);i<=Math.min(left.length-1,group.end+2);i++)patch+=left[i]===right[i]?' '+left[i]+'\n':'-'+left[i]+'\n'+'+'+right[i]+'\n';}
}
console.log(JSON.stringify(patch+'*** End Patch'));
