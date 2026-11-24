/* Unified tracker: Firestore is the source of truth; no provider summary call. */
(function(w){'use strict';
const trackers=new Map();w._cwActiveTrackers={};
function element(tag,text,cls){const e=document.createElement(tag);if(text!=null)e.textContent=text;if(cls)e.className=cls;return e;}
function card(prompt){const e=element('section',null,'cw-tracker-card');e.style.cssText='padding:16px;margin:12px 0;border:1px solid #d87925;border-radius:12px;white-space:pre-wrap';e.append(element('h4','CloudWorks'),element('p',prompt),element('div','En attente du PC','cw-live-step'),element('pre','','cw-live-result'));return e;}
async function persist(uid,conv,id,data){if(!uid||!conv)return;await w.db.collection('users').doc(uid).collection('conversations').doc(conv).collection('messages').doc('cw_'+id).set(data,{merge:true});}
w.appendCloudWorksTracker=function(id,prompt,container){
 if(trackers.has(id))return trackers.get(id).card;
 const uid=w.S?.user?.uid,conv=w.S?.convId;if(!uid||!w.CWBus)return;
 const c=card(prompt),step=c.querySelector('.cw-live-step'),out=c.querySelector('.cw-live-result'),button=element('button','Annuler');
 c.id='cwTracker-'+id;c.append(button);
 (container||document.getElementById('messagesList')||document.body).append(c);
 const record={card:c,unsub:()=>{},final:false};trackers.set(id,record);w._cwActiveTrackers[id]=record;
 button.onclick=()=>w.CWBus.cancel(id).catch(e=>{out.textContent=e.message;});
 const watchdog=setTimeout(()=>{step.textContent='Suivi interrompu. Etat inconnu : verifier avant de relancer.';button.textContent='Demander l’annulation';record.unsub();},360000);
 record.unsub=w.CWBus.watch(id,d=>{
  step.textContent=d.step||d.status;
  if(!w.CWBus.terminal(d))return;
  if(record.final)return;record.final=true;clearTimeout(watchdog);
  c.classList.add(d.status);button.remove();
  const summary=d.result?.output||d.result?.error||d.step||d.status;out.textContent=summary;
  // Run callbacks asynchronously after onSnapshot has returned its unsubscribe handle.
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
