const fs = require('fs');
const filepath = 'eva-pc/web/js/features/pc-agent.js';
let content = fs.readFileSync(filepath, 'utf8');

const injection = `
  // Afficher la version dans la barre de titre
  if (window.eva && window.eva.system && window.eva.version) {
    window.eva.version().then(v => {
      const tbSpan = document.querySelector('.electron-titlebar span');
      if (tbSpan) tbSpan.innerText = 'E.V.A DESKTOP v' + v;
    }).catch(e => console.error('Erreur version:', e));
  }
`;

if (!content.includes('E.V.A DESKTOP v')) {
    content = content.replace(/async function initAgentPC\(\) \{/, `async function initAgentPC() {\n${injection}`);
    fs.writeFileSync(filepath, content);
    console.log("Version injection added.");
}
