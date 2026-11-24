# -*- coding: utf-8 -*-
import io
import re

print("=== MISE À JOUR DES MODULES CLOUDWORKS ===")

# 1. cw-tools.js : Permettre schema(allowDone)
cw_tools_code = '''/* CloudWorks unified tool contract. Execution and approvals live in Electron main. */
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
function schema(allowDone=true){
 const toolSchemas=Object.entries(specs).map(([name,s])=>({type:'object',properties:{kind:{enum:['tool']},name:{enum:[name]},args:{type:'object',properties:s.properties}},required:['kind','name','args']}));
 const endings=(allowDone?['done','clarify','fail']:['clarify','fail']).map(kind=>({type:'object',properties:{kind:{enum:[kind]},message:str},required:['kind','message']}));
 return {oneOf:[...toolSchemas,...endings]};
}
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
'''

# 2. cw-agent.js : Empêcher done au tour 0, prompts d'exemples précis
cw_agent_code = '''/* CloudWorks: bounded structured agent, never interpret prose as a command. */
(function(w){
'use strict';
let active=null;
function content(r){if(r?.aborted)throw Error('CANCELLED');return r?.choices?.[0]?.message?.content||'';}
function CWAgent(uid,id,options){this.uid=uid;this._taskId=id;this.options=options||{};this.stopped=false;}
CWAgent.prototype.stop=function(){this.stopped=true;return w.eva?.cloudworks?.cancel(this._taskId);};
CWAgent.prototype.run=async function(prompt,emit){
 if(active)return {success:false,error:'AGENT_BUSY'};
 active=this;
 const observations=[],seen=new Set();let invalid=0;
 const output=async(text,status)=>{if(emit)await emit(text,status,false);};
 const finish=(success,message,extra={})=>({success,response:message,output:success?message:null,error:success?null:message,observations,...extra});
 try{
  if(!w.CWTools||!w.eva?.system?.llmChat)throw Error('LOCAL_MODEL_REQUIRED');
  const system='Tu es EVA, agent Windows. Tu dois accomplir la requete de l utilisateur en appelant les outils appropries.\\n'+
   'Format obligatoire (JSON uniquement) :\\n'+
   'Pour ouvrir un site web ou une app : {"kind":"tool","name":"app_launch","args":{"target":"https://youtube.com","args":null}}\\n'+
   'Pour creer un fichier : {"kind":"tool","name":"file_create","args":{"path":"$env:USERPROFILE\\\\\\\\Desktop\\\\\\\\test.txt","content":"Contenu du fichier","append":false}}\\n'+
   'Pour chercher une app installee : {"kind":"tool","name":"app_resolve","args":{"query":"notepad"}}\\n'+
   'Pour lister un dossier : {"kind":"tool","name":"file_list","args":{"path":"$env:USERPROFILE\\\\\\\\Desktop","depth":1}}\\n'+
   'Pour terminer (UNIQUEMENT apres qu un outil ait reussi) : {"kind":"done","message":"Action effectuee avec succes."}\\n'+
   'Tu DOIS utiliser un outil au premier tour. Tu ne peux PAS utiliser done sans avoir d abord execute un outil avec succes.';
  
  for(let turn=0;turn<12;turn++){
   if(this.stopped)throw Error('CANCELLED');
   await output('Analyse locale de la prochaine etape','running');
   const allowDone = observations.length > 0 && observations.some(o => o.result?.success === true);
   const currentSchema = w.CWTools.schema(allowDone);
   const messages=[
    {role:'system',content:system},
    {role:'user',content:JSON.stringify({
      request:prompt,
      observations:observations.slice(-8).map(o=>({name:o.name,args:o.args,result:JSON.parse(JSON.stringify(o.result,(k,v)=>k==='imageBase64'?undefined:(typeof v==='string'&&v.length>6000?v.slice(0,6000):v)))})),
      instruction:allowDone?'Tu as observe le resultat des outils. Tu peux appeler un autre outil ou terminer avec done.':'Tu DOIS choisir un outil (kind: tool) pour repondre a la requete.'
    })}
   ];
   let decision;
   try{
    const r=await w.eva.system.llmChat(messages,{sessionId:this._taskId,maxTokens:1800,temperature:0,jsonSchema:currentSchema,stopTriggers:[],timeoutMs:120000});
    if(this.stopped)throw Error('CANCELLED');
    decision=JSON.parse(content(r));
    if(!decision||!['tool','done','clarify','fail'].includes(decision.kind))throw Error('INVALID_DECISION');
    if(decision.kind==='tool')decision.args=w.CWTools.validate(decision.name,decision.args);
   }catch(e){if(this.stopped||/CANCELLED|TIMEOUT|MODEL|LLM_BUSY/.test(e.message))throw e;if(++invalid>=2)throw Error('MODEL_INVALID_OUTPUT: '+e.message);continue;}
   invalid=0;
   if(decision.kind!=='tool'){
    if(decision.kind!=='done')return finish(false,decision.message||'Clarification requise',{needsInput:decision.kind==='clarify'});
    const successful=observations.filter(o=>o.result?.success===true);
    const hasFailure=observations.some(o=>o.result?.success!==true);
    if(!successful.length||hasFailure)return finish(false,'TASK_NOT_VERIFIED: aucune completion fiable',{partial:successful.length>0});
    if(successful.every(o=>['app_resolve','app_check','process_verify'].includes(o.name)||(o.name==='folder_organize'&&o.args.dryRun)))
     return finish(false,'TASK_NOT_VERIFIED: verification seule, aucune action confirmee');
    await output(decision.message||'Execution terminee','done');
    return finish(true,decision.message||'Execution terminee');
   }
   const fingerprint=JSON.stringify([decision.name,Object.keys(decision.args).sort().map(k=>[k,decision.args[k]])]);
   if(seen.has(fingerprint))throw Error('REPEATED_TOOL_CALL');
   seen.add(fingerprint);
   await output('Execution : '+decision.name,'executing');
   const result=await w.CWTools.executeTool(decision.name,decision.args,{taskId:this._taskId});
   observations.push({name:decision.name,args:decision.args,result});
   if(this.stopped)throw Error('CANCELLED');
   await output(result.success?'Outil termine : '+decision.name:'Echec : '+(result.error||decision.name),result.success?'running':'error');
   if(result.cancelled||result.indeterminate||result.error==='APPROVAL_DENIED')return finish(false,result.error||'CANCELLED',{cancelled:!!result.cancelled,indeterminate:!!result.indeterminate});
  }
  return finish(false,'MAX_TURNS_REACHED',{partial:observations.some(o=>o.result?.success)});
 }catch(e){await output(e.message,'error');return finish(false,e.message,{cancelled:this.stopped||e.message==='CANCELLED'});}
 finally{active=null;}
};
w.CWAgent=CWAgent;
w.CWAgentStop=()=>active?.stop();
w.CWAgentRun=async(uid,prompt,options={})=>{
 if(!w.CWBus)throw Error('CW_BUS_REQUIRED');
 const id=await w.CWBus.submit('agentic_task',{prompt},{deviceId:options.deviceId});
 return w.CWBus.wait(id,options.emitFn);
};
})(window);
'''

