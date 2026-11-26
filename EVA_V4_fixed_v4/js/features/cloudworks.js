/* EVA V4 WEB — CLOUDWORKS.JS — Contrôle à distance via CWBus + CWModal */
(function() {
'use strict';

var _cwUnsub = null;
var _cwResultUnsub = null;
var _bgDeviceUnsub = null;
var MAX_LOG = 8;

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function toMs(v) {
  if (!v) return 0;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v.toDate === 'function') return v.toDate().getTime();
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'number') return v;
  return 0;
}

/* ══════════════════════════════════════════
   LISTENER DE FOND — peuple S.cwDevices
══════════════════════════════════════════ */
function _startBackgroundDeviceListener(uid) {
  if (_bgDeviceUnsub || !window.db || !uid) return;
  try {
    _bgDeviceUnsub = window.db.collection('cloudworks').doc(uid).collection('devices')
      .onSnapshot(function(snap) {
        var arr = [];
        snap.forEach(function(doc) {
          var d = Object.assign({ id: doc.id, deviceId: doc.id }, doc.data());
          var seenMs = toMs(d.lastSeen) || toMs(d.updatedAt);
          var online = d.online === true && seenMs > 0 && (Date.now() - seenMs) < 120000;
          arr.push(Object.assign({}, d, { online: online }));
        });
        if (window.S) window.S.cwDevices = arr;
        window._cwDevicesCache = arr;
        _refreshTargetSelector(arr);
      }, function(err) {
        console.warn('[CW Web] Listener fond erreur:', err);
      });
  } catch(e) {
    console.warn('[CW Web] Erreur listener fond:', e);
  }
}

(function _hookAuthForDeviceListener() {
  var attempt = 0;
  var check = setInterval(function() {
    attempt++;
    if (attempt > 120) { clearInterval(check); return; }
    if (window.S && window.S.user && window.S.user.uid && window.db) {
      clearInterval(check);
      _startBackgroundDeviceListener(window.S.user.uid);
    }
  }, 500);
})();

/* ══════════════════════════════════════════
   LOAD — panneau Web CloudWorks
══════════════════════════════════════════ */
async function loadCloudWorks() {
  if (!window.S || !window.S.user || !window.db) return;
  var uid = S.user.uid;
  var list = document.getElementById('cwDeviceList');
  if (!list) return;

  _ensureWebControlBar();
  list.innerHTML = '<div class="cw-empty"><div class="cw-spinner"></div>Chargement des appareils…</div>';
  _setStats(null, null, null);

  if (_cwUnsub) { _cwUnsub(); _cwUnsub = null; }
  if (_cwResultUnsub) { _cwResultUnsub(); _cwResultUnsub = null; }

  try {
    _cwUnsub = window.db.collection('cloudworks').doc(uid).collection('devices')
      .onSnapshot(function(snap) {
        renderDevices(snap);
      }, function(err) {
        list.innerHTML = '<div class="cw-empty"><div class="cw-empty-icon">📡</div>Impossible de charger les appareils.<br><small style="opacity:0.6">' + esc(err.message) + '</small></div>';
        _setStats(0, 0, 0);
      });

    _cwResultUnsub = window.db.collection('cloudworks').doc(uid).collection('commands')
      .orderBy('updatedAt', 'desc')
      .limit(MAX_LOG)
      .onSnapshot(function(snap) {
        _renderActivityLog(snap);
      }, function(err) {
        console.warn('[CW Web] Activity snapshot error:', err);
      });
  } catch(e) {
    list.innerHTML = '<div class="cw-empty"><div class="cw-empty-icon">⚠️</div>Erreur Firebase.</div>';
    _setStats(0, 0, 0);
  }
}

