/* Sole desktop command consumer. No legacy PowerShell fallback. */
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
 const progress=async(text,status)=>{
  steps.push({text:String(text).slice(0,600),ts:new Date().toISOString(),state:status==='error'?'error':'running'});
  const ok=await ownedUpdate(r,{step:String(text).slice(0,600),steps:steps.slice(-40),state:status==='executing'?'executing':'running'});
  if(!ok)throw Error('OWNERSHIP_LOST_OR_CANCELLED');
  emit('cw:step',{cmdId:id,step:text});
 };
 try{
  const config=await w.eva.cloudworks.status();if(!config.enabled)throw Error('CLOUDWORKS_DISABLED');
  unsubCancel=r.onSnapshot(s=>{if(s.exists&&s.data().status==='cancelled')current?.id===id&&current.stop();});
  let prompt=data.payload?.prompt||data.action||'';
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
   // Avoid large/sensitive result uploads: no file contents, screenshots or model observations.
   const safe={success:result.success===true,output:result.output||result.response||null,error:result.error||null,partial:!!result.partial,indeterminate:!!result.indeterminate};
   const persisted=await ownedUpdate(r,{status,state:result.indeterminate?'indeterminate':result.partial?'partial':status==='done'?'succeeded':status==='cancelled'?'cancelled':'failed',step:safe.output||safe.error||status,result:safe,steps:steps.slice(-40),completedAt:ts()}).catch(e=>{console.error('[CW] Final write failed',id,e);return false;});
   emit('cw:task-done',{cmdId:id,status:persisted?status:'error',result:persisted?safe:{success:false,error:'FINAL_STATE_NOT_PERSISTED; verifier avant toute nouvelle execution'},type:data.type});
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
  await device.set({deviceId,deviceName:status.hostname,deviceType:'windows',online:status.enabled,llmModelInstalled:!!chk.exists,lastSeen:ts(),updatedAt:ts(),workerVersion:2},{merge:true});
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