# 3. cw-bus.js : Correction de target() (plusieurs PC), merge:true sur set()
cw_bus_code = '''/* Shared Firestore command producer. Never executes tools. */
(function(w){'use strict';
const terminal=d=>['done','error','cancelled'].includes(d?.status);
function uid(){const id=w.S?.user?.uid;if(!id||!w.db)throw Error('AUTH_REQUIRED');return id;}
function commands(){return w.db.collection('cloudworks').doc(uid()).collection('commands');}
async function target(explicit){
 if(explicit&&explicit!=='web')return explicit;
 if(w.eva&&w._cwDeviceId)return w._cwDeviceId;
 const saved=localStorage.getItem('cw_target_device');
 const snap=await w.db.collection('cloudworks').doc(uid()).collection('devices').get();
 const now = Date.now();
 const online=snap.docs.map(d=>({id:d.id, ...d.data()})).filter(x=>{
   const t = x.lastSeen?.toMillis?.() || x.lastSeen?.toDate?.()?.getTime() || (x.lastSeen instanceof Date ? x.lastSeen.getTime() : (typeof x.lastSeen === 'number' ? x.lastSeen : 0));
   return x.online && (t === 0 || (now - t) < 300000);
 });
 if(saved&&online.some(d=>d.id===saved))return saved;
 if(online.length>=1){
   const win=online.find(d=>d.platform==='win32'||d.deviceType==='windows')||online[0];
   return win.id;
 }
 throw Error('NO_PC_ONLINE: Aucun PC connecte a CloudWorks');
}
async function submit(type,payload={},options={}){
 const deviceId=await target(options.deviceId);
 const ref=commands().doc();
 await ref.set({schemaVersion:2,id:ref.id,deviceId,type,payload,status:'pending',state:'queued',step:'En attente du PC',createdAt:w.timestamp?w.timestamp():new Date(),updatedAt:w.timestamp?w.timestamp():new Date(),expiresAt:new Date(Date.now()+300000),steps:[],source:w.eva?'desktop':'web'}, {merge:true});
 return ref.id;
}
function watch(id,fn,error){return commands().doc(id).onSnapshot(s=>{if(s.exists)fn({id:s.id,...s.data()});},error);}
function wait(id,emit,untilRouting=false){
 return new Promise((resolve,reject)=>{
  let unsub=()=>{},done=false;
  const settle=(err,value)=>{if(done)return;done=true;clearTimeout(timer);unsub();err?reject(err):resolve(value);};
  const timer=setTimeout(()=>settle(Error('TRACKING_TIMEOUT: execution inconnue; ne pas relancer automatiquement')),360000);
  unsub=watch(id,d=>{
   if(emit)Promise.resolve(emit(d.step,d.status,false)).catch(console.warn);
   if(untilRouting&&d.routing==='action')settle(null,{handled:true,id});
   else if(untilRouting&&d.routing==='conversation')settle(null,{handled:false,id});
   else if(terminal(d))settle(null,untilRouting?{handled:true,id,error:d.result?.error}:d.result||{success:false,error:d.step});
  },e=>settle(e));
 });
}
async function cancel(id){await w.db.runTransaction(async tx=>{const r=commands().doc(id),s=await tx.get(r);if(!s.exists||terminal(s.data()))return;tx.update(r,{status:'cancelled',state:'cancelled',step:'Annulation demandee; les effets deja realises restent presents',updatedAt:new Date()});});}
w.CWBus={submit,watch,wait,cancel,target,terminal,selectDevice:id=>localStorage.setItem('cw_target_device',id)};
})(window);
'''

