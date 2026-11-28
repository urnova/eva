/* Called before providers by the small, fail-closed insertion in messages.js. */
(function(w){'use strict';let routing=false;
async function saveChatMsg(role,text){
 const uid=w.S?.user?.uid;if(!uid)return;
 const now=w.timestamp?w.timestamp():new Date();
 const convsCol=w.db.collection('users').doc(uid).collection('conversations');
 if(!w.S.convId){
  const c=convsCol.doc();
  const data={title:text.slice(0,60),lastMessage:text.slice(0,120),createdAt:now,updatedAt:now};
  await c.set(data);w.S.convId=c.id;
  if(Array.isArray(w.S.convs)){w.S.convs.unshift(Object.assign({id:c.id},data));w.renderConvs?.();}
 }else{
  convsCol.doc(w.S.convId).update({lastMessage:text.slice(0,120),updatedAt:now}).catch(()=>{});
 }
 await convsCol.doc(w.S.convId).collection('messages').add({role,content:text,timestamp:now});
}
const PC_HINT_RE=/(ouvr|lanc|cr[eé]|fais|g[eé]n[eè]re|[eé]cris|effac|supprim|d[eé]plac|rang|tri|copi|coll|renomm|ferm|quitt|tue|kill|arr[eê]t|red[eé]marr|[eé]teins|verrouill|veille|captur|screenshot|ex[eé]cut|install|d[eé]sinstall|t[eé]l[eé]charg|cherch.*sur\s|va\s+sur\s|script|powershell|cmd|terminal|syst[eè]me|sysinfo|cpu|gpu|ram|disque|batterie|volume|luminosit|wifi|bluetooth|fichier|dossier|r[eé]pertoire|bureau|desktop|document|t[eé]l[eé]chargement|downloads|html|\.html?|\.py|python|txt|\.txt|pdf|\.pdf|json|csv|xlsx|word|excel|powerpoint|app|appli|logiciel|programme|fen[eê]tre|pc|ordinateur|machine|whatsapp|discord|spotify|chrome|edge|firefox|brave|youtube|google|github|tetris|bloc[- ]?notes?|notepad|calculatrice|calc|vscode|explorateur|explorer|param[eè]tres)/i;
async function route(text){
 if(!text||!w.S?.user||!w.CWBus)return false;
 if(/^\/chat\s/i.test(text))return false;
 if(w.S.image||w.S.images?.length||w.S.document||w.S.documents?.length)return false;
 if(routing){w.toast?.('Routage deja en cours','info');return true;}
 const forced=/^\/pc\s/i.test(text),prompt=forced?text.replace(/^\/pc\s/i,''):text;
 const isPureWebInfo=/\b(m[eé]t[eé]o|quel temps|temp[eé]rature|actualit[eé]s?|news|qui est|qu['’]est[- ]ce|d[eé]finition|prix|cours)\b/i.test(prompt)&&!/\b(dossier|fichier|bureau|app|appli|logiciel|programme|chrome|edge|tetris|pdf|excel)\b/i.test(prompt);
 if(!forced&&(isPureWebInfo||!PC_HINT_RE.test(prompt)))return false;
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
   w._cwPreRenderedUserText=null;
   if(typeof w.hideTyping==='function')w.hideTyping();
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
