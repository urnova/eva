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

function schemaForTool(toolName,compact=false){
 const s=w.CWTools?.specs?.[toolName];
 if(!s)return w.CWTools.schema(false);
 let props=s.properties;
 if(compact&&toolName==='file_create')props={path:s.properties.path,append:s.properties.append};
 else if(compact&&toolName==='pdf_create')props={path:s.properties.path,title:s.properties.title};
 else if(compact&&toolName==='document_create')props={format:s.properties.format,filename:s.properties.filename,destination:s.properties.destination};
 return {
  type:'object',
  properties:{kind:{enum:['tool']},name:{enum:[toolName]},args:{type:'object',properties:props}},
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
 const raw=String(str||'').trim();
 const full=raw.match(/^```[a-z0-9_-]*\r?\n([\s\S]*?)\r?\n```\s*$/i);
 if(full)return full[1];
 const inner=raw.match(/```(?:html|python|py|css|json|csv|xml|yaml|md|txt)?\r?\n([\s\S]*?)\r?\n```/i);
 if(inner&&inner[1].length>=raw.length*0.45)return inner[1];
 return raw.replace(/^```[a-z0-9_-]*\r?\n/i,'').replace(/\r?\n```\s*$/,'');
}

function _extractJsonStrField(str,field){
 const re=new RegExp('"'+field+'"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"');
 const m=str.match(re);
 if(m){
  try{return JSON.parse('"'+m[1]+'"');}
  catch(_){return m[1].replace(/\\"/g,'"').replace(/\\\\/g,'\\');}
 }
 // Fallback si guillemet Windows backslash non echapé dans le chemin
 const loose=str.match(new RegExp('"'+field+'"\\s*:\\s*"([^"\\r\\n]+)"'));
 return loose?loose[1]:null;
}

function _repairJsonBackslashes(str){
 return String(str||'').replace(/\\([^"\\/bfnrtu])/g,'\\\\$1');
}

function safeParseDecision(raw,forcedStep){
 const str=String(raw||'').trim();
 try{return JSON.parse(str);}catch(_){}
 const start=str.indexOf('{'),end=str.lastIndexOf('}');
 const slice=(start>=0&&end>start)?str.slice(start,end+1):str;
 for(const candidate of [slice,_repairJsonBackslashes(slice)]){
  try{return JSON.parse(candidate);}catch(_){}
 }
 const nm=str.match(/"name"\s*:\s*"([^"]+)"/);
 const toolName=nm?nm[1]:forcedStep?.tool;
 if(toolName==='file_create'){
  const p=_extractJsonStrField(str,'path');
  if(p)return {kind:'tool',name:'file_create',args:{path:p,content:'DRAFT'}};
 }else if(toolName==='pdf_create'){
  const p=_extractJsonStrField(str,'path');
  const title=_extractJsonStrField(str,'title')||'Document EVA';
  if(p)return {kind:'tool',name:'pdf_create',args:{path:p,title,content:'DRAFT'}};
 }else if(toolName==='document_create'){
  const filename=_extractJsonStrField(str,'filename');
  const destination=_extractJsonStrField(str,'destination')||'$env:USERPROFILE\\Desktop';
  const format=_extractJsonStrField(str,'format')||'txt';
  if(filename)return {kind:'tool',name:'document_create',args:{format,filename,destination,content:'DRAFT'}};
 }else if(toolName==='folder_create'){
  const p=_extractJsonStrField(str,'path');
  if(p)return {kind:'tool',name:'folder_create',args:{path:p}};
 }else if(toolName==='app_launch'||toolName==='web_browse'){
  const target=_extractJsonStrField(str,'target')||_extractJsonStrField(str,'url');
  const a=_extractJsonStrField(str,'args');
  if(target)return {kind:'tool',name:toolName,args:toolName==='web_browse'?{url:target}:(a?{target,args:a}:{target})};
 }else if(toolName==='app_resolve'||toolName==='app_check'){
  const q=_extractJsonStrField(str,'query')||_extractJsonStrField(str,'name');
  if(q)return {kind:'tool',name:toolName,args:toolName==='app_resolve'?{query:q}:{name:q}};
 }
 throw Error('INVALID_JSON_OUTPUT');
}

async function generateRichFileContent(fullPrompt,stepGoal,filePath,existingArtifacts,taskId){
 const ext=(String(filePath||'').split('.').pop()||'').toLowerCase();
 const isHtml=ext==='html'||ext==='htm';
 const isPy=ext==='py';
 const sysPrompt=isHtml
  ?'Tu es un generateur de code web expert. Retourne UNIQUEMENT le code HTML5 complet, autonome (<style> et <script> inclus, sans CDN externe, sans commentaire d introduction ni balise ```). Tout jeu ou appli demande doit etre reellement jouable, fluide et esthetique.'
  :isPy
   ?'Tu es un developpeur Python expert. Retourne UNIQUEMENT du code Python 3 complet, propre, fonctionnel et directement executable (encodage UTF-8, sans commentaire d introduction ni balise ```).'
   :'Tu es un assistant precis. Retourne UNIQUEMENT le contenu brut exact du fichier demande (sans introduction, sans commentaire ni balise ```).';
 const userMsg='Demande globale utilisateur : '+fullPrompt+'\n'+
  'Fichier exact a ecrire : '+filePath+'\n'+
  'Objectif de ce fichier : '+stepGoal+'\n'+
  (existingArtifacts?.length?('Autres fichiers de la tache :\n'+existingArtifacts.map(a=>'- '+a.path+': '+String(a.preview||'').slice(0,500)).join('\n')+'\n'):'')+
  'Ecris maintenant le contenu complet et directement utilisable du fichier.';
 const callProvider=async(prov)=>{
  if(typeof prov?.sendMessage==='function')return prov.sendMessage([{role:'user',content:userMsg}],sysPrompt);
  if(typeof prov?.chat==='function')return prov.chat([{role:'user',content:userMsg}],sysPrompt);
  return null;
 };
 const provName=w.S?.config?.aiProvider||'';
 if(w.EVAProviders?.createProvider&&w.S?.config&&!['qwen','eva'].includes(provName)){
  try{
   const provider=w.EVAProviders.createProvider(provName,w.S.config);
   const aiPromise=callProvider(provider);
   const tmoPromise=new Promise((_,rej)=>setTimeout(()=>rej(Error('RICH_CONTENT_TIMEOUT')),35000));
   const res=await Promise.race([aiPromise,tmoPromise]);
   if(res&&res.success&&res.content&&res.content.trim().length>3){
    return stripOuterCodeFences(res.content);
   }
  }catch(e){
   console.warn('[CWAgent] Fallback contenu apres echec provider ('+provName+'):',e?.message||e);
  }
 }
 if(w.eva?.system?.llmChat){
  try{
   const rl=await w.eva.system.llmChat([{role:'system',content:sysPrompt},{role:'user',content:userMsg}],{sessionId:taskId,maxTokens:3072,temperature:0.2,stopTriggers:[],timeoutMs:90000});
   const txt=stripOuterCodeFences(content(rl));
   if(txt&&txt.trim().length>2)return txt;
  }catch(e2){console.warn('[CWAgent] Fallback texte libre 3B echoue:',e2?.message||e2);}
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

  // ── Phase 1 : Planification structurée (1 à 8 étapes avec outil verrouillé) ──
  let plan=[];
  try{
   const sysPlan='Decompose la requete Windows en etapes ordonnees en choisissant l outil exact pour chaque etape.\n'+
    'Outils disponibles: folder_create (creer un dossier), file_create (creer tout fichier texte/code: .html, .py, .css, .txt, .md, .json, .csv — jamais .js/.bat/.ps1), web_browse (ouvrir un site web ou URL comme YouTube, Google, Gmail), app_launch (ouvrir une application Windows comme Edge, Chrome, Bloc-notes, Calculatrice, ou un fichier cree .html/.py/.txt/.pdf, ou un navigateur sur une URL), app_resolve (verifier une app locale), folder_organize (trier dossier), file_list, file_read, file_search, pdf_create, excel_create, screenshot_take, system_status, data_analyze, command_run.\n'+
    'Regles :\n'+
    '- Pour ouvrir un site web (YouTube, Google, Twitch, URL...), utilise web_browse (ou app_launch avec URL) directement sans app_resolve.\n'+
    '- Pour ouvrir une application Windows (Edge, Chrome, Discord, Spotify, Calculatrice, Bloc-notes...), utilise app_launch directement.\n'+
    '- Si un dossier ET un ou plusieurs fichiers (.html, .py, .txt, etc.) sont demandes : mets folder_create, puis UN step file_create distinct par fichier, puis app_launch si ouverture demandee.\n'+
    '- Utilise toujours file_create (JAMAIS document_create) pour les pages web HTML et les scripts Python.\n'+
    '- N invente pas d etapes inutiles.';
   const rp=await w.eva.system.llmChat(
    [{role:'system',content:sysPlan},{role:'user',content:prompt}],
    {sessionId:this._taskId,maxTokens:640,temperature:0,jsonSchema:planSchema(),stopTriggers:[],timeoutMs:60000}
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
   '- N ecrase JAMAIS un fichier deja cree a une etape precedente (alreadyUsedFilePaths).\n'+
   '- Extensions interdites pour file_create : .js, .bat, .cmd, .ps1, .vbs, .exe (mets le JS/CSS dans .html, ou utilise .py pour Python).\n'+
   '- Pour ouvrir un site web (YouTube, Google...), passe "https://www.youtube.com" ou "YouTube" dans url/target.\n'+
   '- Pour ouvrir un navigateur sur un site, utilise app_launch avec target="Edge" (ou "Chrome") et args="https://...".\n'+
   '- Si app_resolve retourne primaryMatch (url, AppID ou path), passe exactement cette valeur dans app_launch.';

  const buildCompletedSummary=()=>observations.slice(-8).map(o=>{
   const res=o.result?.result;
   const item={
    name:o.name,
    args:o.args?.path||o.args?.target||o.args?.url||o.args?.query||o.args?.filename||undefined,
    success:!!o.result?.success,
    resultPath:res?.path||res?.opened||res?.url||res?.primaryMatch?.url||res?.primaryMatch?.AppID||res?.primaryMatch?.path||undefined,
    error:o.result?.error||undefined
   };
   if(res?.items&&Array.isArray(res.items))item.items=res.items.slice(0,15).map(x=>x.path||x.name);
   if(typeof res?.content==='string')item.snippet=res.content.slice(0,600);
   if(typeof res?.stdout==='string'&&res.stdout.trim())item.stdout=res.stdout.slice(0,600);
   if(res?.cpu||res?.totalmem)item.system={cpu:res.cpu,freememMo:Math.round((res.freemem||0)/1048576),totalmemMo:Math.round((res.totalmem||0)/1048576)};
   return item;
  });

  // Helper d'execution d'un step verrouille ou libre
  const runTurnLoop=async(forcedStep,stepIdx,totalSteps,retryHint=null)=>{
   const useLocked=!!(forcedStep&&w.CWTools.specs[forcedStep.tool]);
   const isCompactContentTool=useLocked&&['file_create','pdf_create','document_create'].includes(forcedStep.tool);
   const currentSchema=useLocked?schemaForTool(forcedStep.tool,isCompactContentTool):w.CWTools.schema(observations.some(o=>o.result?.success));
   const messages=[
    {role:'system',content:sysStep+(retryHint?('\nCORRECTION OBLIGATOIRE : '+retryHint):'')},
    {role:'user',content:JSON.stringify({
      request:prompt,
      stepNumber:stepIdx+1,
      totalSteps,
      tool:forcedStep?.tool||null,
      stepGoal:forcedStep?.goal||prompt,
      alreadyUsedFilePaths:Array.from(createdPaths.keys()),
      completedSteps:buildCompletedSummary()
    })}
   ];

   const r=await w.eva.system.llmChat(messages,{sessionId:this._taskId,maxTokens:isCompactContentTool?256:1024,temperature:retryHint?0.25:0,jsonSchema:currentSchema,stopTriggers:[],timeoutMs:120000});
   if(this.stopped)throw Error('CANCELLED');
   const decision=safeParseDecision(content(r),forcedStep);
   if(!decision||!['tool','done','clarify','fail'].includes(decision.kind))throw Error('INVALID_DECISION');
   if(decision.kind!=='tool')return decision;

   decision.args=decision.args||{};
   if(decision.name==='file_create'){
    if(decision.args.content==null)decision.args.content='DRAFT';
    if(/\.(js|mjs|cjs|bat|cmd|ps1|vbs|exe)$/i.test(String(decision.args.path||''))){
     decision.args.path=String(decision.args.path).replace(/\.(js|mjs|cjs|bat|cmd|ps1|vbs|exe)$/i,'.html');
    }
   }else if(decision.name==='pdf_create'){
    if(decision.args.content==null)decision.args.content='DRAFT';
    if(decision.args.path&&!/\.pdf$/i.test(decision.args.path))decision.args.path+='.pdf';
   }else if(decision.name==='document_create'){
    if(decision.args.content==null)decision.args.content='DRAFT';
    if(decision.args.format==='html'){
     const destDir=decision.args.destination||'$env:USERPROFILE\\Desktop';
     const sep=destDir.includes('/')&&!destDir.includes('\\')?'/':'\\';
     const baseName=String(decision.args.filename||'index.html').replace(/[\\/]/g,'');
     decision.name='file_create';
     decision.args={path:destDir.replace(/[\\/]+$/,'')+sep+(baseName.endsWith('.html')||baseName.endsWith('.htm')?baseName:(baseName+'.html')),content:'DRAFT'};
    }
   }else if(decision.name==='excel_create'&&decision.args.path&&!/\.xlsx$/i.test(decision.args.path)){
    decision.args.path+='.xlsx';
   }

   decision.args=w.CWTools.validate(decision.name,decision.args);

   // Garde-fou collision de nom de fichier (ex: reecriture sur index.html au lieu de test.txt)
   if(decision.name==='file_create'&&!decision.args.append&&createdPaths.has(decision.args.path.toLowerCase())){
    const retryMsgs=[
     ...messages,
     {role:'assistant',content:JSON.stringify(decision)},
     {role:'user',content:'REFUS : le fichier "'+decision.args.path+'" existe deja. Donne un NOUVEAU chemin distinct correspondant a l objectif : '+(forcedStep?.goal||prompt)}
    ];
    const r2=await w.eva.system.llmChat(retryMsgs,{sessionId:this._taskId,maxTokens:256,temperature:0.2,jsonSchema:schemaForTool('file_create',true),stopTriggers:[],timeoutMs:60000});
    if(this.stopped)throw Error('CANCELLED');
    const dec2=safeParseDecision(content(r2),forcedStep);
    if(dec2?.kind==='tool'){
     const a2=Object.assign({content:decision.args.content||'DRAFT'},dec2.args||{});
     decision.args=w.CWTools.validate(decision.name,a2);
    }
   }

   // Enrichissement contenu via IA active si file_create / pdf_create / document_create
   if((decision.name==='file_create'&&decision.args.path)||(decision.name==='pdf_create'&&decision.args.path)||(decision.name==='document_create'&&decision.args.filename)){
    const targetPath=decision.args.path||((decision.args.destination||'$env:USERPROFILE\\Desktop')+'\\'+decision.args.filename);
    const rawC=String(decision.args.content||'').trim();
    const needsRich=rawC==='DRAFT'||!rawC||decision.name!=='file_create'||/\.(html?|css|md|txt|py|json|csv|xml|yaml|yml)$/i.test(targetPath)||
     /tetris|jeu|game|page|site|cheat|code|script|python|article|guide|rapport|document|texte|hello/i.test(prompt+' '+(forcedStep?.goal||''));
    if(needsRich){
     await output('Rédaction du contenu ('+(targetPath.split(/[\\/]/).pop()||'fichier')+')...','running');
     const rich=await generateRichFileContent(prompt,forcedStep?.goal||prompt,targetPath,createdPreviews,this._taskId);
     if(rich)decision.args.content=rich;
     else if(rawC==='DRAFT'||!rawC)decision.args.content=forcedStep?.goal||prompt;
    }
   }
   return decision;
  };

  if(plan.length){
   let lastStepErr=null;
   for(let i=0;i<plan.length;i++){
    if(this.stopped)throw Error('CANCELLED');
    const st=plan[i];
    const lbl=toolLabel(st.tool)+(st.goal?' — '+st.goal.slice(0,70):'');
    await output(`Étape ${i+1}/${plan.length} : ${lbl}`,'executing');
    let decision;
    try{
     decision=await runTurnLoop(st,i,plan.length,lastStepErr);
     lastStepErr=null;
    }catch(e){
     if(this.stopped||/CANCELLED|TIMEOUT|MODEL|LLM_BUSY/.test(e.message))throw e;
     if(++invalid>=2)throw Error('MODEL_INVALID_OUTPUT: '+e.message);
     lastStepErr=e.message;
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
   // Fallback boucle adaptative si aucun plan structure
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
    if(result.success&&decision.name==='file_create'&&result.result?.path){
     createdPaths.set(decision.args.path.toLowerCase(),result.result.path);
     createdPreviews.push({path:result.result.path,preview:decision.args.content});
    }
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

  const doneArtifacts=successful.map(o=>{
   const r=o.result?.result;
   if(o.name==='system_status'&&r){
    const freeGb=((r.freemem||0)/1073741824).toFixed(1),totGb=((r.totalmem||0)/1073741824).toFixed(1);
    return `${r.hostname||'PC'} (${r.cpu||'CPU'}, RAM libre ${freeGb}/${totGb} Go)`;
   }
   if(o.name==='data_analyze'&&r){
    return `Analyse (${r.count} valeurs : min ${r.min}, max ${r.max}, moyenne ${Number(r.mean).toFixed(2)})`;
   }
   if((o.name==='file_list'||o.name==='file_search')&&r?.items){
    const sample=r.items.slice(0,5).map(x=>x.name).join(', ');
    return `${r.items.length} élément(s)${sample?' : '+sample:''}`;
   }
   if(o.name==='file_read'&&r?.content!=null){
    return `Lu ${r.path} (${r.content.length} car.)`;
   }
   return r?.summary||r?.path||r?.opened;
  }).filter(Boolean);
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
