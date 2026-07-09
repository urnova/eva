const fs = require('fs');
const pcCloudWorks = `
/* EVA V4 — CLOUDWORKS.JS (PC AGENT EDITION) */
(function() {
'use strict';

async function loadCloudWorks() {
  var list = document.getElementById('cwDeviceList');
  if (!list) return;

  var statsTotal = document.getElementById('cwStatTotal');
  var statsOnline = document.getElementById('cwStatOnline');
  var statsOffline = document.getElementById('cwStatOffline');
  
  if (statsTotal) statsTotal.parentElement.style.display = 'none';
  if (statsOnline) statsOnline.parentElement.style.display = 'none';
  if (statsOffline) statsOffline.parentElement.style.display = 'none';

  list.innerHTML = 
    '<div style="text-align:center;padding:40px 20px;">' +
      '<div style="font-size:3em;margin-bottom:20px;">⚡</div>' +
      '<div style="font-size:1.5em;font-weight:bold;color:var(--cyan);margin-bottom:10px;">Agent CloudWorks Actif</div>' +
      '<div style="font-size:0.9em;color:var(--text-muted);margin-bottom:30px;line-height:1.6;">' +
        'Ce PC est actuellement enregistré comme un Agent système.<br>' +
        'Il écoute les commandes distantes (Capture d\\'écran, Scripts, etc.) envoyées depuis votre tableau de bord web ou vos autres appareils.' +
      '</div>' +
      '<div style="background:rgba(123,139,245,0.05);border:1px solid rgba(123,139,245,0.2);padding:15px;border-radius:12px;display:inline-block;text-align:left;">' +
        '<div style="font-size:0.8em;color:var(--cyan);margin-bottom:5px;font-family:Orbitron,monospace;">ÉTAT DU SERVICE</div>' +
        '<div style="display:flex;align-items:center;gap:10px;font-size:0.9em;">' +
          '<span class="cw-log-dot cw-log-done"></span>' +
          '<span style="color:#e4e4ef;">Connexion sécurisée établie</span>' +
        '</div>' +
        '<div style="display:flex;align-items:center;gap:10px;font-size:0.9em;margin-top:8px;">' +
          '<span class="cw-log-dot cw-log-done"></span>' +
          '<span style="color:#e4e4ef;">LLM Agentique Local : En veille</span>' +
        '</div>' +
      '</div>' +
    '</div>';
    
  var activityLog = document.getElementById('cwActivityLog');
  if (activityLog) {
    activityLog.innerHTML = '<div class="cw-log-empty">En attente de commandes...</div>';
  }
}

window.loadCloudWorks = loadCloudWorks;
window.cwCmd = function(){};
window.cwRemoveDevice = function(){};
window.cwPromptIDE = function(){};
window.cwPromptScript = function(){};
window.cwShowScreenshot = function(){};
window.cwShowSysInfo = function(){};
window.cwShowScriptResult = function(){};
})();
`;
fs.writeFileSync('eva-pc/web/js/features/cloudworks.js', pcCloudWorks, 'utf8');
console.log('PC Agent Dashboard replaced in eva-pc/web/js/features/cloudworks.js');
