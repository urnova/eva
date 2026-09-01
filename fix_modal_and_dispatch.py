import sys
sys.stdout.reconfigure(encoding='utf-8')

# ════════════════════════════════════════
# FIX cw-modal.js:
# 1. Bug: _overlay = stale reference après navigation SPA
# 2. Toujours relire depuis le DOM au lieu du cache
# 3. Toast "⚡ Action CloudWorks détectée" avant le modal
# 4. Log console pour tracer
# ════════════════════════════════════════
with open(r'eva-pc/web/js/features/cw-modal.js', 'r', encoding='utf-8', errors='replace') as f:
    cm = f.read()

OLD_BUILD = """function _buildOverlay() {
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
}"""

NEW_BUILD = """function _buildOverlay() {
  // Toujours relire depuis le DOM pour éviter les références obsolètes (SPA navigation)
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
          <button class="cwcm-btn cwcm-btn-confirm" onclick="window._cwModalRespond(true)">✓ Valider</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(el);
  _overlay = el;

  // Fermer en cliquant à l'extérieur du box uniquement
  el.addEventListener('click', function(e) {
    if (e.target === el) window._cwModalRespond(false);
  });
}"""

if OLD_BUILD in cm:
    cm = cm.replace(OLD_BUILD, NEW_BUILD, 1)
    print('FIX 1: _buildOverlay stale reference fixed')
else:
    print('WARN: _buildOverlay pattern not found')

OLD_SHOW = """function _showConfirmModal(action, deviceName) {
  _buildOverlay();
  document.getElementById('cwcmPrompt').textContent =
    action.prompt || action.label || action.type || 'Action système';
  document.getElementById('cwcmDevice').textContent = deviceName || 'Ce PC';
  _overlay.classList.add('open');
  return new Promise(function(resolve) {
    _pendingResolve = resolve;
  });
}"""

NEW_SHOW = """function _showConfirmModal(action, deviceName) {
  _buildOverlay();

  var promptEl = document.getElementById('cwcmPrompt');
  var deviceEl = document.getElementById('cwcmDevice');
  if (!promptEl || !deviceEl) {
    console.error('[CW Modal] Éléments du modal introuvables — abandon');
    return Promise.resolve(false);
  }

  promptEl.textContent = action.prompt || action.label || action.type || 'Action système';
  deviceEl.textContent = deviceName || 'Ce PC';

  if (!_overlay) {
    console.error('[CW Modal] _overlay null après _buildOverlay');
    return Promise.resolve(false);
  }

  // Toast de notification AVANT le modal pour alerter l'utilisateur
  if (typeof window.toast === 'function') {
    window.toast('⚡ CloudWorks — Confirmation requise', 'info');
  }
  console.log('[CW Modal] Affichage modal pour action:', action.type, action.prompt);

  _overlay.classList.add('open');
  return new Promise(function(resolve) {
    _pendingResolve = resolve;
  });
}"""

if OLD_SHOW in cm:
    cm = cm.replace(OLD_SHOW, NEW_SHOW, 1)
    print('FIX 2: _showConfirmModal — null check, toast, console log')
else:
    print('WARN: _showConfirmModal pattern not found')

# FIX 3: cwConfirmAndExecute — add toast on execution + log trace
OLD_CONFIRM = """  // Exécuter via executeEvaAction (définie dans file-gen.js)
  if (typeof executeEvaAction === 'function') {
    executeEvaAction(action);
  }
};"""

NEW_CONFIRM = """  // Exécuter via executeEvaAction (définie dans file-gen.js)
  if (typeof executeEvaAction === 'function') {
    console.log('[CW Modal] Confirmation OK — exécution de:', action.type);
    executeEvaAction(action);
  } else {
    console.error('[CW Modal] executeEvaAction introuvable — action non exécutée');
    if (typeof window.toast === 'function') window.toast('Erreur: executeEvaAction non défini', 'error');
  }
};"""

if OLD_CONFIRM in cm:
    cm = cm.replace(OLD_CONFIRM, NEW_CONFIRM, 1)
    print('FIX 3: cwConfirmAndExecute — trace + error handling')
else:
    print('WARN: cwConfirmAndExecute end pattern not found')

# Also log when action IS detected in file-gen dispatch
with open(r'eva-pc/web/js/app/file-gen.js', 'r', encoding='utf-8', errors='replace') as f:
    fg = f.read()

OLD_DISPATCH = """    } else if (action && _cwActionTypes.indexOf(action.type) !== -1 && typeof window.cwConfirmAndExecute === 'function') {
      /* Actions CloudWorks : passer par le modal de confirmation */
      window.cwConfirmAndExecute(action);
    } else {"""

NEW_DISPATCH = """    } else if (action && _cwActionTypes.indexOf(action.type) !== -1) {
      /* Actions CloudWorks : passer par le modal de confirmation */
      console.log('[file-gen] Action CloudWorks détectée:', action.type, action.prompt || '');
      if (typeof window.cwConfirmAndExecute === 'function') {
        window.cwConfirmAndExecute(action);
      } else {
        console.error('[file-gen] cwConfirmAndExecute non défini — exécution directe');
        executeEvaAction(action);
      }
    } else {"""

if OLD_DISPATCH in fg:
    fg = fg.replace(OLD_DISPATCH, NEW_DISPATCH, 1)
    print('FIX 4: file-gen dispatch — always execute even if modal missing, add log')
else:
    print('WARN: file-gen dispatch pattern not found')

with open(r'eva-pc/web/js/features/cw-modal.js', 'w', encoding='utf-8') as f:
    f.write(cm)
with open(r'eva-pc/web/js/app/file-gen.js', 'w', encoding='utf-8') as f:
    f.write(fg)

print('cw-modal.js and file-gen.js saved')
