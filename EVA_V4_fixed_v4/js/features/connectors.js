/* ═══════════════════════════════════════════════════════════════════════
   EVA — CONNECTORS.JS + EVAMail (V4.1)
   Dual Architecture : Agent Natif vs Codemod vs MCP JSON-RPC 2.0
   1 seule source de vérité par service + Google Workspace (Agenda/Gmail/Drive)
   + Catalogue élargi (GitHub, Notion, Slack, Discord, Linear, Spotify)
   + Serveurs MCP personnalisés + Vue Mails dédiée (#viewMail)
   ═══════════════════════════════════════════════════════════════════════ */
(function(w) {
  'use strict';

  var STORAGE_KEY = 'eva_connectors_v1';
  var GWS_TOKEN_KEY = 'eva_gws_oauth';
  var ONBOARDING_DISMISSED_KEY = 'eva_gws_onboarding_dismissed';

  var DEFAULT_STATE = {
    calendar:   { mode: 'native', mcpUrl: '' },
    gmail:      { mode: 'native', mcpUrl: '' },
    gdrive:     { mode: 'off',    mcpUrl: '' },
    github:     { mode: 'off',    token: '', mcpUrl: '' },
    notion:     { mode: 'off',    token: '', mcpUrl: '' },
    slack:      { mode: 'off',    webhook: '', mcpUrl: '' },
    discord:    { mode: 'off',    webhook: '', mcpUrl: '' },
    linear:     { mode: 'off',    token: '', mcpUrl: '' },
    spotify:    { mode: 'off',    mcpUrl: '' },
    customMcps: [] // [{ id, name, url, tools: [] }]
  };

  function _esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function loadState() {
    var local = {};
    try { local = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch(_) {}
    var prof = (w.S && w.S.profile && w.S.profile.connectors) || {};
    var out = {};
    Object.keys(DEFAULT_STATE).forEach(function(k) {
      if (k === 'customMcps') {
        var list = Array.isArray(local.customMcps) ? local.customMcps : (Array.isArray(prof.customMcps) ? prof.customMcps : []);
        out.customMcps = list;
      } else {
        out[k] = Object.assign({}, DEFAULT_STATE[k], local[k] || {}, prof[k] || {});
      }
    });
    return out;
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
      provider.addScope('https://www.googleapis.com/auth/drive.readonly');
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
      if (w.toast) w.toast('✅ Google Workspace (Agenda + Gmail + Drive) connecté !', 'success');
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
    st.gdrive.mode = 'off';
    saveState(st);
    if (w.toast) w.toast('Google Workspace déconnecté', 'info');
  }

  /* ── Anti-conflit : 1 seule source de vérité par service ── */
  async function setServiceMode(serviceKey, mode, extras) {
    var st = loadState();
    if (!st[serviceKey] || Array.isArray(st[serviceKey])) return st;
    var nativeSvcs = ['calendar', 'gmail', 'gdrive'];
    var allowed = nativeSvcs.indexOf(serviceKey) !== -1
      ? ['off', 'native', 'codemod', 'mcp']
      : ['off', 'codemod', 'mcp'];
    st[serviceKey].mode = allowed.indexOf(mode) !== -1 ? mode : 'off';
    if (extras && typeof extras === 'object') Object.assign(st[serviceKey], extras);
    await saveState(st);
    return st;
  }

  /* ── Client MCP HTTP JSON-RPC 2.0 (tools/list + tools/call) ── */
  async function mcpRpcCall(url, method, params) {
    var cleanUrl = String(url || '').trim();
    if (!cleanUrl) throw new Error('URL MCP manquante');
    var res = await fetch(cleanUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method: method, params: params || {} })
    });
    if (!res.ok) throw new Error('MCP HTTP ' + res.status);
    var data = await res.json();
    if (data && data.error) throw new Error(data.error.message || 'Erreur MCP');
    return data ? data.result : null;
  }

  async function addCustomMcp(name, url) {
    var st = loadState();
    var item = {
      id: 'mcp_' + Date.now().toString(36),
      name: String(name || '').trim() || 'Serveur MCP',
      url: String(url || '').trim(),
      tools: [],
      status: 'pending'
    };
    if (!item.url) throw new Error('URL du serveur MCP requise');
    try {
      var res = await mcpRpcCall(item.url, 'tools/list', {});
      item.tools = (res && Array.isArray(res.tools)) ? res.tools.map(function(t) { return { name: t.name, description: t.description || '' }; }) : [];
      item.status = 'ok';
    } catch(e) {
      item.status = 'unreachable';
    }
    st.customMcps.push(item);
    await saveState(st);
    return item;
  }

  async function testCustomMcp(id) {
    var st = loadState();
    var m = st.customMcps.find(function(x) { return x.id === id; });
    if (!m) return null;
    try {
      var res = await mcpRpcCall(m.url, 'tools/list', {});
      m.tools = (res && Array.isArray(res.tools)) ? res.tools.map(function(t) { return { name: t.name, description: t.description || '' }; }) : [];
      m.status = 'ok';
    } catch(e) {
      m.status = 'unreachable';
    }
    await saveState(st);
    return m;
  }

  async function removeCustomMcp(id) {
    var st = loadState();
    st.customMcps = st.customMcps.filter(function(x) { return x.id !== id; });
    await saveState(st);
  }

  /* ── Prompt dynamique injecté dans getDynamicSysPrompt() ── */
  function buildSystemPromptAddendum() {
    var st = loadState();
    var parts = [];
    if (st.calendar.mode !== 'off') {
      parts.push(
        '• Google Agenda [' + st.calendar.mode.toUpperCase() + ' — source unique] : ' +
        'utilise [ACTION:{"type":"gws_calendar","op":"list|create|update|delete","title":"...","start":"ISO","end":"ISO","id":"..."}] — toute écriture exige validation humaine.'
      );
    }
    if (st.gmail.mode !== 'off') {
      parts.push(
        '• Gmail [' + st.gmail.mode.toUpperCase() + ' — source unique] : ' +
        'utilise [ACTION:{"type":"gws_gmail","op":"list|read|draft|send|delete","query":"is:unread|newer_than:1d","to":"...","subject":"...","body":"...","id":"..."}] — JAMAIS d\'envoi ni suppression sans confirmation humaine.'
      );
    }
    if (st.gdrive.mode !== 'off') {
      parts.push('• Google Drive [' + st.gdrive.mode.toUpperCase() + '] : [ACTION:{"type":"gdrive_query","query":"nom du fichier"}].');
    }
    if (st.notion.mode !== 'off') {
      parts.push('• Notion [' + st.notion.mode.toUpperCase() + '] : actif en complément des Notes E.V.A (jamais en doublon).');
    }
    if (st.github.mode !== 'off') {
      parts.push('• GitHub [' + st.github.mode.toUpperCase() + '] : utilise [ACTION:{"type":"github_query","op":"repos|issues|search","repo":"owner/repo","query":"..."}].');
    }
    if (st.slack.mode !== 'off' || st.discord.mode !== 'off') {
      parts.push('• Slack/Discord : message webhook via [ACTION:{"type":"slack_query","service":"slack|discord","message":"..."}] (validation requise).');
    }
    if (st.customMcps && st.customMcps.length) {
      st.customMcps.forEach(function(m) {
        var tList = (m.tools || []).map(function(t) { return t.name; }).slice(0, 8).join(', ');
        parts.push('• MCP « ' + m.name + ' » : appelle un outil via [ACTION:{"type":"mcp_call","server":"' + m.name + '","tool":"<nom>","args":{...}}]' + (tList ? (' (outils: ' + tList + ')') : ''));
      });
    }
    if (!parts.length) return '';
    return '\n\n[CONNECTEURS ACTIFS — ARCHITECTURE DUAL NATIF/CODEMOD/MCP]\n' + parts.join('\n');
  }

  /* ── Agent Google Agenda ── */
  async function handleCalendarAction(action) {
    var tok = getGoogleToken();
    var op = (action.op || 'list').toLowerCase();
    if (op === 'list' || op === 'search') {
      if (!tok) {
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
    renderConfirmationCard({
      service: 'calendar',
      badge: '📅 Agent Agenda',
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

  /* ── Agent Gmail ── */
  async function handleGmailAction(action) {
    var tok = getGoogleToken();
    var op = (action.op || 'list').toLowerCase();
    if (!tok) {
      if (w.appendMsg) w.appendMsg('eva', '✉️ Connectez **Google Workspace** dans **Paramètres → Connecteurs** ou l\'onglet **Mails** pour accéder à Gmail.');
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

  /* ── GitHub, Drive, Slack/Discord & MCP Custom Dispatcher ── */
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

  async function handleConnectorAction(action) {
    var st = loadState();
    if (action.type === 'gdrive_query') {
      var tok = getGoogleToken();
      if (!tok) { if (w.appendMsg) w.appendMsg('eva', '📁 Connectez Google Workspace pour rechercher dans Google Drive.'); return null; }
      var q = encodeURIComponent("name contains '" + String(action.query || '').replace(/'/g, "\\'") + "' and trashed = false");
      var r = await fetch('https://www.googleapis.com/drive/v3/files?pageSize=8&fields=files(id,name,mimeType,webViewLink)&q=' + q, {
        headers: { 'Authorization': 'Bearer ' + tok.accessToken }
      });
      if (!r.ok) throw new Error('Drive HTTP ' + r.status);
      var dj = await r.json();
      if (w.appendMsg) {
        var lines = (dj.files || []).map(function(f) { return '- [' + f.name + '](' + (f.webViewLink || '#') + ')'; }).join('\n') || 'Aucun fichier trouvé.';
        w.appendMsg('eva', '📁 **Google Drive** :\n' + lines);
      }
      return dj;
    }
    if (action.type === 'slack_query') {
      var svc = action.service === 'discord' ? 'discord' : 'slack';
      var hook = (st[svc] && st[svc].webhook) || '';
      if (!hook) { if (w.appendMsg) w.appendMsg('eva', '⚠️ Webhook ' + svc + ' non configuré dans Paramètres → Connecteurs.'); return null; }
      renderConfirmationCard({
        service: svc,
        badge: (svc === 'discord' ? '🎮 Discord' : '💬 Slack'),
        summary: 'Envoyer un message sur ' + svc,
        details: action.message || '',
        confirmLabel: 'Envoyer',
        onConfirm: async function() {
          var payload = svc === 'discord' ? { content: action.message } : { text: action.message };
          var res = await fetch(hook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
          if (!res.ok) throw new Error('Webhook HTTP ' + res.status);
          return 'Message envoyé sur ' + svc + ' ✓';
        }
      });
      return { pendingConfirmation: true };
    }
    if (action.type === 'mcp_call') {
      var srv = (st.customMcps || []).find(function(m) {
        return m.name.toLowerCase() === String(action.server || '').toLowerCase() || m.id === action.server;
      }) || (st.customMcps && st.customMcps[0]);
      if (!srv) throw new Error('Serveur MCP introuvable : ' + (action.server || ''));
      var out = await mcpRpcCall(srv.url, 'tools/call', { name: action.tool, arguments: action.args || {} });
      if (w.appendMsg) w.appendMsg('eva', '🔌 **MCP (' + srv.name + ' → ' + action.tool + ')** :\n```json\n' + JSON.stringify(out, null, 2).slice(0, 2000) + '\n```');
      return out;
    }
    return null;
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
        '<div class="msg-bubble" style="background:#18181c;border:1px solid rgba(0,212,255,0.28);border-radius:14px;padding:14px 16px;">' +
          '<div style="font-weight:700;font-size:0.9em;color:#ededf2;margin-bottom:6px;">' + _esc(opts.summary) + '</div>' +
          (opts.details ? '<div style="font-size:0.78em;color:#9a9aa8;white-space:pre-wrap;margin-bottom:12px;">' + _esc(opts.details) + '</div>' : '') +
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
      box.innerHTML = '<span style="color:#9a9aa8;font-size:0.8em;">Action annulée par l\'utilisateur.</span>';
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
            '<div style="font-size:0.8em;font-weight:700;color:#ededf2;">' + _esc(m.subject) + '</div>' +
            '<div style="font-size:0.7em;color:#00d4ff;">' + _esc(m.from) + '</div>' +
            '<div style="font-size:0.73em;color:#9a9aa8;margin-top:2px;">' + _esc(m.snippet) + '</div>' +
          '</div>';
        }).join('')
      : '<div style="padding:10px;font-size:0.8em;color:#9a9aa8;">Aucun message trouvé pour cette requête.</div>';
    div.innerHTML =
      '<div class="msg-content" style="max-width:560px;">' +
        '<div class="eva-agent-badge agent-gmail">✉️ Gmail · ' + emails.length + ' message(s)</div>' +
        '<div class="msg-bubble" style="background:#18181c;border:1px solid rgba(255,255,255,0.09);border-radius:14px;overflow:hidden;">' + itemsHtml + '</div>' +
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
      '<div style="background:#18181c;border:1px solid rgba(0,212,255,0.34);border-radius:18px;max-width:450px;width:100%;padding:24px;box-shadow:0 24px 60px rgba(0,0,0,0.65);color:#ededf2;">' +
        '<div style="font-family:\'Orbitron\',sans-serif;font-size:1em;font-weight:800;color:#00d4ff;margin-bottom:8px;">🔗 Connecter Google Workspace</div>' +
        '<p style="font-size:0.8em;color:#9a9aa8;line-height:1.6;margin-bottom:12px;">Activez <strong>Google Agenda</strong>, <strong>Gmail</strong> et <strong>Drive</strong> en 1 clic pour consulter vos e-mails, synchroniser votre agenda et rédiger des brouillons (avec validation manuelle obligatoire avant envoi).</p>' +
        '<div class="gws-unverified-tip" style="margin-top:0;margin-bottom:14px;">💡 Si Google affiche <em>« Google n\'a pas pu vérifier cette application »</em>, cliquez sur <strong>Paramètres avancés → Accéder à eva... (non sécurisé)</strong>.</div>' +
        '<div style="display:flex;gap:10px;">' +
          '<button type="button" id="gwsOnbConnect" style="flex:1;padding:10px 14px;border:none;border-radius:10px;background:linear-gradient(135deg,#00d4ff,#6366f1);color:#061018;font-weight:800;font-size:0.82em;cursor:pointer;">Connecter en 1 clic</button>' +
          '<button type="button" id="gwsOnbLater" style="padding:10px 14px;border:1px solid rgba(255,255,255,0.14);border-radius:10px;background:transparent;color:#9a9aa8;font-size:0.82em;cursor:pointer;">Plus tard</button>' +
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

  /* ── Rendu Paramètres → Connecteurs (Architecture claire + Catalogue complet) ── */
  function renderSettingsSection(container) {
    var st = loadState();
    var tok = getGoogleToken();
    function modePills(svc, current, allowNative) {
      var opts = allowNative
        ? [{k:'native',l:'Agent Natif'},{k:'codemod',l:'Codemod'},{k:'mcp',l:'MCP'},{k:'off',l:'Désactivé'}]
        : [{k:'codemod',l:'Codemod'},{k:'mcp',l:'MCP'},{k:'off',l:'Désactivé'}];
      return '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;">' + opts.map(function(o) {
        var act = current === o.k;
        return '<button type="button" onclick="window.EVAConnectors.uiSetMode(\'' + svc + '\',\'' + o.k + '\')" style="padding:5px 10px;border-radius:999px;font-size:0.72em;font-weight:600;cursor:pointer;border:1px solid ' + (act ? '#00d4ff' : 'rgba(255,255,255,0.1)') + ';background:' + (act ? 'rgba(0,212,255,0.14)' : '#131316') + ';color:' + (act ? '#00d4ff' : '#9a9aa8') + ';">' + o.l + '</button>';
      }).join('') + '</div>';
    }

    var mcpsHtml = (st.customMcps || []).map(function(m) {
      var badge = m.status === 'ok'
        ? '<span style="color:#4ade80;font-size:0.72em;">● ' + (m.tools ? m.tools.length : 0) + ' outil(s)</span>'
        : '<span style="color:#f59e0b;font-size:0.72em;">● Non vérifié</span>';
      return '<div style="background:#131316;border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:10px 12px;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">' +
        '<div style="min-width:0;flex:1;"><div style="font-weight:700;font-size:0.82em;">🔌 ' + _esc(m.name) + ' ' + badge + '</div><div style="font-size:0.7em;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + _esc(m.url) + '</div></div>' +
        '<div style="display:flex;gap:6px;">' +
          '<button type="button" class="btn btn-secondary" style="font-size:0.72em;padding:4px 9px;" onclick="window.EVAConnectors.uiTestMcp(\'' + _esc(m.id) + '\')">Tester</button>' +
          '<button type="button" class="btn btn-secondary" style="font-size:0.72em;padding:4px 9px;color:#f87171;" onclick="window.EVAConnectors.uiRemoveMcp(\'' + _esc(m.id) + '\')">✕</button>' +
        '</div>' +
      '</div>';
    }).join('');

    container.innerHTML =
      '<div class="settings-section">' +
        '<div class="settings-section-title">Connecteurs · Natif, Codemod &amp; MCP</div>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(175px,1fr));gap:8px;margin-bottom:14px;">' +
          '<div style="background:#131316;border:1px solid rgba(0,212,255,0.22);border-radius:11px;padding:10px 12px;font-size:0.74em;line-height:1.5;"><strong style="color:#00d4ff;">⚡ Agent Natif</strong><br><span style="color:var(--text-muted);">Connexion directe par EVA via API officielle (ex: Google OAuth), avec carte de validation avant action.</span></div>' +
          '<div style="background:#131316;border:1px solid rgba(183,148,246,0.24);border-radius:11px;padding:10px 12px;font-size:0.74em;line-height:1.5;"><strong style="color:#b794f6;">🧩 Codemod</strong><br><span style="color:var(--text-muted);">Exécution compacte par script/action ciblée pour économiser tes tokens IA et accélérer les tâches.</span></div>' +
          '<div style="background:#131316;border:1px solid rgba(74,222,128,0.22);border-radius:11px;padding:10px 12px;font-size:0.74em;line-height:1.5;"><strong style="color:#4ade80;">🔌 Protocole MCP</strong><br><span style="color:var(--text-muted);">Connecte un serveur Model Context Protocol externe (JSON-RPC URL) avec découverte auto des outils.</span></div>' +
        '</div>' +

        '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:12px;">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">' +
            '<div><div style="font-weight:700;font-size:0.88em;">Google Workspace (Agenda, Gmail &amp; Drive)</div><div style="font-size:0.72em;color:var(--text-muted);">' + (tok ? ('🟢 Connecté (' + _esc(tok.email || 'Google OAuth') + ')') : '⚪ Non connecté — OAuth 1 clic') + '</div></div>' +
            (tok
              ? '<button type="button" class="btn btn-secondary" style="font-size:0.74em;padding:5px 10px;" onclick="window.EVAConnectors.disconnectGoogleWorkspace();renderSettings(\'connectors\')">Déconnecter</button>'
              : '<button type="button" class="btn btn-primary" style="font-size:0.74em;padding:6px 12px;" onclick="window.EVAConnectors.connectGoogleWorkspace().then(function(){renderSettings(\'connectors\')})">Connecter Google</button>') +
          '</div>' +
          '<div class="gws-unverified-tip">💡 Si Google affiche <em>« Google n\'a pas pu vérifier cette application »</em>, cliquez sur <strong>Paramètres avancés → Accéder à eva... (non sécurisé)</strong> pour valider l\'accès à votre propre compte.</div>' +
        '</div>' +

        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px;margin-bottom:14px;">' +
          '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:12px;">' +
            '<div style="font-weight:700;font-size:0.84em;">📅 Google Agenda</div>' +
            '<div style="font-size:0.71em;color:var(--text-muted);">Synchronisé avec votre onglet Agenda</div>' +
            modePills('calendar', st.calendar.mode, true) +
          '</div>' +
          '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:12px;">' +
            '<div style="font-weight:700;font-size:0.84em;">✉️ Gmail</div>' +
            '<div style="font-size:0.71em;color:var(--text-muted);">Synchronisé avec l\'onglet Mails (envoi validé)</div>' +
            modePills('gmail', st.gmail.mode, true) +
          '</div>' +
          '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:12px;">' +
            '<div style="font-weight:700;font-size:0.84em;">📁 Google Drive</div>' +
            '<div style="font-size:0.71em;color:var(--text-muted);">Recherche de documents via Google OAuth</div>' +
            modePills('gdrive', st.gdrive.mode, true) +
          '</div>' +
          '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:12px;">' +
            '<div style="font-weight:700;font-size:0.84em;">🎵 Spotify / Multimédia</div>' +
            '<div style="font-size:0.71em;color:var(--text-muted);">Contrôle playlists &amp; lecture via Codemod/MCP</div>' +
            modePills('spotify', st.spotify.mode, false) +
          '</div>' +
        '</div>' +

        '<div class="settings-section-title" style="margin-top:8px;">Développement, Équipe &amp; Productivité</div>' +
        '<div style="display:flex;flex-direction:column;gap:10px;margin-bottom:14px;">' +
          '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:12px;">' +
            '<div style="font-weight:700;font-size:0.84em;">🐙 GitHub</div>' +
            modePills('github', st.github.mode, false) +
            '<input id="connGithubToken" type="password" class="form-input" style="margin-top:8px;font-size:0.76em;" placeholder="Token GitHub PAT (ghp_...)" value="' + _esc(st.github.token || '') + '">' +
          '</div>' +
          '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:12px;">' +
            '<div style="font-weight:700;font-size:0.84em;">📓 Notion</div>' +
            modePills('notion', st.notion.mode, false) +
            '<input id="connNotionToken" type="password" class="form-input" style="margin-top:8px;font-size:0.76em;" placeholder="Clé Notion (secret_...)" value="' + _esc(st.notion.token || '') + '">' +
          '</div>' +
          '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:12px;">' +
            '<div style="font-weight:700;font-size:0.84em;">💬 Slack</div>' +
            modePills('slack', st.slack.mode, false) +
            '<input id="connSlackWebhook" type="password" class="form-input" style="margin-top:8px;font-size:0.76em;" placeholder="Webhook Slack (https://hooks.slack.com/...)" value="' + _esc(st.slack.webhook || '') + '">' +
          '</div>' +
          '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:12px;">' +
            '<div style="font-weight:700;font-size:0.84em;">🎮 Discord</div>' +
            modePills('discord', st.discord.mode, false) +
            '<input id="connDiscordWebhook" type="password" class="form-input" style="margin-top:8px;font-size:0.76em;" placeholder="Webhook Discord (https://discord.com/api/webhooks/...)" value="' + _esc(st.discord.webhook || '') + '">' +
          '</div>' +
          '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:12px;">' +
            '<div style="font-weight:700;font-size:0.84em;">📌 Linear / Trello</div>' +
            modePills('linear', st.linear.mode, false) +
            '<input id="connLinearToken" type="password" class="form-input" style="margin-top:8px;font-size:0.76em;" placeholder="Clé API Linear / Trello" value="' + _esc(st.linear.token || '') + '">' +
          '</div>' +
        '</div>' +
        '<button type="button" class="btn btn-primary" onclick="window.EVAConnectors.saveTokensFromUI()">Sauvegarder les connecteurs</button>' +

        '<div class="settings-section-title" style="margin-top:18px;">Serveurs MCP personnalisés (JSON-RPC 2.0)</div>' +
        '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:8px;">' +
          (mcpsHtml || '<div style="font-size:0.76em;color:var(--text-muted);">Aucun serveur MCP personnalisé ajouté.</div>') +
          '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px;">' +
            '<input id="newMcpName" type="text" class="form-input" style="flex:1 1 130px;font-size:0.78em;" placeholder="Nom (ex: Postgres)">' +
            '<input id="newMcpUrl" type="url" class="form-input" style="flex:2 1 200px;font-size:0.78em;" placeholder="https://mon-serveur-mcp/rpc">' +
            '<button type="button" class="btn btn-primary" style="font-size:0.76em;padding:7px 14px;" onclick="window.EVAConnectors.uiAddMcp()">+ Ajouter MCP</button>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  document.addEventListener('eva:authReady', function() {
    setTimeout(function() {
      try {
        if (!w.S || !w.S.user) return;
        if (getGoogleToken()) return;
        if (localStorage.getItem(ONBOARDING_DISMISSED_KEY) === '1') return;
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
    handleConnectorAction: handleConnectorAction,
    addCustomMcp: addCustomMcp,
    testCustomMcp: testCustomMcp,
    removeCustomMcp: removeCustomMcp,
    showOnboardingModal: showOnboardingModal,
    renderSettingsSection: renderSettingsSection,
    uiSetMode: async function(svc, mode) {
      await setServiceMode(svc, mode);
      var c = document.getElementById('settingsContent');
      if (c) renderSettingsSection(c);
      if (w.toast) w.toast(svc + ' → ' + mode, 'success');
    },
    saveTokensFromUI: async function() {
      var st = loadState();
      var gh = document.getElementById('connGithubToken');
      var nt = document.getElementById('connNotionToken');
      var sl = document.getElementById('connSlackWebhook');
      var dc = document.getElementById('connDiscordWebhook');
      var ln = document.getElementById('connLinearToken');
      if (gh) st.github.token = gh.value.trim();
      if (nt) st.notion.token = nt.value.trim();
      if (sl) st.slack.webhook = sl.value.trim();
      if (dc) st.discord.webhook = dc.value.trim();
      if (ln) st.linear.token = ln.value.trim();
      await saveState(st);
      if (w.toast) w.toast('Connecteurs sauvegardés ✓', 'success');
    },
    uiAddMcp: async function() {
      var nEl = document.getElementById('newMcpName');
      var uEl = document.getElementById('newMcpUrl');
      if (!uEl || !uEl.value.trim()) { if (w.toast) w.toast('Entrez l\'URL du serveur MCP', 'warning'); return; }
      try {
        var added = await addCustomMcp(nEl ? nEl.value : '', uEl.value);
        if (w.toast) w.toast(added.status === 'ok' ? ('Serveur MCP connecté (' + added.tools.length + ' outils) ✓') : 'Serveur MCP enregistré (hors ligne pour le moment)', added.status === 'ok' ? 'success' : 'info');
        var c = document.getElementById('settingsContent');
        if (c) renderSettingsSection(c);
      } catch(e) { if (w.toast) w.toast(e.message, 'error'); }
    },
    uiTestMcp: async function(id) {
      var m = await testCustomMcp(id);
      if (w.toast && m) w.toast(m.status === 'ok' ? (m.name + ' : ' + m.tools.length + ' outil(s) actifs') : (m.name + ' injoignable'), m.status === 'ok' ? 'success' : 'warning');
      var c = document.getElementById('settingsContent');
      if (c) renderSettingsSection(c);
    },
    uiRemoveMcp: async function(id) {
      await removeCustomMcp(id);
      var c = document.getElementById('settingsContent');
      if (c) renderSettingsSection(c);
    }
  };

  /* ═══════════════════════════════════════════════════════════════════════
     VUE MAILS DÉDIÉE (#viewMail) — Lecture, Résumé EVA, Réponse & Rédaction
     ═══════════════════════════════════════════════════════════════════════ */
  var _mailFilter = 'inbox';
  var _mailQuery = '';
  var _mailItems = [];
  var _mailSelected = null;

  function _decodeB64Url(str) {
    try {
      var s = String(str || '').replace(/-/g, '+').replace(/_/g, '/');
      return decodeURIComponent(escape(atob(s)));
    } catch(_) { return ''; }
  }

  function _extractBody(payload) {
    if (!payload) return '';
    if (payload.body && payload.body.data && (!payload.mimeType || payload.mimeType === 'text/plain')) {
      return _decodeB64Url(payload.body.data);
    }
    if (Array.isArray(payload.parts)) {
      for (var i = 0; i < payload.parts.length; i++) {
        var found = _extractBody(payload.parts[i]);
        if (found) return found;
      }
      for (var j = 0; j < payload.parts.length; j++) {
        if (payload.parts[j].body && payload.parts[j].body.data) {
          return _decodeB64Url(payload.parts[j].body.data).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        }
      }
    }
    return '';
  }

  function _renderMailView() {
    var root = document.getElementById('mailViewBody');
    if (!root) return;
    var tok = getGoogleToken();
    if (!tok) {
      root.innerHTML =
        '<div class="mail-onboard-card">' +
          '<div style="font-size:1.8em;margin-bottom:8px;">✉️</div>' +
          '<div style="font-family:\'Orbitron\',sans-serif;font-size:1em;font-weight:800;color:#00d4ff;margin-bottom:8px;">Connectez Gmail à E.V.A</div>' +
          '<p style="font-size:0.84em;color:#9a9aa8;line-height:1.6;margin-bottom:14px;">Consultez votre boîte de réception ici, demandez à E.V.A de résumer un fil ou de préparer une réponse, toujours avec validation explicite avant envoi.</p>' +
          '<button type="button" class="btn btn-primary" onclick="EVAMail.connect()">Connecter Google Workspace (Gmail + Agenda)</button>' +
          '<div class="gws-unverified-tip">💡 Si Google affiche <em>« Google n\'a pas pu vérifier cette application »</em>, cliquez sur <strong>Paramètres avancés → Accéder à eva... (non sécurisé)</strong> pour autoriser l\'accès à votre compte.</div>' +
        '</div>';
      return;
    }

    var listHtml = _mailItems.length
      ? _mailItems.map(function(m) {
          var act = _mailSelected && _mailSelected.id === m.id ? ' active' : '';
          return '<div class="mail-row' + act + '" onclick="EVAMail.openMsg(\'' + _esc(m.id) + '\')">' +
            '<div class="mail-row-from">' + _esc(m.from) + '</div>' +
            '<div class="mail-row-subj">' + _esc(m.subject) + '</div>' +
            '<div class="mail-row-snip">' + _esc(m.snippet) + '</div>' +
          '</div>';
        }).join('')
      : '<div style="padding:28px;text-align:center;color:#9a9aa8;font-size:0.84em;">Aucun e-mail trouvé pour ce filtre.</div>';

    var readerHtml = _mailSelected
      ? '<div class="mail-reader-head">' +
          '<div class="mail-reader-subj">' + _esc(_mailSelected.subject) + '</div>' +
          '<div class="mail-reader-meta">De : <strong>' + _esc(_mailSelected.from) + '</strong>' + (_mailSelected.date ? ' · ' + _esc(_mailSelected.date) : '') + '</div>' +
        '</div>' +
        '<div class="mail-reader-actions">' +
          '<button type="button" class="btn btn-secondary" style="font-size:0.78em;padding:6px 12px;" onclick="EVAMail.askEvaSummarize()">✨ Résumer avec EVA</button>' +
          '<button type="button" class="btn btn-secondary" style="font-size:0.78em;padding:6px 12px;" onclick="EVAMail.askEvaReply()">↩ Préparer une réponse</button>' +
          '<button type="button" class="btn btn-secondary" style="font-size:0.78em;padding:6px 12px;color:#f87171;" onclick="EVAMail.trashMsg(\'' + _esc(_mailSelected.id) + '\')">🗑 Corbeille</button>' +
        '</div>' +
        '<div class="mail-reader-body">' + _esc(_mailSelected.body || _mailSelected.snippet || '(Contenu vide)') + '</div>'
      : '<div style="margin:auto;text-align:center;color:#9a9aa8;font-size:0.86em;">Sélectionnez un e-mail pour le lire ou agir dessus avec E.V.A.</div>';

    root.innerHTML =
      '<div class="mail-shell">' +
        '<div class="mail-toolbar">' +
          '<div class="mail-tabs">' +
            '<button type="button" class="mail-tab' + (_mailFilter === 'inbox' ? ' active' : '') + '" onclick="EVAMail.setFilter(\'inbox\')">Récents</button>' +
            '<button type="button" class="mail-tab' + (_mailFilter === 'unread' ? ' active' : '') + '" onclick="EVAMail.setFilter(\'unread\')">Non lus</button>' +
            '<button type="button" class="mail-tab' + (_mailFilter === 'sent' ? ' active' : '') + '" onclick="EVAMail.setFilter(\'sent\')">Envoyés</button>' +
          '</div>' +
          '<input type="search" id="mailSearchInput" class="mail-search" placeholder="Rechercher un expéditeur, objet..." value="' + _esc(_mailQuery) + '" onkeydown="if(event.key===\'Enter\')EVAMail.search(this.value)">' +
          '<span style="font-size:0.74em;color:#4ade80;">● ' + _esc(tok.email || 'Gmail connecté') + '</span>' +
        '</div>' +
        '<div class="mail-grid">' +
          '<div class="mail-list">' + listHtml + '</div>' +
          '<div class="mail-reader">' + readerHtml + '</div>' +
        '</div>' +
      '</div>';
  }

  w.EVAMail = {
    connect: async function() {
      var ok = await connectGoogleWorkspace();
      if (ok) this.load();
    },
    setFilter: function(f) {
      _mailFilter = f;
      this.load();
    },
    search: function(q) {
      _mailQuery = String(q || '').trim();
      this.load();
    },
    load: async function() {
      var tok = getGoogleToken();
      if (!tok) { _renderMailView(); return; }
      var root = document.getElementById('mailViewBody');
      if (root && !_mailItems.length) root.innerHTML = '<div class="empty-state"><p>Synchronisation Gmail...</p></div>';
      try {
        var qParts = [];
        if (_mailFilter === 'unread') qParts.push('is:unread');
        else if (_mailFilter === 'sent') qParts.push('in:sent');
        if (_mailQuery) qParts.push(_mailQuery);
        var qStr = qParts.join(' ');
        var lr = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=15' + (qStr ? ('&q=' + encodeURIComponent(qStr)) : ''), {
          headers: { 'Authorization': 'Bearer ' + tok.accessToken }
        });
        if (lr.status === 401) {
          localStorage.removeItem(GWS_TOKEN_KEY);
          _renderMailView();
          return;
        }
        if (!lr.ok) throw new Error('Gmail HTTP ' + lr.status);
        var lj = await lr.json();
        var ids = (lj.messages || []).slice(0, 15);
        var loaded = await Promise.all(ids.map(async function(item) {
          var mr = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/' + item.id + '?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date', {
            headers: { 'Authorization': 'Bearer ' + tok.accessToken }
          });
          if (!mr.ok) return null;
          var mj = await mr.json();
          var h = {};
          (mj.payload && mj.payload.headers || []).forEach(function(x) { h[x.name] = x.value; });
          return { id: item.id, from: h.From || '?', subject: h.Subject || '(Sans objet)', date: h.Date || '', snippet: mj.snippet || '', body: null };
        }));
        _mailItems = loaded.filter(Boolean);
        _renderMailView();
      } catch(e) {
        if (w.toast) w.toast('Erreur chargement Gmail : ' + e.message, 'error');
        _renderMailView();
      }
    },
    openMsg: async function(id) {
      var tok = getGoogleToken();
      var item = _mailItems.find(function(x) { return x.id === id; });
      if (!item || !tok) return;
      _mailSelected = item;
      _renderMailView();
      if (item.body === null) {
        try {
          var r = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/' + encodeURIComponent(id) + '?format=full', {
            headers: { 'Authorization': 'Bearer ' + tok.accessToken }
          });
          if (r.ok) {
            var full = await r.json();
            item.body = _extractBody(full.payload) || item.snippet || '';
            _mailSelected = item;
            _renderMailView();
          }
        } catch(_) {}
      }
    },
    askEvaSummarize: function() {
      if (!_mailSelected || !w.setView) return;
      var prompt = 'Résume cet e-mail de ' + _mailSelected.from + ' (Objet : ' + _mailSelected.subject + ') :\n\n' + (_mailSelected.body || _mailSelected.snippet || '').slice(0, 3000);
      w.setView('chat');
      var inp = document.getElementById('msgInput');
      if (inp) { inp.value = prompt; if (w.handleSend) w.handleSend(); }
    },
    askEvaReply: function() {
      if (!_mailSelected || !w.setView) return;
      var prompt = 'Rédige un brouillon de réponse courtois à cet e-mail de ' + _mailSelected.from + ' (Objet : Re: ' + _mailSelected.subject + ') et propose-le avec l\'action Gmail avant envoi :\n\n' + (_mailSelected.body || _mailSelected.snippet || '').slice(0, 2000);
      w.setView('chat');
      var inp = document.getElementById('msgInput');
      if (inp) { inp.value = prompt; if (w.handleSend) w.handleSend(); }
    },
    trashMsg: async function(id) {
      var tok = getGoogleToken();
      if (!tok || !confirm('Déplacer cet e-mail vers la corbeille Gmail ?')) return;
      var r = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/' + encodeURIComponent(id) + '/trash', {
        method: 'POST', headers: { 'Authorization': 'Bearer ' + tok.accessToken }
      });
      if (r.ok) {
        _mailItems = _mailItems.filter(function(x) { return x.id !== id; });
        if (_mailSelected && _mailSelected.id === id) _mailSelected = null;
        if (w.toast) w.toast('E-mail déplacé vers la corbeille ✓', 'success');
        _renderMailView();
      }
    },
    openCompose: function() {
      var tok = getGoogleToken();
      if (!tok) { this.connect(); return; }
      var root = document.getElementById('mailViewBody');
      if (!root) return;
      var existing = document.getElementById('mailComposeModal');
      if (existing) existing.remove();
      var ov = document.createElement('div');
      ov.id = 'mailComposeModal';
      ov.style.cssText = 'position:fixed;inset:0;z-index:99990;background:rgba(0,0,0,0.72);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:16px;';
      ov.innerHTML =
        '<div style="background:#18181c;border:1px solid rgba(255,255,255,0.12);border-radius:16px;max-width:480px;width:100%;padding:20px;display:flex;flex-direction:column;gap:10px;">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;"><strong style="color:#00d4ff;">Nouveau message</strong><button type="button" onclick="this.closest(\'#mailComposeModal\').remove()" style="background:none;border:none;color:#9a9aa8;font-size:18px;cursor:pointer;">✕</button></div>' +
          '<input id="mcTo" type="email" class="form-input" placeholder="Destinataire (ex: contact@exemple.com)">' +
          '<input id="mcSubj" type="text" class="form-input" placeholder="Objet">' +
          '<textarea id="mcBody" class="form-textarea" rows="6" placeholder="Votre message..."></textarea>' +
          '<div style="display:flex;gap:8px;justify-content:flex-end;">' +
            '<button type="button" class="btn btn-secondary" onclick="this.closest(\'#mailComposeModal\').remove()">Annuler</button>' +
            '<button type="button" class="btn btn-primary" onclick="EVAMail.sendCompose()">✉️ Envoyer</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(ov);
    },
    sendCompose: async function() {
      var tok = getGoogleToken();
      if (!tok) return;
      var to = (document.getElementById('mcTo') || {}).value || '';
      var subj = (document.getElementById('mcSubj') || {}).value || '';
      var body = (document.getElementById('mcBody') || {}).value || '';
      if (!to.trim()) { if (w.toast) w.toast('Destinataire requis', 'warning'); return; }
      var rawMime = 'To: ' + to.trim() + '\r\nSubject: ' + subj.trim() + '\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n' + body;
      var encoded = btoa(unescape(encodeURIComponent(rawMime))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      var sr = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + tok.accessToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw: encoded })
      });
      if (!sr.ok) { if (w.toast) w.toast('Erreur envoi HTTP ' + sr.status, 'error'); return; }
      var m = document.getElementById('mailComposeModal');
      if (m) m.remove();
      if (w.toast) w.toast('Message envoyé à ' + to.trim() + ' ✓', 'success');
      this.load();
    }
  };
})(window);
