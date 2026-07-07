const fs = require('fs');
const file = 'eva-pc/web/js/features/cloudworks.js';

let js = fs.readFileSync(file, 'utf8');

const targetRender = `renderDevices() {
    this.listEl.innerHTML = '';
    if(this.devices.length===0){
      this.listEl.innerHTML = '<div style="color:var(--text-muted);text-align:center;padding:20px;">Aucun appareil trouvǸ.</div>';
      return;
    }`;

const replacementRender = `renderDevices() {
    this.listEl.innerHTML = '';

    // Si on est sur l'App PC (Agent), on affiche le Dashboard Local au lieu de la liste
    if (window.eva) {
      this.listEl.innerHTML = \`
        <div style="background:rgba(0,255,136,0.05);border:1px solid rgba(0,255,136,0.2);border-radius:12px;padding:24px;text-align:center;animation:fadeUp 0.3s ease;">
          <div style="font-size:3em;margin-bottom:12px;">🛡️</div>
          <h3 style="font-family:'Orbitron',monospace;color:var(--green);margin-bottom:8px;">Agent CloudWorks Actif</h3>
          <p style="color:var(--text-muted);font-size:0.9em;max-width:400px;margin:0 auto;">
            Cet ordinateur est actuellement configuré comme un Agent OS CloudWorks. Il écoute les requêtes entrantes.
          </p>
          <div style="margin-top:24px;display:flex;justify-content:center;gap:16px;">
            <div style="background:var(--surface2);padding:12px 24px;border-radius:8px;border:1px solid var(--border);">
              <div style="font-size:0.7em;color:var(--cyan);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Statut</div>
              <div style="font-weight:bold;color:var(--green);">En Ligne (Prêt)</div>
            </div>
          </div>
        </div>
      \`;
      return;
    }

    if(this.devices.length===0){
      this.listEl.innerHTML = '<div style="color:var(--text-muted);text-align:center;padding:20px;">Aucun appareil trouvé.</div>';
      return;
    }`;

if (!js.includes('Agent CloudWorks Actif')) {
  js = js.replace(targetRender, replacementRender);
  fs.writeFileSync(file, js, 'utf8');
  console.log("FIXED CW UI IN EVA-PC");
} else {
  console.log("CW UI ALREADY FIXED IN EVA-PC");
}
