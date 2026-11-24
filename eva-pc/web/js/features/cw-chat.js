/* Called before providers by the small, fail-closed insertion in messages.js. */
(function(w){'use strict';let routing=false;
async function saveUser(text){
 const uid=w.S?.user?.uid;if(!uid)return;
 if(!w.S.convId){const c=w.db.collection('users').doc(uid).collection('conversations').doc();await c.set({title:text.slice(0,60),createdAt:new Date(),updatedAt:new Date()});w.S.convId=c.id;}
 await w.db.collection('users').doc(uid).collection('conversations').doc(w.S.convId).collection('messages').add({role:'user',content:text,timestamp:w.timestamp?w.timestamp():new Date()});
}
async function route(text){
 if(!text||!w.S?.user||!w.CWBus)return false;
 if(/^\/chat\s/i.test(text))return false;
 // Attachments remain on the existing conversation path.
 if(w.S.image||w.S.images?.length||w.S.document||w.S.documents?.length)return false;
 if(routing){w.toast?.('Routage deja en cours','info');return true;}
 const forced=/^\/pc\s/i.test(text),prompt=forced?text.replace(/^\/pc\s/i,''):text;
 let deviceId;
 try{deviceId=await w.CWBus.target();}catch(e){if(!forced&&!w.eva)return false;w.toast?.(e.message,'error');return true;}
 routing=true;
 const send=document.getElementById('sendBtn');if(send)send.disabled=true;
 w.setEvaStatusHeader?.('Routage local CloudWorks','thinking');
 try{
  const id=await w.CWBus.submit(forced?'agentic_task':'chat_request',{prompt},{deviceId});
  const result=forced?{handled:true,id}:await w.CWBus.wait(id,null,true);
  if(!result.handled)return false;
  const input=document.getElementById('msgInput');if(input)input.value='';
  if(typeof w.appendMsg==='function')w.appendMsg('user',text);
  await saveUser(text);
  w.appendCloudWorksTracker(id,prompt);return true;
 }catch(e){w.toast?.('CloudWorks : '+e.message,'error');return true;}
 finally{routing=false;if(send)send.disabled=false;w.setEvaStatusHeader?.(null);}
}
w.CWChat={route};
// Replace only the PC task entry point. Keep the existing model-download panel.
w._cwRunAgenticTask=async()=>{
 const p=document.getElementById('cwAgenticPrompt'),status=document.getElementById('cwAgenticStatus');if(!p?.value.trim())return;
 try{const id=await w.CWBus.submit('agentic_task',{prompt:p.value.trim()});if(status){status.replaceChildren();status.style.display='block';}w.appendCloudWorksTracker(id,p.value,status);}
 catch(e){if(status){status.style.display='block';status.textContent=e.message;}}
};
w._cwStopAgent=()=>{for(const id of Object.keys(w._cwActiveTrackers||{}))w.CWBus.cancel(id).catch(console.error);};
w._cwQuickCmd=async type=>{try{const id=await w.CWBus.submit(type,{});w.appendCloudWorksTracker(id,type);}catch(e){w.toast?.(e.message,'error');}};
})(window);
