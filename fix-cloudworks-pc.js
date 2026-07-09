const fs = require('fs');
const file = 'eva-pc/web/js/features/cloudworks.js';
let content = fs.readFileSync(file, 'utf8');

// We want to add buttons for System Info, Screenshot, Lock to the PC CloudWorks UI
const newHtml = `
    '<div style="text-align:center;padding:40px 20px;">' +
      '<div style="font-size:3em;margin-bottom:20px;">⚡</div>' +
      '<div style="font-size:1.5em;font-weight:bold;color:var(--cyan);margin-bottom:10px;">Agent CloudWorks Actif</div>' +
      '<div style="font-size:0.9em;color:var(--text-muted);margin-bottom:30px;line-height:1.6;">' +
        'Ce PC est actuellement enregistré comme un Agent système.<br>' +
        'Il écoute les commandes distantes (Capture d\\'écran, Scripts, etc.) envoyées depuis votre tableau de bord web ou vos autres appareils.' +
      '</div>' +
      '<div style="background:rgba(123,139,245,0.05);border:1px solid rgba(123,139,245,0.2);padding:15px;border-radius:12px;display:inline-block;text-align:left;min-width:300px;">' +
        '<div style="font-size:0.8em;color:var(--cyan);margin-bottom:5px;font-family:Orbitron,monospace;">ÉTAT DU SERVICE</div>' +
        '<div style="display:flex;align-items:center;gap:10px;font-size:0.9em;">' +
          '<span class="cw-log-dot cw-log-done"></span>' +
          '<span style="color:#e4e4ef;">Connexion sécurisée établie</span>' +
        '</div>' +
        '<div style="display:flex;align-items:center;gap:10px;font-size:0.9em;margin-top:8px;">' +
          '<span class="cw-log-dot cw-log-done"></span>' +
          '<span style="color:#e4e4ef;">LLM Agentique Local : Prêt</span>' +
        '</div>' +
        '<hr style="border:0;border-top:1px solid rgba(255,255,255,0.1);margin:15px 0;">' +
        '<div style="font-size:0.8em;color:var(--text-muted);margin-bottom:10px;">TESTS RAPIDES (LOCAL)</div>' +
        '<div style="display:flex;gap:10px;flex-wrap:wrap;">' +
          '<button class="btn btn-secondary" style="font-size:0.8em;" onclick="testLocalSysInfo()">Infos Système</button>' +
          '<button class="btn btn-secondary" style="font-size:0.8em;" onclick="testLocalScreenshot()">Capture d\\'écran</button>' +
          '<button class="btn btn-secondary" style="font-size:0.8em;" onclick="testLocalLock()">Verrouiller le PC</button>' +
        '</div>' +
      '</div>' +
    '</div>'
`;

content = content.replace(/'<div style="text-align:center;padding:40px 20px;">' \+[\s\S]+?'<\/div>';/, newHtml + ';');

// Add test functions at the bottom
if (!content.includes('testLocalSysInfo')) {
  content += `
window.testLocalSysInfo = async function() {
  if (window.eva && window.eva.system) {
    const res = await window.eva.system.info();
    if (res.success) {
      alert("Système: " + res.os.distro + "\\nCPU: " + res.cpu.brand + "\\nRAM Total: " + Math.floor(res.mem.total / 1e9) + " GB");
    } else alert("Erreur: " + res.error);
  }
};
window.testLocalScreenshot = async function() {
  if (window.eva && window.eva.system) {
    const res = await window.eva.system.screenshot();
    if (res.success) {
      alert("Capture d'écran générée (" + res.data.substring(0,20) + "...). Poids: " + Math.floor(res.data.length/1024) + " KB");
    } else alert("Erreur: " + res.error);
  }
};
window.testLocalLock = async function() {
  if (window.eva && window.eva.system) {
    if (confirm("Voulez-vous vraiment verrouiller la session Windows ?")) {
      window.eva.system.lock();
    }
  }
};
`;
}

fs.writeFileSync(file, content, 'utf8');
console.log('PC CloudWorks UI updated with test buttons');
