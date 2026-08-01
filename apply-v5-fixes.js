const fs = require('fs');

// 1. Contexte d'Existence (Web vs PC)
const coreJsPath = 'EVA_V4_fixed_v4/js/app/core.js';
let coreJs = fs.readFileSync(coreJsPath, 'utf8');
const contextInjection = `\nif (typeof window !== 'undefined' && window.eva) {\n  SYS += "\\n\\n[CONTEXTE SYSTÈME] Tu es actuellement exécutée nativement sur l'application PC de l'utilisateur (EVA Desktop Agent). Tu disposes de tes capacités système (CloudWorks Agentic) pour chercher des fichiers ou agir localement. Ton but est d'accomplir ses requêtes en générant des commandes.";\n} else {\n  SYS += "\\n\\n[CONTEXTE SYSTÈME] Tu es actuellement sur l'interface Web (Navigateur). Tu n'as pas d'accès direct au PC local.";\n}\n`;

if (!coreJs.includes('[CONTEXTE SYSTÈME]')) {
    // on insère juste avant `var _EVA_VISION_BASE`
    coreJs = coreJs.replace('var _EVA_VISION_BASE', contextInjection + '\nvar _EVA_VISION_BASE');
    fs.writeFileSync(coreJsPath, coreJs);
    console.log('1. Contexte d\'existence ajouté à core.js');
}

// Replicate to eva-pc if necessary (often it's the same file or copied later)
try {
  let pcCore = fs.readFileSync('eva-pc/web/js/app/core.js', 'utf8');
  if (!pcCore.includes('[CONTEXTE SYSTÈME]')) {
    pcCore = pcCore.replace('var _EVA_VISION_BASE', contextInjection + '\nvar _EVA_VISION_BASE');
    fs.writeFileSync('eva-pc/web/js/app/core.js', pcCore);
    console.log('1b. Contexte ajouté à eva-pc core.js');
  }
} catch(e) {}

// 2. Le Cerveau Trop Bavard (Memory)
const memoryJsPath = 'EVA_V4_fixed_v4/js/app/memory.js';
let memoryJs = fs.readFileSync(memoryJsPath, 'utf8');
if (!memoryJs.includes('N\'enregistre QUE les informations durables et personnelles')) {
    memoryJs = memoryJs.replace('RÈGLES ABSOLUES :\\n\' +', 'RÈGLES ABSOLUES :\\n\' +\n        \'0. N\\\'enregistre QUE les informations durables et personnelles de l\\\'utilisateur central. Ignore totalement les scénarios hypothétiques, les questions générales, ou les recommandations (ex: config PC) à moins que l\\\'utilisateur dise explicitement "C\\\'est MON PC".\\n\' +');
    fs.writeFileSync(memoryJsPath, memoryJs);
    console.log('2. Mémoire rendue moins bavarde');
}
try {
  let pcMemory = fs.readFileSync('eva-pc/web/js/app/memory.js', 'utf8');
  if (!pcMemory.includes('N\'enregistre QUE les informations durables et personnelles')) {
    pcMemory = pcMemory.replace('RÈGLES ABSOLUES :\\n\' +', 'RÈGLES ABSOLUES :\\n\' +\n        \'0. N\\\'enregistre QUE les informations durables et personnelles de l\\\'utilisateur central. Ignore totalement les scénarios hypothétiques, les questions générales, ou les recommandations (ex: config PC) à moins que l\\\'utilisateur dise explicitement "C\\\'est MON PC".\\n\' +');
    fs.writeFileSync('eva-pc/web/js/app/memory.js', pcMemory);
  }
} catch(e){}

// 3. Versions Dynamiques GitHub & 4. Nettoyage de CloudWorks PC
const cloudworksJsPath = 'eva-pc/web/js/features/cloudworks.js';
let cloudworksJs = fs.readFileSync(cloudworksJsPath, 'utf8');
if (!cloudworksJs.includes('// Nettoyage UI sur PC')) {
    // Insérer dans loadCloudWorks
    const injectCW = `\n    // Nettoyage UI sur PC\n    if (window.eva) {\n      const dlSection = document.querySelector('.cw-dl-section');\n      if (dlSection) dlSection.style.display = 'none';\n      const activities = document.querySelector('.cw-activities');\n      if (activities) activities.style.display = 'none';\n    }\n`;
    cloudworksJs = cloudworksJs.replace('function loadCloudWorks() {', 'function loadCloudWorks() {' + injectCW);
    
    // Injecter le script GitHub
    const githubScript = `
    // Récupération version dynamique
    fetch('https://api.github.com/repos/urnova/eva/releases/latest')
      .then(r => r.json())
      .then(d => {
        if(d.tag_name) {
          document.querySelectorAll('.cw-dl-btn-v2').forEach(b => {
            if(!b.innerHTML.includes(d.tag_name)) b.innerHTML += ' (' + d.tag_name + ')';
          });
        }
      }).catch(e=>console.log(e));
`;
    cloudworksJs = cloudworksJs.replace('function loadCloudWorks() {', 'function loadCloudWorks() {' + githubScript);
    fs.writeFileSync(cloudworksJsPath, cloudworksJs);
    console.log('3 & 4. CloudWorks UI & GitHub version OK');
}

