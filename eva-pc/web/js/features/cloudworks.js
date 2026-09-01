/* EVA PC — CLOUDWORKS.JS — Version EXCLUSIVE Application Desktop */
/* Ce fichier est EXCLUSIF à l'application PC — ne PAS copier sur le site web */
(function() {
'use strict';

var _cwUnsub = null;
var _cwResultUnsub = null;
var _cwActivityLog = [];
var MAX_LOG = 20;
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

  // Injecter la structure PC complète
  _renderPCLayout(container, uid);

  // Initialiser le polling LLM
  _initLLMPanel();

  // Charger les devices (autres PC)
  _loadDevices(uid);

  // Charger l'activité récente
  _loadActivity(uid);
}

/* ══════════════════════════════════════════
   LAYOUT PC — injecte les 3 sections
══════════════════════════════════════════ */
function _renderPCLayout(container, uid) {
  container.innerHTML = `
    <!-- SECTION 1 : LLM LOCAL -->
    <div class="cw-section cw-llm-section">
      <div class="cw-section-header">
        <span class="cw-section-icon">🤖</span>
        <span class="cw-section-title">LLM Local</span>
        <div id="cwLLMBadge" class="cw-badge cw-badge-off">● Arrêté</div>
      </div>
      <div class="cw-section-body">
        <div id="cwLLMInfo" class="cw-llm-info">
          <div class="cw-info-row"><span class="cw-info-label">Modèle</span><span id="cwLLMModel" class="cw-info-value">eva-model.gguf</span></div>
          <div class="cw-info-row"><span class="cw-info-label">Port</span><span class="cw-info-value">11434</span></div>
          <div class="cw-info-row"><span class="cw-info-label">Statut</span><span id="cwLLMStatus" class="cw-info-value">—</span></div>
        </div>
        <div class="cw-llm-toggle-row">
          <label class="cw-toggle-label">Démarrer le LLM avec CloudWorks</label>
          <label class="cw-switch">
            <input type="checkbox" id="cwLLMAutoStart" onchange="window._cwToggleLLMAutostart(this.checked)">
            <span class="cw-switch-slider"></span>
          </label>
        </div>
        <div class="cw-llm-actions">
          <button class="cw-btn cw-btn-primary" onclick="window._cwStartLLM()">▶ Démarrer</button>
          <button class="cw-btn cw-btn-secondary" onclick="window._cwStopLLM()">■ Arrêter</button>
          <button class="cw-btn cw-btn-warning" onclick="window._cwRestartLLM()">⟳ Redémarrer</button>
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
          <span class="cw-stat-badge online"><span id="cwStatOnline">—</span> en ligne</span>
          <span class="cw-stat-badge offline"><span id="cwStatOffline">—</span> hors ligne</span>
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
  // Récupérer l'état autostart depuis electron-store
  if (window.eva && window.eva.store) {
    try {
      var autostart = await window.eva.store.get('cwLLMAutoStart');
      var el = document.getElementById('cwLLMAutoStart');
      if (el) el.checked = !!autostart;
    } catch(e) {}
  }
  // Poll statut LLM toutes les 5s
  _updateLLMStatus();
  if (_llmPollInterval) clearInterval(_llmPollInterval);
  _llmPollInterval = setInterval(_updateLLMStatus, 5000);
}

async function _updateLLMStatus() {
  var badge = document.getElementById('cwLLMBadge');
  var statusEl = document.getElementById('cwLLMStatus');
  if (!badge) return;

  if (window.eva && window.eva.system && window.eva.system.llmStatus) {
    try {
      var res = await window.eva.system.llmStatus();
      if (res && res.running) {
        badge.textContent = '● Actif';
        badge.className = 'cw-badge cw-badge-on';
        if (statusEl) statusEl.textContent = 'En cours d\'exécution (PID ' + (res.pid || '?') + ')';
      } else {
        badge.textContent = '○ Arrêté';
        badge.className = 'cw-badge cw-badge-off';
        if (statusEl) statusEl.textContent = 'Non démarré';
      }
    } catch(e) {
      badge.textContent = '? Inconnu';
      badge.className = 'cw-badge cw-badge-unknown';
    }
  }
}

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

window._cwToggleLLMAutostart = async function(enabled) {
  if (window.eva && window.eva.store) {
    await window.eva.store.set('cwLLMAutoStart', enabled);
  }
  // Si activé, démarrer le LLM maintenant
  if (enabled) window._cwStartLLM();
};

/* ══════════════════════════════════════════
   COMMANDES RAPIDES
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
    // Attendre le résultat (polling simple)
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
  if (!promptEl || !window.pcAgent || !window.S || !window.S.user) return;
  var prompt = promptEl.value.trim();
  if (!prompt) return;

  statusEl.style.display = 'block';
  statusEl.textContent = '⟳ Envoi au LLM local...';
  statusEl.className = 'cw-agentic-status running';

  try {
    var cmdId = await window.pcAgent.sendCommand('agentic_task', { prompt }, window.S.user.uid);
    statusEl.textContent = '⟳ LLM en cours de traitement...';

    // Écouter les étapes en temps réel
    var stepUnsub = window.db.collection('cloudworks').doc(window.S.user.uid)
      .collection('commands').doc(cmdId)
      .onSnapshot(function(doc) {
        var d = doc.data();
        if (!d) return;
        if (d.step) statusEl.textContent = '⟳ ' + d.step;
        if (d.status === 'done') {
          stepUnsub();
          statusEl.textContent = '✓ ' + (d.result?.output || 'Tâche terminée');
          statusEl.className = 'cw-agentic-status done';
          promptEl.value = '';
          _updateLLMStatus();
        } else if (d.status === 'error') {
          stepUnsub();
          statusEl.textContent = '✗ Erreur: ' + (d.result?.error || 'Inconnue');
          statusEl.className = 'cw-agentic-status error';
        }
      });
  } catch(e) {
    statusEl.textContent = '✗ Erreur: ' + e.message;
    statusEl.className = 'cw-agentic-status error';
  }
};

/* ══════════════════════════════════════════
   DEVICES
══════════════════════════════════════════ */
function _loadDevices(uid) {
  if (_cwUnsub) { _cwUnsub(); _cwUnsub = null; }
  try {
    _cwUnsub = window.db.collection('cloudworks').doc(uid).collection('devices')
      .onSnapshot(function(snap) { _renderDevices(snap); },
      function(err) {
        var el = document.getElementById('cwDeviceListInner');
        if (el) el.innerHTML = '<div class="cw-empty">Erreur de chargement</div>';
      });
  } catch(e) {}
}

function _renderDevices(snap) {
  var list = document.getElementById('cwDeviceListInner');
  var statOnline = document.getElementById('cwStatOnline');
  var statOffline = document.getElementById('cwStatOffline');
  if (!list) return;
  if (snap.empty) {
    list.innerHTML = '<div class="cw-empty">Aucun autre appareil enregistré</div>';
    if (statOnline) statOnline.textContent = '0';
    if (statOffline) statOffline.textContent = '0';
    return;
  }

  var onlineCount = 0, offlineCount = 0;
  var html = '';
  var myId = window._cwDeviceId || localStorage.getItem('cw_device_id');

  snap.forEach(function(doc) {
    var d = Object.assign({id: doc.id}, doc.data());
    if (d.deviceId === myId) return; // Ne pas afficher ce PC
    var online = d.online === true;
    if (online && d.lastSeen && d.lastSeen.toDate) {
      if (Date.now() - d.lastSeen.toDate().getTime() > 120000) online = false;
    }
    online ? onlineCount++ : offlineCount++;
    var seen = d.lastSeen && d.lastSeen.toDate ? d.lastSeen.toDate().toLocaleString('fr-FR') : 'Inconnu';
    html += `<div class="cw-device-card ${online ? 'online' : 'offline'}">
      <div class="cw-device-icon">${online ? '🟢' : '⚫'}</div>
      <div class="cw-device-info">
        <div class="cw-device-name">${esc(d.deviceName || d.deviceId)}</div>
        <div class="cw-device-meta">${esc(d.osVersion || 'Windows')} · ${online ? 'En ligne' : 'Hors ligne'}</div>
        <div class="cw-device-seen">Vu: ${seen}</div>
      </div>
    </div>`;
  });

  list.innerHTML = html || '<div class="cw-empty">Aucun autre appareil enregistré</div>';
  if (statOnline) statOnline.textContent = onlineCount;
  if (statOffline) statOffline.textContent = offlineCount;
}

window._cwToggleDevices = function() {
  var body = document.getElementById('cwDevicesBody');
  var chevron = document.getElementById('cwDevicesChevron');
  if (!body) return;
  var open = body.style.display !== 'none';
  body.style.display = open ? 'none' : 'block';
  if (chevron) chevron.textContent = open ? '▼' : '▲';
};

/* ══════════════════════════════════════════
   ACTIVITÉ
══════════════════════════════════════════ */
function _loadActivity(uid) {
  if (_cwResultUnsub) { _cwResultUnsub(); _cwResultUnsub = null; }
  try {
    _cwResultUnsub = window.db.collection('cloudworks').doc(uid).collection('commands')
      .orderBy('updatedAt', 'desc')
      .limit(MAX_LOG)
      .onSnapshot(function(snap) { _renderActivity(snap); });
  } catch(e) {}
}

function _renderActivity(snap) {
  var el = document.getElementById('cwActivityList');
  if (!el) return;
  if (snap.empty) { el.innerHTML = '<div class="cw-empty">Aucune activité récente</div>'; return; }
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
}

/* ══════════════════════════════════════════
   STATS (compatibilité avec le HTML existant)
══════════════════════════════════════════ */
function _setStats(total, online, offline) {
  var oEl = document.getElementById('cwStatOnline');
  var fEl = document.getElementById('cwStatOffline');
  if (oEl) oEl.textContent = online !== null ? online : '—';
  if (fEl) fEl.textContent = offline !== null ? offline : '—';
}

/* ══════════════════════════════════════════
   API GLOBALE — utilisée par messages.js et core.js
══════════════════════════════════════════ */
window.loadCloudWorks = loadCloudWorks;

/* ══════════════════════════════════════════
   STYLES INJECTÉS pour la page CloudWorks PC
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
    .cw-badge-unknown { background:rgba(255,100,100,0.15); color:#ff6464; border:1px solid rgba(255,100,100,0.3); }
    .cw-llm-info { margin-bottom:12px; }
    .cw-info-row { display:flex; justify-content:space-between; padding:5px 0; border-bottom:1px solid rgba(0,212,255,0.07); }
    .cw-info-label { font-size:0.72em; color:#88889a; }
    .cw-info-value { font-size:0.72em; color:#e4e4ef; font-family:monospace; }
    .cw-llm-toggle-row { display:flex; align-items:center; justify-content:space-between; margin:10px 0; padding:8px 0; border-bottom:1px solid rgba(0,212,255,0.07); }
    .cw-toggle-label { font-size:0.75em; color:#88889a; }
    .cw-switch { position:relative; width:36px; height:20px; display:inline-block; }
    .cw-switch input { display:none; }
    .cw-switch-slider { position:absolute; inset:0; background:#333; border-radius:20px; cursor:pointer; transition:0.2s; }
    .cw-switch input:checked + .cw-switch-slider { background:var(--cyan,#00d4ff); }
    .cw-switch-slider::before { content:''; position:absolute; width:14px; height:14px; background:#fff; border-radius:50%; left:3px; top:3px; transition:0.2s; }
    .cw-switch input:checked + .cw-switch-slider::before { transform:translateX(16px); }
    .cw-llm-actions { display:flex; gap:8px; flex-wrap:wrap; }
    .cw-btn { padding:7px 14px; border-radius:8px; border:none; cursor:pointer; font-size:0.75em; font-family:inherit; font-weight:600; transition:0.15s; }
    .cw-btn-primary { background:var(--cyan,#00d4ff); color:#000; }
    .cw-btn-primary:hover { opacity:0.85; }
    .cw-btn-secondary { background:rgba(136,136,154,0.15); color:#88889a; border:1px solid rgba(136,136,154,0.2); }
    .cw-btn-secondary:hover { background:rgba(136,136,154,0.25); }
    .cw-btn-warning { background:rgba(255,200,0,0.15); color:#ffc800; border:1px solid rgba(255,200,0,0.25); }
    .cw-btn-warning:hover { background:rgba(255,200,0,0.25); }
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
    .cw-device-seen { font-size:0.65em; color:rgba(136,136,154,0.6); margin-top:2px; }
    .cw-activity-item { display:flex; align-items:center; gap:8px; padding:6px 0; border-bottom:1px solid rgba(0,212,255,0.06); font-size:0.72em; }
    .cw-act-icon { width:16px; text-align:center; }
    .cw-activity-item.done .cw-act-icon { color:#00ff88; }
    .cw-activity-item.error .cw-act-icon { color:#ff4d6d; }
    .cw-activity-item.running .cw-act-icon { color:#ffc800; }
    .cw-act-label { flex:1; color:#e4e4ef; }
    .cw-act-time { color:#88889a; font-size:0.9em; white-space:nowrap; }
    .cw-empty { padding:20px; text-align:center; color:#88889a; font-size:0.78em; }
    .cw-spinner { width:20px; height:20px; border:2px solid rgba(0,212,255,0.2); border-top-color:var(--cyan,#00d4ff); border-radius:50%; animation:cwSpin 0.8s linear infinite; margin:0 auto 8px; }
    @keyframes cwSpin { to { transform:rotate(360deg); } }
  `;
  document.head.appendChild(s);
})();

})(); // fin IIFE
