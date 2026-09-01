const fs = require('fs');

function patchSysPrompt(filePath) {
  if (!fs.existsSync(filePath)) return;
  let js = fs.readFileSync(filePath, 'utf8');

  let target = `  - Tu avertis d'un risque`;
  let insert = `  QUESTIONS SUGGÉRÉES :
  À la TOUTE FIN de TOUTES tes réponses, tu DOIS obligatoirement proposer 3 questions de suivi pertinentes pour continuer la conversation. Format strict requis (un tableau JSON de 3 strings) :
  [SUGGESTIONS: ["Question 1 ?", "Question 2 ?", "Question 3 ?"]]
  
  - Tu avertis d'un risque`;

  if (js.includes(target) && !js.includes('QUESTIONS SUGGÉRÉES')) {
    js = js.replace(target, insert);
    fs.writeFileSync(filePath, js, 'utf8');
  }
}

patchSysPrompt('EVA_V4_fixed_v4/js/app/core.js');
patchSysPrompt('EVA_V4_fixed_v4/js/app/messages.js');
