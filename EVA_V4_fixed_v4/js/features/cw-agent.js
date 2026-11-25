/* CloudWorks: bounded structured agent, never interpret prose as a command. */
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
  const system='Tu es EVA, agent Windows. Accomplis la requete de l utilisateur avec les outils Windows.\n'+
   'Format obligatoire (JSON uniquement) :\n'+
   '- Ouvrir un site web : {"kind":"tool","name":"app_launch","args":{"target":"https://youtube.com","args":null}}\n'+
   '- Lancer une application Windows connue (calculatrice=calc.exe, bloc-notes=notepad.exe, explorateur=explorer.exe, paint=mspaint.exe) : {"kind":"tool","name":"app_launch","args":{"target":"calc.exe","args":null}}\n'+
   '- Chercher une application installee dont tu ignores l executable : {"kind":"tool","name":"app_resolve","args":{"query":"spotify"}}\n'+
   '- Creer ou ecrire un fichier texte (si le nom ou contenu est imprecis, choisis un nom clair comme test.txt et un texte court) : {"kind":"tool","name":"file_create","args":{"path":"$env:USERPROFILE\\\\Desktop\\\\test.txt","content":"Bonjour","append":false}}\n'+
   '- Lister un dossier : {"kind":"tool","name":"file_list","args":{"path":"$env:USERPROFILE\\\\Desktop","depth":1}}\n'+
   '- Capture d ecran : {"kind":"tool","name":"screenshot_take","args":{}}\n'+
   '- Infos systeme : {"kind":"tool","name":"system_status","args":{}}\n'+
   '- Terminer (UNIQUEMENT apres observation d un outil reussi) : {"kind":"done","message":"Action effectuee avec succes."}\n'+
   'Regle : au premier tour, choisis OBLIGATOIREMENT un outil (kind:"tool"). Ne choisis jamais un site web si l utilisateur demande une application Windows locale.';
  
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
