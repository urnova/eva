const fs = require('fs');

let content = fs.readFileSync('EVA_V4_fixed_v4/download.html', 'utf8');

const warningHtml = `
      <div style="background: rgba(255,170,0,0.1); border: 1px solid rgba(255,170,0,0.3); padding: 16px; border-radius: 8px; margin-top: 30px; margin-bottom: 20px;">
        <strong style="color: #ffaa00; font-family: 'Orbitron', monospace; letter-spacing: 1px;">⚠️ ALERTE WINDOWS SMARTSCREEN</strong>
        <p style="margin-top: 10px; font-size: 0.85em; color: var(--text-muted); line-height: 1.6; margin-bottom:0;">
          Lors de l'installation, Windows Defender SmartScreen affichera une fenêtre bleue indiquant que l'application a été bloquée. Ceci est normal car notre application n'est pas encore signée numériquement par un certificat d'entreprise (coûteux).
          <br><br>
          <strong>Pour procéder à l'installation :</strong><br>
          1. Cliquez sur le texte <b>"Informations complémentaires"</b> dans la fenêtre bleue.<br>
          2. Cliquez ensuite sur le bouton <b>"Exécuter quand même"</b> qui apparaît en bas.
        </p>
      </div>
`;

content = content.replace('</div>\n      <a href="https://github.com/urnova/eva/releases/latest/download/EVA-Assistant-Setup.exe"', warningHtml + '      </div>\n      <a href="https://github.com/urnova/eva/releases/latest/download/EVA-Assistant-Setup.exe"');

// Fix the fetch logic to construct the direct download url properly. Wait, it is already fetching latest tag.
// I will just make it so that the href defaults to github.com/urnova/eva/releases/latest if fetch fails, but direct download if it succeeds.
content = content.replace(
  "dlEl.closest('a').href = 'https://github.com/urnova/eva/releases/latest/download/E.V.A-Setup-' + vTag.replace('v', '') + '.exe';",
  "dlEl.closest('a').href = 'https://github.com/urnova/eva/releases/download/' + vTag + '/E.V.A-Setup-' + vTag.replace('v', '') + '.exe';"
);

fs.writeFileSync('EVA_V4_fixed_v4/download.html', content, 'utf8');
console.log('download.html patched');
