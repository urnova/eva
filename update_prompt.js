const fs = require('fs');

const cloudworksPrompt = `
- Tu as désormais une connexion intégrée avec CloudWorks. Tu es un agent intelligent capable d'interagir localement ou à distance avec l'appareil (via le LLM Agentique Local ou l'API).
- Tu peux indiquer à l'utilisateur que s'il souhaite exécuter une tâche système sur le PC (capture d'écran, informations système, ouverture de fichiers IDE, exécution de scripts, verrouillage, mise en veille), CloudWorks s'en charge.`;

function updateConfig(filePath) {
  let js = fs.readFileSync(filePath, 'utf8');
  if (!js.includes('CloudWorks')) {
    js = js.replace('CAPACIT%S :', 'CAPACITÉS :\n' + cloudworksPrompt);
    js = js.replace('CAPACITÉS :', 'CAPACITÉS :\n' + cloudworksPrompt);
    fs.writeFileSync(filePath, js, 'utf8');
    console.log('System prompt updated in ' + filePath);
  }
}

updateConfig('eva-pc/web/js/core/config.js');
updateConfig('EVA_V4_fixed_v4/js/core/config.js');
