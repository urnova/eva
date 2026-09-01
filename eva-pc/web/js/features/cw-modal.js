/* EVA PC — CW-MODAL.JS — Modal de confirmation CloudWorks + Tracker chat */
/* Fichier EXCLUSIF application PC — ne PAS copier sur le site web */
(function() {
'use strict';

/* ════════════════════════════════════════════════════════════
   STYLES
════════════════════════════════════════════════════════════ */
(function injectStyles() {
  if (document.getElementById('cw-modal-styles')) return;
  var s = document.createElement('style');
  s.id = 'cw-modal-styles';
  s.textContent = `
    /* ─── Confirmation Modal ─── */
    #cwConfirmOverlay {
      position:fixed; inset:0; background:rgba(0,0,0,0.72); z-index:9999;
      display:flex; align-items:center; justify-content:center;
      backdrop-filter:blur(6px); opacity:0; pointer-events:none;
      transition:opacity 0.18s ease;
    }
    #cwConfirmOverlay.open { opacity:1; pointer-events:all; }
    #cwConfirmBox {
      background:#0a0f1a; border:1px solid rgba(0,212,255,0.28);
      border-radius:18px; padding:0; width:420px; max-width:90vw;
      box-shadow:0 24px 64px rgba(0,0,0,0.8);
      transform:translateY(14px); transition:transform 0.18s ease;
      overflow:hidden;
    }
    #cwConfirmOverlay.open #cwConfirmBox { transform:translateY(0); }
    .cwcm-header {
      padding:18px 20px 14px;
      background:linear-gradient(135deg,rgba(0,212,255,0.08),rgba(120,0,255,0.06));
      border-bottom:1px solid rgba(0,212,255,0.12);
      display:flex; align-items:center; gap:12px;
    }
    .cwcm-icon { font-size:1.6em; }
    .cwcm-title { font-size:0.88em; font-weight:800; color:#00d4ff; letter-spacing:0.06em; }
    .cwcm-subtitle { font-size:0.68em; color:#88889a; margin-top:2px; }
    .cwcm-body { padding:18px 20px; }
    .cwcm-label { font-size:0.7em; color:#88889a; margin-bottom:5px; letter-spacing:0.06em; text-transform:uppercase; }
    .cwcm-prompt {
      background:rgba(0,0,0,0.35); border:1px solid rgba(0,212,255,0.12);
      border-radius:10px; padding:12px 14px; font-size:0.79em;
      color:#e4e4ef; font-family:'Space Mono',monospace; line-height:1.5;
      max-height:120px; overflow-y:auto; margin-bottom:14px;
    }
    .cwcm-device-row {
      display:flex; align-items:center; gap:8px; margin-bottom:16px;
      font-size:0.75em; color:#88889a;
    }
    .cwcm-device-badge {
      background:rgba(0,255,136,0.12); border:1px solid rgba(0,255,136,0.25);
      color:#00ff88; padding:3px 10px; border-radius:12px; font-size:0.9em;
    }
    .cwcm-actions { display:flex; gap:10px; }
    .cwcm-btn {
      flex:1; padding:11px; border-radius:10px; border:none;
      cursor:pointer; font-family:'Space Mono',monospace; font-weight:700;
      font-size:0.8em; transition:all 0.15s; letter-spacing:0.04em;
    }
    .cwcm-btn-confirm { background:var(--cyan,#00d4ff); color:#000; }
    .cwcm-btn-confirm:hover { opacity:0.85; transform:translateY(-1px); }
    .cwcm-btn-cancel {
      background:rgba(255,77,109,0.1); color:#ff4d6d;
      border:1px solid rgba(255,77,109,0.25);
    }
    .cwcm-btn-cancel:hover { background:rgba(255,77,109,0.2); }

    /* ─── Chat CloudWorks Tracker ─── */
    .cw-tracker-card {
      margin:10px 0; padding:0; background:rgba(0,212,255,0.04);
      border:1px solid rgba(0,212,255,0.2); border-radius:14px;
      overflow:hidden; font-family:'Space Mono',monospace;
    }
    .cw-tracker-header {
      display:flex; align-items:center; gap:10px; padding:10px 14px;
      background:rgba(0,212,255,0.07); border-bottom:1px solid rgba(0,212,255,0.1);
    }
    .cw-tracker-icon { font-size:1em; }
    .cw-tracker-title { font-size:0.75em; font-weight:700; color:#00d4ff; flex:1; }
    .cw-tracker-status { font-size:0.65em; color:#88889a; }
    .cw-tracker-body { padding:12px 14px; }
    .cw-tracker-prompt {
      font-size:0.72em; color:#88889a; margin-bottom:10px;
      border-left:2px solid rgba(0,212,255,0.3); padding-left:8px;
      line-height:1.4;
    }
    .cw-tracker-steps { list-style:none; padding:0; margin:0; }
    .cw-tracker-step {
      display:flex; align-items:flex-start; gap:8px;
      font-size:0.72em; color:#e4e4ef; padding:4px 0;
      border-bottom:1px solid rgba(0,212,255,0.05);
      animation:cwStepIn 0.2s ease;
    }
    @keyframes cwStepIn { from { opacity:0; transform:translateX(-6px); } to { opacity:1; transform:translateX(0); } }
    .cw-tracker-step:last-child { border-bottom:none; }
    .cw-tracker-step-icon { width:16px; text-align:center; flex-shrink:0; margin-top:1px; }
    .cw-tracker-step.running .cw-tracker-step-icon { color:#ffc800; animation:cwPulse 1s ease-in-out infinite; }
    .cw-tracker-step.done .cw-tracker-step-icon { color:#00ff88; }
    .cw-tracker-step.error .cw-tracker-step-icon { color:#ff4d6d; }
    @keyframes cwPulse { 0%,100%{opacity:1;} 50%{opacity:0.4;} }
    .cw-tracker-summary {
      margin-top:10px; padding:10px 12px;
      background:rgba(0,255,136,0.07); border:1px solid rgba(0,255,136,0.18);
      border-radius:8px; font-size:0.74em; color:#e4e4ef; line-height:1.5;
    }
    .cw-tracker-summary.error {
      background:rgba(255,77,109,0.07); border-color:rgba(255,77,109,0.18);
    }
  `;
  document.head.appendChild(s);
})();

/* ════════════════════════════════════════════════════════════
   MODAL DE CONFIRMATION
════════════════════════════════════════════════════════════ */
var _pendingResolve = null;
var _overlay = null;

function _buildOverlay() {
  if (document.getElementById('cwConfirmOverlay')) return;
  var el = document.createElement('div');
  el.id = 'cwConfirmOverlay';
  el.innerHTML = `
    <div id="cwConfirmBox">
      <div class="cwcm-header">
        <div class="cwcm-icon">🖥️</div>
        <div>
          <div class="cwcm-title">CloudWorks — Confirmation</div>
          <div class="cwcm-subtitle">EVA souhaite exécuter une action sur ce PC</div>
        </div>
      </div>
      <div class="cwcm-body">
        <div class="cwcm-label">Tâche demandée</div>
        <div class="cwcm-prompt" id="cwcmPrompt">—</div>
        <div class="cwcm-device-row">
          🎯 Appareil cible : <span class="cwcm-device-badge" id="cwcmDevice">Ce PC</span>
        </div>
        <div class="cwcm-actions">
          <button class="cwcm-btn cwcm-btn-cancel" onclick="window._cwModalRespond(false)">✗ Annuler</button>
          <button class="cwcm-btn cwcm-btn-confirm" onclick="window._cwModalRespond(true)">✓ Valider</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(el);
  _overlay = el;

  // Fermer en cliquant à l'extérieur
  el.addEventListener('click', function(e) {
    if (e.target === el) window._cwModalRespond(false);
  });
}

window._cwModalRespond = function(confirmed) {
  if (!_overlay) return;
  _overlay.classList.remove('open');
  if (_pendingResolve) {
    _pendingResolve(confirmed);
    _pendingResolve = null;
  }
};

function _showConfirmModal(action, deviceName) {
  _buildOverlay();
  document.getElementById('cwcmPrompt').textContent =
    action.prompt || action.label || action.type || 'Action système';
  document.getElementById('cwcmDevice').textContent = deviceName || 'Ce PC';
  _overlay.classList.add('open');
  return new Promise(function(resolve) {
    _pendingResolve = resolve;
  });
}

/* ════════════════════════════════════════════════════════════
   TRACKER DANS LE CHAT
════════════════════════════════════════════════════════════ */
var _activeTrackers = {}; // cmdId → { el, unsub, steps }

function _createTrackerCard(cmdId, prompt) {
  var card = document.createElement('div');
  card.className = 'cw-tracker-card';
  card.id = 'cwTracker-' + cmdId;
  card.innerHTML = `
    <div class="cw-tracker-header">
      <span class="cw-tracker-icon">⚙️</span>
      <span class="cw-tracker-title">CloudWorks — En cours</span>
      <span class="cw-tracker-status" id="cwts-${cmdId}">⟳ Initialisation...</span>
    </div>
    <div class="cw-tracker-body">
      <div class="cw-tracker-prompt">${_esc(prompt || 'Tâche en cours...')}</div>
      <ul class="cw-tracker-steps" id="cwtSteps-${cmdId}"></ul>
    </div>
  `;
  return card;
}

function _addStep(cmdId, text, state) {
  var stepsEl = document.getElementById('cwtSteps-' + cmdId);
  if (!stepsEl) return;
  // Remove previous running step indicator
  var prev = stepsEl.querySelector('.running');
  if (prev) prev.className = 'cw-tracker-step done';

  var icon = state === 'done' ? '✓' : state === 'error' ? '✗' : '⟳';
  var li = document.createElement('li');
  li.className = 'cw-tracker-step ' + (state || 'running');
  li.innerHTML = `<span class="cw-tracker-step-icon">${icon}</span><span>${_esc(text)}</span>`;
  stepsEl.appendChild(li);
  // Scroll
  stepsEl.scrollTop = stepsEl.scrollHeight;
}

function _finalizeTracker(cmdId, result, status) {
  var card = document.getElementById('cwTracker-' + cmdId);
  if (!card) return;

  var headerTitle = card.querySelector('.cw-tracker-title');
  var statusEl = document.getElementById('cwts-' + cmdId);
  var body = card.querySelector('.cw-tracker-body');

  if (status === 'done') {
    if (headerTitle) headerTitle.textContent = 'CloudWorks — Terminé ✓';
    if (statusEl) statusEl.textContent = 'Succès';
    card.style.borderColor = 'rgba(0,255,136,0.3)';
  } else {
    if (headerTitle) headerTitle.textContent = 'CloudWorks — Erreur';
    if (statusEl) statusEl.textContent = 'Échec';
    card.style.borderColor = 'rgba(255,77,109,0.3)';
  }

  var summary = result?.output || result?.error || (status === 'done' ? 'Tâche terminée.' : 'Une erreur est survenue.');
  var summaryEl = document.createElement('div');
  summaryEl.className = 'cw-tracker-summary' + (status === 'error' ? ' error' : '');
  summaryEl.textContent = summary;
  body.appendChild(summaryEl);

  // Unsubscribe Firestore listener
  if (_activeTrackers[cmdId] && _activeTrackers[cmdId].unsub) {
    _activeTrackers[cmdId].unsub();
  }
  delete _activeTrackers[cmdId];

  // Notify EVA to generate a follow-up summary message
  setTimeout(function() {
    window.dispatchEvent(new CustomEvent('cw:generate-summary', {
      detail: { cmdId, status, summary }
    }));
  }, 500);
}

/* ════════════════════════════════════════════════════════════
   API PUBLIQUE
════════════════════════════════════════════════════════════ */

/**
 * Affiche le modal de confirmation, puis exécute l'action si confirmée.
 * Utilisé par file-gen.js pour intercepter les actions CloudWorks.
 */
window.cwConfirmAndExecute = async function(action) {
  var deviceId = action.deviceId || window._cwDeviceId || localStorage.getItem('cw_device_id') || null;
  var deviceName = 'Ce PC';

  // Confirmation obligatoire pour les actions destructives ou longues
  var CW_TYPES = ['agentic_task', 'screenshot', 'sysinfo', 'run_script', 'lock', 'sleep', 'shutdown', 'open_ide_file'];
  if (CW_TYPES.indexOf(action.type) === -1) {
    // Pas une action CloudWorks → exécution directe
    if (typeof executeEvaAction === 'function') executeEvaAction(action);
    return;
  }

  // Afficher le modal
  var confirmed = await _showConfirmModal(action, deviceName);
  if (!confirmed) return;

  // Exécuter via executeEvaAction (définie dans file-gen.js)
  if (typeof executeEvaAction === 'function') {
    executeEvaAction(action);
  }
};

/**
 * Injecte un tracker CloudWorks dans le chat et écoute les mises à jour Firestore.
 * Appelé depuis file-gen.js (window.appendCloudWorksTracker).
 */
window.appendCloudWorksTracker = function(cmdId, prompt) {
  if (!window.db || !window.S || !window.S.user) return;
  var uid = window.S.user.uid;

  // Trouver le dernier message EVA dans le chat et y insérer le tracker
  var msgs = document.querySelectorAll('.message.eva, .msg-eva, [data-role="assistant"]');
  var lastMsg = msgs[msgs.length - 1];
  if (!lastMsg) {
    // Fallback: créer un container dans le chat
    var chatEl = document.getElementById('chat') || document.getElementById('chatMessages') || document.getElementById('messages');
    if (chatEl) {
      lastMsg = document.createElement('div');
      lastMsg.className = 'message eva';
      chatEl.appendChild(lastMsg);
    }
  }

  var card = _createTrackerCard(cmdId, prompt);
  if (lastMsg) lastMsg.appendChild(card);

  // Activer le bouton stop (considérer CW comme génération active)
  if (window.setIsGenerating) window.setIsGenerating(true);
  if (window.S) window.S.cwRunning = true;

  // Écoute Firestore en temps réel
  var unsub = window.db.collection('cloudworks').doc(uid).collection('commands').doc(cmdId)
    .onSnapshot(function(doc) {
      var d = doc.data();
      if (!d) return;

      var statusEl = document.getElementById('cwts-' + cmdId);

      if (d.step && (!_activeTrackers[cmdId] || _activeTrackers[cmdId].lastStep !== d.step)) {
        var isRunning = d.status === 'running';
        _addStep(cmdId, d.step, isRunning ? 'running' : 'done');
        if (statusEl) statusEl.textContent = d.step.substring(0, 40) + (d.step.length > 40 ? '...' : '');
        if (_activeTrackers[cmdId]) _activeTrackers[cmdId].lastStep = d.step;
      }

      if (d.status === 'done' || d.status === 'error') {
        if (d.result?.steps && Array.isArray(d.result.steps)) {
          // Afficher toutes les étapes passées si elles ne sont pas encore affichées
          d.result.steps.forEach(function(s) {
            _addStep(cmdId, s.text || s, 'done');
          });
        }
        _finalizeTracker(cmdId, d.result, d.status);
        // Désactiver le bouton stop
        if (window.S) window.S.cwRunning = false;
        if (window.setIsGenerating) window.setIsGenerating(false);
      }
    });

  _activeTrackers[cmdId] = { unsub, lastStep: null };
};

/**
 * Génère un message de résumé EVA après une tâche CloudWorks
 */
window.addEventListener('cw:generate-summary', function(e) {
  var detail = e.detail;
  var summary = detail.summary || '';
  var status = detail.status;

  // Construire un message de résumé EVA
  var msg = status === 'done'
    ? '✅ **Tâche CloudWorks terminée**\n\n' + summary + '\n\nSouhaites-tu que je fasse autre chose ?'
    : '⚠️ **Erreur CloudWorks**\n\n' + summary + '\n\nVeux-tu que je réessaie ?';

  // Injecter le message dans le chat
  if (window.appendEvaMessage) {
    window.appendEvaMessage(msg);
  } else if (window.addMessage) {
    window.addMessage('assistant', msg);
  }
});

function _esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

console.log('[CW Modal] Chargé ✓');
})();
