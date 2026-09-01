const fs = require('fs');

let js = fs.readFileSync('EVA_V4_fixed_v4/js/app/messages.js', 'utf8');

let target = `Pour toute génération de fichier : UNE phrase courte + le bloc ACTION. Rien d\\'autre après.\\n' +`;
let insert = `Pour toute génération de fichier : UNE phrase courte + le bloc ACTION. Rien d\\'autre après.\\n' +
        'QUESTIONS SUGGÉRÉES : À la fin de TA RÉPONSE, ajoute TOUJOURS [SUGGESTIONS: ["Q1?","Q2?","Q3?"]] (tableau JSON strict de 3 questions de suivi).\\n' +`;

if (js.includes(target) && !js.includes('QUESTIONS SUGGÉRÉES')) {
  js = js.replace(target, insert);
  fs.writeFileSync('EVA_V4_fixed_v4/js/app/messages.js', js, 'utf8');
}