# 4. pc-agent.js : Activer l'overlay flottant automatiquement sur le PC !
pc_agent_code = '''/* Sole desktop command consumer. No legacy PowerShell fallback. */
(function(w){'use strict';
if(!w.eva?.cloudworks||w.__cwWorker)return;w.__cwWorker=true;
let unsubscribe=null,heartbeat=null,current=null,generation=0,user=null,queue=Promise.resolve();
const scheduled=new Set(),owner=crypto.randomUUID();
const ts=()=>w.timestamp?w.timestamp():new Date();
const emit=(name,detail)=>w.dispatchEvent(new CustomEvent(name,{detail}));
function ref(uid,id){return w.db.collection('cloudworks').doc(uid).collection('commands').doc(id);}
async function ownedUpdate(r,patch){return w.db.runTransaction(async tx=>{const s=await tx.get(r);if(!s.exists||s.data().owner!==owner||w.CWBus.terminal(s.data()))return false;tx.update(r,{...patch,updatedAt:ts()});return true;});}
async function consume(uid,id,epoch){
 if(epoch!==generation||uid!==user)return;
 const r=ref(uid,id);
 const data=await w.db.runTransaction(async tx=>{
  const s=await tx.get(r);if(!s.exists)return null;const d=s.data();
  if(d.status!=='pending'||d.deviceId!==w._cwDeviceId)return null;
  const expiry=d.expiresAt?.toMillis?.();
  if(expiry&&Date.now()>expiry){tx.update(r,{status:'error',state:'expired',step:'Commande expiree',result:{success:false,error:'EXPIRED'}});return null;}
  tx.update(r,{owner,status:'running',state:'running',step:'Prise en charge par le PC',startedAt:ts(),updatedAt:ts()});return d;
 });
 if(!data)return;
 let agent=null,result=null,unsubCancel=()=>{};const steps=[];let expired=false;
 current={id,r,stop:()=>{if(agent)agent.stop();else w.eva.cloudworks.cancel(id).catch(console.warn);}};
 const deadline=setTimeout(()=>{expired=true;current?.id===id&&current.stop();},300000);
 
 let prompt=data.payload?.prompt||data.action||'';
 // Afficher la bulle overlay flottante en haut de l'ecran Windows des que CloudWorks s'active
 try {
  if (w.eva?.overlay?.show) {
    w.eva.overlay.show('cloudworks', prompt || 'Tache CloudWorks');
    w.eva.overlay.setState('cloudworks', 'Prise en charge par le PC...');
  }
 } catch(_) {}

 const progress=async(text,status)=>{
  steps.push({text:String(text).slice(0,600),ts:new Date().toISOString(),state:status==='error'?'error':'running'});
  const ok=await ownedUpdate(r,{step:String(text).slice(0,600),steps:steps.slice(-40),state:status==='executing'?'executing':'running'});
  if(!ok)throw Error('OWNERSHIP_LOST_OR_CANCELLED');
  emit('cw:step',{cmdId:id,step:text});
  try {
    if (w.eva?.overlay?.setState) {
      w.eva.overlay.setState('cloudworks', String(text).slice(0, 80));
    }
  } catch(_) {}
 };
 try{
  const config=await w.eva.cloudworks.status();if(!config.enabled)throw Error('CLOUDWORKS_DISABLED');
  unsubCancel=r.onSnapshot(s=>{if(s.exists&&s.data().status==='cancelled')current?.id===id&&current.stop();});
  if(data.payload?.command||data.payload?.tool||data.payload?.name)throw Error('LEGACY_DIRECT_EXECUTION_DISABLED: renvoyer la demande en langage naturel');
  if(data.type==='chat_request'){
   const schema={type:'object',properties:{route:{enum:['action','conversation','clarify']}}};
   const response=await w.eva.system.llmChat([{role:'system',content:'Classe le message: action = demande effective de faire une operation sur le PC (ouvrir, fichiers, applications, systeme). conversation = question, explication, note, rappel, alarme, agenda ou generation de document a telecharger sans destination PC. clarify = demande PC ambigue. Ne classe jamais une negation ou une simple citation comme une demande d execution. JSON uniquement.'},{role:'user',content:prompt}],{sessionId:id,jsonSchema:schema,maxTokens:100,temperature:0,stopTriggers:[]});
   if(response.aborted)throw Error('CANCELLED');
   const route=JSON.parse(response.choices[0].message.content).route;
   if(route==='conversation'){
    await ownedUpdate(r,{routing:'conversation',status:'done',state:'succeeded',step:'Message conversationnel; aucune action PC',result:{success:true,routed:true,executed:false},completedAt:ts()});return;
   }
   if(route!=='action')throw Error('CLARIFICATION_REQUIRED: precise la demande PC');
   if(!await ownedUpdate(r,{routing:'action'}))throw Error('CANCELLED');
  }
  emit('cw:task-start',{cmdId:id,type:data.type,prompt});
  if(['agentic_task','chat_request'].includes(data.type)){
   if(!prompt.trim())throw Error('EMPTY_PROMPT');
   agent=new w.CWAgent(uid,id,{});result=await agent.run(prompt,progress);
  }else{
   const quick={sysinfo:['system_status',{}],screenshot:['screenshot_take',{}],open_explorer:['app_launch',{target:'explorer.exe',args:null}],lock:['session_lock',{}],sleep:['system_sleep',{}],shutdown:['system_shutdown',{}]};
   if(!quick[data.type])throw Error('UNSUPPORTED_COMMAND: '+data.type);
   await progress('Execution : '+data.type,'executing');
   result=await w.eva.cloudworks.executeTool(...quick[data.type],{taskId:id});
   if(result.success)result={...result,output:result.result?.summary||'Commande transmise au systeme'};
  }
 }catch(e){result={success:false,error:e.message};}
 finally{
  unsubCancel();clearTimeout(deadline);
  if(expired&&result)result={...result,success:false,error:'TASK_DEADLINE_EXCEEDED; verifier les effets deja realises',indeterminate:true};
  if(result){
   const status=result.cancelled?'cancelled':result.success===true?'done':'error';
   const safe={success:result.success===true,output:result.output||result.response||null,error:result.error||null,partial:!!result.partial,indeterminate:!!result.indeterminate};
   const persisted=await ownedUpdate(r,{status,state:result.indeterminate?'indeterminate':result.partial?'partial':status==='done'?'succeeded':status==='cancelled'?'cancelled':'failed',step:safe.output||safe.error||status,result:safe,steps:steps.slice(-40),completedAt:ts()}).catch(e=>{console.error('[CW] Final write failed',id,e);return false;});
   emit('cw:task-done',{cmdId:id,status:persisted?status:'error',result:persisted?safe:{success:false,error:'FINAL_STATE_NOT_PERSISTED; verifier avant toute nouvelle execution'},type:data.type});
   try {
     if (w.eva?.overlay?.setState) {
       w.eva.overlay.setState('cloudworks', safe.output || safe.error || 'Termine');
       setTimeout(() => { if (w.eva?.overlay?.hide) w.eva.overlay.hide(); }, 4000);
     }
   } catch(_) {}
  }
  current=null;
 }
}
async function setup(uid){
 generation++;const epoch=generation;user=uid;
 unsubscribe?.();clearInterval(heartbeat);current?.stop();
 if(!uid)return;
 let deviceId=localStorage.getItem('cw_device_id');
 if(!deviceId){deviceId='PC-'+crypto.randomUUID();localStorage.setItem('cw_device_id',deviceId);}
 w._cwDeviceId=deviceId;
 const device=w.db.collection('cloudworks').doc(uid).collection('devices').doc(deviceId);w.pcAgentDocRef=device;
 const beat=async()=>{
  const status=await w.eva.cloudworks.status(),chk=await w.eva.system.llmCheck();
  const stale=await w.db.collection('cloudworks').doc(uid).collection('commands').where('deviceId','==',deviceId).get();
  for(const d of stale.docs){const x=d.data(),started=x.startedAt?.toMillis?.()||0;if(x.status==='running'&&started&&Date.now()-started>360000){await w.db.runTransaction(async tx=>{const now=await tx.get(d.ref);if(now.exists&&now.data().status==='running'&&now.data().owner===x.owner)tx.update(d.ref,{status:'error',state:'indeterminate',step:'Execution abandonnee ou interrompue; verifier avant de relancer',result:{success:false,indeterminate:true,error:'STALE_EXECUTION'},updatedAt:ts()});});}}
  await device.set({deviceId,deviceName:status.hostname,deviceType:'windows',platform:'win32',online:status.enabled,llmModelInstalled:!!chk.exists,lastSeen:ts(),updatedAt:ts(),workerVersion:2},{merge:true});
 };
 await beat();if(epoch!==generation)return;
 heartbeat=setInterval(()=>beat().catch(console.error),30000);
 unsubscribe=w.db.collection('cloudworks').doc(uid).collection('commands').where('deviceId','==',deviceId).onSnapshot(snap=>{
  for(const d of snap.docs){if(d.data().status!=='pending'||scheduled.has(d.id))continue;
   scheduled.add(d.id);queue=queue.then(()=>consume(uid,d.id,epoch)).catch(console.error).finally(()=>scheduled.delete(d.id));
  }
 },console.error);
 emit('cw:device-registered',{deviceId});
}
w.pcAgent={getDeviceId:()=>w._cwDeviceId,sendCommand:(type,payload,uid)=>{if(uid&&uid!==user)throw Error('UID_MISMATCH');return w.CWBus.submit(type,payload,{deviceId:w._cwDeviceId});}};
w.cancelCurrentCloudWorksTask=()=>current?w.CWBus.cancel(current.id):Promise.resolve();
function init(){if(!w.firebase?.auth||!w.db||!w.CWBus){setTimeout(init,300);return;}w.firebase.auth().onAuthStateChanged(u=>setup(u?.uid||null).catch(console.error));}
init();
w.addEventListener('beforeunload',()=>{unsubscribe?.();clearInterval(heartbeat);current?.stop();});
})(window);
'''

