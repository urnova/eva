/* Sole desktop command consumer. No legacy PowerShell fallback. */
(function(w){'use strict';
if(!w.eva?.cloudworks||w.__cwWorker)return;w.__cwWorker=true;
let unsubscribe=null,heartbeat=null,current=null,generation=0,user=null,queue=Promise.resolve(),overlayHideTimer=null;
const scheduled=new Set(),owner=crypto.randomUUID();
const ts=()=>w.timestamp?w.timestamp():new Date();
const emit=(name,detail)=>w.dispatchEvent(new CustomEvent(name,{detail}));
function ref(uid,id){return w.db.collection('cloudworks').doc(uid).collection('commands').doc(id);}
function showOverlay(state,text,data){
 try{clearTimeout(overlayHideTimer);overlayHideTimer=null;if(w.eva?.overlay?.show)w.eva.overlay.show(state,String(text||'').slice(0,140),data);}catch(_){}
}
function updateOverlay(state,text,data){
 try{
  if(w.eva?.overlay?.show)w.eva.overlay.show(state,String(text||'').slice(0,140),data);
  else if(w.eva?.overlay?.setState)w.eva.overlay.setState(state,String(text||'').slice(0,140),data);
 }catch(_){}
}
function hideOverlaySoon(state,text){
 try{
  updateOverlay(state,text);
  clearTimeout(overlayHideTimer);
  overlayHideTimer=setTimeout(()=>{try{if(w.eva?.overlay?.hide)w.eva.overlay.hide();}catch(_){}},3500);
 }catch(_){}
}

if(w.eva.cloudworks.onApprovalPending){
 w.eva.cloudworks.onApprovalPending(data=>{
  if(current&&data&&data.taskId===current.id){
   const label=data.summary||('Autorisation requise : '+(data.tool||'action'));
   updateOverlay('approval',label,data);
   emit('cw:approval-pending',data);
   current.onApproval?.(data);
  }
 });
}

if(w.eva?.overlay?.onAction){
 w.eva.overlay.onAction((action,data)=>{
  if((action==='approve'||action==='deny')&&current){
   const targetId=data||current.id;
   if(targetId===current.id){
    const approved=(action==='approve');
    current.resolveApproval?.(approved);
   }
  }
 });
}

async function ownedUpdate(r,patch){return w.db.runTransaction(async tx=>{const s=await tx.get(r);if(!s.exists||s.data().owner!==owner||w.CWBus.terminal(s.data()))return false;tx.update(r,{...patch,updatedAt:ts()});return true;});}
async function routeMessage(id,prompt){
 const schema={type:'object',properties:{route:{enum:['conversation','action','clarify']}},required:['route']};
 const messages=[
  {role:'system',content:'Determine si le message demande une operation concrete sur le PC Windows (action) ou une reponse textuelle / question / explication / negation (conversation). Ne classe jamais une negation comme action.'},
  {role:'user',content:'Explique-moi comment fonctionne React'},
  {role:'assistant',content:'{"route":"conversation"}'},
  {role:'user',content:'Crée un fichier test sur le bureau'},
  {role:'assistant',content:'{"route":"action"}'},
  {role:'user',content:'C est quoi une PWA ?'},
  {role:'assistant',content:'{"route":"conversation"}'},
  {role:'user',content:'ecrit un fichier de test su mon bureau'},
  {role:'assistant',content:'{"route":"action"}'},
  {role:'user',content:'Bonjour EVA comment ca va ?'},
  {role:'assistant',content:'{"route":"conversation"}'},
  {role:'user',content:'Ouvre YouTube'},
  {role:'assistant',content:'{"route":"action"}'},
  {role:'user',content:'Ouvre Edge'},
  {role:'assistant',content:'{"route":"action"}'},
  {role:'user',content:'Crée une page HTML en code Python sur le bureau'},
  {role:'assistant',content:'{"route":"action"}'},
  {role:'user',content:'N\'ouvre pas YouTube et ne fais rien'},
  {role:'assistant',content:'{"route":"conversation"}'},
  {role:'user',content:prompt}
 ];
 const response=await w.eva.system.llmChat(messages,{sessionId:id,jsonSchema:schema,maxTokens:64,temperature:0,stopTriggers:[]});
 if(response.aborted)throw Error('CANCELLED');
 return JSON.parse(response.choices[0].message.content).route;
}
async function consume(uid,id,epoch){
 if(epoch!==generation||uid!==user)return;
 const r=ref(uid,id);
 const steps=[{text:'Prise en charge par le PC',ts:new Date().toISOString(),state:'running'}];
 const data=await w.db.runTransaction(async tx=>{
  const s=await tx.get(r);if(!s.exists)return null;const d=s.data();
  if(d.status!=='pending'||d.deviceId!==w._cwDeviceId)return null;
  const expiry=d.expiresAt?.toMillis?.();
  if(expiry&&Date.now()>expiry){tx.update(r,{status:'error',state:'expired',step:'Commande expiree',result:{success:false,error:'EXPIRED'}});return null;}
  tx.update(r,{owner,status:'running',state:'running',step:'Prise en charge par le PC',steps,startedAt:ts(),updatedAt:ts()});return d;
 });
 if(!data)return;
 let agent=null,result=null,unsubCancel=()=>{},overlayShown=false,expired=false,approvalHandled=false;
 const resolveApproval=async approved=>{
  if(approvalHandled)return;
  approvalHandled=true;
  updateOverlay('cloudworks',approved?'Action autorisée, exécution...':'Action refusée.');
  await w.eva.cloudworks.respondApproval?.(id,!!approved).catch(()=>{});
  await ownedUpdate(r,{state:approved?'executing':'running',approval:null,approvalDecision:!!approved}).catch(()=>{});
 };
 current={
  id,r,
  stop:()=>{if(agent)agent.stop();else w.eva.cloudworks.cancel(id).catch(console.warn);},
  resolveApproval,
  onApproval:apData=>{
   approvalHandled=false;
   const msg=apData?.summary||('Autorisation requise : '+(apData?.tool||'action'));
   ownedUpdate(r,{
    state:'waiting_user',
    step:msg,
    approval:{pending:true,tool:apData?.tool||'',args:apData?.args||{},summary:msg,requestedAt:Date.now()},
    approvalDecision:null
   }).catch(()=>{});
  }
 };
 const deadline=setTimeout(()=>{expired=true;current?.id===id&&current.stop();},300000);
 let prompt=data.payload?.prompt||data.action||'';

 const progress=async(text,status)=>{
  const clean=String(text||'').slice(0,600);
  for(let i=0;i<steps.length;i++){if(steps[i].state==='running')steps[i].state='done';}
  const prev=steps[steps.length-1];
  if(!prev||prev.text!==clean){
   steps.push({text:clean,ts:new Date().toISOString(),state:status==='error'?'error':'running'});
  }else{
   prev.state=status==='error'?'error':'running';
  }
  const ok=await ownedUpdate(r,{step:clean,steps:steps.slice(-40),state:status==='executing'?'executing':'running'});
  if(!ok)throw Error('OWNERSHIP_LOST_OR_CANCELLED');
  emit('cw:step',{cmdId:id,step:clean});
  if(overlayShown)updateOverlay(status==='error'?'error':'cloudworks',clean);
 };
 try{
  const config=await w.eva.cloudworks.status();if(!config.enabled)throw Error('CLOUDWORKS_DISABLED');
  unsubCancel=r.onSnapshot(s=>{
   if(!s.exists)return;
   const d=s.data();
   if(d.status==='cancelled'){current?.id===id&&current.stop();return;}
   if(d.approval?.pending&&(d.approvalDecision===true||d.approvalDecision===false)&&current?.id===id){
    current.resolveApproval(d.approvalDecision);
   }
  });
  if(data.payload?.command||data.payload?.tool||data.payload?.name)throw Error('LEGACY_DIRECT_EXECUTION_DISABLED: renvoyer la demande en langage naturel');
  if(data.type==='chat_request'){
   const route=await routeMessage(id,prompt);
   if(route!=='action'){
    await ownedUpdate(r,{routing:'conversation',status:'done',state:'succeeded',step:'Message conversationnel; aucune action PC',result:{success:true,routed:true,executed:false},completedAt:ts()});return;
   }
   if(!await ownedUpdate(r,{routing:'action'}))throw Error('CANCELLED');
  }
  overlayShown=true;
  showOverlay('cloudworks',prompt||'Tâche CloudWorks',{taskId:id});
  emit('cw:task-start',{cmdId:id,type:data.type,prompt});
  if(['agentic_task','chat_request'].includes(data.type)){
   if(!prompt.trim())throw Error('EMPTY_PROMPT');
   agent=new w.CWAgent(uid,id,{});result=await agent.run(prompt,progress);
  }else{
   const quick={sysinfo:['system_status',{}],screenshot:['screenshot_take',{}],open_explorer:['app_launch',{target:'explorer.exe',args:null}],lock:['session_lock',{}],sleep:['system_sleep',{}],shutdown:['system_shutdown',{}]};
   if(!quick[data.type])throw Error('UNSUPPORTED_COMMAND: '+data.type);
   await progress('Exécution : '+data.type,'executing');
   result=await w.eva.cloudworks.executeTool(...quick[data.type],{taskId:id});
   if(result.success)result={...result,output:result.result?.summary||'Commande transmise au système'};
  }
 }catch(e){result={success:false,error:e.message};}
 finally{
  unsubCancel();clearTimeout(deadline);
  if(expired&&result)result={...result,success:false,error:'TASK_DEADLINE_EXCEEDED; verifier les effets deja realises',indeterminate:true};
  if(result){
   const status=result.cancelled?'cancelled':result.success===true?'done':'error';
   for(let i=0;i<steps.length;i++){
    if(steps[i].state==='running')steps[i].state=(status==='error'&&i===steps.length-1)?'error':'done';
   }
   const safe={success:result.success===true,output:result.output||result.response||null,error:result.error||null,partial:!!result.partial,indeterminate:!!result.indeterminate};
   const persisted=await ownedUpdate(r,{status,approval:null,state:result.indeterminate?'indeterminate':result.partial?'partial':status==='done'?'succeeded':status==='cancelled'?'cancelled':'failed',step:safe.output||safe.error||status,result:safe,steps:steps.slice(-40),completedAt:ts()}).catch(e=>{console.error('[CW] Final write failed',id,e);return false;});
   emit('cw:task-done',{cmdId:id,status:persisted?status:'error',result:persisted?safe:{success:false,error:'FINAL_STATE_NOT_PERSISTED; verifier avant toute nouvelle execution'},type:data.type,prompt,isRemote:data.source==='web'});
   if(overlayShown){
    hideOverlaySoon(status==='done'?'done':'error',safe.output||safe.error||(status==='done'?'Action terminée':'Échec de la tâche'));
   }
  }else if(overlayShown){
   try{w.eva?.overlay?.hide?.();}catch(_){}
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
 try{
  const udoc=await w.db.collection('users').doc(uid).get();
  const auto=udoc.data()?.cloudworks?.autonomousMode;
  if(typeof auto==='boolean'&&w.eva?.cloudworks?.setAutonomous){
   await w.eva.cloudworks.setAutonomous(auto).catch(()=>{});
  }
 }catch(_){}
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
w.respondCurrentCloudWorksApproval=approved=>current?.resolveApproval?current.resolveApproval(!!approved):Promise.resolve();
function init(){if(!w.firebase?.auth||!w.db||!w.CWBus){setTimeout(init,300);return;}w.firebase.auth().onAuthStateChanged(u=>setup(u?.uid||null).catch(console.error));}
init();
w.addEventListener('beforeunload',()=>{
 unsubscribe?.();clearInterval(heartbeat);current?.stop();
 if(w.pcAgentDocRef)try{w.pcAgentDocRef.set({online:false,updatedAt:ts()},{merge:true}).catch(()=>{});}catch(_){}
});
})(window);
