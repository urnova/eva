/* Shared Firestore command producer. Never executes tools. */
(function(w){'use strict';
const terminal=d=>['done','error','cancelled'].includes(d?.status);
function uid(){const id=w.S?.user?.uid;if(!id||!w.db)throw Error('AUTH_REQUIRED');return id;}
function commands(){return w.db.collection('cloudworks').doc(uid()).collection('commands');}
async function target(explicit){
 if(explicit&&explicit!=='web')return explicit;
 if(w.eva&&w._cwDeviceId)return w._cwDeviceId;
 const saved=localStorage.getItem('cw_target_device');
 const snap=await w.db.collection('cloudworks').doc(uid()).collection('devices').get();
 const online=snap.docs.filter(d=>{const x=d.data(),t=x.lastSeen?.toMillis?.()||0;return x.online&&Date.now()-t<90000;});
 if(saved&&online.some(d=>d.id===saved))return saved;
 if(online.length===1)return online[0].id;
 throw Error(online.length?'SELECT_DEVICE: selectionne le PC cible avec CWBus.selectDevice(id)':'NO_PC_ONLINE');
}
async function submit(type,payload={},options={}){
 const deviceId=await target(options.deviceId),ref=commands().doc();
 await ref.set({schemaVersion:2,id:ref.id,deviceId,type,payload,status:'pending',state:'queued',step:'En attente du PC',createdAt:w.timestamp?w.timestamp():new Date(),updatedAt:w.timestamp?w.timestamp():new Date(),expiresAt:new Date(Date.now()+300000),steps:[],source:w.eva?'desktop':'web'});
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