# 5. cw-modal.js : Carte UI avec style soigné EVA
cw_modal_code = '''/* Unified tracker: Firestore is the source of truth; no provider summary call. */
(function(w){'use strict';
const trackers=new Map();w._cwActiveTrackers={};
function element(tag,text,cls){const e=document.createElement(tag);if(text!=null)e.textContent=text;if(cls)e.className=cls;return e;}
function card(prompt){
 const e=element('section',null,'cw-tracker-card');
 e.style.cssText='padding:14px 18px;margin:12px 0;background:rgba(18,22,34,0.75);border:1px solid rgba(249,115,22,0.45);border-radius:14px;box-shadow:0 8px 32px rgba(0,0,0,0.4),inset 0 0 15px rgba(249,115,22,0.06);backdrop-filter:blur(16px);position:relative;overflow:hidden;font-family:Inter,sans-serif;color:#e4e4ef;';
 
 const head=element('div',null,'cw-card-header');
 head.style.cssText='display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;';
 const titleBox=element('div',null,'cw-title-box');
 titleBox.style.cssText='display:flex;align-items:center;gap:8px;';
 const icon=element('span','⚡','cw-icon');
 icon.style.cssText='color:#f97316;font-size:14px;';
 const h4=element('h4','CLOUDWORKS','cw-card-title');
 h4.style.cssText='margin:0;font-family:Orbitron,sans-serif;font-size:11px;font-weight:700;color:#00d4ff;letter-spacing:1px;text-transform:uppercase;';
 titleBox.append(icon,h4);
 const badge=element('span','ACTIF','cw-badge');
 badge.style.cssText='font-size:9px;font-weight:700;padding:2px 8px;border-radius:10px;background:rgba(249,115,22,0.15);border:1px solid rgba(249,115,22,0.5);color:#f97316;';
 head.append(titleBox,badge);
 
 const p=element('p',prompt,'cw-prompt-text');
 p.style.cssText='margin:0 0 10px 0;font-size:12px;color:#c0c0d4;font-weight:500;';
 
 const stepBox=element('div',null,'cw-step-box');
 stepBox.style.cssText='display:flex;align-items:center;gap:8px;padding:8px 12px;background:rgba(0,0,0,0.3);border-radius:8px;border:1px solid rgba(255,255,255,0.06);';
 const spin=element('span','●','cw-pulse');
 spin.style.cssText='color:#00d4ff;font-size:10px;animation:corePulse 1.2s infinite;';
 const step=element('div','En attente du PC...','cw-live-step');
 step.style.cssText='font-size:11px;color:#00d4ff;font-weight:600;flex:1;';
 stepBox.append(spin,step);
 
 const res=element('pre','','cw-live-result');
 res.style.cssText='margin:8px 0 0 0;font-size:11px;color:#a0a0b8;white-space:pre-wrap;font-family:inherit;display:none;padding:6px;background:rgba(0,0,0,0.2);border-radius:6px;';
 
 e.append(head,p,stepBox,res);
 return e;
}
async function persist(uid,conv,id,data){if(!uid||!conv)return;await w.db.collection('users').doc(uid).collection('conversations').doc(conv).collection('messages').doc('cw_'+id).set(data,{merge:true});}
w.appendCloudWorksTracker=function(id,prompt,container){
 if(trackers.has(id))return trackers.get(id).card;
 const uid=w.S?.user?.uid,conv=w.S?.convId;if(!uid||!w.CWBus)return;
 const c=card(prompt),step=c.querySelector('.cw-live-step'),out=c.querySelector('.cw-live-result'),badge=c.querySelector('.cw-badge'),pulse=c.querySelector('.cw-pulse');
 const button=element('button','Annuler','cw-btn-cancel');
 button.style.cssText='margin-top:10px;padding:5px 12px;background:rgba(255,77,109,0.1);border:1px solid rgba(255,77,109,0.3);color:#ff4d6d;border-radius:6px;font-size:10px;cursor:pointer;';
 c.id='cwTracker-'+id;c.append(button);
 (container||document.getElementById('messagesList')||document.body).append(c);
 const record={card:c,unsub:()=>{},final:false};trackers.set(id,record);w._cwActiveTrackers[id]=record;
 button.onclick=()=>w.CWBus.cancel(id).catch(e=>{out.style.display='block';out.textContent=e.message;});
 const watchdog=setTimeout(()=>{step.textContent='Suivi interrompu. Etat inconnu.';button.textContent='Annuler';record.unsub();},360000);
 record.unsub=w.CWBus.watch(id,d=>{
  step.textContent=d.step||d.status;
  if(!w.CWBus.terminal(d))return;
  if(record.final)return;record.final=true;clearTimeout(watchdog);
  c.classList.add(d.status);button.remove();
  if(d.status==='done'){
    c.style.borderColor='rgba(0,212,255,0.6)';
    badge.textContent='TERMINÉ ✓';badge.style.color='#00d4ff';badge.style.borderColor='rgba(0,212,255,0.6)';badge.style.background='rgba(0,212,255,0.1)';
    pulse.style.color='#00d4ff';
  }else{
    c.style.borderColor='rgba(255,77,109,0.6)';
    badge.textContent='ÉCHEC ✗';badge.style.color='#ff4d6d';badge.style.borderColor='rgba(255,77,109,0.6)';badge.style.background='rgba(255,77,109,0.1)';
    pulse.style.color='#ff4d6d';
  }
  const summary=d.result?.output||d.result?.error||d.step||d.status;
  if(summary&&summary!==d.step){out.style.display='block';out.textContent=summary;}
  queueMicrotask(()=>record.unsub());delete w._cwActiveTrackers[id];trackers.delete(id);
  persist(uid,conv,id,{role:'cloudworks',type:'cw_tracker',cmdId:id,prompt,status:d.status,summary,steps:d.steps||[],timestamp:w.timestamp?w.timestamp():new Date()}).catch(console.error);
  if(w.S){w.S.busy=false;w.S.cwRunning=false;}
  if(typeof w.hideTyping==='function')w.hideTyping();
  const send=document.getElementById('sendBtn');if(send){send.disabled=false;send.style.display='inline-flex';}
 },err=>{clearTimeout(watchdog);step.textContent='Erreur de suivi : '+err.message;});
 return c;
};
w.cancelCloudWorksTask=id=>w.CWBus.cancel(id);
w.cwConfirmAndExecute=async action=>{
 const types=['agentic_task','screenshot','sysinfo','run_script','lock','sleep','shutdown','open_ide_file'];
 if(!types.includes(action.type))return w.executeEvaAction?.(action);
 try{
  const payload=action.type==='agentic_task'?{prompt:action.prompt}:{};
  const id=await w.CWBus.submit(action.type,payload,{deviceId:action.deviceId});w.appendCloudWorksTracker(id,action.prompt||action.type);return id;
 }catch(e){w.toast?.(e.message,'error');}
};
w.renderSavedTrackerCard=data=>{const c=card(data.prompt||'Tache CloudWorks');c.querySelector('.cw-live-step').textContent=data.status||'inconnu';c.querySelector('.cw-live-result').textContent=data.summary||'';return c;};
w.setIsGenerating=active=>{if(w.S)w.S.busy=!!active;};
if(w.eva?.overlay?.onAction)w.eva.overlay.onAction(action=>{if(action==='cancel')for(const id of Object.keys(w._cwActiveTrackers))w.CWBus.cancel(id).catch(console.error);});
})(window);
'''