function _ensureWebControlBar() {
  var wrap = document.querySelector('#viewCloudworks .cw-wrap');
  var listEl = document.getElementById('cwDeviceList');
  if (!wrap || !listEl || document.getElementById('cwWebCommandPanel')) return;

  var panel = document.createElement('div');
  panel.id = 'cwWebCommandPanel';
  panel.style.cssText = 'margin:14px 0 18px;padding:14px 16px;background:rgba(15,23,42,0.72);border:1px solid rgba(0,212,255,0.2);border-radius:14px;';
  panel.innerHTML =
    '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:10px;">' +
      '<div style="font-size:0.78em;font-weight:700;color:var(--cyan,#00d4ff);letter-spacing:0.6px;text-transform:uppercase;">⚡ Contrôle à distance (IA locale sur votre PC)</div>' +
      '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">' +
        '<select id="cwWebTargetSelect" style="background:rgba(0,0,0,0.4);border:1px solid rgba(0,212,255,0.28);color:#e2e8f0;border-radius:8px;padding:5px 10px;font-size:12px;"><option value="">PC cible automatique</option></select>' +
        '<button onclick="window.cwPurgeOfflineDevices()" style="background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.35);color:#fca5a5;border-radius:8px;padding:5px 10px;font-size:11px;font-weight:600;cursor:pointer;">🧹 Purger hors ligne</button>' +
        '<a href="/download" style="background:rgba(0,212,255,0.12);border:1px solid rgba(0,212,255,0.35);color:#38bdf8;border-radius:8px;padding:5px 10px;font-size:11px;font-weight:600;text-decoration:none;">⬇ E.V.A Desktop</a>' +
      '</div>' +
    '</div>' +
    '<textarea id="cwAgenticPrompt" rows="2" placeholder="Ex: Crée un fichier notes.txt sur le Bureau ou ouvre la calculatrice..." style="width:100%;box-sizing:border-box;background:rgba(0,0,0,0.35);border:1px solid rgba(0,212,255,0.18);border-radius:9px;padding:9px 11px;color:#f1f5f9;font-size:13px;resize:vertical;margin-bottom:8px;"></textarea>' +
    '<button onclick="window._cwWebRunAgentic()" style="width:100%;padding:9px 14px;border:none;border-radius:9px;background:linear-gradient(90deg,#00d4ff,#3b82f6);color:#040814;font-weight:700;font-size:13px;cursor:pointer;">🤖 Exécuter sur le PC sélectionné</button>' +
    '<div id="cwAgenticStatus" style="display:none;margin-top:10px;"></div>';

  listEl.parentNode.insertBefore(panel, listEl);
  if (window._cwDevicesCache) _refreshTargetSelector(window._cwDevicesCache);
}

