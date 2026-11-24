/* Unified tracker: Firestore is the source of truth; no provider summary call. */
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
