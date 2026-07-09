const fs = require('fs');
let html = fs.readFileSync('EVA_V4_fixed_v4/index.html', 'utf8');

html = html.replace(
  `<div style="font-size:0.8em;font-weight:700;color:var(--text);font-family:'Orbitron',monospace;letter-spacing:1px;">Télécharger .EXE</div>`,
  `<div style="font-size:0.8em;font-weight:700;color:var(--text);font-family:'Orbitron',monospace;letter-spacing:1px;">Télécharger E.V.A (Dernière Version)</div>`
);

fs.writeFileSync('EVA_V4_fixed_v4/index.html', html, 'utf8');
