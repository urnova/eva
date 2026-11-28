/* Unified tracker: Firestore is the source of truth; chronological vertical stepper + inline validation. */
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
      background: #18181c;
      border: 1px solid rgba(255, 255, 255, 0.09);
      border-radius: 14px;
      box-shadow: 0 6px 22px rgba(0, 0, 0, 0.36);
      font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
      color: #ededf2;
      transition: border-color 0.2s ease, box-shadow 0.2s ease;
    }
    .cw-tracker-card.cw-done {
      border-color: rgba(74, 222, 128, 0.36);
    }
    .cw-tracker-card.cw-error, .cw-tracker-card.cw-cancelled {
      border-color: rgba(248, 113, 113, 0.36);
    }
    .cw-tracker-card.cw-waiting {
      border-color: rgba(251, 191, 36, 0.45);
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
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #00d4ff;
      box-shadow: 0 0 8px rgba(0, 212, 255, 0.7);
      animation: cwTrackerPulse 1.4s ease-in-out infinite;
      flex-shrink: 0;
    }
    .cw-done .cw-orb-dot {
      background: #4ade80;
      box-shadow: 0 0 8px rgba(74, 222, 128, 0.65);
      animation: none;
    }
    .cw-error .cw-orb-dot, .cw-cancelled .cw-orb-dot {
      background: #f87171;
      box-shadow: 0 0 8px rgba(248, 113, 113, 0.65);
      animation: none;
    }
    .cw-card-title {
      margin: 0;
      font-family: 'Orbitron', 'Inter', sans-serif;
      font-size: 11px;
      font-weight: 700;
      color: #00d4ff;
      letter-spacing: 0.8px;
      text-transform: uppercase;
    }
    .cw-done .cw-card-title { color: #4ade80; }
    .cw-error .cw-card-title, .cw-cancelled .cw-card-title { color: #f87171; }
    .cw-badge {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.4px;
      padding: 3px 9px;
      border-radius: 999px;
      background: rgba(0, 212, 255, 0.1);
      border: 1px solid rgba(0, 212, 255, 0.3);
      color: #00d4ff;
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
    .cw-waiting .cw-badge {
      background: rgba(245, 158, 11, 0.18);
      border-color: rgba(245, 158, 11, 0.55);
      color: #fcd34d;
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
      gap: 0;
      padding: 10px 12px;
      background: rgba(0, 0, 0, 0.28);
      border-radius: 10px;
      border: 1px solid rgba(255, 255, 255, 0.06);
      max-height: 240px;
      overflow-y: auto;
    }
    .cw-step-row {
      position: relative;
      display: flex;
      align-items: flex-start;
      gap: 10px;
      font-size: 12px;
      line-height: 1.4;
      color: #94a3b8;
      padding: 4px 0 8px 0;
    }
    .cw-step-row:last-child { padding-bottom: 2px; }
    .cw-step-rail {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      flex-shrink: 0;
      width: 18px;
    }
    .cw-step-row:not(:last-child) .cw-step-rail::after {
      content: '';
      position: absolute;
      top: 19px;
      bottom: -8px;
      width: 1.5px;
      background: rgba(148, 163, 184, 0.22);
    }
    .cw-step-row.is-done:not(:last-child) .cw-step-rail::after {
      background: rgba(16, 185, 129, 0.38);
    }
    .cw-step-marker {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      font-weight: 800;
      background: rgba(148, 163, 184, 0.14);
      color: #94a3b8;
      border: 1px solid rgba(148, 163, 184, 0.3);
      z-index: 1;
    }
    .cw-step-row.is-done .cw-step-marker {
      background: rgba(16, 185, 129, 0.16);
      color: #34d399;
      border-color: rgba(16, 185, 129, 0.5);
    }
    .cw-step-row.is-done { color: #cbd5e1; }
    .cw-step-row.is-active .cw-step-marker {
      background: rgba(249, 115, 22, 0.22);
      color: #fb923c;
      border-color: rgba(249, 115, 22, 0.7);
      animation: cwTrackerPulse 1.3s ease-in-out infinite;
    }
    .cw-step-row.is-active {
      color: #fff7ed;
      font-weight: 600;
    }
    .cw-step-row.is-error .cw-step-marker {
      background: rgba(239, 68, 68, 0.2);
      color: #f87171;
      border-color: rgba(239, 68, 68, 0.55);
    }
    .cw-step-row.is-error { color: #fca5a5; }
    .cw-step-text {
      flex: 1;
      min-width: 0;
      word-break: break-word;
      padding-top: 1px;
    }
    .cw-approval-box {
      display: none;
      margin-top: 10px;
      padding: 11px 12px;
      border-radius: 10px;
      background: rgba(245, 158, 11, 0.1);
      border: 1px solid rgba(245, 158, 11, 0.45);
    }
    .cw-approval-title {
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: #fbbf24;
      margin-bottom: 5px;
    }
    .cw-approval-summary {
      font-size: 12.5px;
      color: #fef3c7;
      margin-bottom: 9px;
      line-height: 1.4;
      word-break: break-word;
    }
    .cw-approval-btns {
      display: flex;
      gap: 8px;
    }
    .cw-btn-approve {
      flex: 1;
      padding: 7px 12px;
      border-radius: 8px;
      border: none;
      background: #10b981;
      color: #03150e;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
    }
    .cw-btn-approve:hover:not(:disabled) { filter: brightness(1.1); }
    .cw-btn-deny {
      flex: 1;
      padding: 7px 12px;
      border-radius: 8px;
      background: rgba(239, 68, 68, 0.18);
      border: 1px solid rgba(239, 68, 68, 0.5);
      color: #fecaca;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
    }
    .cw-btn-deny:hover:not(:disabled) { background: rgba(239, 68, 68, 0.3); }
    .cw-btn-approve:disabled, .cw-btn-deny:disabled { opacity: 0.5; cursor: not-allowed; }
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
      0%, 100% { transform: scale(0.92); opacity: 0.8; }
      50% { transform: scale(1.18); opacity: 1; }
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
  const row = element('div', null, 'cw-step-row is-active');
  const rail = element('div', null, 'cw-step-rail');
  rail.append(element('span', '•', 'cw-step-marker'));
  row.append(rail, element('span', 'En attente du PC...', 'cw-step-text cw-live-step'));
  stepsBox.append(row);

  const approvalBox = element('div', null, 'cw-approval-box');
  const apTitle = element('div', 'Validation requise', 'cw-approval-title');
  const apSummary = element('div', '', 'cw-approval-summary');
  const apBtns = element('div', null, 'cw-approval-btns');
  const btnOk = element('button', '✓ Autoriser', 'cw-btn-approve');
  const btnNo = element('button', '✗ Refuser', 'cw-btn-deny');
  apBtns.append(btnOk, btnNo);
  approvalBox.append(apTitle, apSummary, apBtns);

  const res = element('pre', '', 'cw-live-result');

  e.append(head, p, stepsBox, approvalBox, res);
  return e;
}

function renderSteps(stepsBox, d) {
  const list = Array.isArray(d.steps) && d.steps.length ? d.steps : null;
  stepsBox.replaceChildren();
  const isTerm = w.CWBus?.terminal(d);
  if (list) {
    list.forEach((st, idx) => {
      const isLast = idx === list.length - 1;
      const isErr = st.state === 'error' || (isLast && d.status === 'error');
      const isDone = st.state === 'done' || (!isErr && (isTerm || !isLast));
      const rowCls = 'cw-step-row' + (isErr ? ' is-error' : (isDone ? ' is-done' : ' is-active'));
      const row = element('div', null, rowCls);
      const rail = element('div', null, 'cw-step-rail');
      const mk = element('span', isErr ? '✗' : (isDone ? '✓' : '•'), 'cw-step-marker');
      rail.append(mk);
      const tx = element('span', st.text || '', 'cw-step-text' + (isLast ? ' cw-live-step' : ''));
      row.append(rail, tx);
      stepsBox.append(row);
    });
    stepsBox.scrollTop = stepsBox.scrollHeight;
  } else {
    const isErr = d.status === 'error';
    const isDone = d.status === 'done';
    const row = element('div', null, 'cw-step-row' + (isErr ? ' is-error' : (isDone ? ' is-done' : ' is-active')));
    const rail = element('div', null, 'cw-step-rail');
    rail.append(element('span', isErr ? '✗' : (isDone ? '✓' : '•'), 'cw-step-marker'));
    const tx = element('span', d.step || d.status || 'En attente du PC...', 'cw-step-text cw-live-step');
    row.append(rail, tx);
    stepsBox.append(row);
  }
}

function badgeLabel(d) {
  if (d.status === 'done') return 'TERMINÉ ✓';
  if (d.status === 'cancelled') return 'ANNULÉ';
  if (d.status === 'error') return 'ÉCHEC ✗';
  if (d.state === 'waiting_user' || d.approval?.pending) return 'VALIDATION';
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
  const approvalBox = c.querySelector('.cw-approval-box');
  const apSummary = c.querySelector('.cw-approval-summary');
  const btnApprove = c.querySelector('.cw-btn-approve');
  const btnDeny = c.querySelector('.cw-btn-deny');

  const sendApproval = async approved => {
    btnApprove.disabled = true;
    btnDeny.disabled = true;
    try {
      await w.eva?.cloudworks?.respondApproval?.(id, approved);
    } catch(_) {}
    try {
      await w.db.collection('cloudworks').doc(uid).collection('commands').doc(id).update({
        approvalDecision: !!approved,
        updatedAt: w.timestamp ? w.timestamp() : new Date()
      });
    } catch(err) {
      out.style.display = 'block';
      out.textContent = 'Erreur validation : ' + err.message;
    }
  };
  btnApprove.onclick = () => sendApproval(true);
  btnDeny.onclick = () => sendApproval(false);

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

    const waiting = !w.CWBus.terminal(d) && d.approval?.pending && d.approvalDecision == null;
    c.classList.toggle('cw-waiting', !!waiting);
    if (waiting) {
      approvalBox.style.display = 'block';
      apSummary.textContent = d.approval.summary || ('Autoriser l’action : ' + (d.approval.tool || 'système'));
      btnApprove.disabled = false;
      btnDeny.disabled = false;
    } else {
      approvalBox.style.display = 'none';
    }

    if (!w.CWBus.terminal(d)) return;
    if (record.final) return;
    record.final = true;
    clearTimeout(watchdog);
    c.classList.remove('cw-waiting');
    approvalBox.style.display = 'none';
    c.classList.add('cw-' + d.status);
    footer.remove();

    const summary = d.result?.output || d.result?.error || d.step || d.status;
    if (c.dataset.cwRendered === '1') return;
    c.dataset.cwRendered = '1';
    const imgData = d.result?.image || d.result?.dataUrl || (typeof d.result?.base64 === 'string' ? ('data:image/png;base64,' + d.result.base64) : null);
    if (imgData) {
      out.style.display = 'block';
      out.innerHTML = '<div style="margin-bottom:6px;font-weight:600;">Capture d\'écran reçue :</div><img src="' + imgData.replace(/"/g,'') + '" style="max-width:100%;border-radius:10px;border:1px solid rgba(0,212,255,0.28);cursor:pointer;" onclick="openImageModal?openImageModal(this.src):window.open(this.src)">';
    } else if (d.result?.sysinfo || d.result?.cpu || d.result?.ram) {
      out.style.display = 'block';
      const si = d.result.sysinfo || d.result;
      out.innerHTML = '<pre style="margin:0;white-space:pre-wrap;font-size:11.5px;color:#cbd5e1;">' + (typeof si === 'string' ? si : JSON.stringify(si, null, 2)) + '</pre>';
    } else if (summary) {
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

    if (target.id !== 'cwAgenticStatus') {
      const closingMsg = d.status === 'done'
        ? '✅ ' + summary
        : d.status === 'cancelled'
          ? '■ Tâche CloudWorks annulée.'
          : '⚠️ Je n’ai pas pu terminer l’action sur votre PC : ' + summary;
      if (typeof w.appendMsg === 'function') w.appendMsg('eva', closingMsg);
      if (uid && conv && w.db) {
        w.db.collection('users').doc(uid).collection('conversations').doc(conv).collection('messages').add({
          role: 'assistant',
          content: closingMsg,
          timestamp: w.timestamp ? w.timestamp() : new Date()
        }).catch(console.error);
      }
      if (!w._isJarvisActive && w.S?.ttsOn && w.EVATTS?.speakTextStreaming) {
        w.EVATTS.speakTextStreaming(closingMsg, w.S.config || {});
      }
    }

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
