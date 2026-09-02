/* EVA V4 — CLOUDWORKS.JS — Paths: cloudworks/{uid}/devices & cloudworks/{uid}/commands */
(function() {
'use strict';

var _cwUnsub = null;
var _cwResultUnsub = null;
var _cwActivityLog = [];
var MAX_LOG = 20;

function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;');}

/* ══════════════════════════════════════════
   LISTENER DE FOND — démarre dès l'auth
   Peuple S.cwDevices MÊME si le panneau CW n'est jamais ouvert
   (mobile, nav directe, etc.)
══════════════════════════════════════════ */
var _bgDeviceUnsub = null;

function _startBackgroundDeviceListener(uid) {
  if (_bgDeviceUnsub) return; // déjà actif
  if (!window.db) return;
  try {
    _bgDeviceUnsub = window.db.collection('cloudworks').doc(uid).collection('devices')
      .onSnapshot(function(snap) {
        var arr = [];
        snap.forEach(function(doc) {
          var d = Object.assign({ id: doc.id, deviceId: doc.id }, doc.data());
          var online = d.online === true;
          if (online && d.lastSeen && d.lastSeen.toDate) {
            if (Date.now() - d.lastSeen.toDate().getTime() > 120000) online = false;
          }
          arr.push(Object.assign({}, d, { online: online }));
        });
        if (window.S) window.S.cwDevices = arr;
        window._cwDevicesCache = arr;
        var nb = arr.filter(function(d) { return d.online; }).length;
        console.log('[CW] Listener fond: ' + arr.length + ' appareils, ' + nb + ' en ligne');
      }, function(err) {
        console.warn('[CW] Listener fond erreur:', err);
      });
  } catch(e) {
    console.warn('[CW] Impossible de démarrer le listener fond:', e);
  }
}

// Attend que window.S.user soit défini par auth.js (évite les races conditions Firebase)
// N'utilise PAS onAuthStateChanged directement — auth.js le gère déjà
function _hookAuthForDeviceListener() {
  var attempt = 0, maxAttempts = 120; // 60 secondes max
  var check = setInterval(function() {
    attempt++;
    if (attempt > maxAttempts) { clearInterval(check); return; }
    // window.S.user est défini par auth.js APRÈS que Firebase ait bien initialisé le token
    if (window.S && window.S.user && window.S.user.uid && window.db) {
      clearInterval(check);
      var uid = window.S.user.uid;
      // Délai 1s supplémentaire pour s\'assurer que le token est propagé à Firestore
      setTimeout(function() {
        _startBackgroundDeviceListener(uid);
        _startBackgroundResultsListener(uid);
      }, 1000);
    }
  }, 500);
}
_hookAuthForDeviceListener();

// Listener de fond pour les RÉSULTATS — s'active dès l'auth, même si panneau CW fermé
var _bgResultsUnsub = null;
function _startBackgroundResultsListener(uid) {
  if (_bgResultsUnsub) return;
  if (!window.db) return;
  try {
    _bgResultsUnsub = window.db.collection('cloudworks').doc(uid).collection('commands')
      .orderBy('updatedAt', 'desc').limit(20)
      .onSnapshot(function(snap) {
        _handleResultsSnap(snap);
      }, function(err) {
        console.warn('[CW] Listener résultats fond erreur:', err);
      });
  } catch(e) {}
}
// Déclencher ce listener en même temps que le listener d'appareils
var _origHook = _startBackgroundDeviceListener;
_startBackgroundDeviceListener = function(uid) {
  _origHook(uid);
  _startBackgroundResultsListener(uid);
};

/* ══════════════════════════════════════════
   LOAD — initialise listeners (panneau CW ouvert)
══════════════════════════════════════════ */
  async function loadCloudWorks() {
  if (!window.S || !window.S.user) return;
  var uid = S.user.uid;
  var list = document.getElementById('cwDeviceList');
  if (!list) return;
  list.innerHTML = '<div class="cw-empty"><div class="cw-spinner"></div>Chargement des appareils\u2026</div>';
  _setStats(null, null, null);
  if (_cwUnsub) { _cwUnsub(); _cwUnsub = null; }
  if (_cwResultUnsub) { _cwResultUnsub(); _cwResultUnsub = null; }
  try {
    _cwUnsub = window.db.collection('cloudworks').doc(uid).collection('devices')
      .onSnapshot(function(snap) { renderDevices(snap); },
      function(err) {
        list.innerHTML = '<div class="cw-empty"><div class="cw-empty-icon">\uD83D\uDCE1</div>Impossible de charger les appareils.<br><small style="opacity:0.6">Vérifiez votre connexion.</small></div>';
        _setStats(0, 0, 0);
      });
    _cwResultUnsub = window.db.collection('cloudworks').doc(uid).collection('commands')
      .orderBy('updatedAt','desc')
      .limit(MAX_LOG)
      .onSnapshot(function(snap) { _handleResultsSnap(snap); });
  } catch(e) {
    list.innerHTML = '<div class="cw-empty"><div class="cw-empty-icon">⚠️</div>Erreur Firebase.</div>';
    _setStats(0, 0, 0);
  }
}

/* ══════════════════════════════════════════
   STATS
══════════════════════════════════════════ */
function _setStats(total, online, offline) {
  var tEl = document.getElementById('cwStatTotal');
  var oEl = document.getElementById('cwStatOnline');
  var fEl = document.getElementById('cwStatOffline');
  if (tEl) tEl.textContent = total !== null ? total : '—';
  if (oEl) oEl.textContent = online !== null ? online : '—';
  if (fEl) fEl.textContent = offline !== null ? offline : '—';
}

/* ══════════════════════════════════════════
   RENDER DEVICES
══════════════════════════════════════════ */
function renderDevices(snap) {
  var list = document.getElementById('cwDeviceList');
  if (!list) return;
  if (snap.empty) {
    list.innerHTML = '<div class="cw-empty"><div class="cw-empty-icon">\uD83D\uDCBB</div><div class="cw-empty-title">AUCUN APPAREIL CONNECTÉ</div>Installez EVA Desktop sur votre PC pour qu\'il apparaisse ici automatiquement.</div>';
    _setStats(0, 0, 0);
    return;
  }

  var totalCount = 0, onlineCount = 0;
  list.innerHTML = '';
  var _cwDevArr = []; /* peuple S.cwDevices pour le system prompt EVA */

  snap.forEach(function(doc) {
    var d = Object.assign({id: doc.id}, doc.data());
    var online = d.online === true;
    if (online && d.lastSeen && d.lastSeen.toDate) {
      var diffMs = Date.now() - d.lastSeen.toDate().getTime();
      if (diffMs > 120000) {
        online = false;
        d.online = false;
      }
    }
    var seen = d.lastSeen && d.lastSeen.toDate ? d.lastSeen.toDate().toLocaleString('fr-FR') : 'Inconnu';
    var iconMap = {mac: '🍎', linux: '🐧', windows: '🖥️'};
    var icon = iconMap[d.deviceType] || '🖥️';
    var typeLabel = {mac: 'macOS', linux: 'Linux', windows: 'Windows'}[d.deviceType] || 'PC';
    var did = esc(d.id);
    var dname = esc(d.deviceName || d.deviceId);
    totalCount++;
    if (online) onlineCount++;
    _cwDevArr.push(Object.assign({}, d, { online: online }));

    var c = document.createElement('div');
    c.className = 'cw-card' + (online ? ' cw-card-online' : ' cw-card-offline');

    var actionsHtml = '<div class="cw-card-divider"></div><div class="cw-card-actions">';
    if (online) {
      actionsHtml +=
        /* Screenshot */
        '<button class="cw-action-btn" onclick="cwCmd(\'' + did + '\',\'screenshot\')" title="Capture d\'écran du bureau">' +
          '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="12" cy="12" r="3"/></svg>Capture' +
        '</button>' +
        /* Infos système */
        '<button class="cw-action-btn" onclick="cwCmd(\'' + did + '\',\'sysinfo\')" title="RAM, CPU, disque, réseau">' +
          '<svg viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>Infos Système' +
        '</button>' +
        /* Ouvrir dans IDE */
        '<button class="cw-action-btn" onclick="cwPromptIDE(\'' + did + '\')" title="Ouvrir un fichier dans l\'IDE">' +
          '<svg viewBox="0 0 24 24"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>IDE' +
        '</button>' +
        /* Exécuter script */
        '<button class="cw-action-btn" onclick="cwPromptScript(\'' + did + '\')" title="Exécuter un script ou une commande">' +
          '<svg viewBox="0 0 24 24"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>Exécuter' +
        '</button>' +
        /* Verrouiller */
        '<button class="cw-action-btn" onclick="cwCmd(\'' + did + '\',\'lock\')">' +
          '<svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>Verrouiller' +
        '</button>' +
        /* Veille */
        '<button class="cw-action-btn" onclick="cwCmd(\'' + did + '\',\'sleep\')">' +
          '<svg viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z"/></svg>Veille' +
        '</button>' +
        /* Éteindre */
        '<button class="cw-action-btn cw-danger" onclick="cwCmd(\'' + did + '\',\'shutdown\')">' +
          '<svg viewBox="0 0 24 24"><path d="M18.36 6.64A9 9 0 1 1 5.64 6.64"/><line x1="12" y1="2" x2="12" y2="12"/></svg>Éteindre' +
        '</button>';
    }
    actionsHtml +=
      '<button class="cw-action-btn cw-remove' + (online ? ' cw-remove-inline' : '') + '" onclick="cwRemoveDevice(\'' + did + '\',\'' + dname + '\')">' +
        '<svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>' +
        (online ? 'Retirer' : 'Retirer l\'appareil') +
      '</button>' +
    '</div>';

    var ipHtml = d.localIP ? '<div class="cw-card-ip">' + esc(d.localIP) + '</div>' : '';

    c.innerHTML =
      '<div class="cw-card-inner">' +
        '<div class="cw-card-top">' +
          '<div class="cw-card-left">' +
            '<div class="cw-card-iconwrap">' + icon + '</div>' +
            '<div class="cw-card-info">' +
              '<div class="cw-card-name">' + dname + '</div>' +
              '<div class="cw-card-sub">' + typeLabel + ' · ' + esc(d.deviceId || d.id) + '</div>' +
            '</div>' +
          '</div>' +
          '<div class="cw-card-right">' +
            '<span class="cw-badge ' + (online ? 'cw-badge-on' : 'cw-badge-off') + '">' +
              (online ? 'EN LIGNE' : 'HORS LIGNE') +
            '</span>' +
            ipHtml +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="cw-card-divider"></div>' +
      '<div class="cw-card-meta">' +
        '<span class="cw-meta-item"><span class="cw-meta-dot"></span>Vu le ' + seen + '</span>' +
        (d.osVersion ? '<span class="cw-meta-item"><span class="cw-meta-dot"></span>' + esc(d.osVersion) + '</span>' : '') +
      '</div>' +
      actionsHtml;

    list.appendChild(c);
  });

    /* Mettre à jour S.cwDevices pour le system prompt EVA */
  if (window.S) window.S.cwDevices = _cwDevArr;
  window._cwDevicesCache = _cwDevArr;
  _setStats(totalCount, onlineCount, totalCount - onlineCount);
}

/* ══════════════════════════════════════════
   SEND COMMAND
══════════════════════════════════════════ */
async function cwCmd(deviceId, type, payload) {
  if (!window.S || !window.S.user) return;
  var msgs = {shutdown: 'Éteindre ce PC ?', lock: 'Verrouiller ce PC ?', sleep: 'Mettre en veille ?'};
  if (msgs[type] && !confirm(msgs[type])) return;
  try {
    var ref = window.db.collection('cloudworks').doc(S.user.uid).collection('commands').doc();
    await ref.set({
      deviceId: deviceId,
      type: type,
      payload: payload || {},
      status: 'pending',
      createdAt: window.timestamp(),
      updatedAt: window.timestamp()
    });
    var labels = {
      screenshot: '📸 Capture demandée…',
      sysinfo: '📊 Infos système demandées…',
      lock: '🔒 Verrouillage…',
      sleep: '💤 Mise en veille…',
      shutdown: '⏻ Extinction…',
      run_script: '⚡ Script envoyé…',
      open_ide_file: '💻 Ouverture dans l\'IDE…'
    };
    if (window.toast) window.toast(labels[type] || 'Commande envoyée', 'success');
    _addLogEntry({type: type, deviceId: deviceId, status: 'pending', createdAt: new Date(), cmdId: ref.id});
  } catch(e) {
    if (window.toast) window.toast('Erreur : ' + e.message, 'error');
  }
}

/* ══════════════════════════════════════════
   PROMPTS — IDE & SCRIPT
══════════════════════════════════════════ */
function cwPromptIDE(deviceId) {
  cwShowInputModal({
    title: '💻 Ouvrir dans l\'IDE',
    label: 'Chemin du fichier à ouvrir',
    placeholder: 'Ex: C:\\Users\\moi\\projet\\main.py',
    confirmLabel: 'Ouvrir',
    onConfirm: function(val) {
      if (!val.trim()) return;
      cwCmd(deviceId, 'open_ide_file', {filePath: val.trim()});
    }
  });
}

function cwPromptScript(deviceId) {
  cwShowInputModal({
    title: '⚡ Exécuter un script',
    label: 'Commande ou chemin du script',
    placeholder: 'Ex: python script.py  ou  npm run build',
    confirmLabel: 'Exécuter',
    textarea: true,
    onConfirm: function(val) {
      if (!val.trim()) return;
      cwCmd(deviceId, 'run_script', {command: val.trim()});
    }
  });
}

/* ══════════════════════════════════════════
   INPUT MODAL
══════════════════════════════════════════ */
function cwShowInputModal(opts) {
  var existing = document.getElementById('cwInputModal');
  if (existing) existing.remove();

  var m = document.createElement('div');
  m.id = 'cwInputModal';
  m.className = 'cw-modal-overlay';
  m.innerHTML =
    '<div class="cw-modal-box">' +
      '<div class="cw-modal-title">' + opts.title + '</div>' +
      '<label class="cw-modal-label">' + opts.label + '</label>' +
      (opts.textarea ?
        '<textarea class="cw-modal-input cw-modal-textarea" id="cwInputField" placeholder="' + esc(opts.placeholder || '') + '" rows="4">' + esc(opts.defaultValue || '') + '</textarea>' :
        '<input class="cw-modal-input" id="cwInputField" type="text" placeholder="' + esc(opts.placeholder || '') + '" value="' + esc(opts.defaultValue || '') + '">'
      ) +
      '<div class="cw-modal-actions">' +
        '<button class="cw-modal-cancel" onclick="document.getElementById(\'cwInputModal\').remove()">Annuler</button>' +
        '<button class="cw-modal-confirm" id="cwInputConfirm">' + esc(opts.confirmLabel || 'Confirmer') + '</button>' +
      '</div>' +
    '</div>';

  document.body.appendChild(m);
  var field = document.getElementById('cwInputField');
  if (field) setTimeout(function(){ field.focus(); }, 80);

  document.getElementById('cwInputConfirm').onclick = function() {
    var val = field ? field.value : '';
    opts.onConfirm(val);
    m.remove();
  };

  m.addEventListener('click', function(e){ if (e.target === m) m.remove(); });
}

/* ══════════════════════════════════════════
   RESULT LISTENER — Firestore real-time
══════════════════════════════════════════ */
function _handleResultsSnap(snap) {
  // Traite tous les changements (added + modified) de statut done/error
  snap.docChanges().forEach(function(change) {
    if (change.type !== 'added' && change.type !== 'modified') return;
    var data = change.doc.data();
    if (data.status !== 'done' && data.status !== 'error') return;
    _updateLogEntry(change.doc.id, data);
    if (data.type === 'screenshot' && data.status === 'done' && data.result && data.result.imageBase64) {
      var mime = (data.result.mimeType || 'image/jpeg');
      cwShowScreenshot(data.result.imageBase64, data.deviceId, mime);
    }
    if (data.type === 'sysinfo' && data.status === 'done' && data.result) {
      cwShowSysInfo(data.result, data.deviceId);
    }
    if (data.type === 'run_script' && data.status === 'done') {
      cwShowScriptResult(data.result, data.deviceId);
    }
  });
  _renderActivityLog();
}

/* ══════════════════════════════════════════
   SCREENSHOT MODAL
══════════════════════════════════════════ */
function cwShowScreenshot(base64, deviceId, mimeType) {
  mimeType = mimeType || 'image/jpeg';
  var existing = document.getElementById('cwScreenModal');
  if (existing) existing.remove();

  var ts = new Date().toLocaleTimeString('fr-FR');
  var m = document.createElement('div');
  m.id = 'cwScreenModal';
  m.className = 'cw-modal-overlay';
  m.innerHTML =
    '<div class="cw-modal-box cw-screenshot-box">' +
      '<div class="cw-modal-title" style="margin-bottom:8px;">📸 Capture d\'écran <span style="font-size:0.75em;opacity:0.5;font-weight:400;">' + ts + '</span></div>' +
      '<div style="font-size:0.72em;color:var(--text-muted);margin-bottom:14px;">Appareil : ' + esc(deviceId) + '</div>' +
      '<div class="cw-screenshot-wrap">' +
        '<img src="data:' + mimeType + ';base64,' + base64 + '" class="cw-screenshot-img" alt="Capture d\'écran" onclick="this.classList.toggle(\'cw-screenshot-zoomed\')">' +
        '<div class="cw-screenshot-hint">Cliquer sur l\'image pour zoomer</div>' +
      '</div>' +
      '<div class="cw-modal-actions" style="margin-top:16px;">' +
        '<button class="cw-modal-cancel" onclick="document.getElementById(\'cwScreenModal\').remove()">Fermer</button>' +
        '<a class="cw-modal-confirm" style="text-decoration:none;display:inline-flex;align-items:center;gap:6px;" href="data:image/png;base64,' + base64 + '" download="eva-capture-' + Date.now() + '.png">⬇ Télécharger</a>' +
      '</div>' +
    '</div>';

  document.body.appendChild(m);
  m.addEventListener('click', function(e){ if (e.target === m) m.remove(); });
  if (window.toast) window.toast('📸 Capture reçue !', 'success');
}

/* ══════════════════════════════════════════
   SYSINFO MODAL
══════════════════════════════════════════ */
function cwShowSysInfo(result, deviceId) {
  var existing = document.getElementById('cwSysInfoModal');
  if (existing) existing.remove();

  function row(label, val, color) {
    return '<div class="cw-si-row"><span class="cw-si-label">' + esc(label) + '</span>' +
      '<span class="cw-si-val" style="' + (color ? 'color:' + color : '') + '">' + esc(String(val || '—')) + '</span></div>';
  }
  function bar(label, pct) {
    var color = pct > 85 ? '#ff4d6d' : pct > 60 ? '#ffaa44' : '#4ade80';
    return '<div class="cw-si-row"><span class="cw-si-label">' + esc(label) + '</span>' +
      '<div class="cw-si-bar-wrap"><div class="cw-si-bar" style="width:' + Math.min(100,pct) + '%;background:' + color + '"></div></div>' +
      '<span class="cw-si-pct" style="color:' + color + '">' + Math.round(pct) + '%</span></div>';
  }

  var content =
    '<div class="cw-si-section">Système</div>' +
    row('Appareil', deviceId) +
    row('OS', result.os) +
    row('Hostname', result.hostname) +
    row('Uptime', result.uptime) +
    '<div class="cw-si-section">Processeur</div>' +
    row('CPU', result.cpu) +
    (result.cpuUsage != null ? bar('Utilisation CPU', result.cpuUsage) : '') +
    '<div class="cw-si-section">Mémoire</div>' +
    (result.ramUsage != null ? bar('RAM utilisée', result.ramUsage) : '') +
    row('RAM totale', result.ramTotal) +
    row('RAM libre', result.ramFree) +
    '<div class="cw-si-section">Stockage</div>' +
    (result.diskUsage != null ? bar('Disque principal', result.diskUsage) : '') +
    row('Disque total', result.diskTotal) +
    row('Disque libre', result.diskFree) +
    '<div class="cw-si-section">Réseau</div>' +
    row('IP locale', result.localIP) +
    row('IP publique', result.publicIP);

  var m = document.createElement('div');
  m.id = 'cwSysInfoModal';
  m.className = 'cw-modal-overlay';
  m.innerHTML =
    '<div class="cw-modal-box cw-sysinfo-box">' +
      '<div class="cw-modal-title">📊 Infos Système</div>' +
      '<div class="cw-si-grid">' + content + '</div>' +
      '<div class="cw-modal-actions" style="margin-top:16px;">' +
        '<button class="cw-modal-confirm" onclick="document.getElementById(\'cwSysInfoModal\').remove()">Fermer</button>' +
      '</div>' +
    '</div>';

  document.body.appendChild(m);
  m.addEventListener('click', function(e){ if (e.target === m) m.remove(); });
  if (window.toast) window.toast('📊 Infos système reçues', 'success');
}

/* ══════════════════════════════════════════
   SCRIPT RESULT MODAL
══════════════════════════════════════════ */
function cwShowScriptResult(result, deviceId) {
  var existing = document.getElementById('cwScriptModal');
  if (existing) existing.remove();

  var output = (result && result.stdout) ? result.stdout : (result && result.output) ? result.output : '(aucune sortie)';
  var errOutput = (result && result.stderr) ? result.stderr : '';
  var exitCode = (result && result.exitCode != null) ? result.exitCode : '—';

  var m = document.createElement('div');
  m.id = 'cwScriptModal';
  m.className = 'cw-modal-overlay';
  m.innerHTML =
    '<div class="cw-modal-box cw-script-box">' +
      '<div class="cw-modal-title">⚡ Résultat du script <span style="font-size:0.7em;opacity:0.5;">code : ' + esc(String(exitCode)) + '</span></div>' +
      '<div style="font-size:0.72em;color:var(--text-muted);margin-bottom:10px;">Appareil : ' + esc(deviceId) + '</div>' +
      '<pre class="cw-script-output">' + esc(output) + '</pre>' +
      (errOutput ? '<pre class="cw-script-output cw-script-err">' + esc(errOutput) + '</pre>' : '') +
      '<div class="cw-modal-actions" style="margin-top:14px;">' +
        '<button class="cw-modal-confirm" onclick="document.getElementById(\'cwScriptModal\').remove()">Fermer</button>' +
      '</div>' +
    '</div>';

  document.body.appendChild(m);
  m.addEventListener('click', function(e){ if (e.target === m) m.remove(); });
  if (window.toast) window.toast('⚡ Script terminé (code ' + exitCode + ')', exitCode === 0 || exitCode === '0' ? 'success' : 'error');
}

/* ══════════════════════════════════════════
   ACTIVITY LOG
══════════════════════════════════════════ */
var _knownResults = {};

function _addLogEntry(entry) {
  _cwActivityLog.unshift(entry);
  if (_cwActivityLog.length > MAX_LOG) _cwActivityLog.pop();
  _renderActivityLog();
}

function _updateLogEntry(cmdId, data) {
  if (_knownResults[cmdId]) return;
  _knownResults[cmdId] = true;
  var typeLabels = {
    screenshot: '📸 Capture',
    sysinfo: '📊 Infos système',
    lock: '🔒 Verrouillage',
    sleep: '💤 Veille',
    shutdown: '⏻ Extinction',
    run_script: '⚡ Script',
    open_ide_file: '💻 IDE'
  };
  var entry = {
    type: data.type,
    deviceId: data.deviceId,
    status: data.status,
    label: typeLabels[data.type] || data.type,
    createdAt: data.updatedAt && data.updatedAt.toDate ? data.updatedAt.toDate() : new Date()
  };
  _cwActivityLog = _cwActivityLog.filter(function(e){ return e.type !== data.type || e.deviceId !== data.deviceId || e.status !== 'pending'; });
  _cwActivityLog.unshift(entry);
  if (_cwActivityLog.length > MAX_LOG) _cwActivityLog.pop();
}

function _renderActivityLog() {
  var el = document.getElementById('cwActivityLog');
  if (!el) return;
  if (_cwActivityLog.length === 0) {
    el.innerHTML = '<div class="cw-log-empty">Aucune commande récente</div>';
    return;
  }
  el.innerHTML = _cwActivityLog.map(function(e) {
    var statusIcon = e.status === 'done' ? '<span class="cw-log-dot cw-log-done"></span>' :
                     e.status === 'error' ? '<span class="cw-log-dot cw-log-err"></span>' :
                     '<span class="cw-log-dot cw-log-pending"></span>';
    var statusLabel = e.status === 'done' ? 'Terminé' : e.status === 'error' ? 'Erreur' : 'En attente…';
    var ts = e.createdAt ? e.createdAt.toLocaleTimeString('fr-FR', {hour:'2-digit',minute:'2-digit',second:'2-digit'}) : '';
    return '<div class="cw-log-item">' +
      statusIcon +
      '<div class="cw-log-info">' +
        '<span class="cw-log-label">' + esc(e.label || e.type) + '</span>' +
        '<span class="cw-log-device">' + esc(e.deviceId || '') + '</span>' +
      '</div>' +
      '<div class="cw-log-right">' +
        '<span class="cw-log-status">' + statusLabel + '</span>' +
        '<span class="cw-log-time">' + ts + '</span>' +
      '</div>' +
    '</div>';
  }).join('');
}

/* ══════════════════════════════════════════
   REMOVE DEVICE
══════════════════════════════════════════ */
async function cwRemoveDevice(deviceId, deviceName) {
    if (!window.S || !window.S.user) return;
    if (!confirm('Retirer ' + deviceName + ' de votre compte ?\n\nL\'appareil sera déconnecté.')) return;
    try {
        const docSnap = await window.db.collection('cloudworks').doc(S.user.uid).collection('devices').doc(deviceId).get();
        if (docSnap.exists && docSnap.data().sessionId) {
            await window.db.collection('users').doc(S.user.uid).collection('sessions').doc(docSnap.data().sessionId).update({revoke: true}).catch(()=>{});
        }
        await window.db.collection('cloudworks').doc(S.user.uid).collection('devices').doc(deviceId).delete();
        if (window.toast) window.toast('Appareil retiré et session révoquée.', 'success');
    } catch(e) {
        if (window.toast) window.toast('Erreur : ' + e.message, 'error');
    }
}

/* ══════════════════════════════════════════
   EXPORTS
══════════════════════════════════════════ */
window.loadCloudWorks    = loadCloudWorks;
window.cwCmd             = cwCmd;
window.cwRemoveDevice    = cwRemoveDevice;
window.cwPromptIDE       = cwPromptIDE;
window.cwPromptScript    = cwPromptScript;
window.cwShowScreenshot  = cwShowScreenshot;
window.cwShowSysInfo     = cwShowSysInfo;
window.cwShowScriptResult= cwShowScriptResult;
})();



