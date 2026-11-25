/* Unified tracker: Firestore is the source of truth; no provider summary call. */
(function(w){
'use strict';
const trackers = new Map();
w._cwActiveTrackers = {};

function ensureStyles() {
  if (document.getElementById('cw-tracker-styles')) return;
  const s = document.createElement('style');
  s.id = 'cw-tracker-styles';
  s.textContent = `
    .cw-tracker-card {
      padding: 14px 16px;
      margin: 10px 0;
      background: linear-gradient(155deg, rgba(11, 16, 28, 0.94), rgba(16, 23, 38, 0.94));
      border: 1px solid rgba(0, 212, 255, 0.26);
      border-radius: 14px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.42), inset 0 1px 0 rgba(255, 255, 255, 0.05);
      font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
      color: #e6ecf7;
      transition: border-color 0.25s ease, box-shadow 0.25s ease;
    }
    .cw-tracker-card.cw-done {
      border-color: rgba(16, 185, 129, 0.45);
    }
    .cw-tracker-card.cw-error, .cw-tracker-card.cw-cancelled {
      border-color: rgba(239, 68, 68, 0.45);
    }
    .cw-card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 8px;
    }
    .cw-title-box {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }
    .cw-orb-dot {
      width: 9px;
      height: 9px;
      border-radius: 50%;
      background: #00d4ff;
      box-shadow: 0 0 8px rgba(0, 212, 255, 0.8);
      animation: cwTrackerPulse 1.4s ease-in-out infinite;
      flex-shrink: 0;
    }
    .cw-done .cw-orb-dot {
      background: #10b981;
      box-shadow: 0 0 8px rgba(16, 185, 129, 0.7);
      animation: none;
    }
    .cw-error .cw-orb-dot, .cw-cancelled .cw-orb-dot {
      background: #ef4444;
      box-shadow: 0 0 8px rgba(239, 68, 68, 0.7);
      animation: none;
    }
    .cw-card-title {
      margin: 0;
      font-family: 'Orbitron', 'Segoe UI', sans-serif;
      font-size: 11px;
      font-weight: 700;
      color: #00d4ff;
      letter-spacing: 0.9px;
      text-transform: uppercase;
    }
    .cw-done .cw-card-title { color: #34d399; }
    .cw-error .cw-card-title, .cw-cancelled .cw-card-title { color: #f87171; }
    .cw-badge {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.4px;
      padding: 3px 9px;
      border-radius: 999px;
      background: rgba(0, 212, 255, 0.12);
      border: 1px solid rgba(0, 212, 255, 0.35);
      color: #38bdf8;
      white-space: nowrap;
      flex-shrink: 0;
    }
    .cw-done .cw-badge {
      background: rgba(16, 185, 129, 0.14);
      border-color: rgba(16, 185, 129, 0.45);
      color: #34d399;
    }
    .cw-error .cw-badge, .cw-cancelled .cw-badge {
      background: rgba(239, 68, 68, 0.14);
      border-color: rgba(239, 68, 68, 0.45);
      color: #f87171;
    }
    .cw-prompt-text {
      margin: 0 0 10px 0;
      font-size: 13px;
      font-weight: 500;
      color: #f1f5f9;
      line-height: 1.4;
      word-break: break-word;
    }
    .cw-steps-box {
      display: flex;
      flex-direction: column;
      gap: 5px;
      padding: 9px 12px;
      background: rgba(0, 0, 0, 0.28);
      border-radius: 10px;
      border: 1px solid rgba(255, 255, 255, 0.06);
    }
    .cw-step-row {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      font-size: 12px;
      line-height: 1.38;
      color: #94a3b8;
    }
    .cw-step-row.is-active {
      color: #e0f2fe;
      font-weight: 600;
    }
    .cw-step-row.is-error {
      color: #fca5a5;
    }
    .cw-step-marker {
      flex-shrink: 0;
      font-size: 11px;
      margin-top: 1px;
    }
    .cw-live-result {
      margin: 9px 0 0 0;
      padding: 9px 12px;
      border-radius: 9px;
      font-size: 12px;
      line-height: 1.45;
      white-space: pre-wrap;
      word-break: break-word;
      font-family: inherit;
      background: rgba(15, 23, 42, 0.7);
      border: 1px solid rgba(148, 163, 184, 0.18);
      color: #cbd5e1;
      display: none;
    }
    .cw-done .cw-live-result {
      background: rgba(16, 185, 129, 0.08);
      border-color: rgba(16, 185, 129, 0.28);
      color: #d1fae5;
    }
    .cw-error .cw-live-result, .cw-cancelled .cw-live-result {
      background: rgba(239, 68, 68, 0.09);
      border-color: rgba(239, 68, 68, 0.3);
      color: #fecaca;
    }
    .cw-card-footer {
      display: flex;
      justify-content: flex-end;
      margin-top: 9px;
    }
    .cw-btn-cancel {
      padding: 5px 12px;
      background: rgba(239, 68, 68, 0.12);
      border: 1px solid rgba(239, 68, 68, 0.35);
      color: #fca5a5;
      border-radius: 8px;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s ease;
    }
    .cw-btn-cancel:hover {
      background: rgba(239, 68, 68, 0.25);
    }
    @keyframes cwTrackerPulse {
      0%, 100% { transform: scale(0.92); opacity: 0.75; }
      50% { transform: scale(1.22); opacity: 1; }
    }
  `;
  document.head.appendChild(s);
}

function element(tag, text, cls) {
  const e = document.createElement(tag);
  if (text != null) e.textContent = text;
  if (cls) e.className = cls;
  return e;
}

function card(prompt) {
  ensureStyles();
  const e = element('section', null, 'cw-tracker-card');

  const head = element('div', null, 'cw-card-header');
  const titleBox = element('div', null, 'cw-title-box');
  const dot = element('span', null, 'cw-orb-dot');
  const h4 = element('h4', 'CLOUDWORKS', 'cw-card-title');
  titleBox.append(dot, h4);
  const badge = element('span', 'EN FILE', 'cw-badge');
  head.append(titleBox, badge);

  const p = element('p', prompt, 'cw-prompt-text');

  const stepsBox = element('div', null, 'cw-steps-box');
  const stepRow = element('div', null, 'cw-step-row is-active');
  const marker = element('span', '▸', 'cw-step-marker');
  const stepText = element('span', 'En attente du PC...', 'cw-live-step');
  stepRow.append(marker, stepText);
  stepsBox.append(stepRow);

  const res = element('pre', '', 'cw-live-result');

  e.append(head, p, stepsBox, res);
  return e;
}

function renderSteps(stepsBox, d) {
  const list = Array.isArray(d.steps) && d.steps.length ? d.steps.slice(-5) : null;
  stepsBox.replaceChildren();
  const isTerm = w.CWBus?.terminal(d);
  if (list) {
    list.forEach((st, idx) => {
      const isLast = idx === list.length - 1;
      const isErr = st.state === 'error';
      const row = element('div', null, 'cw-step-row' + (isErr ? ' is-error' : (isLast && !isTerm ? ' is-active' : '')));
      const mk = element('span', isErr ? '✗' : (isLast && !isTerm ? '▸' : '✓'), 'cw-step-marker');
      const tx = element('span', st.text || '', isLast ? 'cw-live-step' : null);
      row.append(mk, tx);
      stepsBox.append(row);
    });
  } else {
    const row = element('div', null, 'cw-step-row' + (d.status === 'error' ? ' is-error' : (!isTerm ? ' is-active' : '')));
    const mk = element('span', d.status === 'error' ? '✗' : (d.status === 'done' ? '✓' : '▸'), 'cw-step-marker');
    const tx = element('span', d.step || d.status || 'En attente du PC...', 'cw-live-step');
    row.append(mk, tx);
    stepsBox.append(row);
  }
}

function badgeLabel(d) {
  if (d.status === 'done') return 'TERMINÉ ✓';
  if (d.status === 'cancelled') return 'ANNULÉ';
  if (d.status === 'error') return 'ÉCHEC ✗';
  if (d.state === 'waiting_user') return 'VALIDATION PC';
  if (d.state === 'executing') return 'EXÉCUTION';
  if (d.status === 'running') return 'ANALYSE';
  return 'EN FILE';
}

async function persist(uid, conv, id, data) {
  if (!uid || !conv) return;
  await w.db.collection('users').doc(uid).collection('conversations').doc(conv).collection('messages').doc('cw_' + id).set(data, { merge: true });
}

w.appendCloudWorksTracker = function(id, prompt, container) {
  if (trackers.has(id)) return trackers.get(id).card;
  const uid = w.S?.user?.uid, conv = w.S?.convId;
  if (!uid || !w.CWBus) return;
  const target = container || document.getElementById('messagesList') || document.body;
  if (target && target.id === 'cwAgenticStatus') {
    target.className = '';
    target.style.cssText = 'display:block;margin-top:12px;';
  }

  const c = card(prompt);
  const stepsBox = c.querySelector('.cw-steps-box');
  const out = c.querySelector('.cw-live-result');
  const badge = c.querySelector('.cw-badge');

  const footer = element('div', null, 'cw-card-footer');
  const button = element('button', 'Annuler', 'cw-btn-cancel');
  footer.append(button);
  c.id = 'cwTracker-' + id;
  c.append(footer);
  target.append(c);

  const record = { card: c, unsub: () => {}, final: false };
  trackers.set(id, record);
  w._cwActiveTrackers[id] = record;

  button.onclick = () => w.CWBus.cancel(id).catch(e => {
    out.style.display = 'block';
    out.textContent = e.message;
  });

  const watchdog = setTimeout(() => {
    badge.textContent = 'INCONNU';
    out.style.display = 'block';
    out.textContent = 'Suivi interrompu (timeout 6 min). Vérifiez sur le PC.';
    record.unsub();
  }, 360000);

  record.unsub = w.CWBus.watch(id, d => {
    badge.textContent = badgeLabel(d);
    renderSteps(stepsBox, d);
    if (!w.CWBus.terminal(d)) return;
    if (record.final) return;
    record.final = true;
    clearTimeout(watchdog);
    c.classList.add('cw-' + d.status);
    footer.remove();

    const summary = d.result?.output || d.result?.error || d.step || d.status;
    if (summary) {
      out.style.display = 'block';
      out.textContent = summary;
    }
    queueMicrotask(() => record.unsub());
    delete w._cwActiveTrackers[id];
    trackers.delete(id);
    persist(uid, conv, id, {
      role: 'cloudworks',
      type: 'cw_tracker',
      cmdId: id,
      prompt,
      status: d.status,
      summary,
      steps: d.steps || [],
      timestamp: w.timestamp ? w.timestamp() : new Date()
    }).catch(console.error);

    if (w.S) { w.S.busy = false; w.S.cwRunning = false; }
    if (typeof w.hideTyping === 'function') w.hideTyping();
    const send = document.getElementById('sendBtn');
    if (send) { send.disabled = false; send.style.display = 'inline-flex'; }
  }, err => {
    clearTimeout(watchdog);
    c.classList.add('cw-error');
    badge.textContent = 'ÉCHEC ✗';
    out.style.display = 'block';
    out.textContent = 'Erreur de suivi : ' + err.message;
  });

  return c;
};

w.cancelCloudWorksTask = id => w.CWBus.cancel(id);

w.cwConfirmAndExecute = async action => {
  const types = ['agentic_task', 'screenshot', 'sysinfo', 'run_script', 'lock', 'sleep', 'shutdown', 'open_ide_file'];
  if (!types.includes(action.type)) return w.executeEvaAction?.(action);
  try {
    const payload = action.type === 'agentic_task' ? { prompt: action.prompt } : {};
    const id = await w.CWBus.submit(action.type, payload, { deviceId: action.deviceId });
    w.appendCloudWorksTracker(id, action.prompt || action.type);
    return id;
  } catch (e) {
    w.toast?.(e.message, 'error');
  }
};

w.renderSavedTrackerCard = data => {
  const st = data.status || 'done';
  const c = card(data.prompt || 'Tâche CloudWorks');
  c.classList.add('cw-' + (st === 'done' ? 'done' : (st === 'cancelled' ? 'cancelled' : 'error')));
  c.querySelector('.cw-badge').textContent = badgeLabel({ status: st });
  renderSteps(c.querySelector('.cw-steps-box'), { status: st, step: data.summary || st, steps: data.steps || [] });
  const out = c.querySelector('.cw-live-result');
  if (data.summary) {
    out.style.display = 'block';
    out.textContent = data.summary;
  }
  return c;
};

w.setIsGenerating = active => { if (w.S) w.S.busy = !!active; };

if (w.eva?.overlay?.onAction) {
  w.eva.overlay.onAction(action => {
    if (action === 'cancel') {
      for (const id of Object.keys(w._cwActiveTrackers)) w.CWBus.cancel(id).catch(console.error);
    }
  });
}
})(window);
