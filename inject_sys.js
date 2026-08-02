const fs = require('fs');
const filepath = 'eva-pc/web/js/app/core.js';
let content = fs.readFileSync(filepath, 'utf8');

const injection = `
window.getDynamicSysPrompt = async function() {
  let prompt = SYS;
  try {
    if (window.db && window.S && window.S.user) {
      let snap = await window.db.collection('cloudworks').doc(window.S.user.uid).collection('devices').where('online','==',true).get();
      let devices = [];
      snap.forEach(d => { devices.push(d.id + ' (OS: ' + d.data().os + ')'); });
      if (devices.length > 0) {
        prompt += "\n\n[CLOUDWORKS] Appareils actuellement en ligne : " + devices.join(', ') + ". Pour toute action système (agentic_task, shutdown, etc.), tu DOIS spécifier le deviceId exact dans le JSON. S'il y a plusieurs appareils ou s'il y a le moindre doute sur la cible de l'action, DEMANDE à l'utilisateur de préciser l'appareil AVANT de générer le bloc d'action.";
      }
    }
  } catch(e) {}
  return prompt;
};
`;

if (!content.includes('window.getDynamicSysPrompt')) {
    content = content + "\n" + injection;
    fs.writeFileSync(filepath, content);
    console.log("Dynamic prompt injected in PC core.js");
}
