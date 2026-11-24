/* Compatibility facade over the canonical command envelope. */
(function(w){'use strict';
const states={queued:'pending',running:'running',executing:'running',waiting_user:'running',succeeded:'done',failed:'error',partial:'error',expired:'error',indeterminate:'error',cancelled:'cancelled'};
const ref=(uid,id)=>w.db.collection('cloudworks').doc(uid).collection('commands').doc(id);
w.CWFirestore={
 pushCommand:async(uid,task)=>{
  if(uid!==w.S?.user?.uid)throw Error('UID_MISMATCH');
  const deviceId=await w.CWBus.target(task.deviceId);
  await w.db.runTransaction(async tx=>{const r=ref(uid,task.id);const old=await tx.get(r);if(old.exists)throw Error('COMMAND_ALREADY_EXISTS');
   tx.set(r,{schemaVersion:2,id:task.id,type:'agentic_task',deviceId,payload:{prompt:task.prompt},status:'pending',state:'queued',step:'En attente du PC',createdAt:new Date(),updatedAt:new Date(),expiresAt:new Date(Date.now()+300000)});
  });
 },
 updateCommandState:async(uid,id,state)=>{if(state==='cancelled')return w.CWBus.cancel(id);throw Error('ONLY_WORKER_CAN_CHANGE_EXECUTION_STATE');},
 listenCommand:(uid,id,cb)=>w.CWBus.watch(id,cb),
 listenDevices:(uid,cb)=>w.db.collection('cloudworks').doc(uid).collection('devices').onSnapshot(s=>cb(s.docs.map(d=>({id:d.id,...d.data()})))),
 startDeviceHeartbeat:()=>{console.info('[CW] Heartbeat owned exclusively by pc-agent');},
 loadActivity:(uid,limit,cb)=>w.db.collection('cloudworks').doc(uid).collection('commands').orderBy('createdAt','desc').limit(limit||20).get().then(s=>cb(s.docs.map(d=>({id:d.id,...d.data()})))),
 logAction:()=>{},
 initWithAuth:cb=>w.firebase.auth().onAuthStateChanged(u=>{if(u)cb(u);})
};
})(window);
