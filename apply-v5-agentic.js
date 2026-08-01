const fs = require('fs');

const coreJsPath = 'EVA_V4_fixed_v4/js/app/core.js';
let coreJs = fs.readFileSync(coreJsPath, 'utf8');
const agenticInstruction = "  - Pour déléguer une tâche complexe au PC de l'utilisateur (chercher des fichiers, générer, trier) : [ACTION:{\"type\":\"agentic_task\",\"prompt\":\"Instructions complètes de la tâche...\"}]\n";

if (!coreJs.includes('agentic_task')) {
    coreJs = coreJs.replace('- Pour un événement agenda', agenticInstruction + '  - Pour un événement agenda');
    fs.writeFileSync(coreJsPath, coreJs);
}

try {
  let pcCore = fs.readFileSync('eva-pc/web/js/app/core.js', 'utf8');
  if (!pcCore.includes('agentic_task')) {
    pcCore = pcCore.replace('- Pour un événement agenda', agenticInstruction + '  - Pour un événement agenda');
    fs.writeFileSync('eva-pc/web/js/app/core.js', pcCore);
  }
} catch(e){}

const messagesJsPath = 'EVA_V4_fixed_v4/js/app/messages.js';
let msgJs = fs.readFileSync(messagesJsPath, 'utf8');
if (!msgJs.includes('agentic_task')) {
    msgJs = msgJs.replace('- Agenda', '- Tâche PC → [ACTION:{"type":"agentic_task","prompt":"..."}]\\n\' +\n      \'- Agenda');
    fs.writeFileSync(messagesJsPath, msgJs);
}

try {
  let pcMsg = fs.readFileSync('eva-pc/web/js/app/messages.js', 'utf8');
  if (!pcMsg.includes('agentic_task')) {
    pcMsg = pcMsg.replace('- Agenda', '- Tâche PC → [ACTION:{"type":"agentic_task","prompt":"..."}]\\n\' +\n      \'- Agenda');
    fs.writeFileSync('eva-pc/web/js/app/messages.js', pcMsg);
  }
} catch(e){}

const fileGenJsPath = 'EVA_V4_fixed_v4/js/app/file-gen.js';
let fileGen = fs.readFileSync(fileGenJsPath, 'utf8');
const agenticLogic = `
    } else if (action.type === 'agentic_task') {
      try {
        var snap = await window.db.collection('cloudworks').doc(uid).collection('devices').where('deviceType','==','windows').get();
        var onlineDevice = null;
        snap.forEach(function(d) { if (d.data().online) onlineDevice = d.id; });
        if (onlineDevice) {
          if(window.setEvaStatus) window.setEvaStatus('🚀 MISSION AGENTIQUE...', 'action');
          await window.db.collection('cloudworks').doc(uid).collection('commands').add({
            deviceId: onlineDevice,
            type: 'agentic_task',
            payload: { prompt: action.prompt || "Trouve un moyen de le faire." },
            status: 'pending',
            createdAt: typeof window.timestamp === 'function' ? window.timestamp() : new Date()
          });
          if (window.toast) window.toast('Agent Local : Tâche envoyée avec succès au PC !', 'success');
        } else {
          if (window.toast) window.toast('Action échouée : Le PC Agent est déconnecté.', 'error');
          console.warn('[CloudWorks] Impossible de déléguer la tâche, aucun appareil en ligne.');
        }
      } catch(e) { console.error('Erreur agentic_task:', e); }`;

if (!fileGen.includes("type === 'agentic_task'")) {
    fileGen = fileGen.replace("    } else if (action.type === 'note') {", agenticLogic + "\n    } else if (action.type === 'note') {");
    fs.writeFileSync(fileGenJsPath, fileGen);
}

try {
  let pcFileGen = fs.readFileSync('eva-pc/web/js/app/file-gen.js', 'utf8');
  if (!pcFileGen.includes("type === 'agentic_task'")) {
    pcFileGen = pcFileGen.replace("    } else if (action.type === 'note') {", agenticLogic + "\n    } else if (action.type === 'note') {");
    fs.writeFileSync('eva-pc/web/js/app/file-gen.js', pcFileGen);
  }
} catch(e){}

console.log('Done agentic task logic');
