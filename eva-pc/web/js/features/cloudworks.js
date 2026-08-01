
/* EVA V4 — CLOUDWORKS.JS (PC AGENT EDITION) */
(function() {
'use strict';

async function loadCloudWorks() {
    // Récupération version dynamique
    fetch('https://api.github.com/repos/urnova/eva/releases/latest')
      .then(r => r.json())
      .then(d => {
        if(d.tag_name) {
          document.querySelectorAll('.cw-dl-btn-v2').forEach(b => {
            if(!b.innerHTML.includes(d.tag_name)) b.innerHTML += ' (' + d.tag_name + ')';
          });
        }
      }).catch(e=>console.log(e));

    // Nettoyage UI sur PC
    if (window.eva) {
      const dlSection = document.querySelector('.cw-dl-section');
      if (dlSection) dlSection.style.display = 'none';
      const activities = document.querySelector('.cw-activities');
      if (activities) activities.style.display = 'none';
    }

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
        'Il écoute les commandes distantes (Capture d\'écran, Scripts, etc.) envoyées depuis votre tableau de bord web ou vos autres appareils.' +
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
          '<button class="btn btn-secondary" style="font-size:0.8em;" onclick="testLocalScreenshot()">Capture d\'écran</button>' +
          '<button class="btn btn-secondary" style="font-size:0.8em;" onclick="testLocalLock()">Verrouiller le PC</button>' +
        '</div>' +
      '</div>' +
    '</div>'
;
    
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
