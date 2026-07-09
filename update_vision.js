const fs = require('fs');
let js = fs.readFileSync('EVA_V4_fixed_v4/js/app/advanced.js', 'utf8');

js = js.replace(
`    var mem = _VS.vr.memory || {};
    var memBlock = '';
    var memFields = ['client','equipment','serial','issue','procedures','status'];
    var memEntries = memFields.filter(function(k){ return mem[k] && mem[k] !== ''; });
    if (memEntries.length > 0) {
      memBlock = '\\n\\nMÉMOIRE DE SESSION (informations déjà connues — NE PAS redemander) :\\n';
      memEntries.forEach(function(k) {
        var labels = { client:'Client', equipment:'Équipement', serial:'N° de série', issue:'Problème', procedures:'Procédures réalisées', status:'Statut' };
        memBlock += '- ' + (labels[k] || k) + ' : ' + mem[k] + '\\n';
      });
      memBlock += 'Utilise TOUJOURS ces infos sans les redemander à l\\'utilisateur.';
    }
    return 'Tu es E.V.A, IA d\\'Astral Technologie. Module Vision Réparation.\\n' +
      'Tu assistes ' + techName + ' (' + techRole + '), technicien IT. Réponses courtes, techniques, en français.\\n' +
      'Bullet points si pertinent. Pas d\\'explications basiques.\\n\\n' +
      'MÉMOIRE — RÈGLE ABSOLUE : À chaque réponse, tu DOIS terminer par ce tag caché (il ne s\\'affiche pas) :\\n' +
      '[MEM:{"client":"nom ou vide","equipment":"marque modele ou vide","serial":"N° ou vide","issue":"problème bref ou vide","procedures":"actions faites séparées par ; ou vide","status":"En cours|Résolu|Non résolu|vide"}]\\n' +
      'Remplis uniquement les champs connus. Cumule les procédures (n\\'efface pas les précédentes).' + memBlock + '\\n\\n' +`,
`    var mem = _VS.vr.memory || {};
    var memBlock = '';
    var memEntries = Object.keys(mem).filter(function(k){ return mem[k] && mem[k] !== ''; });
    if (memEntries.length > 0) {
      memBlock = '\\n\\nMINI CERVEAU TEMPORAIRE DE SESSION (Contexte cumulé) :\\n';
      memEntries.forEach(function(k) {
        var labels = { client:'Client', equipment:'Équipement', serial:'N° de série', issue:'Problème', procedures:'Procédures réalisées', status:'Statut', context:'Contexte & Historique Global' };
        memBlock += '- ' + (labels[k] || k) + ' : ' + mem[k] + '\\n';
      });
      memBlock += '\\nCette mémoire temporaire te permet de te rappeler de tout sans exception dans la conversation.';
    }
    return 'Tu es E.V.A, IA d\\'Astral Technologie. Module Vision Réparation.\\n' +
      'Tu assistes ' + techName + ' (' + techRole + '), technicien IT. Réponses courtes, techniques, en français.\\n' +
      'Bullet points si pertinent. Pas d\\'explications basiques.\\n\\n' +
      'MÉMOIRE — RÈGLE ABSOLUE : À chaque réponse, tu DOIS terminer par ce tag caché (il ne s\\'affiche pas) :\\n' +
      '[MEM:{"client":"nom","equipment":"modèle","serial":"N°","issue":"problème","procedures":"actions cumulées","status":"En cours|Résolu|vide","context":"Tout élément important de la conversation à mémoriser"}]\\n' +
      'Remplis uniquement les champs connus. Cumule les procédures et enrichis le champ "context" pour te rappeler de tout sans exception dans la conversation.' + memBlock + '\\n\\n' +`
);

js = js.replace(
`      var fields = ['client','equipment','serial','issue','procedures','status'];
      fields.forEach(function(k) {`,
`      var fields = ['client','equipment','serial','issue','procedures','status','context'];
      fields.forEach(function(k) {`
);

fs.writeFileSync('EVA_V4_fixed_v4/js/app/advanced.js', js, 'utf8');
// Mirror to PC version
fs.writeFileSync('eva-pc/web/js/app/advanced.js', js, 'utf8');
console.log('Vision memory updated to use temporary mini-brain');
