/* Called before providers by the small, fail-closed insertion in messages.js. */
(function(w){'use strict';let routing=false;
async function saveChatMsg(role,text){
 const uid=w.S?.user?.uid;if(!uid)return;
 if(!w.S.convId){const c=w.db.collection('users').doc(uid).collection('conversations').doc();await c.set({title:text.slice(0,60),createdAt:new Date(),updatedAt:new Date()});w.S.convId=c.id;}
 await w.db.collection('users').doc(uid).collection('conversations').doc(w.S.convId).collection('messages').add({role,content:text,timestamp:w.timestamp?w.timestamp():new Date()});
}
async function route(text){
 if(!text||!w.S?.user||!w.CWBus)return false;
 if(/^\/chat\s/i.test(text))return false;
 if(w.S.image||w.S.images?.length||w.S.document||w.S.documents?.length)return false;
 if(routing){w.toast?.('Routage deja en cours','info');return true;}
 const forced=/^\/pc\s/i.test(text),prompt=forced?text.replace(/^\/pc\s/i,''):text;
 if(!forced&&w.eva?.cloudworks?.status){
  try{const st=await w.eva.cloudworks.status();if(!st?.enabled)return false;}catch(_){return false;}
 }
 let deviceId;
 try{deviceId=await w.CWBus.target();}catch(e){if(!forced)return false;w.toast?.(e.message,'error');return true;}
 routing=true;
 const input=document.getElementById('msgInput');
 if(input){input.value='';input.style.height='auto';}
 if(typeof w.appendMsg==='function'&&w._cwPreRenderedUserText!==text){
  w._cwPreRenderedUserText=text;
  w.appendMsg('user',text);
 }
 const send=document.getElementById('sendBtn');if(send)send.disabled=true;
 w.showTyping?.(text);
 w.setEvaStatusHeader?.('Analyse de la demande...','thinking');
 try{
  const id=await w.CWBus.submit(forced?'agentic_task':'chat_request',{prompt},{deviceId});
  const result=forced?{handled:true,id}:await w.CWBus.wait(id,null,true);
  if(!result.handled||(!forced&&result.error==='CLOUDWORKS_DISABLED')){
   return false;
  }
  w._cwPreRenderedUserText=null;
  if(typeof w.hideTyping==='function')w.hideTyping();
  if(w.S)w.S.cwRunning=true;
  if(w._isJarvisActive&&w.eva?.overlay?.show)w.eva.overlay.show('cloudworks',prompt);
  await saveChatMsg('user',text);
  const intro="Je m'en occupe tout de suite ! Je lance l'action sur votre PC.";
  if(typeof w.appendMsg==='function')w.appendMsg('eva',intro);
  await saveChatMsg('assistant',intro);
  w.appendCloudWorksTracker(id,prompt);return true;
 }catch(e){
  w._cwPreRenderedUserText=null;
  if(typeof w.hideTyping==='function')w.hideTyping();
  if(w.S)w.S.cwRunning=false;
  w.toast?.('CloudWorks : '+e.message,'error');
  return true;
 }finally{
  routing=false;
  if(send)send.disabled=false;
  w.setEvaStatusHeader?.(null);
 }
}
w.CWChat={route};
if(!w._cwRunAgenticTask){
 w._cwRunAgenticTask=async()=>{
  const p=document.getElementById('cwAgenticPrompt'),status=document.getElementById('cwAgenticStatus');if(!p?.value.trim())return;
  try{
   const id=await w.CWBus.submit('agentic_task',{prompt:p.value.trim()});
   if(status){status.replaceChildren();status.className='';status.style.cssText='display:block;margin-top:12px;';}
   w.appendCloudWorksTracker(id,p.value,status);
   const r=await w.CWBus.wait(id);if(r?.success)p.value='';
  }catch(e){if(status){status.style.display='block';status.textContent=e.message;}}
 };
}
if(!w._cwStopAgent){
 w._cwStopAgent=()=>{for(const id of Object.keys(w._cwActiveTrackers||{}))w.CWBus.cancel(id).catch(console.error);};
}
if(!w._cwQuickCmd){
 w._cwQuickCmd=async type=>{
  const status=document.getElementById('cwAgenticStatus');
  try{
   const id=await w.CWBus.submit(type,{});
   if(status){status.replaceChildren();status.className='';status.style.cssText='display:block;margin-top:12px;';}
   w.appendCloudWorksTracker(id,type,status||undefined);
  }catch(e){w.toast?.(e.message,'error');}
 };
}
})(window);
