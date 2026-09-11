/* EVA PC — CLOUDWORKS.JS — Version EXCLUSIVE Application Desktop */
/* Ce fichier est EXCLUSIF à l'application PC — ne PAS copier sur le site web */
(function() {
'use strict';

var _cwUnsub = null;
var _cwResultUnsub = null;
var _cwDevicesUnsub = null;
var _llmPollInterval = null;

function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

/* ══════════════════════════════════════════
   LOAD — initialise tout
══════════════════════════════════════════ */
async function loadCloudWorks() {
  if (!window.S || !window.S.user) return;
  var uid = S.user.uid;
  var container = document.getElementById('cwDeviceList');
  if (!container) return;

  try {
    // Injecter la structure PC complète
    _renderPCLayout(container, uid);
  } catch(e) { console.error('[CloudWorks] Erreur _renderPCLayout:', e); }

  try {
    // Initialiser le polling LLM
    _initLLMPanel();
  } catch(e) { console.error('[CloudWorks] Erreur _initLLMPanel:', e); }

  try {
    // Charger les devices (autres PC)
    _loadDevices(uid);
  } catch(e) { console.error('[CloudWorks] Erreur _loadDevices:', e); }

  try {
    // Charger l'activité récente
    _loadActivity(uid);
  } catch(e) { console.error('[CloudWorks] Erreur _loadActivity:', e); }
}

/* ══════════════════════════════════════════
   LAYOUT PC — injecte les sections principales
══════════════════════════════════════════ */
function _renderPCLayout(container, uid) {
  container.innerHTML = `
    <!-- SECTION 1 : LLM LOCAL -->
    <div class="cw-section cw-llm-section">
      <div class="cw-section-header">
        <span class="cw-section-icon">🤖</span>
        <span class="cw-section-title">LLM Local</span>
        <div id="cwLLMBadge" class="cw-badge cw-badge-off">○ Arrêté</div>
      </div>
      <div class="cw-section-body">
        <div id="cwLLMInfo" class="cw-llm-info">
          <div class="cw-info-row"><span class="cw-info-label">Modèle</span><span id="cwLLMModel" class="cw-info-value">EVA V5 — 3B Q4_K_M</span></div>
          <div class="cw-info-row"><span class="cw-info-label">Engine</span><span class="cw-info-value">node-llama-cpp</span></div>
          <div class="cw-info-row"><span class="cw-info-label">Statut</span><span id="cwLLMStatus" class="cw-info-value">—</span></div>
        </div>
        <div class="cw-llm-actions">
          <button class="cw-btn cw-btn-warning" id="cwRestartLLMBtn" onclick="window._cwRestartLLM()">⟳ Redémarrage d'urgence</button>
          <button class="cw-btn cw-btn-primary" id="cwDownloadLLMBtn" style="display:none;" onclick="window._cwDownloadLLM()">⬇ Télécharger le modèle IA (2.0 Go)</button>
        </div>
        <div id="cwDownloadProgressWrap" style="display:none; margin-top:14px; padding:12px; background:rgba(0,212,255,0.05); border:1px solid rgba(0,212,255,0.2); border-radius:10px;">
          <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.75em; margin-bottom:6px;">
            <span id="cwDownloadStatusText" style="color:var(--text,#e4e4ef); font-weight:600;">Téléchargement du modèle IA...</span>
            <span id="cwDownloadPercent" style="color:var(--cyan,#00d4ff); font-weight:700;">0%</span>
          </div>
          <div style="background:rgba(255,255,255,0.08); border-radius:8px; height:8px; overflow:hidden;">
            <div id="cwDownloadBar" style="width:0%; height:100%; background:linear-gradient(90deg, var(--cyan,#00d4ff), #3b82f6); transition:width 0.3s ease;"></div>
          </div>
          <div style="display:flex; justify-content:space-between; font-size:0.68em; color:var(--text-muted,#88889a); margin-top:6px;">
            <span id="cwDownloadBytes">0 Mo / 2048 Mo</span>
            <span>Hugging Face (sécurisé)</span>
          </div>
        </div>
      </div>
    </div>

    <!-- SECTION 2 : COMMANDES RAPIDES -->
    <div class="cw-section">
      <div class="cw-section-header">
        <span class="cw-section-icon">⚡</span>
        <span class="cw-section-title">Commandes rapides — Ce PC</span>
      </div>
      <div class="cw-section-body">
        <div class="cw-quick-grid">
          <button class="cw-quick-btn" onclick="window._cwQuickCmd('screenshot')">
            <span class="cw-quick-icon">📸</span>
            <span>Capture d'écran</span>
          </button>
          <button class="cw-quick-btn" onclick="window._cwQuickCmd('sysinfo')">
            <span class="cw-quick-icon">💻</span>
            <span>Infos système</span>
          </button>
          <button class="cw-quick-btn" onclick="window._cwQuickCmd('open_explorer')">
            <span class="cw-quick-icon">📁</span>
            <span>Explorateur</span>
          </button>
        </div>
        <div class="cw-agentic-box">
          <div class="cw-agentic-label">Tâche IA libre (LLM local)</div>
          <textarea id="cwAgenticPrompt" class="cw-textarea" placeholder="Ex: Crée un fichier test.txt sur le Bureau et mets-y 'Bonjour'..." rows="3"></textarea>
          <button class="cw-btn cw-btn-primary cw-btn-full" onclick="window._cwRunAgenticTask()">🤖 Exécuter avec le LLM</button>
          <div id="cwAgenticStatus" class="cw-agentic-status" style="display:none"></div>
        </div>
      </div>
    </div>

    <!-- SECTION 3 : APPAREILS CONNECTÉS (collapsable) -->
    <div class="cw-section cw-collapsable" id="cwDevicesSection">
      <div class="cw-section-header cw-collapsable-header" onclick="window._cwToggleDevices()">
        <span class="cw-section-icon">🖥️</span>
        <span class="cw-section-title">Appareils connectés</span>
        <div class="cw-stat-badges">
          <span class="cw-stat-badge online"><span id="cwStatOnline">0</span> en ligne</span>
          <span class="cw-stat-badge offline"><span id="cwStatOffline">0</span> hors ligne</span>
        </div>
        <span id="cwDevicesChevron" class="cw-chevron">▼</span>
      </div>
      <div class="cw-section-body" id="cwDevicesBody" style="display:none">
        <div id="cwDeviceListInner"><div class="cw-empty"><div class="cw-spinner"></div>Chargement…</div></div>
      </div>
    </div>

    <!-- SECTION 4 : ACTIVITÉ RÉCENTE -->
    <div class="cw-section">
      <div class="cw-section-header">
        <span class="cw-section-icon">📋</span>
        <span class="cw-section-title">Activité récente</span>
      </div>
      <div class="cw-section-body">
        <div id="cwActivityList"><div class="cw-empty">Aucune commande récente</div></div>
      </div>
    </div>
  `;
}

/* ══════════════════════════════════════════
   LLM PANEL
══════════════════════════════════════════ */
async function _initLLMPanel() {
  _updateLLMBadge(null);

  if (window.eva && window.eva.onLLMStatusChanged) {
    window.eva.onLLMStatusChanged(function(status) {
      console.log('[CloudWorks] Événement LLM status:', status);
      _updateLLMBadge(status.running);
      if (status.running) {
        _addActivity('LLM local prêt et opérationnel', 'done');
      }
    });
  }

  await _checkLLMHealth();

  if (_llmPollInterval) clearInterval(_llmPollInterval);
  _llmPollInterval = setInterval(_checkLLMHealth, 10000);
}

var _isDownloadingLLM = false;

// Vérification directe de l'état du moteur LLM via IPC Electron (node-llama-cpp)
async function _checkLLMHealth() {
  if (_isDownloadingLLM) return;
  var downloadBtn = document.getElementById('cwDownloadLLMBtn');
  var restartBtn = document.getElementById('cwRestartLLMBtn');
  var agenticBtn = document.querySelector('.cw-agentic-box button');

  // 1. Vérifier si le fichier modèle est présent sur le disque
  if (window.eva && window.eva.system && window.eva.system.llmCheck) {
    try {
      var chk = await window.eva.system.llmCheck();
      if (!chk || !chk.exists) {
        _updateLLMBadge('not-downloaded');
        if (downloadBtn) downloadBtn.style.display = 'inline-flex';
        if (restartBtn) restartBtn.style.display = 'none';
        if (agenticBtn) {
          agenticBtn.disabled = true;
          agenticBtn.title = 'Modèle local non téléchargé (rendez-vous en haut pour le télécharger)';
        }
        return;
      }
    } catch(e) {}
  }

  // Si le modèle est présent :
  if (downloadBtn) downloadBtn.style.display = 'none';
  if (restartBtn) restartBtn.style.display = 'inline-flex';
  if (agenticBtn) {
    agenticBtn.disabled = false;
    agenticBtn.title = '';
  }

  // 2. Vérifier si le moteur tourne actuellement
  if (window.eva && window.eva.system && window.eva.system.llmStatus) {
    try {
      var res = await window.eva.system.llmStatus();
      if (res && res.running) {
        _updateLLMBadge(true);
      } else {
        _updateLLMBadge(false);
      }
    } catch(e) {
      _updateLLMBadge(false);
    }
  } else {
    _updateLLMBadge(false);
  }
}

function _updateLLMBadge(state) {
  var badge = document.getElementById('cwLLMBadge');
  var statusEl = document.getElementById('cwLLMStatus');
  if (!badge) return;

  if (state === 'not-downloaded') {
    badge.textContent = '○ Non téléchargé';
    badge.className = 'cw-badge cw-badge-warning';
    if (statusEl) statusEl.textContent = 'Modèle local non installé (2.0 Go requis)';
  } else if (state === 'downloading') {
    badge.textContent = '⬇ Téléchargement...';
    badge.className = 'cw-badge cw-badge-starting';
    if (statusEl) statusEl.textContent = 'Téléchargement en cours depuis Hugging Face...';
  } else if (state === true) {
    badge.textContent = '● Actif';
    badge.className = 'cw-badge cw-badge-on';
    if (statusEl) statusEl.textContent = 'Moteur IA opérationnel (node-llama-cpp)';
  } else if (state === 'starting') {
    badge.textContent = '⟳ En chargement...';
    badge.className = 'cw-badge cw-badge-starting';
    if (statusEl) statusEl.textContent = 'Chargement du modèle en mémoire...';
  } else if (state === false) {
    badge.textContent = '○ Arrêté';
    badge.className = 'cw-badge cw-badge-off';
    if (statusEl) statusEl.textContent = 'Non démarré';
  } else {
    badge.textContent = '? Vérification...';
    badge.className = 'cw-badge cw-badge-unknown';
    if (statusEl) statusEl.textContent = 'Vérification en cours...';
  }
}

async function _updateLLMStatus() { await _checkLLMHealth(); }

window._cwDownloadLLM = async function() {
  if (_isDownloadingLLM) return;
  if (!window.eva || !window.eva.system || !window.eva.system.llmDownload) {
    if (typeof window.toast === 'function') window.toast('Téléchargement non supporté sur cette plateforme', 'error');
    return;
  }

  var downloadBtn = document.getElementById('cwDownloadLLMBtn');
  var progressWrap = document.getElementById('cwDownloadProgressWrap');
  var bar = document.getElementById('cwDownloadBar');
  var percentEl = document.getElementById('cwDownloadPercent');
  var bytesEl = document.getElementById('cwDownloadBytes');
  var statusText = document.getElementById('cwDownloadStatusText');

  _isDownloadingLLM = true;
  _updateLLMBadge('downloading');
  if (downloadBtn) { downloadBtn.disabled = true; downloadBtn.style.opacity = '0.5'; }
  if (progressWrap) progressWrap.style.display = 'block';

  // Écouter la progression en temps réel émise par Electron
  if (window.eva.onLLMDownloadProgress) {
    window.eva.onLLMDownloadProgress(function(data) {
      var pct = data.progress || 0;
      if (bar) bar.style.width = pct + '%';
      if (percentEl) percentEl.textContent = pct + '%';
      if (bytesEl && data.downloadedBytes) {
        var dlMB = (data.downloadedBytes / (1024 * 1024)).toFixed(1);
        var totalMB = (data.totalBytes / (1024 * 1024)).toFixed(1);
        bytesEl.textContent = dlMB + ' Mo / ' + totalMB + ' Mo';
      }
    });
  }

  try {
    _addActivity('Téléchargement du modèle IA local lancé...', 'pending');
    var res = await window.eva.system.llmDownload();
    if (res && res.success) {
      if (bar) bar.style.width = '100%';
      if (percentEl) percentEl.textContent = '100%';
      if (statusText) statusText.textContent = 'Téléchargement terminé ! Chargement en cours...';

      _addActivity('Modèle IA téléchargé avec succès (2 Go)', 'done');
      if (typeof window.toast === 'function') window.toast('Modèle IA téléchargé avec succès !', 'success');

      // Notifier l'agent local que le modèle est installé
      window.dispatchEvent(new CustomEvent('cw:model-installed'));

      // Attendre un court instant puis démarrer le LLM si CloudWorks est actif
      setTimeout(async function() {
        if (progressWrap) progressWrap.style.display = 'none';
        _isDownloadingLLM = false;
        await window._cwStartLLM();
        await _checkLLMHealth();
      }, 1500);
    } else {
      throw new Error(res && res.error ? res.error : 'Échec du téléchargement');
    }
  } catch(err) {
    console.error('[CloudWorks] Erreur download LLM:', err);
    _isDownloadingLLM = false;
    _updateLLMBadge('not-downloaded');
    if (downloadBtn) { downloadBtn.disabled = false; downloadBtn.style.opacity = '1'; }
    if (statusText) statusText.textContent = 'Erreur : ' + err.message;
    if (typeof window.toast === 'function') window.toast('Erreur lors du téléchargement : ' + err.message, 'error');
    _addActivity('Erreur téléchargement modèle : ' + err.message, 'error');
  }
};

window._cwStartLLM = async function() {
  var badge = document.getElementById('cwLLMBadge');
  if (badge) { badge.textContent = '⟳ Démarrage...'; badge.className = 'cw-badge cw-badge-starting'; }
  if (window.eva && window.eva.system && window.eva.system.llmStart) {
    try {
      var r = await window.eva.system.llmStart();
      _updateLLMStatus();
      _addActivity('LLM local démarré manuellement', r.success ? 'done' : 'error');
    } catch(e) { _addActivity('Erreur démarrage LLM: ' + e.message, 'error'); }
  }
};

window._cwStopLLM = async function() {
  if (window.eva && window.eva.system && window.eva.system.llmStop) {
    try {
      await window.eva.system.llmStop();
      _updateLLMStatus();
      _addActivity('LLM local arrêté manuellement', 'done');
    } catch(e) {}
  }
};

window._cwRestartLLM = async function() {
  await window._cwStopLLM();
  setTimeout(window._cwStartLLM, 1500);
};

/* ══════════════════════════════════════════
   COMMANDES RAPIDES & TASKEUR IA
══════════════════════════════════════════ */
window._cwQuickCmd = async function(type) {
  if (!window.pcAgent || !window.S || !window.S.user) return;
  var statusEl = document.getElementById('cwAgenticStatus');
  if (statusEl) { statusEl.style.display = 'block'; statusEl.textContent = '⟳ ' + type + ' en cours...'; statusEl.className = 'cw-agentic-status running'; }

  try {
    var cmdId = await window.pcAgent.sendCommand(type, {}, window.S.user.uid);
    if (type === 'open_explorer') {
      if (window.eva && window.eva.system) {
        await window.eva.system.exec('explorer.exe');
        if (statusEl) { statusEl.textContent = '✓ Explorateur ouvert'; statusEl.className = 'cw-agentic-status done'; }
      }
      return;
    }

    var tries = 0;
    var pollRes = setInterval(async function() {
      tries++;
      if (tries > 30) { clearInterval(pollRes); return; }
      var doc = await window.db.collection('cloudworks').doc(window.S.user.uid).collection('commands').doc(cmdId).get();
      var d = doc.data();
      if (d && (d.status === 'done' || d.status === 'error')) {
        clearInterval(pollRes);
        if (statusEl) {
          statusEl.textContent = d.status === 'done' ? '✓ Commande terminée' : '✗ Erreur: ' + (d.result?.error || '');
          statusEl.className = 'cw-agentic-status ' + d.status;
        }
        _updateLLMStatus();
      }
    }, 1000);
  } catch(e) {
    if (statusEl) { statusEl.textContent = '✗ Erreur: ' + e.message; statusEl.className = 'cw-agentic-status error'; }
  }
};

window._cwRunAgenticTask = async function() {
  var promptEl = document.getElementById('cwAgenticPrompt');
  var statusEl = document.getElementById('cwAgenticStatus');
  if (!promptEl || !window.S || !window.S.user) return;
  var prompt = promptEl.value.trim();
  if (!prompt) return;

  if (!window.CWAgent || !window.CWTools) {
    if (window.toast) window.toast('Module CWAgent non chargé. Rechargez l\'application.', 'error');
    return;
  }

  statusEl.style.display = 'block';
  statusEl.className = 'cw-agentic-status running';
  statusEl.innerHTML =
    '<div class="cw-task-header">Envoi au LLM local...</div>' +
    '<div class="cw-task-steps" id="cwTaskSteps"></div>' +
    '<button class="cw-btn cw-btn-danger cw-btn-sm" style="margin-top:8px;" onclick="window._cwStopAgent()">Arrêter</button>';

  var stepsEl = document.getElementById('cwTaskSteps');

  var approvalMode = true;
  var autonomousMode = false;
  try {
    var settingsDoc = await window.db.collection('users').doc(window.S.user.uid).get();
    var settingsData = settingsDoc.data();
    if (settingsData && settingsData.cloudworks) {
      if (settingsData.cloudworks.approvalMode !== undefined) approvalMode = settingsData.cloudworks.approvalMode;
      if (settingsData.cloudworks.autonomousMode !== undefined) autonomousMode = settingsData.cloudworks.autonomousMode;
    }
  } catch(e) {}

  var agent = new window.CWAgent(window.S.user.uid, {
    approvalMode: approvalMode,
    autonomousMode: autonomousMode
  });
  window._activeAgent = agent;

  var header = statusEl.querySelector('.cw-task-header');

  var result = await agent.run(prompt, stepsEl, function(text, cls) {
    if (header) header.textContent = text;
  });

  if (result.success) {
    if (header) header.textContent = 'Tâche terminée';
    statusEl.className = 'cw-agentic-status done';
    promptEl.value = '';
    _addActivity('Tâche IA: ' + prompt.substring(0, 50), 'done');
  } else {
    if (header) header.textContent = 'Erreur: ' + (result.error || 'Inconnue');
    statusEl.className = 'cw-agentic-status error';
    _addActivity('Tâche IA erreur: ' + prompt.substring(0, 30), 'error');
  }

  window._activeAgent = null;
};

window._cwStopAgent = function() {
  if (window._activeAgent) window._activeAgent.stop();
  if (window.CWAgentStop) window.CWAgentStop();
};

window._cwToggleDevices = function() {
  var body = document.getElementById('cwDevicesBody');
  var chevron = document.getElementById('cwDevicesChevron');
  if (!body) return;
  var open = body.style.display !== 'none';
  body.style.display = open ? 'none' : 'block';
  if (chevron) chevron.textContent = open ? '▼' : '▲';
};

/* ══════════════════════════════════════════
   APPAREILS CONNECTÉS
══════════════════════════════════════════ */
function _loadDevices(uid) {
  if (!window.db) return;
  if (_cwDevicesUnsub) { _cwDevicesUnsub(); _cwDevicesUnsub = null; }
  var container = document.getElementById('cwDeviceListInner');

  try {
    _cwDevicesUnsub = window.db.collection('cloudworks').doc(uid).collection('devices')
      .onSnapshot(function(snap) {
        var total = snap.size;
        var online = 0;
        var offline = 0;
        var html = '';

        if (snap.empty) {
          if (container) container.innerHTML = '<div class="cw-empty">Aucun autre appareil enregistré</div>';
          _setStats(0, 0, 0);
          return;
        }

        snap.forEach(function(doc) {
          var d = doc.data();
          var isOnline = !!d.online;
          if (isOnline) online++; else offline++;

          var deviceName = d.deviceName || d.name || doc.id;
          var os = d.os || d.deviceType || 'Windows';
          var lastSeen = d.updatedAt ? (d.updatedAt.toDate ? d.updatedAt.toDate().toLocaleString('fr-FR') : new Date(d.updatedAt).toLocaleString('fr-FR')) : 'Inconnu';
          var statusCls = isOnline ? 'online' : 'offline';
          var statusDot = isOnline ? '● En ligne' : '○ Hors ligne';

          html += `
            <div class="cw-device-card ${statusCls}">
              <span class="cw-device-icon">💻</span>
              <div style="flex:1;">
                <div class="cw-device-name">${esc(deviceName)}</div>
                <div class="cw-device-meta">OS: ${esc(os)} · <span class="cw-device-status-${statusCls}">${statusDot}</span></div>
                <div class="cw-device-seen">Dernière activité: ${esc(lastSeen)}</div>
              </div>
            </div>
          `;
        });

        if (container) container.innerHTML = html;
        _setStats(total, online, offline);
      }, function(err) {
        console.warn('[CloudWorks] Devices snapshot error:', err);
        if (container) container.innerHTML = '<div class="cw-empty">Impossible de charger les appareils</div>';
        _setStats(0, 0, 0);
      });
  } catch(e) {
    console.error('[CloudWorks] Erreur initialisation devices:', e);
  }
}

/* ══════════════════════════════════════════
   ACTIVITÉ
══════════════════════════════════════════ */
function _loadActivity(uid) {
  if (!window.db) return;
  if (_cwResultUnsub) { _cwResultUnsub(); _cwResultUnsub = null; }
  try {
    _cwResultUnsub = window.db.collection('cloudworks').doc(uid).collection('commands')
      .orderBy('updatedAt', 'desc')
      .limit(10)
      .onSnapshot(function(snap) { _renderActivity(snap); }, function(err) {
        console.warn('[CloudWorks] Activity snapshot error:', err);
      });
  } catch(e) {
    console.error('[CloudWorks] Erreur initialisation activité:', e);
  }
}

function _renderActivity(snap) {
  var el = document.getElementById('cwActivityList');
  if (!el) return;
  if (snap.empty) { el.innerHTML = '<div class="cw-empty">Aucune commande récente</div>'; return; }
  var html = '';
  snap.forEach(function(doc) {
    var d = doc.data();
    var ts = d.updatedAt && d.updatedAt.toDate ? d.updatedAt.toDate().toLocaleString('fr-FR') : '';
    var icon = d.status === 'done' ? '✓' : d.status === 'error' ? '✗' : d.status === 'running' ? '⟳' : '·';
    var cls = 'cw-activity-item ' + (d.status || '');
    var label = d.type || 'commande';
    if (d.payload && d.payload.prompt) label += ': ' + d.payload.prompt.substring(0, 40) + '…';
    html += `<div class="${cls}"><span class="cw-act-icon">${icon}</span><span class="cw-act-label">${esc(label)}</span><span class="cw-act-time">${ts}</span></div>`;
  });
  el.innerHTML = html;
}

function _addActivity(text, status) {
  var el = document.getElementById('cwActivityList');
  if (!el) return;
  var icon = status === 'done' ? '✓' : status === 'error' ? '✗' : '·';
  var entry = document.createElement('div');
  entry.className = 'cw-activity-item ' + (status || '');
  entry.innerHTML = `<span class="cw-act-icon">${icon}</span><span class="cw-act-label">${esc(text)}</span><span class="cw-act-time">${new Date().toLocaleString('fr-FR')}</span>`;
  el.prepend(entry);
  while (el.children.length > 10) el.removeChild(el.lastChild);
}

/* ══════════════════════════════════════════
   STATS
══════════════════════════════════════════ */
function _setStats(total, online, offline) {
  var oEl = document.getElementById('cwStatOnline');
  var fEl = document.getElementById('cwStatOffline');
  var tEl = document.getElementById('cwStatTotal');
  if (oEl) oEl.textContent = online !== null ? online : '0';
  if (fEl) fEl.textContent = offline !== null ? offline : '0';
  if (tEl) tEl.textContent = total !== null ? total : '0';
}

/* ══════════════════════════════════════════
   API GLOBALE
══════════════════════════════════════════ */
window.loadCloudWorks = loadCloudWorks;

/* ══════════════════════════════════════════
   STYLES INJECTÉS
══════════════════════════════════════════ */
(function injectStyles() {
  if (document.getElementById('cw-pc-styles')) return;
  var s = document.createElement('style');
  s.id = 'cw-pc-styles';
  s.textContent = `
    .cw-section { background:rgba(0,212,255,0.04); border:1px solid rgba(0,212,255,0.12); border-radius:14px; margin-bottom:14px; overflow:hidden; }
    .cw-section-header { display:flex; align-items:center; gap:10px; padding:14px 16px; background:rgba(0,212,255,0.06); }
    .cw-section-icon { font-size:1.1em; }
    .cw-section-title { font-size:0.82em; font-weight:700; color:var(--cyan,#00d4ff); letter-spacing:0.08em; flex:1; }
    .cw-section-body { padding:14px 16px; }
    .cw-badge { font-size:0.72em; padding:3px 10px; border-radius:20px; font-weight:700; }
    .cw-badge-on { background:rgba(0,255,136,0.15); color:#00ff88; border:1px solid rgba(0,255,136,0.3); }
    .cw-badge-off { background:rgba(136,136,154,0.15); color:#88889a; border:1px solid rgba(136,136,154,0.2); }
    .cw-badge-starting { background:rgba(255,200,0,0.15); color:#ffc800; border:1px solid rgba(255,200,0,0.3); }
    .cw-badge-warning { background:rgba(249,115,22,0.15); color:#f97316; border:1px solid rgba(249,115,22,0.3); }
    .cw-badge-unknown { background:rgba(255,100,100,0.15); color:#ff6464; border:1px solid rgba(255,100,100,0.3); }
    .cw-llm-info { margin-bottom:12px; }
    .cw-info-row { display:flex; justify-content:space-between; padding:5px 0; border-bottom:1px solid rgba(0,212,255,0.07); }
    .cw-info-label { font-size:0.72em; color:#88889a; }
    .cw-info-value { font-size:0.72em; color:#e4e4ef; font-family:monospace; }
    .cw-llm-actions { display:flex; gap:8px; flex-wrap:wrap; }
    .cw-btn { padding:7px 14px; border-radius:8px; border:none; cursor:pointer; font-size:0.75em; font-family:inherit; font-weight:600; transition:0.15s; }
    .cw-btn-primary { background:var(--cyan,#00d4ff); color:#000; }
    .cw-btn-primary:hover { opacity:0.85; }
    .cw-btn-warning { background:rgba(255,200,0,0.15); color:#ffc800; border:1px solid rgba(255,200,0,0.25); }
    .cw-btn-warning:hover { background:rgba(255,200,0,0.25); }
    .cw-btn-danger { background:rgba(255,77,109,0.15); color:#ff4d6d; border:1px solid rgba(255,77,109,0.25); }
    .cw-btn-full { width:100%; margin-top:8px; }
    .cw-quick-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-bottom:14px; }
    .cw-quick-btn { background:rgba(0,212,255,0.07); border:1px solid rgba(0,212,255,0.15); border-radius:10px; padding:12px 8px; display:flex; flex-direction:column; align-items:center; gap:6px; cursor:pointer; transition:0.15s; color:var(--text,#e4e4ef); font-size:0.72em; font-family:inherit; }
    .cw-quick-btn:hover { background:rgba(0,212,255,0.14); border-color:rgba(0,212,255,0.35); }
    .cw-quick-icon { font-size:1.4em; }
    .cw-agentic-box { margin-top:4px; }
    .cw-agentic-label { font-size:0.72em; color:#88889a; margin-bottom:6px; }
    .cw-textarea { width:100%; background:rgba(0,0,0,0.3); border:1px solid rgba(0,212,255,0.15); border-radius:8px; padding:10px; color:var(--text,#e4e4ef); font-size:0.78em; font-family:'Space Mono',monospace; resize:vertical; outline:none; }
    .cw-textarea:focus { border-color:rgba(0,212,255,0.4); }
    .cw-agentic-status { margin-top:8px; padding:8px 12px; border-radius:8px; font-size:0.75em; font-family:'Space Mono',monospace; }
    .cw-agentic-status.running { background:rgba(255,200,0,0.1); color:#ffc800; border:1px solid rgba(255,200,0,0.2); }
    .cw-agentic-status.done { background:rgba(0,255,136,0.1); color:#00ff88; border:1px solid rgba(0,255,136,0.2); }
    .cw-agentic-status.error { background:rgba(255,77,109,0.1); color:#ff4d6d; border:1px solid rgba(255,77,109,0.2); }
    .cw-collapsable-header { cursor:pointer; user-select:none; }
    .cw-collapsable-header:hover { background:rgba(0,212,255,0.1); }
    .cw-chevron { margin-left:auto; color:#88889a; font-size:0.8em; }
    .cw-stat-badges { display:flex; gap:6px; }
    .cw-stat-badge { font-size:0.68em; padding:2px 8px; border-radius:12px; }
    .cw-stat-badge.online { background:rgba(0,255,136,0.12); color:#00ff88; }
    .cw-stat-badge.offline { background:rgba(136,136,154,0.12); color:#88889a; }
    .cw-device-card { display:flex; align-items:center; gap:12px; padding:10px 12px; background:rgba(0,0,0,0.2); border-radius:10px; margin-bottom:8px; border:1px solid rgba(0,212,255,0.08); }
    .cw-device-card.offline { opacity:0.6; }
    .cw-device-icon { font-size:1.2em; }
    .cw-device-name { font-size:0.8em; font-weight:700; color:#e4e4ef; }
    .cw-device-meta { font-size:0.68em; color:#88889a; }
    .cw-device-status-online { color:#00ff88; font-weight:600; }
    .cw-device-status-offline { color:#88889a; }
    .cw-device-seen { font-size:0.65em; color:rgba(136,136,154,0.6); margin-top:2px; }
    .cw-activity-item { display:flex; align-items:center; gap:8px; padding:6px 0; border-bottom:1px solid rgba(0,212,255,0.06); font-size:0.72em; }
    .cw-act-icon { width:16px; text-align:center; }
    .cw-activity-item.done .cw-act-icon { color:#00ff88; }
    .cw-activity-item.error .cw-act-icon { color:#ff4d6d; }
    .cw-activity-item.running .cw-act-icon { color:#ffc800; }
    .cw-act-label { flex:1; color:#e4e4ef; }
    .cw-act-time { color:#88889a; font-size:0.9em; white-space:nowrap; }
    .cw-empty { padding:20px; text-align:center; color:#88889a; font-size:0.78em; }
    .cw-task-header { font-weight:700; margin-bottom:6px; }
    .cw-task-steps { max-height:180px; overflow-y:auto; border-top:1px solid rgba(0,212,255,0.1); margin-top:6px; padding-top:6px; }
    .cw-task-step { padding:3px 0; font-size:0.9em; border-bottom:1px solid rgba(255,255,255,0.04); }
    .cw-task-step.done { color:#00ff88; }
    .cw-task-step.error { color:#ff4d6d; }
    .cw-task-step.running { color:#ffc800; }
    .cw-task-step.pending { color:#88889a; }
    .cw-spinner { width:20px; height:20px; border:2px solid rgba(0,212,255,0.2); border-top-color:var(--cyan,#00d4ff); border-radius:50%; animation:cwSpin 0.8s linear infinite; margin:0 auto 8px; }
    @keyframes cwSpin { to { transform:rotate(360deg); } }
  `;
  document.head.appendChild(s);
})();

})();
