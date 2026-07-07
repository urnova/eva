const fs = require('fs');
let settings = fs.readFileSync('eva-pc/web/js/app/settings-panel.js', 'utf8');

const target = `function connectPuter() {
  if (window.eva) {
    window.eva.openExternal('https://eva.astraltechnologie.fr/puter-proxy.html?redirect=eva-desktop');
    toast("Une page s'est ouverte pour la connexion Puter", "info");
    return;
  }
  if (!window.puter) { toast('Puter non disponible','error'); return; }
  var authPromise;`;

const replacement = `function connectPuter() {
  if (!window.puter) { toast('Puter non disponible','error'); return; }
  var authPromise;`;

settings = settings.replace(target, replacement);

fs.writeFileSync('eva-pc/web/js/app/settings-panel.js', settings, 'utf8');
console.log("RESTORED NATIVE PUTER CONNECT");
