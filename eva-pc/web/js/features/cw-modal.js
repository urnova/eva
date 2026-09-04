/* ════════════════════════════════════════════════════════════════
   CW-MODAL.JS  —  CloudWorks Modal + Stepper Tracker (ORANGE UI)
   EVA — Application PC & Web
   
   Fournit :
   • Validation inline (dans le chat) avant exécution d'une action CW
   • Tracker vertical "stepper" dans le chat pendant la tâche
   • Bouton d'annulation dans le tracker (synchronisé Firestore)
   • Message de résumé EVA après la fin de la tâche
════════════════════════════════════════════════════════════════ */
(function() {
'use strict';

/* ── Injection CSS (Thème Orange) ───────────────────────── */
(function() {
  var s = document.createElement('style');
  s.textContent = `
    /* ─── Tracker Stepper & Modal Inline ─── */
    .cw-tracker-card {
      margin:12px 0; background:linear-gradient(145deg,rgba(28,15,10,0.96),rgba(38,20,12,0.92));
      border:1px solid rgba(255,136,0,0.25); border-radius:16px; overflow:hidden;
      font-family:'Inter','Space Grotesk',system-ui,sans-serif;
      box-shadow:0 4px 24px rgba(0,0,0,0.35),0 0 0 1px rgba(255,255,255,0.03);
      transition:border-color 0.4s ease;
    }
    .cw-tracker-card.done  { border-color:rgba(0,255,136,0.25); }
    .cw-tracker-card.error { border-color:rgba(255,77,109,0.25); }
    .cw-tracker-card.cancelled { border-color:rgba(150,150,180,0.18); opacity:0.8; }
    .cw-tracker-card.pending_approval { border-color:rgba(255,136,0,0.5); box-shadow:0 0 20px rgba(255,136,0,0.15); }

    .cw-tracker-header {
      display:flex; align-items:center; gap:10px; padding:12px 16px;
      background:rgba(255,136,0,0.08); border-bottom:1px solid rgba(255,136,0,0.15);
    }
    .cw-tracker-icon-wrap {
      width:30px; height:30px; border-radius:8px; flex-shrink:0;
      background:rgba(255,136,0,0.15); border:1px solid rgba(255,136,0,0.3);
      display:flex; align-items:center; justify-content:center; font-size:14px;
    }
    .cw-tracker-title {
      font-size:0.76em; font-weight:700; color:#ff9900; flex:1; letter-spacing:0.01em;
    }
    .cw-tracker-badge {
      font-size:0.6em; padding:2px 9px; border-radius:20px; font-weight:600;
      background:rgba(255,200,0,0.1); color:#ffc800; border:1px solid rgba(255,200,0,0.22);
    }
    .cw-tracker-badge.running { animation:cwBlink 2s ease-in-out infinite; }
    .cw-tracker-badge.pending { background:rgba(255,136,0,0.15); color:#ff8800; border-color:rgba(255,136,0,0.3); animation:cwBlink 1.5s ease-in-out infinite; }
    .cw-tracker-badge.done { background:rgba(0,255,136,0.1); color:#00ff88; border-color:rgba(0,255,136,0.22); animation:none; }
    .cw-tracker-badge.error { background:rgba(255,77,109,0.1); color:#ff4d6d; border-color:rgba(255,77,109,0.22); animation:none; }
    .cw-tracker-badge.cancelled { background:rgba(150,150,180,0.1); color:#9898aa; border-color:rgba(150,150,180,0.2); animation:none; }
    @keyframes cwBlink { 0%,100%{opacity:1} 50%{opacity:0.55} }

    .cw-tracker-body { padding:14px 16px; }
    .cw-tracker-prompt {
      font-size:0.72em; color:rgba(255,230,200,0.75); margin-bottom:16px;
      padding:8px 12px; border-left:2px solid rgba(255,136,0,0.4);
      border-radius:0 6px 6px 0; background:rgba(255,136,0,0.04);
      line-height:1.45; max-height:60px; overflow:hidden;
      display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical;
    }

    /* ── Inline Approval UI ── */
    .cw-approval-ui {
      background:rgba(0,0,0,0.2); border:1px solid rgba(255,136,0,0.15);
      border-radius:10px; padding:14px; margin-bottom:12px;
    }
    .cw-approval-text { font-size:0.7em; color:#ffaa33; margin-bottom:10px; text-align:center; font-weight:600; }
    .cw-approval-device { font-size:0.65em; color:rgba(255,255,255,0.4); text-align:center; margin-bottom:14px; }
    .cw-approval-device span { color:#ff8800; background:rgba(255,136,0,0.1); padding:2px 6px; border-radius:4px; border:1px solid rgba(255,136,0,0.2); }
    .cw-approval-actions { display:flex; gap:10px; }
    .cw-approval-btn {
      flex:1; padding:8px 0; border:none; border-radius:8px; cursor:pointer;
      font-size:0.72em; font-weight:600; transition:all 0.15s ease;
    }
    .cw-approval-btn.accept { background:linear-gradient(135deg,#ff8800,#dd6600); color:#fff; }
    .cw-approval-btn.accept:hover { opacity:0.9; box-shadow:0 4px 12px rgba(255,136,0,0.3); }
    .cw-approval-btn.reject { background:rgba(255,77,109,0.1); color:#ff4d6d; border:1px solid rgba(255,77,109,0.3); }
    .cw-approval-btn.reject:hover { background:rgba(255,77,109,0.2); }

    /* ── Vertical Stepper ── */
    .cw-stepper { display:flex; flex-direction:column; gap:0; }
    .cw-stepper-item {
      display:flex; gap:12px; position:relative;
      animation:cwStepIn 0.22s ease;
    }
    @keyframes cwStepIn { from{opacity:0;transform:translateY(-5px)} to{opacity:1;transform:translateY(0)} }

    .cw-step-connector {
      position:absolute; left:12px; top:28px; bottom:0; width:2px; border-radius:1px;
      background:linear-gradient(to bottom,rgba(255,136,0,0.3),rgba(255,136,0,0.05));
    }
    .cw-stepper-item.done > .cw-step-connector {
      background:linear-gradient(to bottom,rgba(0,255,136,0.35),rgba(0,255,136,0.06));
    }

    .cw-step-dot {
      width:26px; height:26px; border-radius:50%; flex-shrink:0;
      display:flex; align-items:center; justify-content:center;
      font-size:11px; position:relative; z-index:1; margin-top:2px;
      transition:all 0.3s ease;
    }
    .cw-stepper-item.pending .cw-step-dot {
      background:rgba(255,255,255,0.03); border:1.5px dashed rgba(255,255,255,0.1); color:rgba(255,255,255,0.18);
    }
    .cw-stepper-item.running .cw-step-dot {
      background:rgba(255,136,0,0.1); border:1.5px solid rgba(255,136,0,0.45);
      color:#ff8800; box-shadow:0 0 14px rgba(255,136,0,0.25);
      animation:cwDotSpin 1.4s linear infinite;
    }
    @keyframes cwDotSpin {
      0%  {box-shadow:0 0 8px rgba(255,136,0,0.15);}
      50% {box-shadow:0 0 18px rgba(255,136,0,0.4);}
      100%{box-shadow:0 0 8px rgba(255,136,0,0.15);}
    }
    .cw-stepper-item.done .cw-step-dot {
      background:rgba(0,255,136,0.1); border:1.5px solid rgba(0,255,136,0.4); color:#00ff88; box-shadow:0 0 10px rgba(0,255,136,0.18);
    }
    .cw-stepper-item.error .cw-step-dot {
      background:rgba(255,77,109,0.1); border:1.5px solid rgba(255,77,109,0.4); color:#ff4d6d;
    }

    .cw-step-content { flex:1; min-width:0; padding:3px 0 16px; }
    .cw-stepper-item:last-child .cw-step-content { padding-bottom:0; }
    .cw-step-label { font-size:0.74em; font-weight:500; line-height:1.4; }
    .cw-stepper-item.pending .cw-step-label { color:rgba(255,230,200,0.3); }
    .cw-stepper-item.running .cw-step-label { color:#ffe0b2; }
    .cw-stepper-item.done    .cw-step-label { color:rgba(255,230,200,0.6); text-decoration:none; }
    .cw-stepper-item.error   .cw-step-label { color:#ff6b84; }

    .cw-step-cmd {
      font-size:0.62em; font-family:'Space Mono',monospace;
      color:rgba(255,200,150,0.3); margin-top:3px; line-height:1.4;
      max-height:32px; overflow:hidden;
    }
    .cw-stepper-item.running .cw-step-cmd { color:rgba(255,136,0,0.5); }

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
   TRACKER VERTICAL STEPPER & INLINE CONFIRMATION
════════════════════════════════════════════════════════════ */
var _activeTrackers = {};
var _pendingResolve = null;

function _esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function _getOrAppendTargetBubble() {
  var msgs = document.querySelectorAll('.message.eva, .msg-eva, [data-role="assistant"]');
  var lastMsg = msgs[msgs.length - 1];
  if (!lastMsg) {
    var chatEl = document.getElementById('messagesArea') || document.getElementById('chatMessages') || document.getElementById('chat');
    if (chatEl) {
      lastMsg = document.createElement('div');
      lastMsg.className = 'message eva';
      chatEl.appendChild(lastMsg);
    }
  }
  return lastMsg;
}

function _generateTempId() {
  return 'cw-temp-' + Math.random().toString(36).substr(2, 9);
}

function _showConfirmModalInline(action, deviceName) {
  var tempId = _generateTempId();
  var card = document.createElement('div');
  card.className = 'cw-tracker-card pending_approval';
  card.id = 'cwTracker-' + tempId;
  
  var promptText = action.prompt || action.label || action.type || 'Action système';
  
  card.innerHTML = `
    <div class="cw-tracker-header">
      <div class="cw-tracker-icon-wrap">⚙️</div>
      <span class="cw-tracker-title">CloudWorks Agent</span>
      <span class="cw-tracker-badge pending" id="cwts-${tempId}">? En attente</span>
    </div>
    <div class="cw-tracker-body">
      <div class="cw-tracker-prompt">${_esc(promptText)}</div>
      
      <div class="cw-approval-ui" id="cwApproveUI-${tempId}">
        <div class="cw-approval-text">Validation requise</div>
        <div class="cw-approval-device">Cible : <span>${_esc(deviceName)}</span></div>
        <div class="cw-approval-actions">
          <button class="cw-approval-btn reject" onclick="window._cwModalRespond(false, '${tempId}')">✗ Refuser</button>
          <button class="cw-approval-btn accept" onclick="window._cwModalRespond(true, '${tempId}')">✓ Accepter</button>
        </div>
      </div>

      <div class="cw-stepper" id="cwtSteps-${tempId}"></div>
    </div>
    <div class="cw-tracker-footer" id="cwFooter-${tempId}" style="display:none;">
      <button class="cw-tracker-cancel" onclick="window.cancelCloudWorksTask('${tempId}')">
        ■ Arrêter la tâche
      </button>
    </div>
  `;

  var lastMsg = _getOrAppendTargetBubble();
  if (lastMsg) {
    lastMsg.appendChild(card);
    var chatArea = document.getElementById('messagesArea') || document.getElementById('chatMessages');
    if (chatArea) chatArea.scrollTop = chatArea.scrollHeight;
  }

  if (typeof window.toast === 'function') window.toast('⚡ CloudWorks — Confirmation requise', 'info');
  return new Promise(function(resolve) { _pendingResolve = resolve; });
}

window._cwModalRespond = function(confirmed, tempId) {
  var card = document.getElementById('cwTracker-' + tempId);
  if (card) {
    if (!confirmed) {
      card.classList.remove('pending_approval');
      card.classList.add('cancelled');
      var badge = document.getElementById('cwts-' + tempId);
      if (badge) { badge.textContent = '■ Annulé'; badge.className = 'cw-tracker-badge cancelled'; }
      var ui = document.getElementById('cwApproveUI-' + tempId);
      if (ui) ui.style.display = 'none';
      
      var summaryEl = document.createElement('div');
      summaryEl.className = 'cw-tracker-summary cancelled';
      summaryEl.textContent = 'Action annulée avant exécution.';
      card.appendChild(summaryEl);
    } else {
      var ui = document.getElementById('cwApproveUI-' + tempId);
      if (ui) ui.style.display = 'none';
      card.remove(); 
    }
  }

  if (_pendingResolve) { 
    _pendingResolve(confirmed); 
    _pendingResolve = null; 
  }
};

/* ════════════════════════════════════════════════════════════
   GESTION ÉTAT INPUT
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

window.setIsGenerating = function(active) {
  if (active) {
    _blockInputForCW();
  } else if (!window.S || !window.S.cwRunning) {
    _restoreInputState();
  }
};

/* ════════════════════════════════════════════════════════════
   ANNULATION D'UNE TÂCHE
════════════════════════════════════════════════════════════ */
window.cancelCloudWorksTask = function(cmdId) {
  if (!window.db || !window.S || !window.S.user) return;
  var uid = window.S.user.uid;
  window.db.collection('cloudworks').doc(uid).collection('commands').doc(cmdId)
    .update({ status: 'cancelled', updatedAt: window.timestamp ? window.timestamp() : new Date() })
    .catch(function(e) {
      console.error('[CW Tracker] Erreur annulation:', e);
      _finalizeTracker(cmdId, { error: 'Annulé localement' }, 'cancelled');
    });
};

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
        var activeIds = Object.keys(_activeTrackers);
        if (activeIds.length > 0) activeIds.forEach(window.cancelCloudWorksTask);
      } else {
        if (typeof window.stopGeneration === 'function') window.stopGeneration();
      }
    }, true);
  }, 300);
})();

/* ════════════════════════════════════════════════════════════
   API PUBLIQUE : cwConfirmAndExecute
════════════════════════════════════════════════════════════ */
window.cwConfirmAndExecute = async function(action) {
  var CW_TYPES = ['agentic_task', 'screenshot', 'sysinfo', 'run_script', 'lock', 'sleep', 'shutdown', 'open_ide_file'];
  if (CW_TYPES.indexOf(action.type) === -1) {
    if (typeof executeEvaAction === 'function') executeEvaAction(action);
    return;
  }
  
  var isRemote = window.location.href.includes('app.eva') || window.location.href.includes('127.0.0.1');
  var targetName = isRemote ? 'CloudWorks à distance (PC)' : 'Ce PC';

  var confirmed = await _showConfirmModalInline(action, targetName);
  if (!confirmed) return;

  if (typeof executeEvaAction === 'function') {
    executeEvaAction(action);
  } else {
    console.error('[CW Modal] executeEvaAction introuvable');
  }
};

/* ════════════════════════════════════════════════════════════
   API PUBLIQUE : appendCloudWorksTracker
════════════════════════════════════════════════════════════ */
function _createTrackerCard(cmdId, prompt) {
  var card = document.createElement('div');
  card.className = 'cw-tracker-card';
  card.id = 'cwTracker-' + cmdId;
  card.innerHTML = `
    <div class="cw-tracker-header">
      <div class="cw-tracker-icon-wrap">⚙️</div>
      <span class="cw-tracker-title">CloudWorks Agent</span>
      <span class="cw-tracker-badge running" id="cwts-${cmdId}">⟳ En cours</span>
    </div>
    <div class="cw-tracker-body">
      <div class="cw-tracker-prompt">${_esc(prompt || 'Tâche en cours...')}</div>
      <div class="cw-stepper" id="cwtSteps-${cmdId}"></div>
    </div>
    <div class="cw-tracker-footer" id="cwFooter-${cmdId}">
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
  var prev = stepperEl.querySelector('.cw-stepper-item.running');
  if (prev) {
    prev.classList.remove('running'); prev.classList.add('done');
    var prevDot = prev.querySelector('.cw-step-dot');
    if (prevDot) prevDot.textContent = '✓';
    if (!prev.querySelector('.cw-step-connector')) {
      var connector = document.createElement('div');
      connector.className = 'cw-step-connector';
      prev.insertBefore(connector, prev.firstChild);
    }
  }
  var icon = state === 'done' ? '✓' : state === 'error' ? '✗' : '⟳';
  var item = document.createElement('div');
  item.className = 'cw-stepper-item ' + (state || 'running');
  if (_activeTrackers[cmdId]) _activeTrackers[cmdId].stepCount = (_activeTrackers[cmdId].stepCount || 0) + 1;
  item.innerHTML = `
    <div class="cw-step-dot">${icon}</div>
    <div class="cw-step-content">
      <div class="cw-step-label">${_esc(text)}</div>
      ${cmdText ? '<div class="cw-step-cmd">' + _esc(cmdText.substring(0, 80)) + '</div>' : ''}
    </div>
  `;
  stepperEl.appendChild(item);
  var chatArea = document.getElementById('messagesArea') || document.getElementById('chatMessages');
  if (chatArea) chatArea.scrollTop = chatArea.scrollHeight;
}

function _finalizeTracker(cmdId, result, status) {
  var card = document.getElementById('cwTracker-' + cmdId);
  if (!card) return;
  var badge = document.getElementById('cwts-' + cmdId);
  var titleEl = card.querySelector('.cw-tracker-title');
  var footer = document.getElementById('cwFooter-' + cmdId);

  var stepperEl = document.getElementById('cwtSteps-' + cmdId);
  if (stepperEl) {
    var lastRunning = stepperEl.querySelector('.cw-stepper-item.running');
    if (lastRunning) {
      lastRunning.classList.remove('running'); lastRunning.classList.add(status === 'done' ? 'done' : 'error');
      var dot = lastRunning.querySelector('.cw-step-dot');
      if (dot) dot.textContent = status === 'done' ? '✓' : '✗';
    }
  }

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

  if (footer) footer.style.display = 'none';

  var summary = (result && (result.output || result.error || result.report)) || '';
  if (status === 'done' && !summary) summary = 'Tâche terminée avec succès.';
  if (status === 'cancelled' && !summary) summary = "Tâche interrompue par l'utilisateur.";
  if (status === 'error' && !summary) summary = 'Une erreur est survenue.';

  if (summary) {
    var summaryEl = document.createElement('div');
    summaryEl.className = 'cw-tracker-summary' + (status === 'error' ? ' error' : status === 'cancelled' ? ' cancelled' : '');
    summaryEl.textContent = summary.substring(0, 300) + (summary.length > 300 ? '…' : '');
    card.appendChild(summaryEl);
  }

  if (_activeTrackers[cmdId] && _activeTrackers[cmdId].unsub) _activeTrackers[cmdId].unsub();
  delete _activeTrackers[cmdId];

  if (Object.keys(_activeTrackers).length === 0) {
    if (window.S) window.S.cwRunning = false;
    _restoreInputState();
  }

  setTimeout(function() {
    window.dispatchEvent(new CustomEvent('cw:generate-summary', { detail: { cmdId: cmdId, status: status, summary: summary, result: result } }));
  }, 600);
}

window.addEventListener('cw:task-start', function(e) {
  var d = e.detail;
  if (!d || !d.cmdId) return;
  if (!document.getElementById('cwTracker-' + d.cmdId)) {
    window.appendCloudWorksTracker(d.cmdId, d.prompt || 'Tâche CloudWorks à distance');
    var badge = document.getElementById('cwts-' + d.cmdId);
    if (badge) badge.textContent = '⟳ Distant';
  }
});

window.appendCloudWorksTracker = function(cmdId, prompt) {
  if (!window.db || !window.S || !window.S.user) return;
  var uid = window.S.user.uid;

  var lastMsg = _getOrAppendTargetBubble();
  var card = _createTrackerCard(cmdId, prompt);
  lastMsg.appendChild(card);

  _blockInputForCW();
  if (window.S) { window.S.cwRunning = true; window.S.busy = true; }

  var tracker = { unsub: null, lastStep: null, stepCount: 0, startMs: Date.now() };
  _activeTrackers[cmdId] = tracker;

  tracker.unsub = window.db.collection('cloudworks').doc(uid).collection('commands').doc(cmdId)
    .onSnapshot(function(doc) {
      var d = doc.data();
      if (!d) return;

      if (d.step && d.step !== tracker.lastStep) {
        tracker.lastStep = d.step;
        var isActive = (d.status !== 'done' && d.status !== 'error' && d.status !== 'cancelled');
        _addStep(cmdId, d.step, isActive ? 'running' : 'done', d.lastCmd || null);
      }

      if (d.status === 'done' || d.status === 'error' || d.status === 'cancelled') {
        if (d.result && d.result.steps && Array.isArray(d.result.steps)) {
          d.result.steps.forEach(function(s) {
            var text = typeof s === 'string' ? s : (s.text || JSON.stringify(s));
            if (text !== tracker.lastStep) _addStep(cmdId, text, 'done');
          });
        }
        _finalizeTracker(cmdId, d.result, d.status);
      }
    }, function(err) {
      _finalizeTracker(cmdId, { error: err.message }, 'error');
    });
};

/* ════════════════════════════════════════════════════════════
   MESSAGE DE RÉSUMÉ EVA
════════════════════════════════════════════════════════════ */
window.addEventListener('cw:generate-summary', function(e) {
  var detail = e.detail;
  var status  = detail.status;
  var summary = detail.summary || '';
  var result  = detail.result || {};

  var reportText = result.report || result.output || summary || '';
  var msg = '';
  if (status === 'done') {
    msg = reportText
      ? "✅ **Tâche CloudWorks terminée**\n\n" + reportText + "\n\nSouhaites-tu que je fasse autre chose ?"
      : "✅ **Tâche CloudWorks terminée avec succès.** Souhaites-tu que je fasse autre chose ?";
  } else if (status === 'cancelled') {
    msg = "■ **Tâche arrêtée** par l'utilisateur. Dis-moi si tu veux relancer.";
  } else {
    msg = "⚠️ **Erreur CloudWorks**\n\n" + (summary || "Erreur inconnue.") + "\n\nVeux-tu que je réessaie ?";
  }

  if (typeof window.streamEvaMsg === 'function') window.streamEvaMsg(msg);
  else if (typeof window.addMessage === 'function') window.addMessage('assistant', msg);
});

console.log('[CW Modal] Chargé v3 ✓ — UI Orange & Inline Approvals');
})();
