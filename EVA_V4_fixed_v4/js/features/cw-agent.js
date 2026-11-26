/* CloudWorks: tool-locked planner + local GBNF agent + optional active AI rich file content. */
(function(w){
'use strict';
let active=null;
const TOOL_LABELS={
 app_launch:'Lancement / ouverture',
 app_resolve:'Recherche de l’application installée',
 app_check:'Vérification d’application',
 app_close:'Fermeture d’application',
 app_install:'Installation via Winget',
 web_browse:'Ouverture dans le navigateur',
 web_search:'Recherche web',
 web_fetch:'Lecture de page web',
 file_list:'Inspection du dossier',
 file_read:'Lecture de fichier',
 file_search:'Recherche de fichiers',
 file_create:'Création de fichier',
 folder_create:'Création de dossier',
 folder_organize:'Organisation de dossier',
 pdf_create:'Création de document PDF',
 excel_create:'Création de tableur Excel',
 document_create:'Création de document',
 data_analyze:'Analyse de données',
 system_status:'Lecture état système',
 screenshot_take:'Capture d’écran',
 process_verify:'Vérification système',
 command_run:'Exécution PowerShell'
};
function toolLabel(name){return TOOL_LABELS[name]||name;}
function content(r){if(r?.aborted)throw Error('CANCELLED');return r?.choices?.[0]?.message?.content||'';}

function schemaForTool(toolName){
 const s=w.CWTools?.specs?.[toolName];
 if(!s)return w.CWTools.schema(false);
 return {
  type:'object',
  properties:{kind:{enum:['tool']},name:{enum:[toolName]},args:{type:'object',properties:s.properties}},
  required:['kind','name','args']
 };
}

function planSchema(){
 const names=Object.keys(w.CWTools?.specs||{});
 return {
  type:'object',
  properties:{
   steps:{
    type:'array',
    minItems:1,
    maxItems:8,
    items:{
     type:'object',
     properties:{tool:{enum:names},goal:{type:'string'}},
     required:['tool','goal']
    }
   }
  },
  required:['steps']
 };
}

function stripOuterCodeFences(str){
 const m=String(str||'').trim().match(/^```[a-z0-9_-]*\r?\n([\s\S]*?)\r?\n```$/i);
 return m?m[1]:String(str||'');
}

async function generateRichFileContent(fullPrompt,stepGoal,filePath,existingArtifacts){
 const provName=w.S?.config?.aiProvider||'';
 if(!w.EVAProviders?.createProvider||!w.S?.config||['qwen','eva'].includes(provName))return null;
 try{
  const provider=w.EVAProviders.createProvider(provName,w.S.config);
  const ext=(String(filePath||'').split('.').pop()||'').toLowerCase();
  const isHtml=ext==='html'||ext==='htm';
  const sysPrompt=isHtml
   ?'Tu es un generateur de code web expert. Retourne UNIQUEMENT le code HTML5 complet, autonome (<style> et <script> inclus, sans CDN externe, sans commentaire d introduction ni balise ```). Tout jeu ou appli demande doit etre reellement jouable, fluide et esthétique.'
   :'Tu es un assistant precis. Retourne UNIQUEMENT le contenu texte brut exact du fichier demande (sans introduction, sans commentaire ni balise ```).';
  const userMsg='Demande globale utilisateur : '+fullPrompt+'\n'+
   'Fichier exact a ecrire : '+filePath+'\n'+
   'Objectif de ce fichier : '+stepGoal+'\n'+
   (existingArtifacts?.length?('Autres fichiers de la tache :\n'+existingArtifacts.map(a=>'- '+a.path+': '+String(a.preview||'').slice(0,400)).join('\n')+'\n'):'')+
   'Ecris maintenant le contenu complet et directement utilisable du fichier.';
  const aiPromise=provider.chat([{role:'user',content:userMsg}],sysPrompt);
  const tmoPromise=new Promise((_,rej)=>setTimeout(()=>rej(Error('RICH_CONTENT_TIMEOUT')),22000));
  const res=await Promise.race([aiPromise,tmoPromise]);
  if(res&&res.success&&res.content&&res.content.trim().length>20){
   return stripOuterCodeFences(res.content);
  }
 }catch(e){
  console.warn('[CWAgent] Fallback contenu 3B local:',e?.message||e);
 }
 return null;
}

function CWAgent(uid,id,options){this.uid=uid;this._taskId=id;this.options=options||{};this.stopped=false;}
CWAgent.prototype.stop=function(){this.stopped=true;return w.eva?.cloudworks?.cancel(this._taskId);};

CWAgent.prototype.run=async function(prompt,emit){
 if(active)return {success:false,error:'AGENT_BUSY'};
 active=this;
 const observations=[],seen=new Set(),createdPaths=new Map(),createdPreviews=[];
 let invalid=0;
 const output=async(text,status)=>{if(emit)await emit(text,status,false);};
 const finish=(success,message,extra={})=>({success,response:message,output:success?message:null,error:success?null:message,observations,...extra});

 try{
  if(!w.CWTools||!w.eva?.system?.llmChat)throw Error('LOCAL_MODEL_REQUIRED');
  await output('Planification des étapes sur le PC...','running');

  let plan=[];
  try{
   const sysPlan='Decompose la requete Windows en etapes ordonnees en choisissant l outil exact pour chaque etape.\n'+
    'Outils disponibles: folder_create (creer un dossier), file_create (creer un fichier avec extension .html/.txt/.md), app_resolve (trouver app Store/PWA avant lancement), app_launch (ouvrir une app, URL, dossier ou fichier cree .html/.txt/.pdf), folder_organize (trier dossier), file_list, file_read, file_search, pdf_create, excel_create, screenshot_take, system_status.\n'+
    'Regles :\n'+
    '- Si un dossier ET plusieurs fichiers sont demandes : mets d abord folder_create, puis UN step file_create distinct par fichier (avec chemin complet et extension .html ou .txt), puis app_launch si ouverture demandee.\n'+
    '- Si une app locale Windows/Store (WhatsApp, Spotify, Discord...) doit etre ouverte, mets d abord app_resolve puis app_launch.\n'+
    '- N invente pas d etapes inutiles.';
   const rp=await w.eva.system.llmChat(
    [{role:'system',content:sysPlan},{role:'user',content:prompt}],
    {sessionId:this._taskId,maxTokens:512,temperature:0,jsonSchema:planSchema(),stopTriggers:[],timeoutMs:60000}
   );
   if(this.stopped)throw Error('CANCELLED');
   const parsedPlan=JSON.parse(content(rp));
   if(Array.isArray(parsedPlan?.steps)&&parsedPlan.steps.length){
    plan=parsedPlan.steps.slice(0,8);
   }
  }catch(pe){
   if(this.stopped||/CANCELLED|TIMEOUT|MODEL|LLM_BUSY/.test(pe.message))throw pe;
   console.warn('[CWAgent] Fallback boucle libre (plan failed):',pe.message);
  }

  const sysStep='Tu es EVA, agent Windows. Remplis uniquement les arguments JSON exacts de l outil impose pour l etape courante.\n'+
   '- Bureau Windows : utilise $env:USERPROFILE\\\\Desktop (ex: $env:USERPROFILE\\\\Desktop\\\\MonDossier\\\\index.html).\n'+
   '- Si un dossier a deja ete cree a l etape precedente (voir completedSteps), cree les fichiers A L INTERIEUR de ce dossier.\n'+
   '- N ecrase JAMAIS un fichier deja cree a une etape precedente (choisis le nouveau nom de fichier demande par stepGoal).\n'+
   '- Si app_resolve retourne primaryMatch.AppID ou path dans completedSteps, passe exactement cette valeur dans target pour app_launch.';

  const runTurnLoop=async(forcedStep,stepIdx,totalSteps)=>{
   const useLocked=!!(forcedStep&&w.CWTools.specs[forcedStep.tool]);
   const currentSchema=useLocked?schemaForTool(forcedStep.tool):w.CWTools.schema(observations.some(o=>o.result?.success));
   const messages=[
    {role:'system',content:sysStep},
    {role:'user',content:JSON.stringify({
      request:prompt,
      stepNumber:stepIdx+1,
      totalSteps,
      tool:forcedStep?.tool||null,
      stepGoal:forcedStep?.goal||prompt,
      alreadyUsedFilePaths:Array.from(createdPaths.keys()),
      completedSteps:observations.slice(-8).map(o=>({
       name:o.name,
       args:o.args?.path||o.args?.target||o.args?.query||undefined,
       success:!!o.result?.success,
       resultPath:o.result?.result?.path||o.result?.result?.opened||o.result?.result?.primaryMatch?.AppID||o.result?.result?.primaryMatch?.path||undefined,
       error:o.result?.error||undefined
      }))
    })}
   ];

   const r=await w.eva.system.llmChat(messages,{sessionId:this._taskId,maxTokens:2048,temperature:0,jsonSchema:currentSchema,stopTriggers:[],timeoutMs:120000});
   if(this.stopped)throw Error('CANCELLED');
   const decision=JSON.parse(content(r));
   if(!decision||!['tool','done','clarify','fail'].includes(decision.kind))throw Error('INVALID_DECISION');
   if(decision.kind!=='tool')return decision;
   decision.args=w.CWTools.validate(decision.name,decision.args||{});

   if(decision.name==='file_create'&&!decision.args.append&&createdPaths.has(decision.args.path.toLowerCase())){
    const retryMsgs=[
     ...messages,
     {role:'assistant',content:JSON.stringify(decision)},
     {role:'user',content:'REFUS : le fichier "'+decision.args.path+'" existe deja. Donne un NOUVEAU chemin distinct correspondant a l objectif : '+(forcedStep?.goal||prompt)}
    ];
    const r2=await w.eva.system.llmChat(retryMsgs,{sessionId:this._taskId,maxTokens:2048,temperature:0,jsonSchema:currentSchema,stopTriggers:[],timeoutMs:60000});
    if(this.stopped)throw Error('CANCELLED');
    const dec2=JSON.parse(content(r2));
    if(dec2?.kind==='tool')decision.args=w.CWTools.validate(decision.name,dec2.args||{});
   }

   if(decision.name==='file_create'&&decision.args.path){
    const needsRich=/\.(html?|css|md)$/i.test(decision.args.path)||
     /tetris|jeu|game|page|site|cheat|code|script|article|guide|rapport|document|texte|hello/i.test(prompt+' '+(forcedStep?.goal||''));
    if(needsRich){
     await output('Rédaction du contenu ('+(decision.args.path.split(/[\\/]/).pop()||'fichier')+')...','running');
     const rich=await generateRichFileContent(prompt,forcedStep?.goal||prompt,decision.args.path,createdPreviews);
     if(rich)decision.args.content=rich;
    }
   }
   return decision;
  };

  if(plan.length){
   for(let i=0;i<plan.length;i++){
    if(this.stopped)throw Error('CANCELLED');
    const st=plan[i];
    const lbl=toolLabel(st.tool)+(st.goal?' — '+st.goal.slice(0,70):'');
    await output(`Étape ${i+1}/${plan.length} : ${lbl}`,'executing');
    let decision;
    try{
     decision=await runTurnLoop(st,i,plan.length);
    }catch(e){
     if(this.stopped||/CANCELLED|TIMEOUT|MODEL|LLM_BUSY/.test(e.message))throw e;
     if(++invalid>=2)throw Error('MODEL_INVALID_OUTPUT: '+e.message);
     i--;continue;
    }
    invalid=0;
    if(decision.kind!=='tool')break;
    const result=await w.CWTools.executeTool(decision.name,decision.args,{taskId:this._taskId});
    observations.push({name:decision.name,args:decision.args,result});
    if(this.stopped)throw Error('CANCELLED');
    if(result.cancelled||result.indeterminate||result.error==='APPROVAL_DENIED'){
     return finish(false,result.error||'CANCELLED',{cancelled:!!result.cancelled,indeterminate:!!result.indeterminate});
    }
    if(result.success){
     if(decision.name==='file_create'&&result.result?.path){
      createdPaths.set(decision.args.path.toLowerCase(),result.result.path);
      createdPreviews.push({path:result.result.path,preview:decision.args.content});
     }
     await output(`Étape ${i+1}/${plan.length} terminée : ${result.result?.summary||toolLabel(decision.name)}`,'running');
    }else{
     await output(`Étape ${i+1}/${plan.length} en échec (${result.error||'erreur'})`,'error');
    }
   }
  }else{
   for(let turn=0;turn<8;turn++){
    if(this.stopped)throw Error('CANCELLED');
    const decision=await runTurnLoop(null,turn,8);
    if(decision.kind!=='tool'){
     if(decision.kind!=='done')return finish(false,decision.message||'Clarification requise',{needsInput:decision.kind==='clarify'});
     break;
    }
    const fp=JSON.stringify([decision.name,Object.keys(decision.args).sort().map(k=>[k,decision.args[k]])]);
    if(seen.has(fp))throw Error('REPEATED_TOOL_CALL');
    seen.add(fp);
    await output(toolLabel(decision.name),'executing');
    const result=await w.CWTools.executeTool(decision.name,decision.args,{taskId:this._taskId});
    observations.push({name:decision.name,args:decision.args,result});
    if(result.cancelled||result.indeterminate||result.error==='APPROVAL_DENIED')return finish(false,result.error||'CANCELLED',{cancelled:!!result.cancelled,indeterminate:!!result.indeterminate});
   }
  }

  const successful=observations.filter(o=>o.result?.success===true);
  const failed=observations.filter(o=>o.result?.success!==true);
  if(!successful.length||(plan.length>1&&failed.length>0&&successful.every(o=>o.name==='folder_create'))){
   const errTxt=failed.map(f=>`${f.name}: ${f.result?.error||'échec'}`).join(' | ')||'Aucune action confirmée';
   await output(errTxt,'error');
   return finish(false,errTxt,{partial:successful.length>0});
  }
  if(successful.every(o=>['app_resolve','app_check','process_verify'].includes(o.name)||(o.name==='folder_organize'&&o.args.dryRun))){
   return finish(false,'TASK_NOT_VERIFIED: vérification seule, aucune action confirmée');
  }

  const doneArtifacts=successful
   .map(o=>o.result?.result?.summary||o.result?.result?.path||o.result?.result?.opened)
   .filter(Boolean);
  const summary=(failed.length?`Terminé partiellement (${successful.length}/${observations.length} étapes) : `:'Tâche effectuée avec succès : ')+
   (doneArtifacts.length?doneArtifacts.join(' · '):'opérations complètes.');
  await output(summary,failed.length?'error':'done');
  return finish(failed.length===0,summary,{partial:failed.length>0&&successful.length>0});
 }catch(e){
  await output(e.message,'error');
  return finish(false,e.message,{cancelled:this.stopped||e.message==='CANCELLED'});
 }finally{active=null;}
};
w.CWAgent=CWAgent;
w.CWAgentStop=()=>active?.stop();
w.CWAgentRun=async(uid,prompt,options={})=>{
 if(!w.CWBus)throw Error('CW_BUS_REQUIRED');
 const id=await w.CWBus.submit('agentic_task',{prompt},{deviceId:options.deviceId});
 return w.CWBus.wait(id,options.emitFn);
};
})(window);
