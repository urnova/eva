const fs = require('fs');
const path = 'f:/code/eva/evaprojectmultiplatforme/eva-pc/web/chat.html';
let html = fs.readFileSync(path, 'utf8');

// The CloudWorks UI has a block starting with <div id="cwUI" class="cw-overlay">
// Inside it, there is a stats section and a list of devices.
// And a section saying: "Installez E.V.A Desktop sur votre PC pour commencer"

const cwNewContent = `
<!-- CloudWorks local status for PC -->
<div class="cw-panel" style="text-align:center; padding: 40px 20px;">
  <div style="font-size: 3em; margin-bottom: 20px;">☁️</div>
  <h2 style="color:var(--text); font-family:'Orbitron',monospace; letter-spacing:1px; margin-bottom:10px;">CloudWorks PC Node</h2>
  <div style="color:var(--text-muted); font-size: 0.9em; max-width: 400px; margin: 0 auto 30px auto; line-height:1.5;">
    Ce PC est actuellement connecté à votre réseau CloudWorks en tant qu'agent autonome. Vous pouvez lui envoyer des commandes depuis n'importe quel autre appareil E.V.A connecté à votre compte.
  </div>
  
  <div style="background: rgba(0,212,255,0.05); border: 1px solid rgba(0,212,255,0.2); border-radius: 12px; padding: 20px; display: inline-block; text-align: left;">
    <div style="display:flex; align-items:center; gap: 10px; margin-bottom: 10px;">
      <div style="width: 12px; height: 12px; border-radius: 50%; background: #4ade80; box-shadow: 0 0 10px #4ade80;"></div>
      <span style="color: var(--text); font-weight: bold; font-family: 'Space Mono', monospace;">STATUT : EN LIGNE (ACTIF)</span>
    </div>
    <div style="font-size: 0.8em; color: var(--text-muted); margin-bottom: 5px;">Modèle LLM local : Prêt</div>
    <div style="font-size: 0.8em; color: var(--text-muted);">Exécution des scripts : Autorisée</div>
  </div>
</div>
`;

// Find the <div id="cwUI"...>
const cwStart = html.indexOf('<div class="cw-header">');
const cwEnd = html.indexOf('</div>\n    </div>\n  </div>', cwStart); 
// Wait, replacing everything inside <div class="cw-content"> is better.
const contentStart = html.indexOf('<div class="cw-content">');
const contentEnd = html.indexOf('</div>\n    </div>\n  </div>', contentStart);

if (contentStart !== -1 && contentEnd !== -1) {
    const before = html.substring(0, contentStart + '<div class="cw-content">'.length);
    // actually, let's keep the header
    const afterRegexStr = '</div>\n    </div>\n  </div>';
    
    // Using simple replace since I might mess up indices
    // Instead of completely removing the old one, let's just do:
    let newHTML = html.replace(/<div class="cw-content">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/, `<div class="cw-content">${cwNewContent}</div></div></div>`);
    fs.writeFileSync(path, newHTML, 'utf8');
    console.log('Replaced CW UI');
} else {
    console.log('Could not find cw-content');
}