// Also for Web
const webCwJsPath = 'EVA_V4_fixed_v4/js/features/cloudworks.js';
let webCwJs = fs.readFileSync(webCwJsPath, 'utf8');
if (!webCwJs.includes('api.github.com')) {
    const githubScript = `
    // Récupération version dynamique
    fetch('https://api.github.com/repos/urnova/eva/releases/latest')
      .then(r => r.json())
      .then(d => {
        if(d.tag_name) {
          document.querySelectorAll('.cw-dl-btn-v2, .cw-btn').forEach(b => {
            if(b.innerHTML.includes('Télécharger') && !b.innerHTML.includes(d.tag_name)) {
              b.innerHTML = b.innerHTML.replace('Télécharger E.V.A Desktop (Dernière version)', 'Télécharger E.V.A Desktop (' + d.tag_name + ')');
              b.innerHTML = b.innerHTML.replace('Télécharger EVA Desktop Agent', 'Télécharger EVA Desktop Agent (' + d.tag_name + ')');
            }
          });
        }
      }).catch(e=>console.log(e));
`;
    webCwJs = webCwJs.replace('function loadCloudWorks() {', 'function loadCloudWorks() {' + githubScript);
    fs.writeFileSync(webCwJsPath, webCwJs);
}

// 5. LLM Agentique Local avec Boucle ReAct
const pcAgentJsPath = 'eva-pc/web/js/features/pc-agent.js';
let pcAgentJs = fs.readFileSync(pcAgentJsPath, 'utf8');
if (!pcAgentJs.includes('agentic_task')) {
    const agenticCode = `
      else if (data.type === 'agentic_task') {
        const prompt = data.payload?.prompt || 'Aucun prompt';
        status = 'running';
        await window.db.collection('cloudworks').doc(uid).collection('commands').doc(cmdId).update({ status: 'running', updatedAt: new Date(), step: 'Démarrage boucle autonome...' });
        
        resultData = await runAgenticLoop(prompt, cmdId, uid);
        status = 'done';
      }
`;
    pcAgentJs = pcAgentJs.replace('else if (data.type === \\\'sysinfo\\\')', agenticCode.replace(/\\\\'/g,"'") + "      else if (data.type === 'sysinfo')");
    
    const loopFunc = `
  async function runAgenticLoop(userPrompt, cmdId, uid) {
    let history = [
      { role: 'system', content: "Tu es l'Agent PC Autonome d'EVA (Modèle local). Ton rôle est d'accomplir des tâches sur le système Windows de l'utilisateur. Tu as accès à un exécuteur de commandes. Pour exécuter une commande PowerShell/Batch, renvoie EXACTEMENT ce bloc: [CMD] ta_commande_ici [/CMD]. Tu recevras ensuite le résultat. Raisonne étape par étape. Une fois la tâche entièrement finie, renvoie [REPORT] ton_rapport_final_ici [/REPORT]. Ne fais pas de longs discours, sois direct." },
      { role: 'user', content: userPrompt }
    ];
    let finalReport = 'Tâche terminée, mais aucun rapport généré.';
    
    for(let i=0; i<10; i++) {
      try {
        const r = await fetch('http://127.0.0.1:11434/api/chat', {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({
            model: 'qwen2.5:1.5b',
            messages: history,
            stream: false,
            keep_alive: -1
          })
        });
        if(!r.ok) throw new Error('Ollama non disponible');
        const data = await r.json();
        const text = data.message?.content || '';
        history.push({role: 'assistant', content: text});
        
        // Check for REPORT
        const reportMatch = text.match(/\\[REPORT\\]([\\s\\S]*?)\\[\\/REPORT\\]/i);
        if(reportMatch) {
          finalReport = reportMatch[1].trim();
          break;
        }
        
        // Check for CMD
        const cmdMatch = text.match(/\\[CMD\\]([\\s\\S]*?)\\[\\/CMD\\]/i);
        if(cmdMatch) {
          const cmd = cmdMatch[1].trim();
          await window.db.collection('cloudworks').doc(uid).collection('commands').doc(cmdId).update({ step: 'Exécution: ' + cmd });
          
          let cmdResult = '';
          try {
            const res = await window.eva.system.exec(cmd);
            cmdResult = res.success ? (res.stdout || 'Succès') : (res.stderr || res.error);
          } catch(e) { cmdResult = 'Erreur: ' + e; }
          
          history.push({role: 'user', content: "Résultat de la commande:\\n" + cmdResult + "\\n\\nQue fais-tu ensuite ? (Utilise [CMD] ou [REPORT])"});
        } else {
          // No tag found
          history.push({role: 'user', content: "Je n'ai pas trouvé de balise [CMD] ou [REPORT]. Utilise obligatoirement l'une de ces balises."});
        }
      } catch(e) {
        return { error: e.message };
      }
    }
    return { output: finalReport };
  }
`;
    pcAgentJs += loopFunc;
    fs.writeFileSync(pcAgentJsPath, pcAgentJs);
    console.log('5. LLM Agentique Local ajouté');
}
