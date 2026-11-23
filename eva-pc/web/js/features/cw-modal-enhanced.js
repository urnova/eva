/* =================================================================
   CW-MODAL-ENHANCED.JS — Interface modale CloudWorks v5.6
   Affiche les 10 états, le plan avant validation, l'historique.
   Remplace cw-modal.js (l'ancien modal reste en fallback).
   ================================================================= */
(function() {
'use strict';

/* ───────────────────────────────────────────
   COULEURS PAR ÉTAT
─────────────────────────────────────────── */
var STATE_UI = {
  queued:        { icon: '⏳', label: 'En file',     color: '#88889a', bg: 'rgba(136,136,154,0.12)' },
  running:       { icon: '🧠', label: 'Réflexion…',  color: '#00d4ff', bg: 'rgba(0,212,255,0.08)',  anim: true },
  executing:     { icon: '⚡', label: 'Exécution…',  color: '#ffc800', bg: 'rgba(255,200,0,0.08)',  anim: true },
  waiting_user:  { icon: '🔔', label: 'Attente',     color: '#f97316', bg: 'rgba(249,115,22,0.10)' },
  succeeded:     { icon: '✅', label: 'Réussi',      color: '#00ff88', bg: 'rgba(0,255,136,0.08)'  },
  partial:       { icon: '⚠️', label: 'Partiel',     color: '#ffc800', bg: 'rgba(255,200,0,0.08)'  },
  failed:        { icon: '❌', label: 'Échoué',      color: '#ff4d6d', bg: 'rgba(255,77,109,0.08)' },
  cancelled:     { icon: '🚫', label: 'Annulé',      color: '#88889a', bg: 'rgba(136,136,154,0.08)'},
  expired:       { icon: '⌛', label: 'Expiré',      color: '#88889a', bg: 'rgba(136,136,154,0.08)'},
  indeterminate: { icon: '❓', label: 'Indéterminé', color: '#ffc800', bg: 'rgba(255,200,0,0.06)',  anim: true }
};

function esc(s) {
  return String(s)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

/* ───────────────────────────────────────────
   BADGE D'ÉTAT
─────────────────────────────────────────── */
function renderStateBadge(state) {
  var ui = STATE_UI[state] || STATE_UI.indeterminate;
  var animClass = ui.anim ? ' cw-badge-anim' : '';
  return (
    '<span class="cw-state-badge' + animClass + '" style="' +
    'color:' + ui.color + ';' +
    'background:' + ui.bg + ';' +
    'border:1px solid ' + ui.color + '44;' +
    'padding:3px 10px;border-radius:20px;font-size:0.72em;font-weight:700;display:inline-flex;align-items:center;gap:5px;">' +
    ui.icon + ' ' + ui.label +
    '</span>'
  );
}

/* ───────────────────────────────────────────
   TRACKER CARD — carte de tâche
─────────────────────────────────────────── */
function createTrackerCard(task) {
  var card = document.createElement('div');
  card.className = 'cw-tracker-card cw-enhanced';
  card.dataset.taskId = task.id;
  card.style.cssText = 'border:1px solid rgba(0,212,255,0.15);border-radius:12px;padding:14px;background:rgba(0,0,0,0.3);margin-bottom:10px;';

  card.innerHTML = _buildCardHTML(task);
  return card;
}

function _buildCardHTML(task) {
  var ui = STATE_UI[task.state] || STATE_UI.indeterminate;
  return (
    '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">' +
      '<span style="font-size:1.2em;">' + ui.icon + '</span>' +
      '<span style="flex:1;font-size:0.82em;font-weight:600;color:#e4e4ef;" class="cw-card-prompt">' + esc(task.prompt.substring(0, 80)) + '</span>' +
      '<span class="cw-card-state">' + renderStateBadge(task.state) + '</span>' +
    '</div>' +
    '<div class="cw-card-thoughts" style="margin-bottom:8px;"></div>' +
    '<div class="cw-card-steps" style="margin-bottom:8px;"></div>' +
    '<div class="cw-card-approval" style="margin-bottom:8px;"></div>' +
    '<div class="cw-card-result" style="font-size:0.78em;color:#88889a;"></div>' +
    '<div style="display:flex;justify-content:flex-end;margin-top:10px;">' +
      '<button class="cw-cancel-btn cw-btn" data-task-id="' + esc(task.id) + '" style="padding:5px 12px;font-size:0.72em;background:rgba(255,77,109,0.1);color:#ff4d6d;border:1px solid rgba(255,77,109,0.25);border-radius:7px;cursor:pointer;display:' + (_isTerminal(task.state) ? 'none' : 'block') + ';">✕ Annuler</button>' +
    '</div>'
  );
}

function _isTerminal(state) {
  return ['succeeded','failed','cancelled','expired','partial'].indexOf(state) > -1;
}

/* ───────────────────────────────────────────
   MISE À JOUR DYNAMIQUE DE LA CARTE
─────────────────────────────────────────── */
function updateCard(card, task) {
  if (!card) return;

  // État
  var stateEl = card.querySelector('.cw-card-state');
  if (stateEl) stateEl.innerHTML = renderStateBadge(task.state);

  // Bouton annuler
  var cancelBtn = card.querySelector('.cw-cancel-btn');
  if (cancelBtn) cancelBtn.style.display = _isTerminal(task.state) ? 'none' : 'block';
}

/* ───────────────────────────────────────────
   AFFICHER UNE PENSÉE (thought)
─────────────────────────────────────────── */
function appendThought(card, thought) {
  if (!card) return;
  var container = card.querySelector('.cw-card-thoughts');
  if (!container) return;
  var el = document.createElement('div');
  el.style.cssText = 'font-size:0.72em;color:#88889a;padding:5px 10px;background:rgba(0,212,255,0.04);border-left:2px solid rgba(0,212,255,0.25);border-radius:0 6px 6px 0;margin-bottom:5px;';
  el.textContent = '💭 ' + thought;
  container.appendChild(el);
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/* ───────────────────────────────────────────
   AFFICHER UNE ÉTAPE (step)
─────────────────────────────────────────── */
function appendStep(card, step) {
  if (!card) return;
  var container = card.querySelector('.cw-card-steps');
  if (!container) return;
  var state = step.state || 'running';
  var ui = STATE_UI[state] || STATE_UI.running;
  var el = document.createElement('div');
  el.className = 'cw-task-step ' + state;
  el.style.cssText = 'display:flex;align-items:center;gap:7px;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.04);font-size:0.78em;';
  el.innerHTML = (
    '<span style="color:' + ui.color + ';">' + ui.icon + '</span>' +
    '<span style="flex:1;color:#e4e4ef;">' + esc(step.tool || '') + '</span>' +
    '<span style="color:#88889a;font-size:0.85em;">' + (step.state || '') + '</span>'
  );
  container.appendChild(el);
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  return el;
}

function updateStep(stepEl, step) {
  if (!stepEl) return;
  var state = step.state || 'running';
  var ui = STATE_UI[state] || STATE_UI.running;
  stepEl.className = 'cw-task-step ' + state;
  var parts = stepEl.querySelectorAll('span');
  if (parts[0]) { parts[0].style.color = ui.color; parts[0].textContent = ui.icon; }
  if (parts[2]) parts[2].textContent = step.state || '';
}

/* ───────────────────────────────────────────
   BLOC D'APPROBATION
─────────────────────────────────────────── */
function showApproval(card, toolName, args, onDecision) {
  var container = card.querySelector('.cw-card-approval');
  if (!container) return;
  var argsStr = JSON.stringify(args, null, 2).substring(0, 400);
  var block = document.createElement('div');
  block.className = 'cw-approval-block';
  block.style.cssText = 'margin:8px 0;padding:12px;background:rgba(249,115,22,0.08);border:1px solid rgba(249,115,22,0.3);border-radius:10px;';
  block.innerHTML = (
    '<div style="font-size:0.72em;color:#f97316;font-weight:700;margin-bottom:6px;">⚠️ Action sensible : <code>' + esc(toolName) + '</code></div>' +
    '<pre style="font-size:0.65em;color:rgba(255,230,200,0.7);background:rgba(0,0,0,0.3);padding:8px;border-radius:6px;overflow:auto;max-height:120px;white-space:pre-wrap;">' + esc(argsStr) + '</pre>' +
    '<div style="display:flex;gap:8px;margin-top:10px;">' +
      '<button class="cw-approve-yes cw-btn" style="flex:1;padding:7px;background:linear-gradient(135deg,#00d4ff,#8b5cf6);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:0.75em;font-weight:600;">✓ Autoriser</button>' +
      '<button class="cw-approve-no cw-btn" style="flex:1;padding:7px;background:rgba(255,77,109,0.1);color:#ff4d6d;border:1px solid rgba(255,77,109,0.25);border-radius:8px;cursor:pointer;font-size:0.75em;font-weight:600;">✕ Refuser</button>' +
    '</div>'
  );

  container.innerHTML = '';
  container.appendChild(block);

  var timer = setTimeout(function() {
    block.remove();
    onDecision('timeout');
  }, window.CWEngine ? window.CWEngine.APPROVAL_TIMEOUT : 45000);

  block.querySelector('.cw-approve-yes').addEventListener('click', function() {
    clearTimeout(timer); block.remove(); onDecision('accepted');
  });
  block.querySelector('.cw-approve-no').addEventListener('click', function() {
    clearTimeout(timer); block.remove(); onDecision('refused');
  });
}

/* ───────────────────────────────────────────
   RÉSULTAT FINAL
─────────────────────────────────────────── */
function showResult(card, state, message) {
  var el = card ? card.querySelector('.cw-card-result') : null;
  if (!el) return;
  var ui = STATE_UI[state] || STATE_UI.indeterminate;
  el.style.cssText = 'font-size:0.78em;padding:8px 10px;border-radius:8px;margin-top:4px;background:' + ui.bg + ';color:' + ui.color + ';border:1px solid ' + ui.color + '33;';
  el.textContent = ui.icon + ' ' + (message || ui.label);
}

/* ───────────────────────────────────────────
   INJECTION DES STYLES
─────────────────────────────────────────── */
(function injectStyles() {
  if (document.getElementById('cw-enhanced-styles')) return;
  var s = document.createElement('style');
  s.id = 'cw-enhanced-styles';
  s.textContent = `
    @keyframes cwPulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
    .cw-badge-anim { animation: cwPulse 1.5s ease infinite; }
    .cw-enhanced .cw-cancel-btn:hover { background:rgba(255,77,109,0.25) !important; }
    .cw-tracker-card.cw-enhanced { transition: border-color 0.3s ease; }
    .cw-tracker-card.cw-enhanced:hover { border-color: rgba(0,212,255,0.3) !important; }
  `;
  document.head.appendChild(s);
})();

/* ───────────────────────────────────────────
   EXPORT GLOBAL
─────────────────────────────────────────── */
window.CWModal = {
  createTrackerCard: createTrackerCard,
  updateCard:        updateCard,
  appendThought:     appendThought,
  appendStep:        appendStep,
  updateStep:        updateStep,
  showApproval:      showApproval,
  showResult:        showResult,
  renderStateBadge:  renderStateBadge,
  STATE_UI:          STATE_UI
};

})();
