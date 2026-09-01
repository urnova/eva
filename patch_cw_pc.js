const fs = require('fs');

function fixCW() {
  const path = 'f:/code/eva/evaprojectmultiplatforme/eva-pc/web/chat.html';
  let html = fs.readFileSync(path, 'utf8');

  // Replace Home page CloudWorks block
  let hwStart = html.indexOf('<!-- Section: CloudWorks & Desktop -->');
  if (hwStart !== -1) {
    let hwEnd = html.indexOf('<!-- Section: Comment parler', hwStart);
    if (hwEnd !== -1) {
      let replacement = `
        <!-- Section: CloudWorks & Desktop -->
        <div>
          <div style="font-size:0.62em;letter-spacing:2px;text-transform:uppercase;color:var(--cyan);margin-bottom:10px;font-family:'Orbitron',monospace;">☁️ Cloud Works Node</div>
          <div style="background:rgba(0,212,255,0.05);border:1px solid rgba(0,212,255,0.2);border-radius:12px;padding:14px 16px;">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
              <div style="width:10px;height:10px;border-radius:50%;background:#4ade80;box-shadow:0 0 10px #4ade80;"></div>
              <div style="font-size:0.75em;color:var(--text);font-weight:600;">Agent Local Connecté</div>
            </div>
            <div style="font-size:0.68em;color:var(--text-muted);line-height:1.6;">Ce PC (E.V.A Desktop) est actif sur CloudWorks. Les commandes à distance envoyées depuis le site web seront exécutées ici.</div>
            <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;">
              <span style="font-size:0.62em;padding:3px 9px;border-radius:20px;background:rgba(74,222,128,0.1);border:1px solid rgba(74,222,128,0.25);color:#4ade80;">Prêt</span>
            </div>
          </div>
        </div>
      `;
      html = html.substring(0, hwStart) + replacement + html.substring(hwEnd);
    }
  }

  // Replace viewCloudworks
  let cwStart = html.indexOf('<div class="view" id="viewCloudworks">');
  if (cwStart !== -1) {
    let cwEnd = html.indexOf('<!-- ⚙️ VIEW: SETTINGS ⚙️ -->', cwStart);
    if (cwEnd !== -1) {
      let cwReplacement = `
      <!-- ☁️ VIEW: CLOUD WORKS ☁️ -->
      <div class="view" id="viewCloudworks">
        <div style="padding:40px; display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; text-align:center;">
          <div style="font-size: 4em; margin-bottom: 20px;">💻</div>
          <h1 style="color:var(--text); font-family:'Orbitron',monospace; font-size: 1.5em; margin-bottom: 15px; letter-spacing: 2px;">E.V.A DESKTOP NODE</h1>
          <div style="color:var(--text-muted); max-width: 500px; line-height: 1.6; margin-bottom: 30px; font-size: 0.9em;">
            Vous êtes sur l'application native d'E.V.A. Ce PC agit comme un <strong>Agent Local (Node)</strong> sur le réseau CloudWorks.<br><br>
            Vous pouvez désormais utiliser le site web d'E.V.A depuis votre téléphone ou un autre ordinateur pour surveiller et contrôler cette machine à distance.
          </div>
          <div style="background: rgba(0,212,255,0.05); border: 1px solid rgba(0,212,255,0.2); border-radius: 12px; padding: 20px; text-align: left; width: 100%; max-width: 400px;">
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom: 12px;">
              <span style="color:var(--text); font-size:0.85em; font-family:'Space Mono',monospace;">STATUT DU NOEUD</span>
              <div style="display:flex; align-items:center; gap:8px;">
                <span style="color:#4ade80; font-size:0.75em; font-weight:bold;">EN LIGNE</span>
                <div style="width:8px; height:8px; border-radius:50%; background:#4ade80; box-shadow:0 0 8px #4ade80; animation: blink 2s infinite;"></div>
              </div>
            </div>
            <div style="font-size:0.75em; color:var(--text-muted); margin-bottom:8px; display:flex; justify-content:space-between;">
              <span>Exécution système</span> <span style="color:var(--text);">Autorisée</span>
            </div>
            <div style="font-size:0.75em; color:var(--text-muted); margin-bottom:8px; display:flex; justify-content:space-between;">
              <span>Tâches Agentiques</span> <span style="color:var(--text);">Activées</span>
            </div>
            <div style="font-size:0.75em; color:var(--text-muted); display:flex; justify-content:space-between;">
              <span>Modèle LLM local</span> <span style="color:var(--text);">Prêt</span>
            </div>
          </div>
          <button onclick="document.getElementById('navHome').click()" class="btn btn-primary" style="margin-top: 30px; font-family:'Space Mono',monospace; letter-spacing:1px; text-transform:uppercase;">Retour au chat</button>
        </div>
      </div>
      `;
      html = html.substring(0, cwStart) + cwReplacement + html.substring(cwEnd);
    }
  }

  fs.writeFileSync(path, html, 'utf8');
  console.log('Fixed CW PC UI');
}

fixCW();
