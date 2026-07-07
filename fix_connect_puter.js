const fs = require('fs');
let settings = fs.readFileSync('eva-pc/web/js/app/settings-panel.js', 'utf8');

settings = settings.replace(
  /function connectPuter\(\) \{[\s\S]*?var authPromise;/m,
  `function connectPuter() {
  if (window.eva) {
    window.eva.openExternal('https://eva.astraltechnologie.fr/puter-proxy.html?redirect=eva-desktop');
    toast("Une page s'est ouverte pour la connexion Puter", "info");
    return;
  }
  if (!window.puter) { toast('Puter non disponible','error'); return; }
  var authPromise;`
);

fs.writeFileSync('eva-pc/web/js/app/settings-panel.js', settings, 'utf8');
console.log("CONNECT PUTER FIXED");
