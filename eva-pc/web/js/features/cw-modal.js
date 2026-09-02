/* ════════════════════════════════════════════════════════════════
   CW-MODAL.JS  —  CloudWorks Modal + Stepper Tracker
   EVA — Application PC
   
   Fournit :
   • Modal de confirmation avant exécution d'une action CW
   • Tracker vertical "stepper" dans le chat pendant la tâche
   • Bouton d'annulation dans le tracker (synchronisé Firestore)
   • Message de résumé EVA après la fin de la tâche
════════════════════════════════════════════════════════════════ */
(function() {
'use strict';

/* ── Injection CSS ──────────────────────────────────────── */
(function() {
  var s = document.createElement('style');
  s.textContent = `
    /* ─── Modal de confirmation ─── */
    #cwConfirmOverlay {
      display:none; position:fixed; inset:0; z-index:99999;
      background:rgba(8,10,22,0.75); backdrop-filter:blur(8px);
      align-items:center; justify-content:center;
    }
    #cwConfirmOverlay.open { display:flex; animation:cwFadeIn 0.18s ease; }
    @keyframes cwFadeIn { from{opacity:0;transform:scale(0.96)} to{opacity:1;transform:scale(1)} }

    #cwConfirmBox {
      background:linear-gradient(145deg,rgba(12,14,30,0.98),rgba(18,20,42,0.95));
      border:1px solid rgba(0,212,255,0.25); border-radius:18px;
      width:min(420px,92vw); box-shadow:0 20px 60px rgba(0,0,0,0.6),0 0 0 1px rgba(255,255,255,0.04);
    }
    .cwcm-header {
      display:flex; align-items:center; gap:14px; padding:18px 20px 14px;
      border-bottom:1px solid rgba(0,212,255,0.1);
    }
    .cwcm-icon {
      width:40px; height:40px; border-radius:10px; display:flex;
      align-items:center; justify-content:center; font-size:1.3em;
      background:rgba(0,212,255,0.1); border:1px solid rgba(0,212,255,0.2);
    }
    .cwcm-title { font-size:0.85em; font-weight:700; color:#00d4ff; }
    .cwcm-subtitle { font-size:0.7em; color:rgba(180,185,210,0.6); margin-top:2px; }
    .cwcm-body { padding:16px 20px 20px; }
    .cwcm-label { font-size:0.67em; text-transform:uppercase; letter-spacing:0.08em; color:rgba(180,185,210,0.4); margin-bottom:8px; }
    .cwcm-prompt {
      font-size:0.8em; color:#e4e4ef; padding:10px 14px; border-radius:10px;
      background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.07);
      line-height:1.5; margin-bottom:14px; max-height:80px; overflow-y:auto;
    }
    .cwcm-device-row {
      font-size:0.7em; color:rgba(180,185,210,0.5); margin-bottom:16px; display:flex; align-items:center; gap:6px;
    }
    .cwcm-device-badge {
      background:rgba(0,212,255,0.08); border:1px solid rgba(0,212,255,0.2);
      border-radius:6px; padding:1px 8px; color:#00d4ff; font-size:0.9em;
    }
    .cwcm-actions { display:flex; gap:10px; }
    .cwcm-btn {
      flex:1; padding:10px 16px; border:none; border-radius:10px; cursor:pointer;
      font-size:0.78em; font-weight:600; transition:all 0.15s ease;
    }
    .cwcm-btn-confirm { background:linear-gradient(135deg,#00d4ff,#0099dd); color:#000; }
    .cwcm-btn-confirm:hover { opacity:0.9; transform:translateY(-1px); box-shadow:0 4px 16px rgba(0,212,255,0.3); }
    .cwcm-btn-cancel {
      background:rgba(255,77,109,0.08); color:rgba(255,77,109,0.8);
      border:1px solid rgba(255,77,109,0.2);
    }
    .cwcm-btn-cancel:hover { background:rgba(255,77,109,0.15); color:#ff4d6d; }

    /* ─── Tracker Stepper ─── */
    .cw-tracker-card {
      margin:12px 0; background:linear-gradient(145deg,rgba(10,12,28,0.96),rgba(15,18,38,0.92));
      border:1px solid rgba(0,212,255,0.18); border-radius:16px; overflow:hidden;
      font-family:'Inter','Space Grotesk',system-ui,sans-serif;
      box-shadow:0 4px 24px rgba(0,0,0,0.35),0 0 0 1px rgba(255,255,255,0.03);
      transition:border-color 0.4s ease;
    }
    .cw-tracker-card.done  { border-color:rgba(0,255,136,0.25); }
    .cw-tracker-card.error { border-color:rgba(255,77,109,0.25); }
    .cw-tracker-card.cancelled { border-color:rgba(150,150,180,0.18); opacity:0.8; }

    .cw-tracker-header {
      display:flex; align-items:center; gap:10px; padding:12px 16px;
      background:rgba(0,212,255,0.05); border-bottom:1px solid rgba(0,212,255,0.1);
    }
    .cw-tracker-icon-wrap {
      width:30px; height:30px; border-radius:8px; flex-shrink:0;
      background:rgba(0,212,255,0.1); border:1px solid rgba(0,212,255,0.2);
      display:flex; align-items:center; justify-content:center; font-size:14px;
    }
    .cw-tracker-title {
      font-size:0.76em; font-weight:700; color:#00d4ff; flex:1; letter-spacing:0.01em;
    }
    .cw-tracker-badge {
      font-size:0.6em; padding:2px 9px; border-radius:20px; font-weight:600;
      background:rgba(255,200,0,0.1); color:#ffc800; border:1px solid rgba(255,200,0,0.22);
      animation:cwBlink 2s ease-in-out infinite;
    }
    .cw-tracker-badge.done { background:rgba(0,255,136,0.1); color:#00ff88; border-color:rgba(0,255,136,0.22); animation:none; }
    .cw-tracker-badge.error { background:rgba(255,77,109,0.1); color:#ff4d6d; border-color:rgba(255,77,109,0.22); animation:none; }
    .cw-tracker-badge.cancelled { background:rgba(150,150,180,0.1); color:#9898aa; border-color:rgba(150,150,180,0.2); animation:none; }
    @keyframes cwBlink { 0%,100%{opacity:1} 50%{opacity:0.55} }

    .cw-tracker-body { padding:14px 16px; }
    .cw-tracker-prompt {
      font-size:0.72em; color:rgba(200,205,235,0.65); margin-bottom:16px;
      padding:8px 12px; border-left:2px solid rgba(0,212,255,0.3);
      border-radius:0 6px 6px 0; background:rgba(255,255,255,0.025);
      line-height:1.45; max-height:60px; overflow:hidden;
      display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical;
    }

    /* ── Vertical Stepper ── */
    .cw-stepper { display:flex; flex-direction:column; gap:0; }
    .cw-stepper-item {
      display:flex; gap:12px; position:relative;
      animation:cwStepIn 0.22s ease;
    }
    @keyframes cwStepIn { from{opacity:0;transform:translateY(-5px)} to{opacity:1;transform:translateY(0)} }

    /* Vertical connector line */
    .cw-step-connector {
      position:absolute; left:12px; top:28px; bottom:0; width:2px; border-radius:1px;
      background:linear-gradient(to bottom,rgba(0,212,255,0.25),rgba(0,212,255,0.04));
    }
    .cw-stepper-item.done > .cw-step-connector {
      background:linear-gradient(to bottom,rgba(0,255,136,0.35),rgba(0,255,136,0.06));
    }

    /* Step dot */
    .cw-step-dot {
      width:26px; height:26px; border-radius:50%; flex-shrink:0;
      display:flex; align-items:center; justify-content:center;
      font-size:11px; position:relative; z-index:1; margin-top:2px;
      transition:all 0.3s ease;
    }
    .cw-stepper-item.pending .cw-step-dot {
      background:rgba(255,255,255,0.03); border:1.5px dashed rgba(255,255,255,0.1);
      color:rgba(255,255,255,0.18);
    }
    .cw-stepper-item.running .cw-step-dot {
      background:rgba(255,200,0,0.1); border:1.5px solid rgba(255,200,0,0.45);
      color:#ffc800; box-shadow:0 0 14px rgba(255,200,0,0.25);
      animation:cwDotSpin 1.4s linear infinite;
    }
    @keyframes cwDotSpin {
      0%  {box-shadow:0 0 8px rgba(255,200,0,0.15);}
      50% {box-shadow:0 0 18px rgba(255,200,0,0.4);}
      100%{box-shadow:0 0 8px rgba(255,200,0,0.15);}
    }
    .cw-stepper-item.done .cw-step-dot {
      background:rgba(0,255,136,0.1); border:1.5px solid rgba(0,255,136,0.4);
      color:#00ff88; box-shadow:0 0 10px rgba(0,255,136,0.18);
    }
    .cw-stepper-item.error .cw-step-dot {
      background:rgba(255,77,109,0.1); border:1.5px solid rgba(255,77,109,0.4);
      color:#ff4d6d;
    }

    /* Step content */
    .cw-step-content { flex:1; min-width:0; padding:3px 0 16px; }
    .cw-stepper-item:last-child .cw-step-content { padding-bottom:0; }
    .cw-step-label { font-size:0.74em; font-weight:500; line-height:1.4; }
    .cw-stepper-item.pending .cw-step-label { color:rgba(200,205,235,0.22); }
    .cw-stepper-item.running .cw-step-label { color:#e4e4ef; }
    .cw-stepper-item.done    .cw-step-label { color:rgba(200,210,220,0.55); text-decoration:none; }
    .cw-stepper-item.error   .cw-step-label { color:#ff6b84; }

    .cw-step-cmd {
      font-size:0.62em; font-family:'Space Mono',monospace;
      color:rgba(180,185,215,0.3); margin-top:3px; line-height:1.4;
      max-height:32px; overflow:hidden;
    }
    .cw-stepper-item.running .cw-step-cmd { color:rgba(255,200,0,0.45); }

    /* Cancel + Summary */
    .cw-tracker-footer { padding:0 16px 14px; }
    .cw-tracker-cancel {
      width:100%; padding:8px 14px; border:1px solid rgba(255,77,109,0.2);
      border-radius:9px; background:rgba(255,77,109,0.05); color:rgba(255,77,109,0.65);
      font-size:0.68em; font-weight:600; cursor:pointer; transition:all 0.18s ease;
      display:flex; align-items:center; justify-content:center; gap:6px;
    }
    .cw-tracker-cancel:hover { background:rgba(255,77,109,0.12); color:#ff4d6d; border-color:rgba(255,77,109,0.35); }

    .cw-tracker-summary {
      margin:0 16px 14px; padding:11px 14px;
      background:rgba(0,255,136,0.05); border:1px solid rgba(0,255,136,0.14);
      border-radius:9px; font-size:0.72em; color:rgba(200,220,210,0.85); line-height:1.5;
    }
    .cw-tracker-summary.error {
      background:rgba(255,77,109,0.05); border-color:rgba(255,77,109,0.14); color:rgba(220,200,205,0.85);
    }
    .cw-tracker-summary.cancelled {
      background:rgba(150,150,180,0.05); border-color:rgba(150,150,180,0.14); color:rgba(200,200,215,0.6);
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
  var existing = document.getElementById('cwConfirmOverlay');
  if (existing) { _overlay = existing; return; }
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
          <button class="cwcm-btn cwcm-btn-confirm" onclick="window._cwModalRespond(true)">✓ Lancer la tâche</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(el);
  _overlay = el;
  el.addEventListener('click', function(e) {
    if (e.target === el) window._cwModalRespond(false);
  });
}

window._cwModalRespond = function(confirmed) {
  if (!_overlay) return;
  _overlay.classList.remove('open');
  if (_pendingResolve) { _pendingResolve(confirmed); _pendingResolve = null; }
};

function _showConfirmModal(action, deviceName) {
  _buildOverlay();
  var promptEl = document.getElementById('cwcmPrompt');
  var deviceEl = document.getElementById('cwcmDevice');
  if (!promptEl || !deviceEl) return Promise.resolve(false);
  promptEl.textContent = action.prompt || action.label || action.type || 'Action système';
  deviceEl.textContent = deviceName || 'Ce PC';
  if (!_overlay) return Promise.resolve(false);
  if (typeof window.toast === 'function') window.toast('⚡ CloudWorks — Confirmation requise', 'info');
  _overlay.classList.add('open');
  return new Promise(function(resolve) { _pendingResolve = resolve; });
}

/* ════════════════════════════════════════════════════════════
   TRACKER VERTICAL STEPPER
════════════════════════════════════════════════════════════ */
var _activeTrackers = {}; // cmdId → { unsub, lastStep, stepCount, startMs }

function _createTrackerCard(cmdId, prompt) {
  var card = document.createElement('div');
  card.className = 'cw-tracker-card';
  card.id = 'cwTracker-' + cmdId;
  card.innerHTML = `
    <div class="cw-tracker-header">
      <div class="cw-tracker-icon-wrap">⚙️</div>
      <span class="cw-tracker-title">CloudWorks Agent</span>
      <span class="cw-tracker-badge" id="cwts-${cmdId}">⟳ En cours</span>
    </div>
    <div class="cw-tracker-body">
      <div class="cw-tracker-prompt">${_esc(prompt || 'Tâche en cours...')}</div>
      <div class="cw-stepper" id="cwtSteps-${cmdId}"></div>
    </div>
    <div class="cw-tracker-footer">
      <button class="cw-tracker-cancel" onclick="window.cancelCloudWorksTask('${cmdId}')">
        ■ Arrêter la tâche
      </button>
    </div>
  `;
  return card;
}

function _addStep(cmdId, text, state, cmdText) {
  var stepperEl = document.getElementById('cwtSteps-' + cmdId);
  if (!stepperEl) return;

  // Marquer l'étape précédente comme terminée
  var prev = stepperEl.querySelector('.cw-stepper-item.running');
  if (prev) {
    prev.classList.remove('running');
    prev.classList.add('done');
    var prevDot = prev.querySelector('.cw-step-dot');
    if (prevDot) prevDot.textContent = '✓';
    // Ajouter/garder le connector
    var connector = prev.querySelector('.cw-step-connector');
    if (!connector) {
      connector = document.createElement('div');
      connector.className = 'cw-step-connector';
      prev.insertBefore(connector, prev.firstChild);
    }
  }

  var icon = state === 'done' ? '✓' : state === 'error' ? '✗' : '⟳';
  var item = document.createElement('div');
  item.className = 'cw-stepper-item ' + (state || 'running');

  var num = _activeTrackers[cmdId] ? ((_activeTrackers[cmdId].stepCount || 0) + 1) : 1;
  if (_activeTrackers[cmdId]) _activeTrackers[cmdId].stepCount = num;

  item.innerHTML = `
    <div class="cw-step-dot">${icon}</div>
    <div class="cw-step-content">
      <div class="cw-step-label">${_esc(text)}</div>
      ${cmdText ? '<div class="cw-step-cmd">' + _esc(cmdText.substring(0, 80)) + '</div>' : ''}
    </div>
  `;

  // Connector pour les étapes précédentes (sera retiré de la dernière)
  if (state === 'running' || state === 'pending') {
    // Pas de connector sur l'étape active (on le rajoutera quand elle sera done)
  }

  stepperEl.appendChild(item);
  // Scroll auto
  var chatArea = document.getElementById('messagesArea') || document.getElementById('chatMessages');
  if (chatArea) chatArea.scrollTop = chatArea.scrollHeight;
}

function _finalizeTracker(cmdId, result, status) {
  var card = document.getElementById('cwTracker-' + cmdId);
  if (!card) return;

  var badge = document.getElementById('cwts-' + cmdId);
  var titleEl = card.querySelector('.cw-tracker-title');
  var footer = card.querySelector('.cw-tracker-footer');

  // Finir la dernière étape running
  var stepperEl = document.getElementById('cwtSteps-' + cmdId);
  if (stepperEl) {
    var lastRunning = stepperEl.querySelector('.cw-stepper-item.running');
    if (lastRunning) {
      lastRunning.classList.remove('running');
      lastRunning.classList.add(status === 'done' ? 'done' : 'error');
      var dot = lastRunning.querySelector('.cw-step-dot');
      if (dot) dot.textContent = status === 'done' ? '✓' : '✗';
    }
  }

  // Badge + titre
  if (status === 'done') {
    card.classList.add('done');
    if (badge) { badge.textContent = '✓ Terminé'; badge.className = 'cw-tracker-badge done'; }
    if (titleEl) titleEl.textContent = 'CloudWorks — Terminé ✓';
  } else if (status === 'cancelled') {
    card.classList.add('cancelled');
    if (badge) { badge.textContent = '■ Annulé'; badge.className = 'cw-tracker-badge cancelled'; }
    if (titleEl) titleEl.textContent = 'CloudWorks — Arrêté';
  } else {
    card.classList.add('error');
    if (badge) { badge.textContent = '✗ Erreur'; badge.className = 'cw-tracker-badge error'; }
    if (titleEl) titleEl.textContent = 'CloudWorks — Erreur';
  }

  // Cacher le bouton Annuler
  if (footer) footer.style.display = 'none';

  // Résumé
  var summary = (result && (result.output || result.error || result.report)) || '';
  if (status === 'done' && !summary) summary = 'Tâche terminée avec succès.';
  if (status === 'cancelled' && !summary) summary = 'Tâche interrompue par l\'utilisateur.';
  if (status === 'error' && !summary) summary = 'Une erreur est survenue.';

  if (summary) {
    var summaryEl = document.createElement('div');
    summaryEl.className = 'cw-tracker-summary' + (status === 'error' ? ' error' : status === 'cancelled' ? ' cancelled' : '');
    summaryEl.textContent = summary.substring(0, 300) + (summary.length > 300 ? '…' : '');
    card.appendChild(summaryEl);
  }

  // Unsubscribe listener
  if (_activeTrackers[cmdId] && _activeTrackers[cmdId].unsub) {
    _activeTrackers[cmdId].unsub();
  }
  delete _activeTrackers[cmdId];

  // Désactiver le bouton stop (si plus aucune tâche active)
  var hasActiveTasks = Object.keys(_activeTrackers).length > 0;
  if (!hasActiveTasks) {
    if (window.S) window.S.cwRunning = false;
    _restoreInputState();
  }

  // Message de résumé EVA après 600ms
  setTimeout(function() {
    window.dispatchEvent(new CustomEvent('cw:generate-summary', {
      detail: { cmdId: cmdId, status: status, summary: summary, result: result }
    }));
  }, 600);
}

/* ════════════════════════════════════════════════════════════
   GESTION ÉTAT INPUT (bloquer/débloquer pendant la tâche)
════════════════════════════════════════════════════════════ */
function _blockInputForCW() {
  var sendBtn = document.getElementById('sendBtn');
  var stopBtn = document.getElementById('stopBtn');
  var input   = document.getElementById('msgInput');
  if (sendBtn) sendBtn.style.display = 'none';
  if (stopBtn) stopBtn.style.display = 'inline-flex';
  if (input)   input.setAttribute('data-cw-blocked', '1');
}

function _restoreInputState() {
  var sendBtn = document.getElementById('sendBtn');
  var stopBtn = document.getElementById('stopBtn');
  var input   = document.getElementById('msgInput');
  if (stopBtn) stopBtn.style.display = 'none';
  if (sendBtn) {
    sendBtn.style.display = 'inline-flex';
    var hasText = input && input.value.trim();
    sendBtn.disabled = !hasText;
  }
  if (input) input.removeAttribute('data-cw-blocked');
  if (window.S) window.S.busy = false;
}

/* ════════════════════════════════════════════════════════════
   ANNULATION D'UNE TÂCHE
════════════════════════════════════════════════════════════ */
window.cancelCloudWorksTask = function(cmdId) {
  if (!window.db || !window.S || !window.S.user) return;
  var uid = window.S.user.uid;
  console.log('[CW Tracker] Annulation demandée pour:', cmdId);
  window.db.collection('cloudworks').doc(uid).collection('commands').doc(cmdId)
    .update({ status: 'cancelled', updatedAt: window.timestamp ? window.timestamp() : new Date() })
    .then(function() {
      console.log('[CW Tracker] Annulation envoyée à Firestore');
    })
    .catch(function(e) {
      console.error('[CW Tracker] Erreur annulation:', e);
      // Finaliser localement même si Firestore échoue
      _finalizeTracker(cmdId, { error: 'Annulé localement' }, 'cancelled');
    });
};

/* ════════════════════════════════════════════════════════════
   API PUBLIQUE : cwConfirmAndExecute
════════════════════════════════════════════════════════════ */
window.cwConfirmAndExecute = async function(action) {
  var CW_TYPES = ['agentic_task', 'screenshot', 'sysinfo', 'run_script', 'lock', 'sleep', 'shutdown', 'open_ide_file'];
  if (CW_TYPES.indexOf(action.type) === -1) {
    if (typeof executeEvaAction === 'function') executeEvaAction(action);
    return;
  }
  var confirmed = await _showConfirmModal(action, 'Ce PC');
  if (!confirmed) return;
  if (typeof executeEvaAction === 'function') {
    console.log('[CW Modal] Confirmation OK — exécution:', action.type);
    executeEvaAction(action);
  } else {
    console.error('[CW Modal] executeEvaAction introuvable');
    if (typeof window.toast === 'function') window.toast('Erreur: executeEvaAction non défini', 'error');
  }
};

/* ════════════════════════════════════════════════════════════
   API PUBLIQUE : appendCloudWorksTracker
   Injecte le tracker dans le dernier message EVA + écoute Firestore
════════════════════════════════════════════════════════════ */
window.appendCloudWorksTracker = function(cmdId, prompt) {
  if (!window.db || !window.S || !window.S.user) return;
  var uid = window.S.user.uid;

  // Insérer dans le dernier message EVA
  var msgs = document.querySelectorAll('.message.eva, .msg-eva, [data-role="assistant"]');
  var lastMsg = msgs[msgs.length - 1];
  if (!lastMsg) {
    var chatEl = document.getElementById('messagesArea') || document.getElementById('chat') || document.getElementById('chatMessages');
    if (chatEl) {
      lastMsg = document.createElement('div');
      lastMsg.className = 'message eva';
      chatEl.appendChild(lastMsg);
    }
  }

  var card = _createTrackerCard(cmdId, prompt);
  if (lastMsg) lastMsg.appendChild(card);

  // Bloquer l'input et afficher le stop button
  _blockInputForCW();
  if (window.S) { window.S.cwRunning = true; window.S.busy = true; }

  // Écoute Firestore
  var tracker = { unsub: null, lastStep: null, stepCount: 0, startMs: Date.now() };
  _activeTrackers[cmdId] = tracker;

  tracker.unsub = window.db.collection('cloudworks').doc(uid).collection('commands').doc(cmdId)
    .onSnapshot(function(doc) {
      var d = doc.data();
      if (!d) return;

      // Nouvelle étape
      if (d.step && d.step !== tracker.lastStep) {
        tracker.lastStep = d.step;
        var isActive = (d.status !== 'done' && d.status !== 'error' && d.status !== 'cancelled');
        _addStep(cmdId, d.step, isActive ? 'running' : 'done', d.lastCmd || null);
      }

      // Terminé
      if (d.status === 'done' || d.status === 'error' || d.status === 'cancelled') {
        // Afficher les étapes manquantes
        if (d.result && d.result.steps && Array.isArray(d.result.steps)) {
          d.result.steps.forEach(function(s) {
            var text = typeof s === 'string' ? s : (s.text || JSON.stringify(s));
            if (text !== tracker.lastStep) _addStep(cmdId, text, 'done');
          });
        }
        _finalizeTracker(cmdId, d.result, d.status);
      }
    }, function(err) {
      console.error('[CW Tracker] Erreur listener:', err);
      _finalizeTracker(cmdId, { error: err.message }, 'error');
    });
};

/* ════════════════════════════════════════════════════════════
   setIsGenerating — permet à d'autres modules de contrôler l'état
════════════════════════════════════════════════════════════ */
window.setIsGenerating = function(active) {
  if (active) {
    _blockInputForCW();
  } else if (!window.S || !window.S.cwRunning) {
    _restoreInputState();
  }
};

/* ════════════════════════════════════════════════════════════
   MESSAGE DE RÉSUMÉ EVA après CloudWorks
════════════════════════════════════════════════════════════ */
window.addEventListener('cw:generate-summary', function(e) {
  var detail = e.detail;
  var status  = detail.status;
  var summary = detail.summary || '';
  var result  = detail.result || {};

  // Construire le rapport final
  var reportText = result.report || result.output || summary || '';
  var msg = '';
  if (status === 'done') {
    msg = reportText
      ? '✅ **Tâche CloudWorks terminée**\n\n' + reportText + '\n\nSouhaites-tu que je fasse autre chose ?'
      : '✅ **Tâche CloudWorks terminée avec succès.** Souhaites-tu que je fasse autre chose ?';
  } else if (status === 'cancelled') {
    msg = '■ **Tâche arrêtée** par l\'utilisateur. La tâche a été interrompue. Dis-moi si tu veux relancer ou modifier la demande.';
  } else {
    msg = '⚠️ **Erreur CloudWorks**\n\n' + (summary || 'Une erreur inconnue est survenue.') + '\n\nVeux-tu que je réessaie ?';
  }

  // Injecter dans le chat
  if (typeof window.streamEvaMsg === 'function') {
    window.streamEvaMsg(msg);
  } else if (typeof window.addMessage === 'function') {
    window.addMessage('assistant', msg);
  }
});

/* Patch du stopBtn pour gérer aussi l'annulation CloudWorks */
(function() {
  var maxTry = 20, n = 0;
  var t = setInterval(function() {
    n++;
    if (n > maxTry) { clearInterval(t); return; }
    var stopBtn = document.getElementById('stopBtn');
    if (!stopBtn) return;
    clearInterval(t);
    stopBtn.addEventListener('click', function() {
      if (window.S && window.S.cwRunning) {
        // Annuler la tâche CloudWorks active
        var activeIds = Object.keys(_activeTrackers);
        if (activeIds.length > 0) {
          activeIds.forEach(function(cmdId) { window.cancelCloudWorksTask(cmdId); });
        }
      } else {
        // Arrêter la génération normale
        if (typeof window.stopGeneration === 'function') window.stopGeneration();
      }
    }, true); // capture phase pour intercepter avant d'autres handlers
  }, 300);
})();

function _esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

console.log('[CW Modal] Chargé v2 ✓ — Stepper vertical + sync annulation');
})();
