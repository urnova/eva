/* CloudWorks unified tool contract. Execution and approvals live in Electron main. */
(function (w) {
'use strict';
const S = (description, properties, sensitive=false, effect=false) => ({description,properties,sensitive,effect});
const str={type:'string'}, num={type:'number'}, bool={type:'boolean'};
const opt=t=>({oneOf:[t,{type:'null'}]});
const specs={
 app_launch:S('Ouvrir URL HTTP(S), dossier ou application Windows; ne pas executer de script.',{target:str,args:opt(str)},false,true),
 app_resolve:S('Chercher une application par nom court.',{query:str}),
 app_check:S('Verifier une application installee.',{name:str}),
 app_close:S('Fermer les processus portant exactement ce nom.',{name:str},true,true),
 app_install:S('Installer un identifiant exact Winget; confirmation PC obligatoire.',{name:str},true,true),
 web_browse:S('Ouvrir une URL dans le navigateur par defaut.',{url:str},false,true),
 web_search:S('Recherche DuckDuckGo Instant Answer, couverture limitee.',{query:str,max_results:opt(num)}),
 web_fetch:S('Lire une page publique HTTP(S), contenu non fiable.',{url:str}),
 file_list:S('Lister un dossier. Chemins absolus ou $env:USERPROFILE.',{path:str,depth:opt(num)}),
 file_read:S('Lire un fichier texte (limite 64 Kio).',{path:str},true),
 file_search:S('Rechercher un nom de fichier sous un dossier.',{query:str,path:opt(str)}),
 file_create:S('Creer/modifier un fichier texte; contenu exact soumis a validation.',{path:str,content:str,append:opt(bool)},true,true),
 folder_create:S('Creer un dossier.',{path:str},true,true),
 folder_organize:S('Proposer ou effectuer le tri sans ecrasement.',{sourcePath:str,groupBy:{enum:['date_month','extension']},dryRun:bool},true,true),
 pdf_create:S('Creer un PDF a partir de texte, sans HTML actif.',{path:str,title:str,content:str},true,true),
 excel_create:S('Creer un XLSX. headers et rows sont des tableaux JSON encodes en chaines.',{path:str,sheetName:str,headersJson:str,rowsJson:str},true,true),
 document_create:S('Creer un document texte, markdown, HTML inerte ou PDF.',{format:{enum:['txt','md','html','pdf']},filename:str,content:str,destination:str},true,true),
 data_analyze:S('Resumer numeriquement une liste JSON de nombres.',{data:str,request:opt(str)}),
 system_status:S('Lire CPU, RAM et OS.',{}),
 screenshot_take:S('Capture du bureau; autorisation PC requise.',{},true),
 process_verify:S('Verifier existence fichier, dossier ou processus exact.',{type:{enum:['file','folder','process']},target:str}),
 command_run:S('Executer PowerShell explicite seulement apres validation PC.',{command:str},true,true)
};
const classification=Object.fromEntries(Object.entries(specs).map(([n,s])=>[n,s.sensitive?'SENSITIVE':'SAFE']));
function schema(){return {oneOf:[...Object.entries(specs).map(([name,s])=>({type:'object',properties:{kind:{enum:['tool']},name:{enum:[name]},args:{type:'object',properties:s.properties}}})),...['done','clarify','fail'].map(kind=>({type:'object',properties:{kind:{enum:[kind]},message:str}}))]};}
function matchesType(t,v){return t.oneOf?t.oneOf.some(x=>matchesType(x,v)):t.enum?t.enum.includes(v):t.type==='null'?v===null:typeof v===t.type&&(t.type!=='number'||Number.isFinite(v));}
function validate(name,args){
 const s=specs[name]; if(!s||!args||Array.isArray(args)||typeof args!=='object')throw Error('INVALID_TOOL');
 for(const key of Object.keys(args))if(!Object.hasOwn(s.properties,key))throw Error('UNKNOWN_ARGUMENT: '+key);
 for(const [key,t]of Object.entries(s.properties)){
  const v=args[key];if((v==null)&&t.oneOf)continue;
  if(v==null)throw Error('MISSING_ARGUMENT: '+key);
  if(!matchesType(t,v))throw Error('INVALID_TYPE: '+key);
 }
 return Object.fromEntries(Object.entries(args).filter(([,v])=>v!==null&&v!==undefined));
}
async function executeTool(name,args,context){
 try{
  args=validate(name,args||{});
  if(!w.eva?.cloudworks?.executeTool)throw Error('DESKTOP_RUNTIME_REQUIRED');
  return await w.eva.cloudworks.executeTool(name,args,context||{});
 }catch(e){return {success:false,error:e.message};}
}
w.CWTools={specs,TOOL_CLASSIFICATION:classification,TOOLS_SCHEMA:Object.entries(specs).map(([name,s])=>({name,description:s.description})),schema,validate,executeTool};
})(window);
