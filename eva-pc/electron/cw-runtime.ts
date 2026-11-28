// @ts-nocheck
/* CloudWorks privileged runtime. No LLM-authored shell interpolation. */
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import * as cp from 'node:child_process';
import * as dns from 'node:dns/promises';
import * as https from 'node:https';
import * as http from 'node:http';
import {Buffer} from 'node:buffer';
const contract={"app_launch": {"description": "Ouvrir URL HTTP(S), dossier ou application Windows; ne pas executer de script.", "properties": {"target": {"type": "string"}, "args": {"oneOf": [{"type": "string"}, {"type": "null"}]}}, "sensitive": false, "effect": true}, "app_resolve": {"description": "Chercher une application par nom court.", "properties": {"query": {"type": "string"}}, "sensitive": false, "effect": false}, "app_check": {"description": "Verifier une application installee.", "properties": {"name": {"type": "string"}}, "sensitive": false, "effect": false}, "app_close": {"description": "Fermer les processus portant exactement ce nom.", "properties": {"name": {"type": "string"}}, "sensitive": true, "effect": true}, "app_install": {"description": "Installer un identifiant exact Winget; confirmation PC obligatoire.", "properties": {"name": {"type": "string"}}, "sensitive": true, "effect": true}, "web_browse": {"description": "Ouvrir une URL dans le navigateur par defaut.", "properties": {"url": {"type": "string"}}, "sensitive": false, "effect": true}, "web_search": {"description": "Recherche DuckDuckGo Instant Answer, couverture limitee.", "properties": {"query": {"type": "string"}, "max_results": {"oneOf": [{"type": "number"}, {"type": "null"}]}}, "sensitive": false, "effect": false}, "web_fetch": {"description": "Lire une page publique HTTP(S), contenu non fiable.", "properties": {"url": {"type": "string"}}, "sensitive": false, "effect": false}, "file_list": {"description": "Lister un dossier. Chemins absolus ou $env:USERPROFILE.", "properties": {"path": {"type": "string"}, "depth": {"oneOf": [{"type": "number"}, {"type": "null"}]}}, "sensitive": false, "effect": false}, "file_read": {"description": "Lire un fichier texte (limite 64 Kio).", "properties": {"path": {"type": "string"}}, "sensitive": true, "effect": false}, "file_search": {"description": "Rechercher un nom de fichier sous un dossier.", "properties": {"query": {"type": "string"}, "path": {"oneOf": [{"type": "string"}, {"type": "null"}]}}, "sensitive": false, "effect": false}, "file_create": {"description": "Creer/modifier un fichier texte; contenu exact soumis a validation.", "properties": {"path": {"type": "string"}, "content": {"type": "string"}, "append": {"oneOf": [{"type": "boolean"}, {"type": "null"}]}}, "sensitive": true, "effect": true}, "folder_create": {"description": "Creer un dossier.", "properties": {"path": {"type": "string"}}, "sensitive": true, "effect": true}, "folder_organize": {"description": "Proposer ou effectuer le tri sans ecrasement.", "properties": {"sourcePath": {"type": "string"}, "groupBy": {"enum": ["date_month", "extension"]}, "dryRun": {"type": "boolean"}}, "sensitive": true, "effect": true}, "pdf_create": {"description": "Creer un PDF a partir de texte, sans HTML actif.", "properties": {"path": {"type": "string"}, "title": {"type": "string"}, "content": {"type": "string"}}, "sensitive": true, "effect": true}, "excel_create": {"description": "Creer un XLSX. headers et rows sont des tableaux JSON encodes en chaines.", "properties": {"path": {"type": "string"}, "sheetName": {"type": "string"}, "headersJson": {"type": "string"}, "rowsJson": {"type": "string"}}, "sensitive": true, "effect": true}, "document_create": {"description": "Creer un document texte, markdown, HTML inerte ou PDF.", "properties": {"format": {"enum": ["txt", "md", "html", "pdf"]}, "filename": {"type": "string"}, "content": {"type": "string"}, "destination": {"type": "string"}}, "sensitive": true, "effect": true}, "data_analyze": {"description": "Resumer numeriquement une liste JSON de nombres.", "properties": {"data": {"type": "string"}, "request": {"oneOf": [{"type": "string"}, {"type": "null"}]}}, "sensitive": false, "effect": false}, "system_status": {"description": "Lire CPU, RAM et OS.", "properties": {}, "sensitive": false, "effect": false}, "screenshot_take": {"description": "Capture du bureau; autorisation PC requise.", "properties": {}, "sensitive": true, "effect": false}, "process_verify": {"description": "Verifier existence fichier, dossier ou processus exact.", "properties": {"type": {"enum": ["file", "folder", "process"]}, "target": {"type": "string"}}, "sensitive": false, "effect": false}, "command_run": {"description": "Executer PowerShell explicite seulement apres validation PC.", "properties": {"command": {"type": "string"}}, "sensitive": true, "effect": true}};
const cancelled=new Set();
const dangerousExtensions=/\.(exe|com|bat|cmd|ps1|vbs|js|mjs|cjs|lnk|url|hta|scr|msi)$/i;
const text=(v,max=8192)=>{if(typeof v!=='string'||v.length>max||v.includes('\0'))throw Error('INVALID_STRING');return v;};
const fail=e=>({success:false,error:e?.message||String(e)});
const ok=result=>({success:true,result});
function matchesType(t,v){return t.oneOf?t.oneOf.some(x=>matchesType(x,v)):t.enum?t.enum.includes(v):t.type==='null'?v===null:typeof v===t.type&&(t.type!=='number'||Number.isFinite(v));}
function validate(name,args){
 if(['session_lock','system_sleep','system_shutdown'].includes(name))return {};
 const s=contract[name];if(!s||!args||Array.isArray(args)||typeof args!=='object')throw Error('INVALID_TOOL');
 if(JSON.stringify(args).length>150000)throw Error('ARGUMENTS_TOO_LARGE');
 for(const k of Object.keys(args))if(!Object.hasOwn(s.properties,k))throw Error('UNKNOWN_ARGUMENT: '+k);
 for(const [k,t]of Object.entries(s.properties)){
  const v=args[k];if(v==null&&t.oneOf)continue;if(v==null)throw Error('MISSING_ARGUMENT: '+k);
  if(!matchesType(t,v))throw Error('INVALID_TYPE: '+k);
 }
 return JSON.parse(JSON.stringify(args));
}
const KNOWN_SITES:Record<string,string>={
 youtube:'https://www.youtube.com','youtube.com':'https://www.youtube.com',
 google:'https://www.google.com','google.fr':'https://www.google.fr','google.com':'https://www.google.com',
 gmail:'https://mail.google.com',chatgpt:'https://chatgpt.com',
 github:'https://github.com',twitch:'https://www.twitch.tv',netflix:'https://www.netflix.com',
 wikipedia:'https://fr.wikipedia.org',reddit:'https://www.reddit.com',
 instagram:'https://www.instagram.com',twitter:'https://x.com',x:'https://x.com',
 linkedin:'https://www.linkedin.com',amazon:'https://www.amazon.fr',
 canva:'https://www.canva.com',notion:'https://www.notion.so',facebook:'https://www.facebook.com'
};
const APP_ALIASES:Record<string,string>={
 edge:'msedge.exe','microsoft edge':'msedge.exe',msedge:'msedge.exe',
 chrome:'chrome.exe','google chrome':'chrome.exe',
 firefox:'firefox.exe','mozilla firefox':'firefox.exe',
 brave:'brave.exe',opera:'opera.exe',
 vscode:'code.exe','vs code':'code.exe','visual studio code':'code.exe',
 'bloc-notes':'notepad.exe','bloc notes':'notepad.exe',blocnotes:'notepad.exe',notepad:'notepad.exe',
 calculatrice:'calc.exe',calc:'calc.exe',calculator:'calc.exe',
 explorateur:'explorer.exe','explorateur de fichiers':'explorer.exe',explorer:'explorer.exe',
 paint:'mspaint.exe',mspaint:'mspaint.exe',
 terminal:'wt.exe','windows terminal':'wt.exe',
 word:'winword.exe',excel:'excel.exe',powerpoint:'powerpnt.exe',
 'gestionnaire des taches':'taskmgr.exe','gestionnaire des tâches':'taskmgr.exe','task manager':'taskmgr.exe',
 parametres:'ms-settings:',paramètres:'ms-settings:',settings:'ms-settings:'
};
function resolveSiteUrl(raw:string):string|null{
 const s=String(raw||'').trim().replace(/^["']|["']$/g,'');
 if(!s)return null;
 if(/^https?:\/\//i.test(s))return httpURL(s).href;
 const low=s.toLowerCase();
 if(Object.hasOwn(KNOWN_SITES,low))return KNOWN_SITES[low];
 if(!/[\\/\s]/.test(s)&&/^[a-z0-9-]+(\.[a-z0-9-]+)+([/?#].*)?$/i.test(s)&&!/\.(exe|com|bat|cmd|ps1|vbs|js|py|txt|md|html?|css|pdf|xlsx|csv|json|xml|png|jpe?g|svg|lnk|dll)$/i.test(s)){
  return httpURL('https://'+s).href;
 }
 return null;
}
function normalizeAppAlias(raw:string):string{
 const clean=String(raw||'').trim().replace(/^["']|["']$/g,'');
 const low=clean.toLowerCase();
 return Object.hasOwn(APP_ALIASES,low)?APP_ALIASES[low]:clean;
}
async function resolveDesktopDir(){
 for(const c of [path.join(os.homedir(),'Desktop'),path.join(os.homedir(),'Bureau'),path.join(os.homedir(),'OneDrive','Desktop'),path.join(os.homedir(),'OneDrive','Bureau')]){
  try{if((await fs.stat(c)).isDirectory())return c;}catch(_){}
 }
 return path.join(os.homedir(),'Desktop');
}
function httpURL(value){const u=new URL(text(value,4096));if(!['https:','http:'].includes(u.protocol)||u.username||u.password)throw Error('URL_NOT_ALLOWED');return u;}
async function localPath(value,write=false){
 let p=text(value,4096).trim().replace(/^["']|["']$/g,'');
 const desk=await resolveDesktopDir();
 p=p.replace(/\$env:DESKTOP|%DESKTOP%/gi,desk)
  .replace(/\$env:USERPROFILE|%USERPROFILE%|\$env:HOME|\$HOME|%HOMEPATH%|^~/gi,os.homedir())
  .replace(/\$env:USERNAME|%USERNAME%/gi,os.userInfo().username);
 if(/^(Desktop|Bureau)([\\/]|$)/i.test(p))p=path.join(desk,p.replace(/^(Desktop|Bureau)[\\/]?/i,''));
 else if(/^Documents([\\/]|$)/i.test(p))p=path.join(os.homedir(),'Documents',p.replace(/^Documents[\\/]?/i,''));
 else if(/^(Downloads|T[eé]l[eé]chargements)([\\/]|$)/i.test(p))p=path.join(os.homedir(),'Downloads',p.replace(/^(Downloads|T[eé]l[eé]chargements)[\\/]?/i,''));
 if(!path.isAbsolute(p)||/^\\\\/.test(p)||/^\\[?.]\\/.test(p)||/\$env:|%[A-Z_]+%/i.test(p))throw Error('ABSOLUTE_LOCAL_PATH_REQUIRED');
 p=path.resolve(p);
 const frDesktop=path.join(os.homedir(),'Bureau');
 const enDesktop=path.join(os.homedir(),'Desktop');
 if(p.toLowerCase()===frDesktop.toLowerCase()||p.toLowerCase().startsWith(frDesktop.toLowerCase()+path.sep)){
  try{await fs.stat(frDesktop);}catch(_){p=desk+p.slice(frDesktop.length);}
 }else if(p.toLowerCase()===enDesktop.toLowerCase()||p.toLowerCase().startsWith(enDesktop.toLowerCase()+path.sep)){
  try{await fs.stat(enDesktop);}catch(_){p=desk+p.slice(enDesktop.length);}
 }
 if(process.platform==='win32'&&p.slice(3).includes(':'))throw Error('NTFS_STREAM_NOT_ALLOWED');
 // Resolve nearest existing parent and reject symlinks/reparse escapes.
 let probe=p;
 for(let i=0;i<64;i++){
  try{const canonical=await fs.realpath(probe);if(canonical.toLowerCase()!==probe.toLowerCase())throw Error('SYMLINK_PATH_NOT_ALLOWED');break;}
  catch(e){if(e.code!=='ENOENT')throw e;const parent=path.dirname(probe);if(parent===probe)throw e;probe=parent;}
 }
 const roots=[process.env.SystemRoot,path.join(os.homedir(),'AppData','Roaming','EVA Assistant')].filter(Boolean);
 if(write&&roots.some(r=>p.toLowerCase()===r.toLowerCase()||p.toLowerCase().startsWith(r.toLowerCase()+path.sep)))throw Error('PROTECTED_PATH');
 return p;
}
function execFile(file,args=[],signal,timeout=30000){return new Promise((resolve,reject)=>{
 cp.execFile(file,args,{windowsHide:true,timeout,maxBuffer:1024*1024,signal,encoding:'utf8'},(e,stdout,stderr)=>e?reject(Error((stderr||e.message).slice(0,1500))):resolve(stdout));
});}
function ps(script,params,signal){
 const data=Buffer.from(JSON.stringify(params),'utf8').toString('base64');
 const prefix="$ErrorActionPreference='Stop'; [Console]::OutputEncoding=[Text.Encoding]::UTF8; $p=ConvertFrom-Json ([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('"+data+"'))); ";
 return execFile('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(prefix+script,'utf16le').toString('base64')],signal);
}
function privateIP(ip){
 if(ip.includes(':'))return true; // Deliberately refuse IPv6 for public fetch until a dedicated IP policy is installed.
 const a=ip.split('.').map(Number);
 return a[0]===0||a[0]===10||a[0]===127||a[0]>=224||(a[0]===169&&a[1]===254)||(a[0]===172&&a[1]>=16&&a[1]<=31)||(a[0]===192&&a[1]===168)||(a[0]===100&&a[1]>=64&&a[1]<=127);
}
async function publicFetch(value,signal){
 let url=httpURL(value);
 for(let i=0;i<5;i++){
  const addresses=await dns.lookup(url.hostname,{all:true,family:4});
  if(!addresses.length||addresses.some(a=>privateIP(a.address)))throw Error('PRIVATE_ADDRESS_DENIED');
  const pinned=addresses[0];
  const page=await new Promise((resolve,reject)=>{
   const req=(url.protocol==='https:'?https:http).get(url,{signal,lookup:(_host,_options,cb)=>cb(null,pinned.address,pinned.family)},res=>{
    if(res.statusCode>=300&&res.statusCode<400){res.resume();resolve({redirect:res.headers.location});return;}
    if(res.statusCode<200||res.statusCode>=300){res.resume();reject(Error('HTTP_'+res.statusCode));return;}
    let total=0;const chunks=[];
    res.on('data',chunk=>{total+=chunk.length;if(total>300000){req.destroy(Error('PAGE_TOO_LARGE'));return;}chunks.push(chunk);});
    res.on('error',reject);res.on('end',()=>resolve({text:Buffer.concat(chunks).toString('utf8')}));
   });
   req.on('error',reject);
  });
  if(page.redirect){url=httpURL(new URL(page.redirect,url).href);continue;}
  return {url:url.href,text:page.text};
 }
 throw Error('TOO_MANY_REDIRECTS');
}
function xml(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));}
function zipStored(entries){
 const locals=[],centrals=[];let offset=0;
 for(const [name,value]of entries){const data=Buffer.from(value),n=Buffer.from(name);let crc=0xffffffff;
  for(const b of data){crc^=b;for(let k=0;k<8;k++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}crc=(crc^0xffffffff)>>>0;
  const h=Buffer.alloc(30);h.writeUInt32LE(0x04034b50);h.writeUInt16LE(20,4);h.writeUInt32LE(crc,14);h.writeUInt32LE(data.length,18);h.writeUInt32LE(data.length,22);h.writeUInt16LE(n.length,26);
  const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt32LE(crc,16);c.writeUInt32LE(data.length,20);c.writeUInt32LE(data.length,24);c.writeUInt16LE(n.length,28);c.writeUInt32LE(offset,42);
  locals.push(h,n,data);centrals.push(c,n);offset+=h.length+n.length+data.length;
 }
 const central=Buffer.concat(centrals),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(central.length,12);end.writeUInt32LE(offset,16);
 return Buffer.concat([...locals,central,end]);
}
function parseJsonArray(v:any,label:string){
 if(Array.isArray(v))return v;
 try{const p=JSON.parse(String(v||''));if(Array.isArray(p))return p;}catch(_){}
 throw Error(label+'_INVALID_JSON_ARRAY');
}
function xlsx(args){
 const headers=parseJsonArray(args.headersJson,'HEADERS'),rows=parseJsonArray(args.rowsJson,'ROWS');
 if(!headers.length||rows.some(r=>!Array.isArray(r)||r.length>100)||headers.length>100||rows.length>1000)throw Error('INVALID_TABLE');
 const cell=(v)=>typeof v==='number'&&Number.isFinite(v)?'<c><v>'+v+'</v></c>':'<c t="inlineStr"><is><t xml:space="preserve">'+xml(v)+'</t></is></c>';
 const sheet='<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'+[headers,...rows].map(row=>'<row>'+row.map(cell).join('')+'</row>').join('')+'</sheetData></worksheet>';
 return zipStored([
 ['[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'],
 ['_rels/.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
 ['xl/workbook.xml','<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="'+xml((args.sheetName||'Sheet1').replace(/[\\/?*\[\]:]/g,'').slice(0,31)||'Sheet1')+'" sheetId="1" r:id="rId1"/></sheets></workbook>'],
 ['xl/_rels/workbook.xml.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'],['xl/worksheets/sheet1.xml',sheet]
 ]);
}
export function installCWRuntime({ipcMain,dialog,shell,BrowserWindow,store,mainWindow,assertSender,abortLLM,onApprovalOverlay}:any){
 const running=new Map();
 const pendingApprovals=new Map<string,{resolve:(ok:boolean)=>void,reject:(e:Error)=>void,timer:NodeJS.Timeout}>();
 const resolveApproval=(id:string,approved:boolean)=>{
  const entry=pendingApprovals.get(id);
  if(!entry)return false;
  clearTimeout(entry.timer);
  pendingApprovals.delete(id);
  entry.resolve(!!approved);
  return true;
 };
 ipcMain.handle('cw:status',event=>{assertSender(event);return {enabled:!!store.get('cwEnabled',false),autonomousMode:!!store.get('cwAutonomousMode',false),hostname:os.hostname(),protocol:2};});
 ipcMain.handle('cw:respond-approval',(event,id:string,approved:boolean)=>{assertSender(event);text(id,200);return {success:resolveApproval(id,!!approved)};});
 ipcMain.handle('cw:cancel',(event,id)=>{assertSender(event);text(id,200);cancelled.add(id);const entry=pendingApprovals.get(id);if(entry){clearTimeout(entry.timer);pendingApprovals.delete(id);entry.reject(Error('CANCELLED'));}running.get(id)?.abort();abortLLM(id);setTimeout(()=>cancelled.delete(id),3600000).unref();return {success:true};});
 ipcMain.handle('cw:execute',async(event,name,input,context={})=>{
  let timer=null,controller=null,id=null;
  try{
   assertSender(event);if(!store.get('cwEnabled',false))throw Error('CLOUDWORKS_DISABLED');
   id=text(context.taskId,200);if(!id)throw Error('TASK_ID_REQUIRED');if(cancelled.has(id))throw Error('CANCELLED');
   if(running.has(id))throw Error('TOOL_BUSY');
   const args=validate(name,input);controller=new AbortController();running.set(id,controller);
   if(name==='pdf_create'&&args.path&&!/\.pdf$/i.test(args.path))args.path+='.pdf';
   if(name==='excel_create'&&args.path&&!/\.xlsx$/i.test(args.path))args.path+='.xlsx';
   // Normalise every path before showing the exact operation for approval.
   for(const k of ['path','sourcePath','destination'])if(args[k]!=null)args[k]=await localPath(args[k],['file_create','folder_create','folder_organize','pdf_create','excel_create','document_create'].includes(name));
   if(name==='document_create'){
    if(path.basename(args.filename)!==args.filename||args.filename.includes('..'))throw Error('INVALID_FILENAME');
    args.path=await localPath(path.join(args.destination,args.filename),true);
   }
   const sensitive=contract[name]?.sensitive||['session_lock','system_sleep','system_shutdown'].includes(name);
   const alwaysApprove=['command_run','app_install','app_close','system_shutdown','session_lock','system_sleep'].includes(name);
   const autonomous=!!store.get('cwAutonomousMode',false);
   if(sensitive&&(alwaysApprove||!autonomous)){
    const win=mainWindow();
    const summaryMap:Record<string,string>={
     file_create:'Créer le fichier '+path.basename(args.path||'fichier'),
     folder_create:'Créer le dossier '+path.basename(args.path||'dossier'),
     folder_organize:'Trier le dossier '+path.basename(args.sourcePath||'dossier'),
     pdf_create:'Créer le PDF '+path.basename(args.path||'document.pdf'),
     excel_create:'Créer le fichier Excel '+path.basename(args.path||'classeur.xlsx'),
     document_create:'Créer le document '+(args.filename||'document'),
     file_read:'Lire le fichier '+path.basename(args.path||'fichier'),
     screenshot_take:'Prendre une capture d\'écran du PC',
     app_close:'Fermer l\'application '+(args.name||''),
     app_install:'Installer '+(args.name||''),
     command_run:'Exécuter une commande PowerShell',
     session_lock:'Verrouiller la session Windows',
     system_sleep:'Mettre le PC en veille',
     system_shutdown:'Éteindre le PC'
    };
    const summary=summaryMap[name]||('Autoriser '+name);
    const approved=await new Promise<boolean>((resolve,reject)=>{
     const approvalTimer=setTimeout(()=>{
      pendingApprovals.delete(id);
      reject(Error('APPROVAL_TIMEOUT'));
     },120000);
     pendingApprovals.set(id,{resolve,reject,timer:approvalTimer});
     try{if(win&&!win.isDestroyed())win.webContents.send('cw:approval-pending',{taskId:id,tool:name,args,summary});}catch(_){}
     try{onApprovalOverlay?.({taskId:id,tool:name,summary});}catch(_){}
    });
    if(!approved)throw Error('APPROVAL_DENIED');
   }
   if(cancelled.has(id)||controller.signal.aborted)throw Error('CANCELLED');
   timer=setTimeout(()=>controller.abort(),45000);
   const signal=controller.signal;
   let result;
   switch(name){
    case 'system_status':result={platform:os.platform(),hostname:os.hostname(),cpu:os.cpus()[0]?.model,totalmem:os.totalmem(),freemem:os.freemem(),summary:'Informations systeme recuperees'};break;
    case 'app_resolve':case 'app_check':{
     const qRaw=text(args.query||args.name,100).trim();
     const siteUrl=resolveSiteUrl(qRaw);
     const normalized=normalizeAppAlias(qRaw);
     const psQuery=`$q=$p.q; $nq=$p.nq; $items=@();
      $qEsc=[regex]::Escape($q);
      $allApps=@(Get-StartApps);
      $exactApps=$allApps | Where-Object { $_.Name -ieq $q -or $_.AppID -ieq $q -or $_.Name -ieq $nq -or $_.AppID -ieq $nq -or $_.Name -ieq ("Microsoft "+$q) -or $_.Name -ieq ("Google "+$q) };
      $wordApps=$allApps | Where-Object { $_.Name -match ("\\b"+$qEsc+"\\b") };
      $subApps=$allApps | Where-Object { $_.Name -like ("*"+$q+"*") -or ($nq -ne $q -and $_.Name -like ("*"+$nq+"*")) };
      foreach($ap in @("HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\*","HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\*","HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\App Paths\\*")){
       Get-ItemProperty $ap -ErrorAction SilentlyContinue | Where-Object { $_.PSChildName -ieq $nq -or $_.PSChildName -ieq ($q+".exe") -or $_.PSChildName -like ("*"+$q+"*") } | Select-Object -First 5 | ForEach-Object {
        $exe=$_.('(default)'); if($exe){ $exe=([string]$exe).Trim('"'); if(Test-Path $exe){ $items+=@{Name=$_.PSChildName;path=$exe;isPWA=$false} } }
       }
      };
      $cmd=Get-Command -Name $nq -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1;
      if(-not $cmd -and $nq -ne $q){ $cmd=Get-Command -Name $q -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1 };
      if($cmd){$items+=@{Name=$cmd.Name;path=$cmd.Source;isPWA=$false}};
      $seenApps=@{};
      foreach($a in @($exactApps) + @($wordApps) + @($subApps)){
       if(-not $a -or -not $a.AppID -or $seenApps.ContainsKey($a.AppID)){ continue };
       $seenApps[$a.AppID]=$true;
       $isPwa=($a.AppID -match "_|chrome|msedge|brave|Web|App" -or $a.AppID -like "*!*");
       $items+=@{Name=$a.Name;AppID=$a.AppID;isPWA=[bool]$isPwa};
       if($items.Count -ge 12){ break }
      };
      $regPaths=@("HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*","HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*","HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*");
      foreach($rp in $regPaths){
       Get-ItemProperty $rp -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -like ("*"+$q+"*") } | Select-Object -First 5 | ForEach-Object {
        $iconExe=$null; if($_.DisplayIcon){ $m=[regex]::Match($_.DisplayIcon,'([^",]+\.exe)'); if($m.Success -and (Test-Path $m.Groups[1].Value)){ $iconExe=$m.Groups[1].Value } };
        $items+=@{Name=$_.DisplayName;path=$iconExe;icon=$_.DisplayIcon;installLocation=$_.InstallLocation;isPWA=($_.DisplayIcon -match "msedge|chrome|brave" -or $_.UninstallString -match "--app-id=")}
       }
      };
      ConvertTo-Json -InputObject @($items) -Compress`;
     const out=await ps(psQuery,{q:qRaw,nq:normalized},signal);
     const matches=JSON.parse(out||'[]');
     if(siteUrl){
      matches.unshift({Name:qRaw+' (Web)',url:siteUrl,isWeb:true,isPWA:false});
     }
     const primaryMatch=matches.find((m:any)=>m.url)||matches.find((m:any)=>m.AppID||m.path)||matches[0]||null;
     result={found:matches.length>0,installed:matches.length>0,matches,primaryMatch};break;
    }
    case 'app_launch':case 'web_browse':{
     const rawTarget=text(args.target||args.url,4096).trim().replace(/^["']|["']$/g,'');
     const rawArgs=String(args.args||'').trim().replace(/^["']|["']$/g,'');
     if(name==='web_browse'){
      const url=resolveSiteUrl(rawTarget);
      if(!url)throw Error('HTTP_URL_REQUIRED');
      await shell.openExternal(url);
      result={accepted:true,opened:url,verifiedRunning:false,summary:'URL ouverte dans le navigateur : '+url};break;
     }
     const browserURL=rawArgs?(resolveSiteUrl(rawArgs)||httpURL(rawArgs).href):null;
     if(!browserURL){
      const directSite=resolveSiteUrl(rawTarget);
      if(directSite){
       await shell.openExternal(directSite);
       result={accepted:true,opened:directSite,verifiedRunning:false,summary:'Site web ouvert dans le navigateur : '+directSite};break;
      }
     }
     const target=normalizeAppAlias(rawTarget);
     const baseLower=path.basename(target).toLowerCase();
     const isAllowedBrowser=/^(msedge|chrome|firefox|brave|opera)(\.exe)?$/i.test(baseLower);
     if(browserURL&&!isAllowedBrowser)throw Error('BROWSER_ARGUMENTS_ONLY');
     if(/^ms-settings:[\w-]*$/i.test(target)){
      await ps('Start-Process $p.uri -ErrorAction Stop',{uri:target},signal);
      result={accepted:true,opened:target,verifiedRunning:false,summary:'Parametres Windows ouverts : '+target};break;
     }
     const looksLikeFsPath=path.isAbsolute(target)||/^(\$env:|%[A-Z_]+%|~|(Desktop|Bureau|Documents|Downloads|T[eé]l[eé]chargements)[\\/])/i.test(target)||(/[\\/]/.test(target)&&!/^[a-z0-9._-]+![a-z0-9._-]+$/i.test(target));
     if(looksLikeFsPath){
      const p=await localPath(target);const stat=await fs.stat(p);
      if(stat.isDirectory()){if(browserURL)throw Error('DIRECTORY_ARGUMENTS_DENIED');const err=await shell.openPath(p);if(err)throw Error(err);result={accepted:true,opened:p,summary:'Dossier ouvert : '+p};break;}
      else if(/\.exe$/i.test(p)){await ps('if($p.arg){Start-Process -FilePath $p.target -ArgumentList $p.arg -ErrorAction Stop}else{Start-Process -FilePath $p.target -ErrorAction Stop}',{target:p,arg:browserURL},signal);result={accepted:true,opened:p,summary:'Application lancee : '+p};break;}
      else if(!dangerousExtensions.test(p)){if(browserURL)throw Error('FILE_ARGUMENTS_DENIED');const err=await shell.openPath(p);if(err)throw Error(err);result={accepted:true,opened:p,summary:'Fichier ouvert : '+p};break;}
      else throw Error('EXECUTABLE_OPEN_DENIED');
     }
     if(/^(powershell|pwsh|cmd|wscript|cscript|mshta|rundll32|regsvr32)(\.exe)?$/i.test(target))throw Error('APP_TARGET_NOT_ALLOWED');
     if(!/^[\w.{}!() \-:@+]{1,200}$/i.test(target))throw Error('APP_TARGET_NOT_ALLOWED');
     const launchScript=`
      $t=$p.target; $raw=$p.raw; $arg=$p.arg;
      $exePath=$null;
      $c=Get-Command -Name $t -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1;
      if($c -and $c.Source){ $exePath=$c.Source };
      if(-not $exePath){
       $names=@($t); if($t -notmatch '\\.exe$'){ $names+=($t+".exe") };
       foreach($nm in $names){
        foreach($rk in @("HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\"+$nm,"HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\"+$nm,"HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\App Paths\\"+$nm)){
         $val=(Get-ItemProperty $rk -ErrorAction SilentlyContinue).'(default)';
         if($val){ $val=$val.Trim('"'); if(Test-Path $val){ $exePath=$val; break } }
        }
        if($exePath){ break }
       }
      };
      if($exePath){
       if($arg){ Start-Process -FilePath $exePath -ArgumentList $arg -ErrorAction Stop }
       else{ Start-Process -FilePath $exePath -ErrorAction Stop };
       Write-Output ("EXE:"+$exePath); exit 0
      };
      if($arg){ throw "BROWSER_EXE_NOT_FOUND" };
      $apps=@(Get-StartApps);
      $rawEsc=[regex]::Escape($raw);
      $app=$apps | Where-Object { $_.AppID -ieq $raw -or $_.AppID -ieq $t } | Select-Object -First 1;
      if(-not $app){ $app=$apps | Where-Object { $_.Name -ieq $raw -or $_.Name -ieq $t -or $_.Name -ieq ("Microsoft "+$raw) -or $_.Name -ieq ("Google "+$raw) } | Select-Object -First 1 };
      if(-not $app){ $app=$apps | Where-Object { $_.Name -match ("\\b"+$rawEsc+"\\b") } | Select-Object -First 1 };
      if(-not $app){ $app=$apps | Where-Object { $_.Name -like ("*"+$raw+"*") } | Select-Object -First 1 };
      if($app -and $app.AppID){
       Start-Process explorer.exe -ArgumentList ("shell:AppsFolder\\"+$app.AppID) -ErrorAction Stop;
       Write-Output ("APPID:"+$app.Name); exit 0
      };
      $lnk=$null;
      foreach($dir in @($env:ProgramData+"\\Microsoft\\Windows\\Start Menu\\Programs",$env:APPDATA+"\\Microsoft\\Windows\\Start Menu\\Programs")){
       if(Test-Path $dir){
        $lnk=Get-ChildItem -Path $dir -Recurse -Filter "*.lnk" -ErrorAction SilentlyContinue | Where-Object { $_.BaseName -ieq $raw -or $_.BaseName -like ("*"+$raw+"*") } | Select-Object -First 1;
        if($lnk){ break }
       }
      };
      if($lnk){ Start-Process -FilePath $lnk.FullName -ErrorAction Stop; Write-Output ("LNK:"+$lnk.FullName); exit 0 };
      throw ("APP_NOT_FOUND: "+$raw)`;
     const launchOut=(await ps(launchScript,{target,raw:rawTarget,arg:browserURL},signal)).trim();
     result={accepted:true,opened:launchOut||target,verifiedRunning:false,summary:'Application lancee : '+(launchOut.replace(/^(EXE|APPID|LNK):/,'')||rawTarget)};break;
    }
    case 'file_list':case 'file_search':{
     const base=args.path||os.homedir(),items=[];const maxDepth=name==='file_search'?3:Math.max(0,Math.min(3,Number(args.depth)||0));
     const walk=async(p,depth)=>{
      let entries=[];
      try{entries=await fs.readdir(p,{withFileTypes:true});}
      catch(e){if(['EPERM','EACCES','ENOENT','ENOTDIR'].includes(e.code))return;throw e;}
      for(const d of entries){
       if(signal.aborted)throw Error('CANCELLED');if(items.length>=100)return;
       const full=path.join(p,d.name);if(d.isSymbolicLink())continue;
       if(name!=='file_search'||d.name.toLowerCase().includes(args.query.toLowerCase()))items.push({name:d.name,path:full,isDir:d.isDirectory()});
       if(depth>0&&d.isDirectory())await walk(full,depth-1);
      }
     };
     await walk(await localPath(base),maxDepth);result={items,truncated:items.length>=100,summary:items.length+' elements retournes'};break;
    }
    case 'file_read':{const stat=await fs.stat(args.path);if(stat.size>65536)throw Error('FILE_TOO_LARGE');result={path:args.path,content:await fs.readFile(args.path,'utf8')};break;}
    case 'folder_create':await fs.mkdir(args.path,{recursive:true});result={path:args.path,exists:(await fs.stat(args.path)).isDirectory()};break;
    case 'file_create':{
     if(dangerousExtensions.test(args.path))throw Error('EXECUTABLE_FILE_WRITE_DENIED');
     await fs.mkdir(path.dirname(args.path),{recursive:true});
     await fs.writeFile(args.path,args.content,{encoding:'utf8',flag:args.append?'a':'w'});
     const content=await fs.readFile(args.path,'utf8');if(args.append?!content.endsWith(args.content):content!==args.content)throw Error('WRITE_VERIFICATION_FAILED');
     result={path:args.path,size:(await fs.stat(args.path)).size,verified:true,summary:'Fichier ecrit et relu : '+args.path};break;
    }
    case 'pdf_create':case 'document_create':{
     const dest=args.path;
     if(dangerousExtensions.test(dest))throw Error('EXECUTABLE_FILE_WRITE_DENIED');
     await fs.mkdir(path.dirname(dest),{recursive:true});
     if(name==='pdf_create'||args.format==='pdf'){
      if(!/\.pdf$/i.test(dest))throw Error('PDF_EXTENSION_REQUIRED');
      let win=null;try{
       win=new BrowserWindow({show:false,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,partition:'cw-pdf-'+Date.now()+'-'+Math.random()}});
       win.webContents.session.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','file://*/*']},(_d,cb)=>cb({cancel:true}));
       await win.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent('<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'"><h1>'+xml(args.title||args.filename||'EVA')+'</h1><pre style="white-space:pre-wrap">'+xml(args.content)+'</pre>'));
       await fs.writeFile(dest,await win.webContents.printToPDF({pageSize:'A4'}));
      }finally{win?.destroy();}
     }else{
      if(!['txt','md','html'].includes(args.format))throw Error('DOCUMENT_FORMAT_UNSUPPORTED');
      await fs.writeFile(dest,args.format==='html'?'<meta http-equiv="Content-Security-Policy" content="default-src \'none\'"><pre>'+xml(args.content)+'</pre>':args.content,'utf8');
     }
     result={path:dest,size:(await fs.stat(dest)).size,summary:'Document enregistre : '+dest};break;
    }
    case 'excel_create':{if(!/\.xlsx$/i.test(args.path))throw Error('XLSX_EXTENSION_REQUIRED');const b=xlsx(args);await fs.mkdir(path.dirname(args.path),{recursive:true});await fs.writeFile(args.path,b);result={path:args.path,size:b.length,summary:'Classeur XLSX enregistre'};break;}
    case 'folder_organize':{
     const moves=[];for(const d of await fs.readdir(args.sourcePath,{withFileTypes:true})){
      if(!d.isFile())continue;const source=path.join(args.sourcePath,d.name);const stat=await fs.stat(source);
      const group=args.groupBy==='extension'?(path.extname(d.name).slice(1)||'sans-extension'):stat.mtime.toISOString().slice(0,7);
      const destination=path.join(args.sourcePath,group,d.name);moves.push({source,destination});
      if(moves.length>500)throw Error('TOO_MANY_FILES');
     }
     if(!args.dryRun){
      for(const m of moves){try{await fs.access(m.destination);throw Error('DESTINATION_EXISTS: '+m.destination);}catch(e){if(e.code!=='ENOENT')throw e;}}
      const completed=[];
      try{for(const m of moves){if(signal.aborted)throw Error('CANCELLED');await fs.mkdir(path.dirname(m.destination),{recursive:true});await fs.copyFile(m.source,m.destination,1);await fs.unlink(m.source);completed.push(m);}}
      catch(e){return {success:false,error:e.message,partial:completed.length>0,result:{completed}};}
     }
     result={dryRun:args.dryRun,moves,summary:args.dryRun?'Plan de tri, aucun fichier deplace':moves.length+' fichiers deplaces'};break;
    }
    case 'process_verify':{
     if(args.type==='process'){
      const si=await import('systeminformation');const p=await si.processes();
      const want=args.target.toLowerCase(),wantBare=want.replace(/\.exe$/,'');
      result={exists:p.list.some(pr=>pr.name.toLowerCase()===want||pr.name.replace(/\.exe$/i,'').toLowerCase()===wantBare)};
     }
     else{const p=await localPath(args.target);let st=null;try{st=await fs.stat(p);}catch(e){if(e.code!=='ENOENT')throw e;}result={exists:!!st&&(args.type==='file'?st.isFile():st.isDirectory()),size:st?.size||0};}break;
    }
    case 'screenshot_take':{const mod=await import('screenshot-desktop');const data=await mod.default({format:'png'});result={imageBase64:data.toString('base64'),summary:'Capture obtenue localement; non envoyee dans Firestore'};break;}
    case 'app_close':{if(!/^[\w.-]+$/.test(args.name))throw Error('EXACT_PROCESS_NAME_REQUIRED');await ps('Get-Process -Name $p.name -ErrorAction Stop | Stop-Process -ErrorAction Stop',{name:args.name.replace(/\.exe$/i,'')},signal);result={summary:'Arret demande pour '+args.name};break;}
    case 'app_install':{
     if(!/^[A-Za-z0-9_.-]+$/.test(args.name)||!args.name.includes('.'))throw Error('EXACT_WINGET_ID_REQUIRED');
     await execFile('winget.exe',['install','--id',args.name,'--exact','--accept-source-agreements','--accept-package-agreements','--disable-interactivity'],signal,45000);
     result={summary:'Winget a termine pour '+args.name};break;
    }
    case 'command_run':{
     if(process.platform!=='win32')throw Error('WINDOWS_REQUIRED');
     const command=text(args.command,12000);
     const stdout=await execFile('powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from("$ErrorActionPreference='Stop'; "+command,'utf16le').toString('base64')],signal);
     result={stdout:stdout.slice(0,8000),summary:'PowerShell termine sans erreur de processus'};break;
    }
    case 'web_fetch':case 'web_search':{
     const url=name==='web_fetch'?args.url:'https://api.duckduckgo.com/?q='+encodeURIComponent(args.query)+'&format=json&no_html=1';
     const page=await publicFetch(url,signal);result={url:page.url,content:page.text.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<[^>]*>/g,' ').slice(0,8000),untrusted:true,summary:name==='web_search'?'Reponse Instant Answer (pas une recherche web exhaustive)':'Page recuperee'};break;
    }
    case 'data_analyze':{const data=JSON.parse(args.data);if(!Array.isArray(data)||!data.length||data.length>10000||data.some(n=>typeof n!=='number'||!Number.isFinite(n)))throw Error('NUMERIC_JSON_ARRAY_REQUIRED');result={count:data.length,min:Math.min(...data),max:Math.max(...data),mean:data.reduce((a,b)=>a+b,0)/data.length};break;}
    case 'session_lock':await execFile('rundll32.exe',['user32.dll,LockWorkStation'],signal);result={summary:'Verrouillage demande'};break;
    case 'system_shutdown':await execFile('shutdown.exe',['/s','/t','30'],signal);result={summary:'Extinction programmee dans 30 secondes'};break;
    case 'system_sleep':throw Error('SLEEP_NOT_IMPLEMENTED_SAFELY');
    default:throw Error('TOOL_NOT_IMPLEMENTED');
   }
   if(signal.aborted||cancelled.has(id))return {success:false,error:'CANCELLED_OR_TIMEOUT_AFTER_DISPATCH',indeterminate:true};
   return ok(result);
  }catch(e){if(controller?.signal.aborted||cancelled.has(id))return {success:false,error:'CANCELLED_OR_TIMEOUT',cancelled:cancelled.has(id),indeterminate:true};return fail(e);}
  finally{if(timer)clearTimeout(timer);if(controller&&running.get(id)===controller)running.delete(id);}
 });
}