# 6. cloudworks.js : Connecter la tâche libre directement au CWBus
cw_js_path = r'f:\code\eva\evaprojectmultiplatforme\eva-pc\web\js\features\cloudworks.js'
with io.open(cw_js_path, 'r', encoding='utf-8') as f:
    cw_js_code = f.read()

# Remplacer _cwRunAgenticTask pour qu'il utilise CWBus.submit et écoute son avancement proprement
cw_task_regex = r'window\._cwRunAgenticTask\s*=\s*async\s*function\s*\(\)\s*\{[\s\S]*?\n\};\n\nwindow\._cwStopAgent'
cw_task_replacement = '''window._cwRunAgenticTask = async function() {
  var promptEl = document.getElementById('cwAgenticPrompt');
  var statusEl = document.getElementById('cwAgenticStatus');
  if (!promptEl || !statusEl) return;
  var prompt = promptEl.value.trim();
  if (!prompt) return;

  statusEl.style.display = 'block';
  statusEl.className = 'cw-agentic-status running';
  statusEl.innerHTML = 
    '<div class="cw-task-header" style="font-weight:600;margin-bottom:6px;color:#00d4ff;">Démarrage du LLM local...</div>' +
    '<div id="cwTaskSteps"></div>' +
    '<button class="cw-btn cw-btn-danger cw-btn-sm" style="margin-top:8px;" onclick="window._cwStopAgent()">Arrêter</button>';

  var stepsEl = document.getElementById('cwTaskSteps');
  var header = statusEl.querySelector('.cw-task-header');

  // Activer immédiatement la bulle overlay flottante en haut de l'écran Windows
  if (window.eva && window.eva.overlay) {
    try {
      window.eva.overlay.show('cloudworks', prompt);
      window.eva.overlay.setState('cloudworks', 'Démarrage du LLM local...');
    } catch(_) {}
  }

  try {
    if (!window.CWBus) throw new Error('CW_BUS_REQUIRED');
    var taskId = await window.CWBus.submit('agentic_task', { prompt: prompt });
    window._activeTaskId = taskId;

    function _onStep(text, status) {
      if (header) header.textContent = text;
      if (stepsEl) {
        var it = document.createElement('div');
        it.className = 'cw-task-step ' + (status || 'running');
        it.style.cssText = 'padding:3px 0;font-size:0.9em;color:#c0c0d4;';
        it.textContent = '▸ ' + text;
        stepsEl.appendChild(it);
      }
      if (window.eva && window.eva.overlay && window.eva.overlay.setState) {
        window.eva.overlay.setState('cloudworks', String(text).slice(0, 80));
      }
    }

    var result = await window.CWBus.wait(taskId, _onStep);

    if (result && result.success) {
      if (header) header.textContent = 'Tâche terminée ✓';
      statusEl.className = 'cw-agentic-status done';
      promptEl.value = '';
      _addActivity('Tâche IA: ' + prompt.substring(0, 50), 'done');
    } else {
      var err = (result && (result.error || result.output)) || 'Erreur inconnue';
      if (header) header.textContent = 'Échec : ' + err;
      statusEl.className = 'cw-agentic-status error';
      _addActivity('Tâche IA erreur: ' + prompt.substring(0, 30), 'error');
    }
  } catch(e) {
    if (header) header.textContent = 'Erreur : ' + e.message;
    statusEl.className = 'cw-agentic-status error';
  } finally {
    var _stopBtn = statusEl.querySelector(".cw-btn-danger");
    if (_stopBtn) _stopBtn.style.display = "none";
    window._activeTaskId = null;
    if (window.eva && window.eva.overlay && window.eva.overlay.hide) {
      setTimeout(function(){ window.eva.overlay.hide(); }, 3500);
    }
  }
};

window._cwStopAgent = function() {
  if (window._activeTaskId && window.CWBus) {
    window.CWBus.cancel(window._activeTaskId);
  }
  if (window.CWAgentStop) window.CWAgentStop();
};

window._cwStopAgent'''