function _refreshTargetSelector(arr) {
  var sel = document.getElementById('cwWebTargetSelect');
  if (!sel) return;
  var prev = sel.value;
  var html = '';
  var online = (arr || []).filter(function(d) { return d.online; });
  if (!online.length) {
    html = '<option value="">Aucun PC en ligne</option>';
  } else {
    online.forEach(function(d) {
      var id = esc(d.deviceId || d.id);
      var name = esc(d.deviceName || d.id);
      html += '<option value="' + id + '">🟢 ' + name + '</option>';
    });
  }
  sel.innerHTML = html;
  if (prev && online.some(function(d) { return (d.deviceId || d.id) === prev; })) {
    sel.value = prev;
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
    list.innerHTML =
      '<div class="cw-empty">' +
        '<div class="cw-empty-icon">🖥️</div>' +
        '<div class="cw-empty-title">AUCUN APPAREIL CONNECTÉ</div>' +
        '<span>Installez E.V.A Desktop sur votre PC pour qu\'il apparaisse ici automatiquement.</span>' +
        '<div style="margin-top:12px;"><a href="/download" style="color:var(--cyan,#00d4ff);font-weight:700;text-decoration:underline;">Télécharger E.V.A Desktop</a></div>' +
      '</div>';
    _setStats(0, 0, 0);
    return;
  }

  var totalCount = 0, onlineCount = 0, offlineCount = 0;
  var _cwDevArr = [];
  list.innerHTML = '';

  snap.forEach(function(doc) {
    var d = Object.assign({ id: doc.id, deviceId: doc.id }, doc.data());
    var seenMs = toMs(d.lastSeen) || toMs(d.updatedAt);
    var online = d.online === true && seenMs > 0 && (Date.now() - seenMs) < 120000;
    var seen = seenMs ? new Date(seenMs).toLocaleString('fr-FR') : 'Inconnu';
    var iconMap = { mac: '🍎', linux: '🐧', windows: '🖥️' };
    var icon = iconMap[d.deviceType] || '🖥️';
    var typeLabel = { mac: 'macOS', linux: 'Linux', windows: 'Windows' }[d.deviceType] || 'PC';
    var did = esc(d.id);
    var dname = esc(d.deviceName || d.deviceId || d.id);

    totalCount++;
    if (online) onlineCount++; else offlineCount++;
    _cwDevArr.push(Object.assign({}, d, { online: online }));

    var c = document.createElement('div');
    c.className = 'cw-card' + (online ? ' cw-card-online' : ' cw-card-offline');

    var actionsHtml = '<div class="cw-card-divider"></div><div class="cw-card-actions">';
    if (online) {
      actionsHtml +=
        '<button class="cw-action-btn" onclick="cwCmd(\'' + did + '\',\'screenshot\')" title="Capture d\'écran">Capture</button>' +
        '<button class="cw-action-btn" onclick="cwCmd(\'' + did + '\',\'sysinfo\')" title="RAM, CPU, OS">Infos Système</button>' +
        '<button class="cw-action-btn" onclick="cwCmd(\'' + did + '\',\'open_explorer\')" title="Ouvrir Explorateur">Explorateur</button>' +
        '<button class="cw-action-btn" onclick="cwCmd(\'' + did + '\',\'lock\')">Verrouiller</button>' +
        '<button class="cw-action-btn" onclick="cwCmd(\'' + did + '\',\'sleep\')">Veille</button>' +
        '<button class="cw-action-btn cw-danger" onclick="cwCmd(\'' + did + '\',\'shutdown\')">Éteindre</button>';
    }
    actionsHtml +=
      '<button class="cw-action-btn cw-remove' + (online ? ' cw-remove-inline' : '') + '" onclick="cwRemoveDevice(\'' + did + '\',\'' + dname + '\')">' +
        (online ? 'Retirer' : 'Retirer l\'appareil') +
      '</button></div>';

    c.innerHTML =
      '<div class="cw-card-inner">' +
        '<div class="cw-card-top">' +
          '<div class="cw-card-left">' +
            '<div class="cw-card-iconwrap">' + icon + '</div>' +
            '<div class="cw-card-info">' +
              '<div class="cw-card-name">' + dname + '</div>' +
              '<div class="cw-card-sub">' + typeLabel + ' · ' + esc(d.deviceId || d.id) + (d.llmModelInstalled ? ' · IA locale prête' : '') + '</div>' +
            '</div>' +
          '</div>' +
          '<div class="cw-card-right">' +
            '<span class="cw-badge ' + (online ? 'cw-badge-on' : 'cw-badge-off') + '">' +
              (online ? 'EN LIGNE' : 'HORS LIGNE') +
            '</span>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="cw-card-divider"></div>' +
      '<div class="cw-card-meta">' +
        '<span class="cw-meta-item">Dernière activité : ' + esc(seen) + '</span>' +
      '</div>' +
      actionsHtml;

    list.appendChild(c);
  });

  if (window.S) window.S.cwDevices = _cwDevArr;
  window._cwDevicesCache = _cwDevArr;
  _refreshTargetSelector(_cwDevArr);
  _setStats(totalCount, onlineCount, offlineCount);
}

