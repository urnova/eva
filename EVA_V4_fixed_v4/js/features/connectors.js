/* ═══════════════════════════════════════════════════════════════════════
   EVA — CONNECTORS.JS (D2)
   Dual Architecture: Native vs Codemod vs MCP (1 seule source de vérité)
   + Google Workspace (OAuth Agenda & Gmail avec validation humaine)
   + Phase 2: GitHub & Notion
   ═══════════════════════════════════════════════════════════════════════ */
(function(w) {
  'use strict';

  var STORAGE_KEY = 'eva_connectors_v1';
  var GWS_TOKEN_KEY = 'eva_gws_oauth';
  var ONBOARDING_DISMISSED_KEY = 'eva_gws_onboarding_dismissed';

  var DEFAULT_STATE = {
    calendar: { mode: 'native', mcpUrl: '' },   // 'off' | 'native' | 'codemod' | 'mcp'
    gmail:    { mode: 'native', mcpUrl: '' },   // 'off' | 'native' | 'codemod' | 'mcp'
    notion:   { mode: 'off', token: '', mcpUrl: '' }, // 'off' | 'codemod' | 'mcp'
    github:   { mode: 'off', token: '', username: '', mcpUrl: '' } // 'off' | 'codemod' | 'mcp'
  };

  function _esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function loadState() {
    var local = {};
    try { local = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch(_) {}
    var prof = (w.S && w.S.profile && w.S.profile.connectors) || {};
    var merged = {
      calendar: Object.assign({}, DEFAULT_STATE.calendar, local.calendar || {}, prof.calendar || {}),
      gmail:    Object.assign({}, DEFAULT_STATE.gmail, local.gmail || {}, prof.gmail || {}),
      notion:   Object.assign({}, DEFAULT_STATE.notion, local.notion || {}, prof.notion || {}),
      github:   Object.assign({}, DEFAULT_STATE.github, local.github || {}, prof.github || {})
    };
    return merged;
  }

  async function saveState(st) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(st)); } catch(_) {}
    if (w.S && w.S.profile) w.S.profile.connectors = st;
    if (w.S && w.S.user && w.db) {
      try {
        await w.db.collection('users').doc(w.S.user.uid).set({ connectors: st }, { merge: true });
      } catch(e) { console.warn('[Connectors] Firestore save:', e.message); }
    }
  }

  function getGoogleToken() {
    try {
      var raw = JSON.parse(localStorage.getItem(GWS_TOKEN_KEY) || 'null');
      if (!raw || !raw.accessToken) return null;
      if (raw.expiresAt && Date.now() > raw.expiresAt) return null;
      return raw;
    } catch(_) { return null; }
  }

  async function connectGoogleWorkspace() {
    if (!w.firebase || !w.firebase.auth || !w.auth) {
      if (w.toast) w.toast('Firebase Auth non disponible.', 'error');
      return false;
    }
    try {
      var provider = new w.firebase.auth.GoogleAuthProvider();
      provider.addScope('https://www.googleapis.com/auth/calendar.events');
      provider.addScope('https://www.googleapis.com/auth/gmail.modify');
      provider.setCustomParameters({ prompt: 'consent', access_type: 'offline' });

      var user = w.auth.currentUser;
      var result = user
        ? await user.reauthenticateWithPopup(provider).catch(function() { return w.auth.signInWithPopup(provider); })
        : await w.auth.signInWithPopup(provider);

      var token = result && result.credential && result.credential.accessToken;
      if (!token) throw new Error('Jeton OAuth Google non reçu');
      var payload = {
        accessToken: token,
        email: (result.user && result.user.email) || '',
        expiresAt: Date.now() + 55 * 60 * 1000
      };
      localStorage.setItem(GWS_TOKEN_KEY, JSON.stringify(payload));
      var st = loadState();
      if (st.calendar.mode === 'off') st.calendar.mode = 'native';
      if (st.gmail.mode === 'off') st.gmail.mode = 'native';
      await saveState(st);
      if (w.toast) w.toast('✅ Google Workspace (Agenda + Gmail) connecté !', 'success');
      return true;
    } catch(e) {
      console.warn('[GWS OAuth]', e);
      if (w.toast) w.toast('Connexion Google Workspace : ' + (e.message || 'annulée'), 'warning');
      return false;
    }
  }

  function disconnectGoogleWorkspace() {
    localStorage.removeItem(GWS_TOKEN_KEY);
    var st = loadState();
    st.calendar.mode = 'off';
    st.gmail.mode = 'off';
    saveState(st);
    if (w.toast) w.toast('Google Workspace déconnecté', 'info');
  }

  /* ── Anti-conflit : 1 seule source de vérité par service ── */
  async function setServiceMode(serviceKey, mode, extras) {
    var st = loadState();
    if (!st[serviceKey]) return st;
    // Validation stricte de mode exclusif ('off' | 'native' | 'codemod' | 'mcp')
    var allowed = (serviceKey === 'calendar' || serviceKey === 'gmail')
      ? ['off', 'native', 'codemod', 'mcp']
      : ['off', 'codemod', 'mcp'];
    st[serviceKey].mode = allowed.includes(mode) ? mode : 'off';
    if (extras && typeof extras === 'object') Object.assign(st[serviceKey], extras);
    await saveState(st);
    return st;
  }

  /* ── Prompt dynamique injecté dans getDynamicSysPrompt() ── */
  function buildSystemPromptAddendum() {
    var st = loadState();
    var parts = [];
    if (st.calendar.mode !== 'off') {
      parts.push(
        '• Google Agenda [' + st.calendar.mode.toUpperCase() + ' — source unique] : ' +
        (st.calendar.mode === 'mcp'
          ? 'utilise le protocole MCP Calendar configuré.'
          : (st.calendar.mode === 'codemod'
            ? 'utilise des instructions compactes [ACTION:{"type":"gws_calendar","op":"list|create|update|delete","title":"...","start":"ISO","end":"ISO","id":"..."}]'
            : 'utilise l\'agent Agenda natif [ACTION:{"type":"gws_calendar","op":"list|create|update|delete","title":"...","start":"ISO","end":"ISO","id":"..."}]')) +
        ' — toute création, modification ou suppression déclenche une carte de validation humaine obligatoire.'
      );
    }
    if (st.gmail.mode !== 'off') {
      parts.push(
        '• Gmail [' + st.gmail.mode.toUpperCase() + ' — source unique] : ' +
        'utilise [ACTION:{"type":"gws_gmail","op":"list|read|draft|send|delete","query":"is:unread|today|1h","to":"...","subject":"...","body":"...","id":"..."}] — JAMAIS d\'envoi ni suppression sans clic humain Envoyer/Confirmer.'
      );
    }
    if (st.notion.mode !== 'off') {
      parts.push('• Notion [' + st.notion.mode.toUpperCase() + '] : actif en complément des Notes E.V.A (jamais en doublon).');
    }
    if (st.github.mode !== 'off') {
      parts.push('• GitHub [' + st.github.mode.toUpperCase() + '] : utilise [ACTION:{"type":"github_query","op":"repos|issues|search","repo":"owner/repo","query":"..."}].');
    }
    if (!parts.length) return '';
    return '\n\n[CONNECTEURS ACTIFS — ARCHITECTURE DUAL MCP/CODEMOD (1 SOURCE DE VÉRITÉ PAR SERVICE)]\n' + parts.join('\n');
  }

  /* ── Agent Google Agenda (Lecture directe + Carte confirmation avant écriture) ── */
  async function handleCalendarAction(action) {
    var tok = getGoogleToken();
    var op = (action.op || 'list').toLowerCase();
    if (op === 'list' || op === 'search') {
      if (!tok) {
        // Fallback événements locaux Firestore
        var localEvs = (w.S && Array.isArray(w.S.events)) ? w.S.events : [];
        return {
          mode: 'local-fallback',
          events: localEvs.slice(0, 8),
          note: 'Connectez Google Workspace dans Paramètres → Connecteurs pour synchroniser Google Agenda.'
        };
      }
      var timeMin = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
      var qParam = action.query ? ('&q=' + encodeURIComponent(action.query)) : '';
      var r = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?singleEvents=true&orderBy=startTime&maxResults=10&timeMin=' + encodeURIComponent(timeMin) + qParam, {
        headers: { 'Authorization': 'Bearer ' + tok.accessToken }
      });
      if (!r.ok) throw new Error('Google Agenda HTTP ' + r.status);
      var j = await r.json();
      return { mode: 'google', events: j.items || [] };
    }
    // Toute écriture (create/update/delete) -> carte validation obligatoire
    renderConfirmationCard({
      service: 'calendar',
      badge: '📅 Agent Google Agenda',
      badgeCls: 'agent-calendar',
      summary: (op === 'delete' ? 'Supprimer l\'événement : ' : (op === 'update' ? 'Modifier l\'événement : ' : 'Créer un événement : ')) + (action.title || 'Sans titre'),
      details: [
        action.start ? ('Début : ' + action.start) : '',
        action.end ? ('Fin : ' + action.end) : '',
        action.description ? ('Détails : ' + action.description) : ''
      ].filter(Boolean).join(' · '),
      confirmLabel: op === 'delete' ? '🗑️ Confirmer la suppression' : '✓ Confirmer dans Agenda',
      onConfirm: async function() {
        var t = getGoogleToken();
        if (!t) {
          // Local Agenda Firestore write
          if (w.db && w.S && w.S.user && op === 'create') {
            await w.db.collection('users').doc(w.S.user.uid).collection('events').add({
              title: action.title || 'Événement EVA',
              date: (action.start || new Date().toISOString()).slice(0, 10),
              time: (action.start && action.start.includes('T')) ? action.start.split('T')[1].slice(0, 5) : '',
              description: action.description || '',
              createdAt: w.timestamp ? w.timestamp() : new Date()
            });
            return 'Événement enregistré dans votre Agenda E.V.A ✓';
          }
          throw new Error('Compte Google Workspace requis pour cette opération');
        }
        if (op === 'create') {
          var cr = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + t.accessToken, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              summary: action.title || 'Événement EVA',
              description: action.description || '',
              start: { dateTime: action.start || new Date(Date.now() + 3600000).toISOString() },
              end:   { dateTime: action.end || new Date(Date.now() + 7200000).toISOString() }
            })
          });
          if (!cr.ok) throw new Error('Création Google Agenda HTTP ' + cr.status);
          return 'Événement ajouté à Google Agenda ✓';
        }
        if (op === 'delete' && action.id) {
          var dr = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events/' + encodeURIComponent(action.id), {
            method: 'DELETE',
            headers: { 'Authorization': 'Bearer ' + t.accessToken }
          });
          if (!dr.ok) throw new Error('Suppression Google Agenda HTTP ' + dr.status);
          return 'Événement supprimé de Google Agenda ✓';
        }
        if (op === 'update' && action.id) {
          var ur = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events/' + encodeURIComponent(action.id), {
            method: 'PATCH',
            headers: { 'Authorization': 'Bearer ' + t.accessToken, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              summary: action.title,
              description: action.description,
              start: action.start ? { dateTime: action.start } : undefined,
              end: action.end ? { dateTime: action.end } : undefined
            })
          });
          if (!ur.ok) throw new Error('Modification Google Agenda HTTP ' + ur.status);
          return 'Événement modifié dans Google Agenda ✓';
        }
        return 'Opération exécutée ✓';
      }
    });
    return { pendingConfirmation: true };
  }

  /* ── Agent Gmail (Résumé/Lecture + Carte validation humaine avant Envoi/Suppression) ── */
  async function handleGmailAction(action) {
    var tok = getGoogleToken();
    var op = (action.op || 'list').toLowerCase();
    if (!tok) {
      if (w.appendMsg) w.appendMsg('eva', '✉️ Connectez **Google Workspace** dans **Paramètres → Connecteurs** pour accéder à Gmail.');
      return { needsAuth: true };
    }
    if (op === 'list' || op === 'read') {
      var q = action.query || 'newer_than:1d';
      var lr = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=6&q=' + encodeURIComponent(q), {
        headers: { 'Authorization': 'Bearer ' + tok.accessToken }
      });
      if (!lr.ok) throw new Error('Gmail HTTP ' + lr.status);
      var lj = await lr.json();
      var msgs = lj.messages || [];
      var details = [];
      for (var i = 0; i < Math.min(msgs.length, 5); i++) {
        var mr = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/' + msgs[i].id + '?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date', {
          headers: { 'Authorization': 'Bearer ' + tok.accessToken }
        });
        if (mr.ok) {
          var mj = await mr.json();
          var hdrs = {};
          (mj.payload && mj.payload.headers || []).forEach(function(h) { hdrs[h.name] = h.value; });
          details.push({ id: msgs[i].id, from: hdrs.From || '?', subject: hdrs.Subject || '(Sans objet)', snippet: mj.snippet || '' });
        }
      }
      renderGmailListCard(details);
      return { emails: details };
    }

    // Draft / Send / Delete -> JAMAIS sans validation humaine explicite
    var isDelete = op === 'delete';
    renderConfirmationCard({
      service: 'gmail',
      badge: '✉️ Agent Gmail',
      badgeCls: 'agent-gmail',
      summary: isDelete ? ('Supprimer cet e-mail (' + (action.id || '?') + ')') : ('Brouillon e-mail vers ' + (action.to || '(destinataire à confirmer)')),
      details: isDelete ? 'Suppression définitive — confirmation humaine requise.' : ('Objet : ' + (action.subject || 'Sans objet') + '\n' + (action.body || '')),
      confirmLabel: isDelete ? '🗑️ Confirmer la suppression' : '✉️ Envoyer cet e-mail',
      onConfirm: async function() {
        var t = getGoogleToken();
        if (!t) throw new Error('Session Google Workspace expirée');
        if (isDelete && action.id) {
          if (!confirm('DOUBLE CONFIRMATION : Déplacer ce message Gmail vers la corbeille ?')) throw new Error('Annulé par l\'utilisateur');
          var dr = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/' + encodeURIComponent(action.id) + '/trash', {
            method: 'POST', headers: { 'Authorization': 'Bearer ' + t.accessToken }
          });
          if (!dr.ok) throw new Error('Gmail trash HTTP ' + dr.status);
          return 'E-mail mis à la corbeille ✓';
        }
        var rawMime = 'To: ' + (action.to || '') + '\r\nSubject: ' + (action.subject || '') + '\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n' + (action.body || '');
        var encoded = btoa(unescape(encodeURIComponent(rawMime))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        var sr = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + t.accessToken, 'Content-Type': 'application/json' },
          body: JSON.stringify({ raw: encoded })
        });
        if (!sr.ok) throw new Error('Envoi Gmail HTTP ' + sr.status);
        return 'E-mail envoyé à ' + action.to + ' ✓';
      }
    });
    return { pendingConfirmation: true };
  }

  /* ── Phase 2 : GitHub & Notion ── */
  async function handleGithubQuery(action) {
    var st = loadState();
    var headers = { 'Accept': 'application/vnd.github+json' };
    if (st.github.token) headers['Authorization'] = 'Bearer ' + st.github.token;
    var url = action.repo
      ? 'https://api.github.com/repos/' + action.repo + (action.op === 'issues' ? '/issues?per_page=5' : '')
      : 'https://api.github.com/user/repos?sort=updated&per_page=6';
    var r = await fetch(url, { headers: headers });
    if (!r.ok) throw new Error('GitHub HTTP ' + r.status);
    return await r.json();
  }

  /* ── UI Cards (Confirmation / Gmail List / Onboarding) ── */
  function renderConfirmationCard(opts) {
    var list = document.getElementById('messagesList');
    if (!list) return;
    var div = document.createElement('div');
    div.className = 'message eva';
    div.innerHTML =
      '<div class="msg-content" style="max-width:520px;">' +
        '<div class="eva-agent-badge ' + _esc(opts.badgeCls || '') + '">' + _esc(opts.badge || 'Connecteur') + '</div>' +
        '<div class="msg-bubble" style="background:rgba(19,19,31,0.96);border:1px solid rgba(0,212,255,0.34);border-radius:14px;padding:14px 16px;">' +
          '<div style="font-weight:700;font-size:0.9em;color:#eef2ff;margin-bottom:6px;">' + _esc(opts.summary) + '</div>' +
          (opts.details ? '<div style="font-size:0.78em;color:#94a3b8;white-space:pre-wrap;margin-bottom:12px;">' + _esc(opts.details) + '</div>' : '') +
          '<div style="display:flex;gap:8px;flex-wrap:wrap;" class="gws-confirm-actions">' +
            '<button type="button" class="btn btn-primary gws-yes" style="padding:7px 14px;font-size:0.78em;">' + _esc(opts.confirmLabel || '✓ Confirmer') + '</button>' +
            '<button type="button" class="btn btn-secondary gws-no" style="padding:7px 14px;font-size:0.78em;">✕ Annuler</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    list.appendChild(div);
    list.scrollTop = list.scrollHeight;
    var yesBtn = div.querySelector('.gws-yes');
    var noBtn = div.querySelector('.gws-no');
    var box = div.querySelector('.gws-confirm-actions');
    yesBtn.onclick = async function() {
      yesBtn.disabled = true; noBtn.disabled = true;
      yesBtn.textContent = '⏳ Exécution...';
      try {
        var msg = await opts.onConfirm();
        box.innerHTML = '<span style="color:#4ade80;font-size:0.8em;font-weight:700;">' + _esc(msg || 'Action validée ✓') + '</span>';
      } catch(e) {
        box.innerHTML = '<span style="color:#f87171;font-size:0.8em;">Erreur : ' + _esc(e.message) + '</span>';
      }
    };
    noBtn.onclick = function() {
      box.innerHTML = '<span style="color:#94a3b8;font-size:0.8em;">Action annulée par l\'utilisateur.</span>';
    };
  }

  function renderGmailListCard(emails) {
    var list = document.getElementById('messagesList');
    if (!list) return;
    var div = document.createElement('div');
    div.className = 'message eva';
    var itemsHtml = emails.length
      ? emails.map(function(m) {
          return '<div style="padding:8px 10px;border-bottom:1px solid rgba(255,255,255,0.06);">' +
            '<div style="font-size:0.8em;font-weight:700;color:#eef2ff;">' + _esc(m.subject) + '</div>' +
            '<div style="font-size:0.7em;color:#38bdf8;">' + _esc(m.from) + '</div>' +
            '<div style="font-size:0.73em;color:#94a3b8;margin-top:2px;">' + _esc(m.snippet) + '</div>' +
          '</div>';
        }).join('')
      : '<div style="padding:10px;font-size:0.8em;color:#94a3b8;">Aucun message trouvé pour cette requête.</div>';
    div.innerHTML =
      '<div class="msg-content" style="max-width:560px;">' +
        '<div class="eva-agent-badge agent-gmail">✉️ Agent Gmail · ' + emails.length + ' message(s)</div>' +
        '<div class="msg-bubble" style="background:rgba(19,19,31,0.96);border:1px solid rgba(248,113,113,0.3);border-radius:14px;overflow:hidden;">' + itemsHtml + '</div>' +
      '</div>';
    list.appendChild(div);
    list.scrollTop = list.scrollHeight;
  }

  function showOnboardingModal() {
    if (document.getElementById('gwsOnboardingModal')) return;
    if (getGoogleToken()) return;
    var wrap = document.createElement('div');
    wrap.id = 'gwsOnboardingModal';
    wrap.style.cssText = 'position:fixed;inset:0;z-index:999950;background:rgba(0,0,0,0.72);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:18px;';
    wrap.innerHTML =
      '<div style="background:#13131f;border:1px solid rgba(0,212,255,0.38);border-radius:18px;max-width:440px;width:100%;padding:24px;box-shadow:0 24px 60px rgba(0,0,0,0.65);color:#eef2ff;">' +
        '<div style="font-family:\'Orbitron\',sans-serif;font-size:1em;font-weight:800;color:#00d4ff;margin-bottom:8px;">🔗 Connecter Google Workspace</div>' +
        '<p style="font-size:0.8em;color:#94a3b8;line-height:1.6;margin-bottom:16px;">Activez <strong>Google Agenda</strong> et <strong>Gmail</strong> en 1 clic pour permettre à E.V.A de consulter votre planning et rédiger vos e-mails (toujours avec validation humaine avant envoi).</p>' +
        '<div style="display:flex;gap:10px;">' +
          '<button type="button" id="gwsOnbConnect" style="flex:1;padding:10px 14px;border:none;border-radius:10px;background:linear-gradient(135deg,#00d4ff,#8b5cf6);color:#070912;font-weight:800;font-size:0.82em;cursor:pointer;">Connecter en 1 clic</button>' +
          '<button type="button" id="gwsOnbLater" style="padding:10px 14px;border:1px solid rgba(255,255,255,0.16);border-radius:10px;background:transparent;color:#94a3b8;font-size:0.82em;cursor:pointer;">Plus tard</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(wrap);
    wrap.querySelector('#gwsOnbConnect').onclick = async function() {
      this.disabled = true; this.textContent = 'Connexion...';
      await connectGoogleWorkspace();
      wrap.remove();
    };
    wrap.querySelector('#gwsOnbLater').onclick = function() {
      localStorage.setItem(ONBOARDING_DISMISSED_KEY, '1');
      wrap.remove();
    };
  }

  /* ── Rendu Paramètres → Connecteurs (MCP vs Codemod + Anti-Conflit) ── */
  function renderSettingsSection(container) {
    var st = loadState();
    var tok = getGoogleToken();
    function modePills(svc, current, allowNative) {
      var opts = allowNative
        ? [{k:'native',l:'Agent Natif'},{k:'codemod',l:'Codemod (Éco tokens)'},{k:'mcp',l:'MCP'},{k:'off',l:'Désactivé'}]
        : [{k:'codemod',l:'Codemod'},{k:'mcp',l:'MCP'},{k:'off',l:'Désactivé'}];
      return '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;">' + opts.map(function(o) {
        var act = current === o.k;
        return '<button type="button" onclick="window.EVAConnectors.uiSetMode(\'' + svc + '\',\'' + o.k + '\')" style="padding:5px 10px;border-radius:999px;font-size:0.72em;font-weight:600;cursor:pointer;border:1px solid ' + (act ? '#00d4ff' : 'rgba(255,255,255,0.12)') + ';background:' + (act ? 'rgba(0,212,255,0.16)' : 'rgba(26,26,46,0.65)') + ';color:' + (act ? '#00d4ff' : '#94a3b8') + ';">' + o.l + '</button>';
      }).join('') + '</div>';
    }
    container.innerHTML =
      '<div class="settings-section">' +
        '<div class="settings-section-title">Connecteurs · Dual MCP + Codemod</div>' +
        '<div style="background:rgba(0,212,255,0.06);border:1px solid rgba(0,212,255,0.25);border-radius:12px;padding:12px 14px;margin-bottom:16px;font-size:0.76em;color:#cbd5e1;line-height:1.55;">' +
          '<strong>1 seule source de vérité par service</strong> : choisir Natif, Codemod ou MCP désactive automatiquement l\'alternative concurrente pour éviter tout doublon ou conflit d\'outils.' +
        '</div>' +

        '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:12px;">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">' +
            '<div><div style="font-weight:700;font-size:0.88em;">Google Workspace (Agenda & Gmail)</div><div style="font-size:0.72em;color:var(--text-muted);">' + (tok ? ('🟢 Connecté (' + _esc(tok.email || 'Google OAuth') + ')') : '⚪ Non connecté — OAuth 1 clic') + '</div></div>' +
            (tok
              ? '<button class="btn btn-secondary" style="font-size:0.74em;padding:5px 10px;" onclick="window.EVAConnectors.disconnectGoogleWorkspace();renderSettings(\'connectors\')">Déconnecter</button>'
              : '<button class="btn btn-primary" style="font-size:0.74em;padding:6px 12px;" onclick="window.EVAConnectors.connectGoogleWorkspace().then(function(){renderSettings(\'connectors\')})">Connecter Google</button>') +
          '</div>' +
        '</div>' +

        '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:10px;">' +
          '<div style="font-weight:700;font-size:0.84em;">📅 Google Agenda</div>' +
          '<div style="font-size:0.71em;color:var(--text-muted);">Mode exclusif (Natif vs Codemod vs MCP Calendar)</div>' +
          modePills('calendar', st.calendar.mode, true) +
        '</div>' +

        '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:10px;">' +
          '<div style="font-weight:700;font-size:0.84em;">✉️ Gmail</div>' +
          '<div style="font-size:0.71em;color:var(--text-muted);">Mode exclusif avec confirmation humaine obligatoire avant envoi</div>' +
          modePills('gmail', st.gmail.mode, true) +
        '</div>' +

        '<div class="settings-section-title" style="margin-top:16px;">Phase 2 — Productivité & Dev (Coexistence Notes EVA)</div>' +
        '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:10px;">' +
          '<div style="font-weight:700;font-size:0.84em;">🐙 GitHub</div>' +
          modePills('github', st.github.mode, false) +
          '<input id="connGithubToken" type="password" class="form-input" style="margin-top:8px;font-size:0.76em;" placeholder="Token GitHub PAT (optionnel pour dépôts privés)" value="' + _esc(st.github.token || '') + '">' +
        '</div>' +
        '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:12px;">' +
          '<div style="font-weight:700;font-size:0.84em;">📓 Notion</div>' +
          modePills('notion', st.notion.mode, false) +
          '<input id="connNotionToken" type="password" class="form-input" style="margin-top:8px;font-size:0.76em;" placeholder="Clé d\'intégration Notion (secret_...)" value="' + _esc(st.notion.token || '') + '">' +
        '</div>' +
        '<button type="button" class="btn btn-primary" onclick="window.EVAConnectors.saveTokensFromUI()">Sauvegarder les jetons Connecteurs</button>' +
      '</div>';
  }

  /* Proposer l'onboarding Google Workspace une fois après chargement profil */
  document.addEventListener('eva:authReady', function() {
    setTimeout(function() {
      try {
        if (!w.S || !w.S.user) return;
        if (getGoogleToken()) return;
        if (localStorage.getItem(ONBOARDING_DISMISSED_KEY) === '1') return;
        // Nouveau compte (< 10 min) : afficher l'onboarding Google Workspace
        var created = w.S.profile && w.S.profile.createdAt && w.S.profile.createdAt.toMillis ? w.S.profile.createdAt.toMillis() : 0;
        if (created && (Date.now() - created) < 10 * 60 * 1000) {
          showOnboardingModal();
        }
      } catch(_) {}
    }, 2200);
  });

  w.EVAConnectors = {
    loadState: loadState,
    saveState: saveState,
    getGoogleToken: getGoogleToken,
    connectGoogleWorkspace: connectGoogleWorkspace,
    disconnectGoogleWorkspace: disconnectGoogleWorkspace,
    setServiceMode: setServiceMode,
    buildSystemPromptAddendum: buildSystemPromptAddendum,
    handleCalendarAction: handleCalendarAction,
    handleGmailAction: handleGmailAction,
    handleGithubQuery: handleGithubQuery,
    showOnboardingModal: showOnboardingModal,
    renderSettingsSection: renderSettingsSection,
    uiSetMode: async function(svc, mode) {
      await setServiceMode(svc, mode);
      var c = document.getElementById('settingsContent');
      if (c) renderSettingsSection(c);
      if (w.toast) w.toast(svc + ' → mode ' + mode, 'success');
    },
    saveTokensFromUI: async function() {
      var st = loadState();
      var gh = document.getElementById('connGithubToken');
      var nt = document.getElementById('connNotionToken');
      if (gh) st.github.token = gh.value.trim();
      if (nt) st.notion.token = nt.value.trim();
      await saveState(st);
      if (w.toast) w.toast('Connecteurs sauvegardés ✓', 'success');
    }
  };
})(window);