cw_js_updated = re.sub(cw_task_regex, cw_task_replacement, cw_js_code)
with io.open(cw_js_path, 'w', encoding='utf-8') as f:
    f.write(cw_js_updated)
print("cloudworks.js mis a jour !")

# Écrire dans eva-pc/web/js/features/
destinations = [
    (r'f:\code\eva\evaprojectmultiplatforme\eva-pc\web\js\features', True),
    (r'f:\code\eva\evaprojectmultiplatforme\EVA_V4_fixed_v4\js\features', False)
]

for d, is_pc in destinations:
    with io.open(f'{d}\\cw-tools.js', 'w', encoding='utf-8') as f:
        f.write(cw_tools_code)
    with io.open(f'{d}\\cw-agent.js', 'w', encoding='utf-8') as f:
        f.write(cw_agent_code)
    with io.open(f'{d}\\cw-bus.js', 'w', encoding='utf-8') as f:
        f.write(cw_bus_code)
    with io.open(f'{d}\\cw-modal.js', 'w', encoding='utf-8') as f:
        f.write(cw_modal_code)
    if is_pc:
        with io.open(f'{d}\\pc-agent.js', 'w', encoding='utf-8') as f:
            f.write(pc_agent_code)
    print(f"Fichiers ecrits dans {d} !")

print("SUCCÈS DE LA MISE À JOUR !")