/* ══════════════════════════════════════════
   COMMANDES WEB -> CWBus + Tracker
══════════════════════════════════════════ */
window._cwWebRunAgentic = async function() {
  var promptEl = document.getElementById('cwAgenticPrompt');
  var statusEl = document.getElementById('cwAgenticStatus');
  var sel = document.getElementById('cwWebTargetSelect');
  if (!promptEl || !promptEl.value.trim()) return;
  if (!window.CWBus) { window.toast?.('CWBus indisponible', 'error'); return; }

  var prompt = promptEl.value.trim();
  var deviceId = sel && sel.value ? sel.value : undefined;
  try {
    var cmdId = await window.CWBus.submit('agentic_task', { prompt: prompt }, { deviceId: deviceId });
    if (statusEl) {
      statusEl.replaceChildren();
      statusEl.style.display = 'block';
    }
    window.appendCloudWorksTracker?.(cmdId, prompt, statusEl || undefined);
    var res = await window.CWBus.wait(cmdId);
    if (res && res.success) promptEl.value = '';
  } catch(e) {
    if (statusEl) {
      statusEl.style.display = 'block';
      statusEl.textContent = 'Erreur : ' + e.message;
    }
    window.toast?.('Erreur : ' + e.message, 'error');
  }
};

async function cwCmd(deviceId, type, payload) {
  if (!window.S || !window.S.user || !window.CWBus) return;
  var msgs = { shutdown: 'Éteindre ce PC ?', lock: 'Verrouiller ce PC ?', sleep: 'Mettre en veille ?' };
  if (msgs[type] && !confirm(msgs[type])) return;
  try {
    var statusEl = document.getElementById('cwAgenticStatus');
    var cmdId = await window.CWBus.submit(type, payload || {}, { deviceId: deviceId });
    window.toast?.('Commande transmise au PC', 'success');
    if (statusEl) {
      statusEl.replaceChildren();
      statusEl.style.display = 'block';
    }
    window.appendCloudWorksTracker?.(cmdId, (payload && payload.prompt) || type, statusEl || undefined);
  } catch(e) {
    window.toast?.('Erreur : ' + e.message, 'error');
  }
}

window.cwRemoveDevice = async function(deviceId, name) {
  if (!window.S || !window.S.user || !window.db) return;
  if (!confirm('Retirer "' + (name || deviceId) + '" de CloudWorks ?')) return;
  try {
    await window.db.collection('cloudworks').doc(S.user.uid).collection('devices').doc(deviceId).delete();
    window.toast?.('Appareil retiré', 'info');
  } catch(e) {
    window.toast?.('Erreur : ' + e.message, 'error');
  }
};

window.cwPurgeOfflineDevices = async function() {
  if (!window.S || !window.S.user || !window.db) return;
  try {
    var col = window.db.collection('cloudworks').doc(S.user.uid).collection('devices');
    var snap = await col.get();
    var removed = 0;
    for (var i = 0; i < snap.docs.length; i++) {
      var doc = snap.docs[i], d = doc.data();
      var seenMs = toMs(d.lastSeen) || toMs(d.updatedAt);
      var online = d.online === true && seenMs > 0 && (Date.now() - seenMs) < 120000;
      if (!online) {
        await doc.ref.delete();
        removed++;
      }
    }
    window.toast?.(removed + ' appareil(s) hors ligne nettoyé(s)', 'success');
  } catch(e) {
    window.toast?.('Erreur purge : ' + e.message, 'error');
  }
};

function _renderActivityLog(snap) {
  var el = document.getElementById('cwActivityLog');
  if (!el) return;
  if (snap.empty) {
    el.innerHTML = '<div class="cw-log-empty">Aucune commande récente</div>';
    return;
  }
  var html = '';
  snap.forEach(function(doc) {
    var d = doc.data();
    var time = toMs(d.updatedAt);
    var tStr = time ? new Date(time).toLocaleString('fr-FR') : '';
    var icon = d.status === 'done' ? '✓' : d.status === 'error' ? '✗' : d.status === 'cancelled' ? '■' : '⟳';
    var label = (d.payload && d.payload.prompt) ? d.payload.prompt : (d.type || 'commande');
    html += '<div style="display:flex;justify-content:space-between;gap:10px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.06);font-size:12px;">' +
      '<span>' + icon + ' ' + esc(String(label).slice(0, 65)) + '</span>' +
      '<span style="color:#64748b;white-space:nowrap;">' + esc(tStr) + '</span>' +
    '</div>';
  });
  el.innerHTML = html;
}

window.cwCmd = cwCmd;
window.loadCloudWorks = loadCloudWorks;
})();
