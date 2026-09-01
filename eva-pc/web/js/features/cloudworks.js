(function() {
'use strict';

async function loadCloudWorks() {
    // Nettoyage UI sur PC
    if (window.eva) {
      setTimeout(() => {
        const guide = document.querySelector('.cw-guide-v2');
        if (guide) guide.style.display = 'none';
        const activities = document.querySelector('.cw-activities');
        if (activities) activities.style.display = 'none';
      }, 50);
    }

  var list = document.getElementById('cwDeviceList');
  if (!list) return;

  var statsTotal = document.getElementById('cwStatTotal');
  var statsOnline = document.getElementById('cwStatOnline');
  var statsOffline = document.getElementById('cwStatOffline');
  
  if (statsTotal) statsTotal.parentElement.style.display = 'none';
  if (statsOnline) statsOnline.parentElement.style.display = 'none';
  if (statsOffline) statsOffline.parentElement.style.display = 'none';

  list.innerHTML = `
    <div style="padding:20px;">
      <div style="display:flex;align-items:center;gap:15px;margin-bottom:30px;">
        <div style="width:60px;height:60px;border-radius:16px;background:linear-gradient(135deg,rgba(123,139,245,0.2),rgba(0,212,255,0.1));display:flex;align-items:center;justify-content:center;border:1px solid rgba(123,139,245,0.3);font-size:2em;">⚡</div>
        <div>
          <div style="font-size:1.6em;font-weight:700;color:var(--text);letter-spacing:0.5px;">Cloudworks Local Agent</div>
          <div style="font-size:0.9em;color:var(--text-muted);">Ce PC écoute les commandes distantes et exécute les tâches locales.</div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:20px;margin-bottom:30px;">
        <!-- Card 1: Santé du Service -->
        <div style="background:var(--surface2);border:1px solid var(--border);border-radius:16px;padding:20px;">
          <div style="font-size:0.8em;color:var(--cyan);margin-bottom:15px;font-weight:600;text-transform:uppercase;letter-spacing:1px;display:flex;align-items:center;gap:8px;">
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
            Santé du Système
          </div>
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
             <div style="width:12px;height:12px;border-radius:50%;background:#4ade80;box-shadow:0 0 10px #4ade80;"></div>
             <span style="font-size:1em;font-weight:500;">Connexion Sécurisée</span>
          </div>
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
             <div style="width:12px;height:12px;border-radius:50%;background:#4ade80;box-shadow:0 0 10px #4ade80;"></div>
             <span style="font-size:1em;font-weight:500;">LLM Agentique : Prêt</span>
          </div>
          <div style="font-size:0.8em;color:var(--text-muted);margin-top:15px;padding-top:15px;border-top:1px solid var(--border);">
            Le service écoute activement en arrière-plan.
          </div>
        </div>

        <!-- Card 2: Ressources -->
        <div style="background:var(--surface2);border:1px solid var(--border);border-radius:16px;padding:20px;position:relative;overflow:hidden;">
          <div style="font-size:0.8em;color:#ffc107;margin-bottom:15px;font-weight:600;text-transform:uppercase;letter-spacing:1px;display:flex;align-items:center;gap:8px;">
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
            Allocation RAM
          </div>
          <div style="font-size:2em;font-weight:800;color:var(--text);margin-bottom:5px;" id="cwRamStat">Max 2.0 Go</div>
          <div style="font-size:0.85em;color:var(--text-muted);margin-bottom:15px;" id="cwRamSub">Calcul en cours...</div>
          <div style="width:100%;height:6px;background:rgba(255,255,255,0.05);border-radius:3px;overflow:hidden;">
            <div id="cwRamBar" style="width:0%;height:100%;background:linear-gradient(90deg, #ffc107, #ff9800);transition:width 1s ease;"></div>
          </div>
        </div>
        
        <!-- Card 3: Recommandation -->
        <div style="background:linear-gradient(145deg, rgba(74, 222, 128, 0.05), rgba(74, 222, 128, 0.1));border:1px solid rgba(74,222,128,0.2);border-radius:16px;padding:20px;">
           <div style="font-size:0.8em;color:#4ade80;margin-bottom:10px;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Recommandation</div>
           <div style="font-size:1.1em;font-weight:600;margin-bottom:10px;color:var(--text);" id="cwRecoTitle">Mode Optimal</div>
           <div style="font-size:0.85em;color:var(--text-muted);line-height:1.5;" id="cwRecoText">Votre système a suffisamment de mémoire libre pour faire tourner le LLM local confortablement (capé à 2Go).</div>
        </div>
      </div>

      <!-- Actions Rapides -->
      <div style="font-size:0.8em;color:var(--text-muted);margin-bottom:15px;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Actions Rapides Locales</div>
      <div style="display:flex;gap:12px;flex-wrap:wrap;">
        <button class="btn btn-secondary" style="border-radius:8px;padding:10px 16px;font-weight:500;display:flex;align-items:center;gap:8px;" onclick="cwTestLocalSysInfo()">
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
          Infos Système
        </button>
        <button class="btn btn-secondary" style="border-radius:8px;padding:10px 16px;font-weight:500;display:flex;align-items:center;gap:8px;" onclick="cwTestLocalScreenshot()">
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
          Capture d'écran
        </button>
        <button class="btn btn-secondary" style="border-radius:8px;padding:10px 16px;font-weight:500;display:flex;align-items:center;gap:8px;color:#f87171;" onclick="cwTestLocalLock()">
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          Verrouiller PC
        </button>
        <button class="btn btn-secondary" style="border-radius:8px;padding:10px 16px;font-weight:500;display:flex;align-items:center;gap:8px;color:#a78bfa;" onclick="cwRestartLLM()">
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
          Redémarrer LLM
        </button>
      </div>
    </div>`;
    
  var activityLog = document.getElementById('cwActivityLog');
  if (activityLog) {
    activityLog.innerHTML = '<div class="cw-log-empty">En attente de commandes...</div>';
  }

  // Update RAM Stats
  if (window.eva && window.eva.system) {
      window.eva.system.info().then(info => {
          if (info && info.mem) {
              const totalRam = Math.round(info.mem.total / 1e9);
              const freeRam = Math.round(info.mem.free / 1e9);
              const usedRam = totalRam - freeRam;
              
              const percentUsed = Math.min(100, Math.round((usedRam / totalRam) * 100));
              
              const cwRamSub = document.getElementById('cwRamSub');
              const cwRamBar = document.getElementById('cwRamBar');
              const cwRecoTitle = document.getElementById('cwRecoTitle');
              const cwRecoText = document.getElementById('cwRecoText');

              if(cwRamSub) cwRamSub.textContent = `${freeRam} Go libres sur ${totalRam} Go`;
              if(cwRamBar) {
                  cwRamBar.style.width = percentUsed + '%';
                  if(percentUsed > 80) cwRamBar.style.background = 'linear-gradient(90deg, #ef4444, #f87171)';
              }

              if(cwRecoTitle && cwRecoText) {
                  if(freeRam > 4) {
                      cwRecoTitle.textContent = "Mode Optimal";
                      cwRecoTitle.style.color = "#4ade80";
                      cwRecoText.textContent = "Votre système a suffisamment de mémoire libre pour faire tourner le LLM local confortablement (capé à 2Go).";
                  } else if (freeRam >= 2) {
                      cwRecoTitle.textContent = "Mode Éco Conseillé";
                      cwRecoTitle.style.color = "#fbbf24";
                      cwRecoText.textContent = "Mémoire disponible correcte, mais évitez de lancer de gros logiciels pendant l'utilisation du LLM.";
                  } else {
                      cwRecoTitle.textContent = "Ressources Critiques";
                      cwRecoTitle.style.color = "#f87171";
                      cwRecoText.textContent = "Peu de mémoire disponible. L'utilisation de modèles IA lourds pourrait ralentir votre PC.";
                  }
              }
          }
      }).catch(()=>{});
  }

  // Polling des vraies statistiques
  function pollStats() {
      if (!window.eva || !window.eva.system) return;
      window.eva.system.stats().then(res => {
          if (res && res.success) {
              const cpuEl = document.getElementById('cwRealCpu');
              const ramEl = document.getElementById('cwRealRam');
              const statusEl = document.getElementById('cwLlmStatus');
              const iconEl = document.getElementById('cwLlmIcon');

              if (cpuEl) cpuEl.textContent = (res.cpu || 0).toFixed(1) + '%';
              if (ramEl) {
                  const usedGB = (res.memUsed || 0) / (1024 ** 3);
                  const totalGB = (res.memTotal || 0) / (1024 ** 3);
                  ramEl.textContent = `${usedGB.toFixed(1)} Go / ${totalGB.toFixed(1)} Go`;
              }
              if (statusEl && iconEl) {
                  if (res.llmActive) {
                      statusEl.textContent = "LLM Agentique : Actif";
                      iconEl.style.background = "#4ade80";
                      iconEl.style.boxShadow = "0 0 10px #4ade80";
                  } else {
                      statusEl.textContent = "LLM Agentique : Inactif / En veille";
                      iconEl.style.background = "#fbbf24";
                      iconEl.style.boxShadow = "0 0 10px #fbbf24";
                  }
              }
          }
      }).catch(()=>{});
  }

  pollStats();
  setInterval(pollStats, 3000);
}

window.loadCloudWorks = loadCloudWorks;

// Actions Rapides (Correction des références manquantes)
window.cwTestLocalSysInfo = async function() {
    if(window.eva && window.eva.system) {
        toast("Récupération des infos système...");
        const res = await window.eva.system.info();
        if(res.success) alert(`OS: ${res.os.distro}\nCPU: ${res.cpu.brand}\nRAM Libre: ${Math.floor(res.mem.free / 1e9)} Go`);
    } else {
        toast("Non disponible en mode web", "error");
    }
};

window.cwTestLocalScreenshot = async function() {
    if(window.eva && window.eva.system) {
        toast("Capture en cours...");
        const res = await window.eva.system.screenshot();
        if(res.success) {
            let img = new Image();
            img.src = res.data;
            img.style.maxWidth = "100%";
            img.style.border = "1px solid var(--border)";
            img.style.borderRadius = "8px";
            img.style.marginTop = "10px";
            
            // On peut l'afficher dans le log d'activité pour le test
            var log = document.getElementById('cwActivityLog');
            if(log) {
                if(log.querySelector('.cw-log-empty')) log.innerHTML = '';
                log.prepend(img);
            }
        }
    } else {
        toast("Non disponible en mode web", "error");
    }
};

window.cwTestLocalLock = async function() {
    if(window.eva && window.eva.system) {
        toast("Verrouillage du PC...", "info");
        await window.eva.system.lock();
    } else {
        toast("Non disponible en mode web", "error");
    }
};

window.cwRestartLLM = async function() {
    if(window.eva && window.eva.system && window.eva.system.llmStop && window.eva.system.llmStart) {
        toast("Redémarrage du LLM en cours...", "info");
        try {
            await window.eva.system.llmStop();
            setTimeout(async () => {
                const res = await window.eva.system.llmStart();
                if (res && res.success) {
                    toast("LLM redémarré avec succès !", "success");
                } else {
                    toast("Erreur lors du démarrage du LLM", "error");
                }
            }, 1500);
        } catch(e) {
            toast("Erreur critique: " + String(e), "error");
        }
    } else {
        toast("Service LLM non disponible", "error");
    }
};

window.cwCmd = function(){};
window.cwRemoveDevice = function(){};
window.cwPromptIDE = function(){};
window.cwPromptScript = function(){};
window.cwShowScreenshot = function(){};
window.cwShowSysInfo = function(){};
window.cwShowScriptResult = function(){};

})();


