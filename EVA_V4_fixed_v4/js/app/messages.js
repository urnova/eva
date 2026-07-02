/* ═══════════════════════════════════════════════════
   MESSAGES
═══════════════════════════════════════════════════ */
var _renderedMsgOffset = 0;
var MSG_PAGE = 40;

function renderMsgs() {
  var list = document.getElementById('messagesList');
  if (!list) return;
  list.innerHTML = '';
  _renderedMsgOffset = Math.max(0, S.messages.length - MSG_PAGE);
  /* Bouton "Charger les messages précédents" si historique tronqué */
  if (_renderedMsgOffset > 0) {
    var loadBtn = document.createElement('div');
    loadBtn.id = 'loadOlderBtn';
    loadBtn.style.cssText = 'text-align:center;padding:8px 0 4px;';
    loadBtn.innerHTML = '<button onclick="loadOlderMsgs()" style="background:rgba(0,195,230,0.1);border:1px solid rgba(0,195,230,0.3);color:#00c3e6;border-radius:20px;padding:4px 18px;font-size:0.78em;cursor:pointer;font-family:inherit;">⬆ Charger les messages précédents ('+_renderedMsgOffset+')</button>';
    list.appendChild(loadBtn);
  }
  for (var i = _renderedMsgOffset; i < S.messages.length; i++) {
    var _md = buildMsgDom(S.messages[i]);
    _md.dataset.msgIdx = i;
    list.appendChild(_md);
  }
  scrollDown();
}

function loadOlderMsgs() {
  var list = document.getElementById('messagesList');
  if (!list) return;
  var prevTop = list.scrollHeight;
  var newOffset = Math.max(0, _renderedMsgOffset - MSG_PAGE);
  var frag = document.createDocumentFragment();
  for (var i = newOffset; i < _renderedMsgOffset; i++) {
    var _md2 = buildMsgDom(S.messages[i]);
    _md2.dataset.msgIdx = i;
    frag.appendChild(_md2);
  }
  _renderedMsgOffset = newOffset;
  /* Insérer avant le premier message existant */
  var firstMsg = list.querySelector('.message');
  if (firstMsg) list.insertBefore(frag, firstMsg);
  else list.appendChild(frag);
  /* Mettre à jour ou supprimer le bouton */
  var btn = document.getElementById('loadOlderBtn');
  if (_renderedMsgOffset === 0) {
    if (btn) btn.remove();
  } else {
    if (btn) btn.querySelector('button').textContent = '⬆ Charger les messages précédents (' + _renderedMsgOffset + ')';
  }
  /* Maintenir la position de scroll */
  list.scrollTop = list.scrollHeight - prevTop;
}

function buildMsgHTML(msg, idx) {
  var isEva = msg.role === 'eva' || msg.role === 'assistant';
  var time = '';
  if (msg.timestamp && msg.timestamp.toDate) {
    time = msg.timestamp.toDate().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
  } else if (msg.time) { time = msg.time; }
  var content = isEva ? mdToHtml(msg.content) : esc(msg.content);
  var mdAttr = isEva ? ' data-md="'+encodeURIComponent(msg.content||'')+'"' : '';
  return '<div class="message '+(isEva?'eva':'user')+'">' +
    '<div class="msg-ava">'+(isEva?'<svg viewBox="0 0 24 24" style="width:15px;height:15px;stroke:var(--cyan);fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><circle cx="12" cy="16" r="1" fill="var(--cyan)" stroke="none"/></svg>':'<span>U</span>')+'</div>' +
    '<div class="msg-content">' +
      '<div class="msg-bubble"'+mdAttr+'>'+content+'</div>' +
      (time ? '<div class="msg-time">'+time+'</div>' : '') +
      (isEva ? '<div class="msg-actions"><button class="msg-act" onclick="copyMsg(this)"><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>Copier</button><button class="msg-act" onclick="speakMsg(this)" title="Écouter"><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg></button></div>' : '') +
    '</div>' +
  '</div>';
}

function appendMsg(role, content, imgUrlOrArr, docOrArr) {
  var list = document.getElementById('messagesList');
  if (!list) return;
  document.getElementById('chatWelcome').style.display = 'none';
  var time = new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
  var msg = {role: role, content: content, time: time};
  if (!S.messages) S.messages = [];
  S.messages.push(msg);
  var div = buildMsgDom(msg);
  div.dataset.msgIdx = S.messages.length - 1;
  var bubble = div.querySelector('.msg-bubble');

  /* ── Images (accepte string URL legacy OU tableau) ── */
  if (bubble) {
    var images = Array.isArray(imgUrlOrArr)
      ? imgUrlOrArr
      : (imgUrlOrArr ? [{ url: imgUrlOrArr, name: 'image' }] : []);

    if (images.length === 1) {
      /* Bulle simple : une seule image */
      var gallery = document.createElement('div');
      gallery.className = 'msg-img-gallery single';
      var im = document.createElement('img');
      im.src = images[0].url || images[0]; im.className = 'msg-image'; im.alt = images[0].name || 'Image';
      gallery.appendChild(im);
      bubble.appendChild(gallery);
    } else if (images.length > 1) {
      /* Galerie multi-images */
      var gallery = document.createElement('div');
      gallery.className = 'msg-img-gallery';
      images.forEach(function(im) {
        var el = document.createElement('img');
        el.src = im.url || im; el.className = 'msg-image'; el.alt = im.name || 'Image';
        el.title = im.name || 'Image';
        gallery.appendChild(el);
      });
      var countEl = document.createElement('div');
      countEl.style.cssText = 'font-size:0.7em;color:var(--text-muted);margin-top:2px;';
      countEl.textContent = images.length + ' photos jointes';
      bubble.appendChild(gallery);
      bubble.appendChild(countEl);
    }
  }

  /* ── Documents (accepte objet legacy OU tableau) ── */
  if (bubble) {
    var docs = Array.isArray(docOrArr)
      ? docOrArr.filter(function(d){ return d && d.name; })
      : (docOrArr && docOrArr.name ? [docOrArr] : []);

    if (docs.length > 0) {
      var docsWrap = document.createElement('div');
      docsWrap.className = 'msg-docs-wrap';
      docs.forEach(function(doc) {
        var icon = (typeof _docIconExt === 'function') ? _docIconExt(doc.ext) : '📎';
        var chip = document.createElement('div');
        chip.className = 'msg-doc-multi';
        chip.innerHTML =
          '<span style="font-size:1.3em;flex-shrink:0;">' + icon + '</span>' +
          '<div style="display:flex;flex-direction:column;min-width:0;">' +
            '<span style="font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:180px;">' + esc(doc.name) + '</span>' +
            (doc.ext ? '<span style="font-size:0.68em;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;">' + doc.ext + (doc.size ? ' · ' + (doc.size > 1024*1024 ? (doc.size/(1024*1024)).toFixed(1)+' Mo' : Math.round(doc.size/1024)+' Ko') : '') + '</span>' : '') +
          '</div>';
        docsWrap.appendChild(chip);
      });
      bubble.appendChild(docsWrap);
    }
  }

  list.appendChild(div);
  scrollDown();
}

function setEvaStatus(text, type) {
  setEvaStatusHeader(text, type);
}

function setEvaStatusHeader(text, type) {
  var dot = document.getElementById('evaHdrDot');
  var label = document.getElementById('evaHdrText');
  var skip = document.getElementById('skipTtsBtn');
  if (!dot || !label) return;
  if (!text) {
    dot.className = 'eva-hdr-dot';
    label.textContent = 'EN LIGNE';
    if (skip) skip.style.display = 'none';
    return;
  }
  dot.className = 'eva-hdr-dot ' + (type || 'thinking');
  label.textContent = text;
  if (skip) skip.style.display = (type === 'speaking') ? 'inline-flex' : 'none';
}
window.setEvaStatusHeader = setEvaStatusHeader;

function skipTTS() {
  if (window.EVATTS) window.EVATTS.stopTTS();
  setEvaStatusHeader(null);
  if (S.wakeWordOn && window.EVAWakeWord) setTimeout(function(){ window.EVAWakeWord.start(); }, 400);
}
window.skipTTS = skipTTS;

function sendVoiceCommand(cmd) {
  if (S.busy) return;
  var input = document.getElementById('msgInput');
  if (input) {
    input.value = cmd;
    var sendBtn = document.getElementById('sendBtn');
    if (sendBtn) sendBtn.disabled = false;
  }
  handleSend();
}

var _SVG_THINK_BRAIN = '<svg viewBox="0 0 24 24"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/></svg>';
var _SVG_THINK_SEARCH = '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>';
var _SVG_THINK_PEN    = '<svg viewBox="0 0 24 24"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>';
var _SVG_THINK_SPARK  = '<svg viewBox="0 0 24 24"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4M22 5h-4M4 17v2M5 18H3"/></svg>';
var _THINK_STEPS = [
  { icon: _SVG_THINK_BRAIN,  label: 'Réfléchis...' },
  { icon: _SVG_THINK_SEARCH, label: 'Analyse...'   },
  { icon: _SVG_THINK_PEN,    label: 'Rédige...'    },
  { icon: _SVG_THINK_SPARK,  label: 'Génère...'    }
];
var _thinkTimer = null;
var _thinkIdx = 0;
var _thinkHistory = []; /* Historique des étapes de réflexion pour le panneau déroulable */
var _generationAborted = false;
var _lastUserMsg = ''; /* Mémorise le dernier message user pour l'analyse contextuelle */

/* ═══════════════════════════════════════════════════════════════════
   ANALYSE CONTEXTUELLE — génère des pensées adaptées au message user
   ═══════════════════════════════════════════════════════════════════ */


/* ═══════════════════════════════════════════════════════════
   VRAIES PENSÉES — appelé quand le modèle expose sa chain-of-thought
   (gemini-thinking, deepseek-r1, etc.)
   ═══════════════════════════════════════════════════════════ */
window.setRealThinking = function(rawThinking) {
  if (!rawThinking) return;
  /* Nettoyer et découper en étapes lisibles */
  var lines = rawThinking.replace(/\r\n/g,'\n').split('\n').filter(function(l){ return l.trim().length > 8; });
  /* Afficher les 60 premiers chars de chaque ligne comme étape */
  lines.forEach(function(line, i) {
    if (i > 20) return; /* Limiter à 20 lignes */
    var clean = line.trim().replace(/^[-*•]\s*/, '').slice(0, 80);
    _thinkHistory.push({ label: clean, detail: '', ts: Date.now(), isReal: true });
  });
  /* Mettre à jour l'indicateur avec la dernière vraie pensée */
  if (lines.length > 0) {
    var lb = document.getElementById('thinkLabel');
    var dt = document.getElementById('thinkDetail');
    var ic = document.getElementById('thinkIcon');
    var last = lines[lines.length > 3 ? lines.length - 1 : 0].trim().slice(0, 70);
    if (ic) ic.textContent = '🧠';
    if (lb) lb.textContent = last;
    if (dt) dt.textContent = '— Raisonnement réel —';
  }
};

function showTyping(userMsg) {
  S.busy = true;
  _generationAborted = false;
  _thinkHistory = [];
  _lastUserMsg = userMsg || '';

  var list = document.getElementById('messagesList');
  if (!list) return;
  var div = document.createElement('div');
  div.className = 'typing-bubble';
  div.id = 'typingInd';

  /* Pensée de départ : icône SVG personnalisée, état Génère */
  var firstThought = { icon: _SVG_THINK_SPARK, label: 'Génère...', detail: 'Composition de la réponse...' };

  div.innerHTML =
    '<div class="thinking-wrap">' +
      '<div class="thinking-steps" id="thinkingStepsEl">' +
        '<span class="thinking-icon" id="thinkIcon">' + firstThought.icon + '</span>' +
        '<span class="thinking-label" id="thinkLabel">' + firstThought.label + '</span>' +
        '<div class="thinking-dots-mini"><div class="thinking-dot-mini"></div><div class="thinking-dot-mini"></div><div class="thinking-dot-mini"></div></div>' +
      '</div>' +
      '<div class="thinking-detail" id="thinkDetail">' + firstThought.detail + '</div>' +
    '</div>';
  list.appendChild(div);
  scrollDown();
  _thinkIdx = 0;

  /* Enregistrer la première pensée */
  _thinkHistory.push({ label: firstThought.label, detail: firstThought.detail, ts: Date.now() });

  /* Pas de boucle aléatoire de mots génériques : on garde l\'état "Génère" statique sauf si mis à jour par l\'API */
  if (_thinkTimer) {
    clearInterval(_thinkTimer);
    _thinkTimer = null;
  }

  /* Cacher le bouton Envoyer et afficher le bouton Stop */
  var sendBtn = document.getElementById('sendBtn');
  var stopBtn = document.getElementById('stopBtn');
  if (sendBtn && stopBtn) {
    sendBtn.style.display = 'none';
    stopBtn.style.display = 'inline-flex';
  }

  if (window.EvaCharacter) window.EvaCharacter.setThinking();
  setEvaStatus('EVA RÉFLÉCHIT...', 'thinking');
}

/* Met à jour l'indicateur de réflexion avec une vraie phase en cours */
window.setThinkingPhase = function(iconSvg, label, detail) {
  var ic = document.getElementById('thinkIcon');
  var lb = document.getElementById('thinkLabel');
  var dt = document.getElementById('thinkDetail');
  if (ic && iconSvg) ic.innerHTML = iconSvg;
  if (lb && label)   lb.textContent = label;
  if (dt !== null && detail !== undefined) dt.textContent = detail || '';
  if (label) _thinkHistory.push({ label: label, detail: detail || '', ts: Date.now() });
};

/* Stoppe la génération en cours */
window.stopGeneration = function() {
  if (!S.busy) return;
  _generationAborted = true;
  hideTyping();
  streamEvaMsg('*Génération interrompue par l\'utilisateur.*');
  toast('Génération arrêtée', 'info');
};

function hideTyping() {
  S.busy = false;
  if (_thinkTimer) { clearInterval(_thinkTimer); _thinkTimer = null; }
  var el = document.getElementById('typingInd');
  if (el) el.remove();
  setEvaStatus(null);
  if (window.EvaCharacter && typeof window.EvaCharacter.setIdle === 'function') {
    try { window.EvaCharacter.setIdle(); } catch(_) {}
  }
  /* Restaurer le bouton Envoyer */
  var sendBtn = document.getElementById('sendBtn');
  var stopBtn = document.getElementById('stopBtn');
  if (sendBtn && stopBtn) {
    stopBtn.style.display = 'none';
    sendBtn.style.display = 'inline-flex';
    var input = document.getElementById('msgInput');
    sendBtn.disabled = !(input && input.value.trim()) && (!S.images || !S.images.length) && (!S.documents || !S.documents.length);
  }
}



function scrollDown() {
  var a = document.getElementById('messagesArea');
  if (a) a.scrollTop = a.scrollHeight;
}

function copyMsg(btn) {
  var bubble = btn.closest('.message').querySelector('.msg-bubble');
  if (!bubble) return;
  navigator.clipboard.writeText(bubble.innerText).then(function() { toast('Copié !','success'); });
}
window.copyMsg = copyMsg;

/* ═══════════════════════════════════════════════════
   ROLLBACK / EDIT / RETRY
═══════════════════════════════════════════════════ */
function rollbackToMsg(idxOrStr) {
  var idx = parseInt(idxOrStr, 10);
  if (isNaN(idx) || idx < 0) return;
  var keepCount = idx + 1;
  if (keepCount >= S.messages.length) { toast('Déjà au dernier message','info'); return; }
  var removed = S.messages.length - keepCount;
  if (!confirm('Revenir à ce point et supprimer ' + removed + ' message(s) suivant(s) ?')) return;

  S.messages = S.messages.slice(0, keepCount);

  /* Réinitialiser le contexte du handler IA */
  if (window.EVAChatHandler) {
    window.EVAChatHandler.clearContext();
    S.messages.forEach(function(m) {
      window.EVAChatHandler.addToContext(
        m.role === 'user' ? 'user' : 'assistant',
        m.content
      );
    });
  }

  /* Supprimer les messages après idx dans Firestore */
  if (S.convId && S.user) {
    db.collection('users').doc(S.user.uid)
      .collection('conversations').doc(S.convId)
      .collection('messages').orderBy('timestamp').get()
      .then(function(snap) {
        var docs = [];
        snap.forEach(function(d) { docs.push(d); });
        var toDelete = docs.slice(keepCount);
        if (!toDelete.length) return;
        var batch = db.batch();
        toDelete.forEach(function(d) { batch.delete(d.ref); });
        return batch.commit();
      }).catch(function(e) { console.warn('[EVA] Rollback Firestore:', e); });
  }

  renderMsgs();
  toast('Conversation ramenée à ce point ✓', 'success');
}
window.rollbackToMsg = rollbackToMsg;

function editMsg(idxOrStr) {
  var idx = parseInt(idxOrStr, 10);
  if (isNaN(idx) || idx < 0) return;
  var msg = S.messages[idx];
  if (!msg || msg.role === 'eva' || msg.role === 'assistant') return;

  var input = document.getElementById('msgInput');
  if (input) {
    input.value = msg.content;
    if (typeof autoResize === 'function') autoResize(input);
    document.getElementById('sendBtn').disabled = false;
    input.focus();
  }

  /* Tronquer S.messages à ce point (sans inclure ce message) */
  S.messages = S.messages.slice(0, idx);

  if (window.EVAChatHandler) {
    window.EVAChatHandler.clearContext();
    S.messages.forEach(function(m) {
      window.EVAChatHandler.addToContext(
        m.role === 'user' ? 'user' : 'assistant',
        m.content
      );
    });
  }

  renderMsgs();
  toast('Message prêt à être modifié — appuyez sur Envoyer', 'info');
}
window.editMsg = editMsg;

function retryMsg(idxOrStr) {
  var idx = parseInt(idxOrStr, 10);
  if (isNaN(idx) || idx < 0) return;
  var msg = S.messages[idx];
  if (!msg || msg.role === 'eva' || msg.role === 'assistant') return;

  /* Tronquer S.messages à ce point (sans inclure ce message) */
  S.messages = S.messages.slice(0, idx);

  if (window.EVAChatHandler) {
    window.EVAChatHandler.clearContext();
    S.messages.forEach(function(m) {
      window.EVAChatHandler.addToContext(
        m.role === 'user' ? 'user' : 'assistant',
        m.content
      );
    });
  }

  var input = document.getElementById('msgInput');
  if (input) {
    input.value = msg.content;
    document.getElementById('sendBtn').disabled = false;
  }

  renderMsgs();
  setTimeout(function() { handleSend(); }, 100);
}
window.retryMsg = retryMsg;

function speakMsg(btn) {
  var bubble = btn.closest('.message').querySelector('.msg-bubble');
  if (!bubble) return;
  var text = bubble.innerText || '';
  if (window.EVATTS) window.EVATTS.speakTextStreaming(text, S.config);
}
window.speakMsg = speakMsg;

/* ═══════════════════════════════════════════════════
   SEND MESSAGE
═══════════════════════════════════════════════════ */
async function handleSend() {
  var input = document.getElementById('msgInput');
  var text = (input.value || '').trim();
  var img = S.image || (S.images && S.images[0]) || null;
  var docPending = S.document || (S.documents && S.documents[0]) || null;
  if (!text && !img && !docPending) return;
  if (S.busy) { toast('Eva réfléchit...','info'); return; }
  if (!window.EVAChatHandler) { toast('Système non initialisé','error'); return; }

  /* Arrêter le micro s'il est actif — l'utilisateur envoie manuellement */
  if (window.EVASTS && window.EVASTS.getIsListening()) {
    window.EVASTS.stopListening();
    var micBtn = document.getElementById('micBtn');
    if (micBtn) micBtn.classList.remove('recording');
    if (window.EvaCharacter) window.EvaCharacter.setIdle();
    setEvaStatusHeader(null);
    if (S.wakeWordOn && window.EVAWakeWord) setTimeout(function(){ window.EVAWakeWord.start(); }, 800);
  }

  var doc = S.document || (S.documents && S.documents[0]) || null;
  var allImages = (S.images && S.images.length) ? S.images : (S.image ? [S.image] : []);
  var allDocs   = (S.documents && S.documents.length) ? S.documents : (S.document ? [S.document] : []);
  input.value = ''; input.style.height = 'auto';
  document.getElementById('sendBtn').disabled = true;
  document.getElementById('imagePreviewBar').style.display = 'none';
  document.getElementById('docPreviewBar').style.display = 'none';
  S.image = null; S.images = [];
  S.document = null; S.documents = [];

  var displayText = text || (allImages.length > 1 ? '📷 ' + allImages.length + ' photos jointes' : allImages.length === 1 ? '📷 Photo jointe' : allDocs.length > 1 ? '' : allDocs.length === 1 ? '' : '');
  appendMsg('user', displayText, allImages, allDocs);
  showTyping(text); /* Passe le message pour l'analyse contextuelle des pensées */
  window.setThinkingPhase(_SVG_THINK_BRAIN, 'Réfléchis...', 'Je lis votre message...');

  var toneInstruction = '';
  var _hasActiveTone = TONES[S.tone] && S.tone !== 'normal';
  if (_hasActiveTone) {
    toneInstruction = TONES[S.tone];
  } else if (TONES['normal']) {
    toneInstruction = '\n\nSTYLE DE RÉPONSE :\n' + TONES['normal'];
  }

  var userCtx = '';
  if (S.profile) {
    var nick = S.profile.nickname || S.profile.displayName;
    if (nick) userCtx += '\nL\'utilisateur s\'appelle ' + nick + '.';
    if (S.profile.bio) userCtx += ' Contexte personnel : ' + S.profile.bio;
    if (S.keyPersonality) {
      userCtx += '\n' + S.keyPersonality;
    }
  }
  if (window._userBio) userCtx += '\nNote personnelle : ' + window._userBio;
  /* Mémoire Évolutive — injectée si activée et non vide */
  if (S.adaptationEnabled && S.evaMemory && S.evaMemory.nodes) {
    userCtx += '\n\nMÉMOIRE ÉVOLUTIVE (Graphe de Connaissances) :\n' + 
               'Note vitale: Dans ce graphe, le nœud avec l\'id "utilisateur" te représente TOI (l\'interlocuteur humain). Toutes les connexions à "utilisateur" sont tes caractéristiques et ton entourage.\n' +
               'INSTRUCTION SPÉCIALE : Tu dois activement analyser ce graphe. Si ce que l\'utilisateur vient de dire contredit une information de la mémoire (ex: un déménagement, un changement de goût, une nouvelle relation amoureuse), tu DOIS réagir humainement dans ta réponse en relevant la contradiction avec étonnement ou curiosité (ex: "Oh ? Tu ne m\'avais pas dit que tu habitais à Feurs ?"). Agis comme une vraie amie qui a de la mémoire !\n' +
               JSON.stringify({nodes: S.evaMemory.nodes, links: S.evaMemory.links});
  }

  // Injection date/heure courante — EVA connaît ainsi l'heure pour créer alarmes/rappels
  var _now = new Date();
  var _dateStr = _now.toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
  var _timeStr = _now.getHours().toString().padStart(2,'0') + ':' + _now.getMinutes().toString().padStart(2,'0');
  var _dateCtx = '\n\n[ DONNÉES TEMPS RÉEL INJECTÉES PAR LE SYSTÈME ]\nDate : ' + _dateStr + '\nHeure actuelle : ' + _timeStr + '\nTimezone : ' + Intl.DateTimeFormat().resolvedOptions().timeZone + '\n(Utilise ces informations pour calculer les heures d\'alarmes et de rappels demandées.)';

  var _activeProv = (S.config && S.config.aiProvider) || 'puter';
  var sysPrompt;

  if (_activeProv === 'qwen' || _activeProv === 'eva') {
    /* Prompt complet adapté aux modèles locaux WebLLM (condensé pour éviter context overflow) */
    var _localNick = (S.profile && (S.profile.nickname || S.profile.displayName))
      ? (S.profile.nickname || S.profile.displayName).split(' ')[0] : null;
    sysPrompt =
      (_hasActiveTone ? '⚠️ MODE ACTIF — PRIORITÉ ABSOLUE :\n' + toneInstruction + '\n\n' : toneInstruction ? '\nSTYLE : ' + toneInstruction + '\n\n' : '') +
      'Tu es EVA — Evolutionary Virtual Assistant — assistante IA créée par Astral Technologie (fondée par Enzo).\n' +
      'Tu ES EVA. Réponds toujours à la 1ère personne. Jamais "Bonjour Eva". Tu n\'es pas ChatGPT. Toujours en français.\n' +
      (_localNick ? 'Tu parles avec ' + _localNick + '.\n' : '') +
      (userCtx ? userCtx.trim() + '\n' : '') +
      '\nPERSONNALITÉ : Chaleureuse, intelligente, bienveillante. VARIE toujours ton introduction (jamais deux fois la même structure).\n' +
      '\nACTIONS DISPONIBLES — utilise-les dès que l\'utilisateur le demande :\n' +
      '- Note → [ACTION:{"type":"note","title":"Titre","body":"Contenu"}]\n' +
      '- Alarme → [ACTION:{"type":"alarm","time":"HH:MM","label":"Libellé","repeat":"once"}]\n' +
      '- Rappel → [ACTION:{"type":"reminder","text":"Texte","date":"YYYY-MM-DD","time":"HH:MM"}]\n' +
      '- Agenda → [ACTION:{"type":"event","title":"Titre","date":"YYYY-MM-DD","time":"HH:MM"}]\n' +
      '- Excel → [ACTION:{"type":"excel","filename":"data.xlsx","headers":["Col1","Col2"],"rows":[["val1","val2"]]}]\n' +
      '- PowerPoint → [ACTION:{"type":"pptx","filename":"p.pptx","title":"Titre","slides":[{"title":"S1","points":["Point 1"]}]}]\n' +
      '- CSV → [ACTION:{"type":"csv","filename":"data.csv","headers":["Col1"],"rows":[["val"]]}]\n' +
      '- Fichier texte → [ACTION:{"type":"txt","filename":"fichier.txt","content":"Contenu"}]\n' +
      '- PDF → bloc ```pdf\n<!DOCTYPE html>...(HTML complet stylisé)...```\n' +
      '- Graphique dans le chat → ```chart\n{"type":"bar","data":{"labels":["A","B"],"datasets":[{"label":"Ventes","data":[10,20],"backgroundColor":["#5b77f7","#06b6d4"]}]}}\n```\n' +
      'Pour toute génération de fichier : UNE phrase courte + le bloc ACTION. Rien d\'autre après.\n' +
      '\nFORMATAGE : Utilise le markdown (##, listes, **gras**, tableaux) quand utile. Blocs spéciaux :\n' +
      '```tip ...``` (conseil), ```warning ...``` (mise en garde), ```info ...``` (information), ```success ...``` (validation)\n' +
      '```stats\nMétrique: Valeur``` (chiffres clés), ```timeline\n2024 → Événement``` (chronologie)\n' +
      '\nDate : ' + _dateStr + ' — Heure : ' + _timeStr + '.';
  } else {
    /* Prompt complet pour les providers cloud (Puter, OpenAI, Claude, etc.) */
    if (_hasActiveTone) {
      /* Le mode actif passe EN PREMIER pour garantir la priorité */
      sysPrompt = '⚠️ MODE ACTIF — PRIORITÉ ABSOLUE (applique à CHAQUE réponse) :\n' + toneInstruction + '\n\n---\n\n' +
        SYS + (userCtx ? '\n\n' + userCtx.trim() : '') + _dateCtx;
    } else {
      sysPrompt = SYS + (userCtx ? '\n\n' + userCtx.trim() : '') + _dateCtx + toneInstruction;
    }
  }

  var msgContent = text;
  if (allImages.length) {
    window.setThinkingPhase(_SVG_THINK_SEARCH, 'Analyse...', 'J\'examine votre image...');
    try {
      var vision = await analyzeImage(allImages[0].data, text || 'Décris cette image.');
      if (vision) msgContent = vision;
      /* Images supplémentaires */
      for (var _ii = 1; _ii < allImages.length; _ii++) {
        window.setThinkingPhase(_SVG_THINK_SEARCH, 'Analyse...', 'J\'examine l\'image ' + (_ii + 1) + ' sur ' + allImages.length + '...');
        try {
          var vision2 = await analyzeImage(allImages[_ii].data, 'Décris aussi cette image.');
          if (vision2) msgContent += '\n\n[Image ' + (_ii + 1) + '] ' + vision2;
        } catch(_) {}
      }
    } catch(e) {}
  }
  /* Documents joints : injecter les textes extraits dans le contexte */
  if (allDocs.length) {
    for (var _di = 0; _di < allDocs.length; _di++) {
      if (allDocs[_di] && allDocs[_di].text) {
        var docCtx = '\n\n[DOCUMENT JOINT — "' + allDocs[_di].name + '"]\n' + allDocs[_di].text + '\n[FIN DU DOCUMENT]';
        msgContent = (msgContent || 'Voici un document. Analyse-le et résume-le.') + docCtx;
      }
    }
    if (allDocs.length === 1) msgContent += '\n\nRéponds à la demande de l\'utilisateur en te basant sur ce document.';
    else msgContent += '\n\nRéponds à la demande de l\'utilisateur en te basant sur ces documents.';
  }

  // Recherche web si nécessaire
  var _isLocalProv = (_activeProv === 'lmstudio' || _activeProv === 'ollama' ||
                      _activeProv === 'qwen'    || _activeProv === 'eva');

  // needsSearch = triggers standard (météo, bourse, actu...) -> S'applique à TOUS
  // needsSearchLocal = triggers étendus (toute question avec "?") -> Seulement pour les modèles locaux
  var _shouldSearch = window.EVAWebSearch && (
    window.EVAWebSearch.needsSearch(msgContent) ||
    (_isLocalProv && window.EVAWebSearch.needsSearchLocal && window.EVAWebSearch.needsSearchLocal(msgContent))
  );
  if (_shouldSearch) {
    var searchLabel = msgContent.length > 40 ? msgContent.substring(0, 40) + '...' : msgContent;
    window.setThinkingPhase(_SVG_THINK_SEARCH, 'Recherche...', 'Recherche web : "' + searchLabel + '"');
    setEvaStatus('🔍 RECHERCHE...', 'thinking');
    try {
      var searchData = await window.EVAWebSearch.search(msgContent);
      if (searchData) {
        msgContent = msgContent + '\n\n' + searchData;
      }
    } catch(e) {
      console.warn('[EVA] Recherche web échouée:', e);
    }
    setEvaStatus('EVA RÉFLÉCHIT...', 'thinking');
  }

  // Override system prompt so chat-handler uses ours
  var origSys = window.EVA_SYSTEM_PROMPT;
  window.EVA_SYSTEM_PROMPT = sysPrompt;

  window.setThinkingPhase(_SVG_THINK_SPARK, 'Génère...', 'Je compose ma réponse...');

  var result = await window.EVAChatHandler.sendMessage(msgContent, { tone: S.tone });

  window.EVA_SYSTEM_PROMPT = origSys;
  hideTyping();

  /* — Si l'utilisateur a cliqué Stop pendant la génération, on ignore la réponse — */
  if (_generationAborted) {
    _generationAborted = false;
    return;
  }

  /* Masquer bannière erreur réseau si la requête a réussi */
  var _netBanner = document.getElementById('networkErrorBanner');

  if (result.success) {
    if (_netBanner) _netBanner.style.display = 'none';

    /* Vraies pensées (gemini-thinking, deepseek-r1, etc.) — injecter dans l'historique avant d'afficher la réponse */
    if (result.thinking && window.setRealThinking) {
      window.setRealThinking(result.thinking);
    }

    var cleanContent = parseEvaActions(result.content);
    if (cleanContent && cleanContent.trim()) {
      streamEvaMsg(cleanContent);
    }
    saveConvMsg(text || '[Image]', cleanContent || result.content.slice(0, 200));
    
    /* ── Mise à jour des statistiques Firebase ── */
    if (window.updateUsageStats) {
      var userTextLen = (text || '').length;
      var evaTextLen = (cleanContent || '').length;
      var tokenEst = Math.round(((userTextLen + evaTextLen) / 5) * 1.3);
      window.updateUsageStats(1, 1, tokenEst || 1);
    }
  } else {
    var _errMsg = (result.error && result.error.message) ? result.error.message : (result.error || '');

    /* ── Erreur Puter : session expirée ── */
    if (_errMsg === 'SESSION_PUTER_EXPIRED') {
      appendMsg('eva', '');
      var _bubbles2 = document.querySelectorAll('.message.eva .msg-bubble');
      var _lb2 = _bubbles2[_bubbles2.length - 1];
      if (_lb2) {
        _lb2.innerHTML =
          '<div style="font-size:0.82em;color:var(--text-muted);margin-bottom:8px;">🔒 Ta session Puter a expiré ou tu n\'es pas encore connecté.</div>' +
          '<button id="puterReconnectBtn" style="display:inline-flex;align-items:center;gap:8px;padding:8px 16px;border:1.5px solid var(--cyan);border-radius:10px;background:rgba(0,212,255,0.08);color:var(--cyan);font-size:0.82em;font-weight:700;cursor:pointer;font-family:inherit;">' +
          '☁️ Se connecter à Puter</button>' +
          '<div style="font-size:0.7em;color:var(--text-muted);margin-top:8px;">La connexion ouvre une fenêtre Puter — assurez-vous que les popups sont autorisées.</div>';
        document.getElementById('puterReconnectBtn').addEventListener('click', async function() {
          this.disabled = true;
          this.textContent = '⏳ Connexion...';
          if (window._puterReconnectAction) {
            var ok = await window._puterReconnectAction();
            if (ok) {
              _lb2.innerHTML = '✅ Reconnecté ! Renvoyez votre message.';
            } else {
              this.disabled = false;
              this.textContent = '☁️ Réessayer';
            }
          }
        });
      }
      toast('Session Puter expirée — reconnexion requise', 'warning');

    /* ── Erreur Puter sur Edge : cookies tiers/popups bloqués ── */
    } else if (_errMsg === 'EDGE_PUTER_BLOCKED') {
      appendMsg('eva', '');
      var _bubblesEdge = document.querySelectorAll('.message.eva .msg-bubble');
      var _lbEdge = _bubblesEdge[_bubblesEdge.length - 1];
      if (_lbEdge) {
        _lbEdge.innerHTML =
          '<div style="font-size:0.84em;font-weight:700;margin-bottom:10px;color:#f59e0b;">⚠️ Edge bloque la connexion Puter</div>' +
          '<div style="font-size:0.75em;color:var(--text-muted);line-height:1.65;margin-bottom:10px;">' +
          'Microsoft Edge bloque les cookies tiers et les popups nécessaires à Puter. 3 solutions :<br><br>' +
          '<b style="color:var(--text);">① Autoriser puter.com dans Edge</b><br>' +
          'Edge → Paramètres → Cookies et autorisations → Ajouter <code>https://puter.com</code> dans la liste des sites autorisés.<br><br>' +
          '<b style="color:var(--text);">② Réduire la protection anti-pistage</b><br>' +
          'Edge → Paramètres → Confidentialité → Protection anti-pistage : passer de <em>Strict</em> à <em>Équilibré</em>.<br><br>' +
          '<b style="color:var(--text);">③ Utiliser un autre provider</b><br>' +
          'Dans Paramètres → IA, basculez sur <strong>Pollinations</strong> (aucun compte requis).' +
          '</div>' +
          '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
          '<button onclick="openSettings(\'ai\')" style="padding:6px 14px;border:1px solid var(--cyan);border-radius:8px;background:rgba(0,212,255,0.08);color:var(--cyan);font-size:0.76em;cursor:pointer;font-family:inherit;">⚙️ Changer de provider</button>' +
          '<button id="edgePuterRetryBtn" style="padding:6px 14px;border:1px solid rgba(245,158,11,0.4);border-radius:8px;background:rgba(245,158,11,0.06);color:#f59e0b;font-size:0.76em;cursor:pointer;font-family:inherit;">🔁 Réessayer</button>' +
          '</div>';
        document.getElementById('edgePuterRetryBtn').addEventListener('click', function() {
          if (window._puterReconnectAction) window._puterReconnectAction();
        });
      }
      toast('Edge bloque Puter — voir les instructions', 'warning');

    /* ── Erreur réseau générique ── */
    } else {
      var _isNetworkErr = !navigator.onLine ||
        (typeof _errMsg === 'string' && (
          _errMsg.toLowerCase().indexOf('network') !== -1 ||
          _errMsg.toLowerCase().indexOf('failed to fetch') !== -1 ||
          _errMsg.toLowerCase().indexOf('connexion') !== -1 ||
          _errMsg.toLowerCase().indexOf('inaccessible') !== -1 ||
          _errMsg.toLowerCase().indexOf('timeout') !== -1
        ));
      if (_isNetworkErr && _netBanner) {
        document.getElementById('networkErrorMsg').textContent = 'Connexion perdue — vérifie ta connexion internet et réessaie.';
        _netBanner.style.display = 'flex';
      } else {
        var _errText = "Désolée, une erreur est survenue : " + (typeof _errMsg === 'string' ? _errMsg : "Erreur inconnue");
        appendMsg('eva', _errText);
        console.error("Erreur IA détaillée :", _errMsg);
        var _bubbles = document.querySelectorAll('.message.eva .msg-bubble');
        var _lastBubble = _bubbles[_bubbles.length - 1];
        if (_lastBubble) {
          var _reportBtn = document.createElement('button');
          _reportBtn.onclick = function() { openReportModal(); };
          _reportBtn.style.cssText = 'display:inline-flex;align-items:center;gap:6px;margin-top:8px;padding:5px 12px;border:1px solid rgba(248,113,113,0.5);border-radius:8px;background:rgba(248,113,113,0.08);color:#f87171;font-size:0.78em;cursor:pointer;font-family:inherit;';
          _reportBtn.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" fill="none" stroke-width="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg> Signaler ce problème';
          _lastBubble.appendChild(_reportBtn);
        }
        toast('Erreur IA — vérifiez les paramètres', 'error');
      }
    }
    if (window.EvaCharacter) window.EvaCharacter.setIdle();
  }
}

/* Bannière réseau auto via browser offline event */
window.addEventListener('offline', function() {
  var _nb = document.getElementById('networkErrorBanner');
  if (_nb) {
    document.getElementById('networkErrorMsg').textContent = 'Connexion perdue — vérifie ta connexion internet.';
    _nb.style.display = 'flex';
  }
});
window.addEventListener('online', function() {
  var _nb = document.getElementById('networkErrorBanner');
  if (_nb) _nb.style.display = 'none';
});

function streamEvaMsg(content) {
  var time = new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
  var list = document.getElementById('messagesList');
  if (!list) return;
  var welcome = document.getElementById('chatWelcome');
  if (welcome) welcome.style.display = 'none';

  // Construction DOM native
  var div = document.createElement('div');
  div.className = 'message eva';

  var msgContent = document.createElement('div');
  msgContent.className = 'msg-content';

  /* ── Panneau historique de pensée (discret, comme Claude/Grok) ── */
  if (_thinkHistory && _thinkHistory.length > 0) {
    var thoughtPanel = document.createElement('div');
    thoughtPanel.className = 'eva-thought-panel';
    thoughtPanel.style.cssText = 'margin-bottom:6px;border-radius:8px;background:transparent;border:1px solid rgba(123,139,245,0.1);overflow:hidden;';
    var thoughtHeader = document.createElement('button');
    thoughtHeader.style.cssText = 'width:100%;display:flex;align-items:center;gap:6px;padding:5px 10px;background:none;border:none;cursor:pointer;color:rgba(160,165,200,0.5);font-size:0.68em;font-family:inherit;text-align:left;transition:opacity 0.2s;';
    thoughtHeader.innerHTML = '<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><circle cx="12" cy="16" r="1" fill="currentColor" stroke="none"/></svg><span style="letter-spacing:0.3px;">Réflexion</span><span style="margin-left:auto;opacity:0.5;">' + _thinkHistory.length + ' étape' + (_thinkHistory.length > 1 ? 's' : '') + ' ▾</span>';
    var thoughtBody = document.createElement('div');
    thoughtBody.style.cssText = 'display:none;padding:6px 10px 8px;border-top:1px solid rgba(123,139,245,0.08);';
    var thCaptured = _thinkHistory.slice();
    thCaptured.forEach(function(step, i) {
      var item = document.createElement('div');
      item.style.cssText = 'display:flex;align-items:flex-start;gap:6px;margin-bottom:4px;font-size:0.68em;color:rgba(160,165,200,0.55);';
      item.innerHTML = '<span style="color:rgba(123,139,245,0.4);min-width:14px;">' + (i+1) + '.</span><div><span style="color:rgba(200,205,230,0.6);">' + step.label + '</span>' + (step.detail ? '<span style="margin-left:5px;opacity:0.5;">' + step.detail + '</span>' : '') + '</div>';
      thoughtBody.appendChild(item);
    });
    thoughtHeader.addEventListener('click', function() {
      var open = thoughtBody.style.display !== 'none';
      thoughtBody.style.display = open ? 'none' : 'block';
      var arrow = thoughtHeader.querySelector('span:last-child');
      if (arrow) arrow.textContent = thCaptured.length + ' étape' + (thCaptured.length > 1 ? 's' : '') + ' ' + (open ? '▾' : '▴');
    });
    thoughtPanel.appendChild(thoughtHeader);
    thoughtPanel.appendChild(thoughtBody);
    msgContent.appendChild(thoughtPanel);
  }

  // Bulle
  var bubble = document.createElement('div');
  bubble.className = 'msg-bubble';

  // Timestamp + actions
  var msgTime = document.createElement('div');
  msgTime.className = 'msg-time';
  msgTime.textContent = time;

  var msgActions = document.createElement('div');
  msgActions.className = 'msg-actions';
  msgActions.innerHTML = '<button class="msg-act" onclick="copyMsg(this)"><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>Copier</button><button class="msg-act" onclick="speakMsg(this)" title="Écouter"><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg></button><button class="msg-act msg-rollback" onclick="rollbackToMsg(this.closest(\'.message\').dataset.msgIdx)" title="Revenir à ce point"><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>Revenir</button>';

  msgContent.appendChild(bubble);
  msgContent.appendChild(msgTime);
  msgContent.appendChild(msgActions);
  div.appendChild(msgContent);
  /* Enregistrer le message EVA dans S.messages pour le rollback */
  var evaMsg = { role: 'eva', content: content, time: time };
  if (!S.messages) S.messages = [];
  S.messages.push(evaMsg);
  div.dataset.msgIdx = S.messages.length - 1;

  list.appendChild(div);
  scrollDown();

  var plain = extractTtsText(content);

  // TTS
  if (S.ttsOn && window.EVATTS && plain && plain.trim().length > 0) {
    setEvaStatus('EVA PARLE...', 'speaking');
    window.EVATTS.speakTextStreaming(plain, S.config);
  } else {
    if (window.EvaCharacter) window.EvaCharacter.setThinking();
    setEvaStatus('EVA ÉCRIT...', 'writing');
    
    // Si la synthèse est activée mais le texte est vide (ex: juste un graphique),
    // on s'assure d'arrêter tout TTS en cours
    if (S.ttsOn && window.EVATTS && (!plain || plain.trim().length === 0)) {
      window.EVATTS.stopTTS();
    }
  }

  // Rendu markdown
  renderMdDom(content, bubble);
  scrollDown();

  // Pseudo-streaming
  _revealMsgBlocks(bubble, function() {
    if (!S.ttsOn || !window.EVATTS) {
      setEvaStatus(null);
    }
    if (window.EvaCharacter && !S.ttsOn) {
      window.EvaCharacter.setIdle();
    }
  });
}

/* Révèle les éléments enfants du bubble progressivement */
function _revealMsgBlocks(container, onDone) {
  var children = Array.from(container.children);
  if (!children.length) { if (onDone) onDone(); return; }
  var totalDelay = 0;
  children.forEach(function(child) {
    child.style.opacity = '0';
    child.style.willChange = 'opacity, transform';
  });
  children.forEach(function(child, idx) {
    var delay = totalDelay;
    /* Délai proportionnel au contenu — titres courts, paragraphes plus longs */
    var len = (child.textContent || '').length;
    var blockDelay = Math.max(80, Math.min(len * 1.8, 320));
    totalDelay += blockDelay;
    setTimeout(function() {
      child.style.animation = 'revealBlock 0.28s ease forwards';
      if (idx % 3 === 0) scrollDown();
    }, delay);
  });
  setTimeout(function() {
    children.forEach(function(child) { child.style.willChange = 'auto'; });
    scrollDown();
    if (onDone) onDone();
  }, totalDelay + 350);
}

async function analyzeImage(base64Data, prompt) {
  var prov = (S.config && S.config.aiProvider) || 'puter';

  /* ── OpenAI Vision ── */
  if (prov === 'openai' && S.config && S.config.openaiApiKey) {
    try {
      var model = (S.config.openaiModel && S.config.openaiModel.includes('gpt-4')) ? S.config.openaiModel : 'gpt-4o';
      var resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + S.config.openaiApiKey },
        body: JSON.stringify({
          model: model,
          messages: [{ role: 'user', content: [
            { type: 'image_url', image_url: { url: base64Data } },
            { type: 'text', text: prompt }
          ]}],
          max_tokens: 600
        })
      });
      var data = await resp.json();
      if (data.choices && data.choices[0]) return data.choices[0].message.content;
    } catch(e) { console.warn('[EVA Vision] OpenAI error:', e); }
    return null;
  }

  /* ── Claude Vision ── */
  if (prov === 'claude' && S.config && S.config.claudeApiKey) {
    try {
      var b64 = base64Data.replace(/^data:image\/[^;]+;base64,/, '');
      var mimeMatch = base64Data.match(/^data:(image\/[^;]+);base64,/);
      var mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
      var claudeModel = S.config.claudeModel || 'claude-3-5-haiku-20241022';
      var resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': S.config.claudeApiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: claudeModel,
          max_tokens: 600,
          messages: [{ role: 'user', content: [
            { type: 'image', source: { type: 'base64', media_type: mimeType, data: b64 } },
            { type: 'text', text: prompt }
          ]}]
        })
      });
      var data = await resp.json();
      if (data.content && data.content[0]) return data.content[0].text;
    } catch(e) { console.warn('[EVA Vision] Claude error:', e); }
    return null;
  }

  /* ── LM Studio Vision ── */
  if (prov === 'lmstudio') {
    try {
      var endpoint = (S.config && S.config.lmstudioUrl) || 'http://localhost:1234';
      var resp = await fetch(endpoint + '/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: [
            { type: 'image_url', image_url: { url: base64Data } },
            { type: 'text', text: prompt }
          ]}],
          max_tokens: 600
        })
      });
      var data = await resp.json();
      if (data.choices && data.choices[0]) return data.choices[0].message.content;
    } catch(e) { console.warn('[EVA Vision] LM Studio error:', e); }
    return null;
  }

  /* ── Ollama Vision (llava) ── */
  if (prov === 'ollama') {
    try {
      var endpoint = (S.config && S.config.ollamaUrl) || 'http://localhost:11434';
      var b64 = base64Data.replace(/^data:image\/[^;]+;base64,/, '');
      var resp = await fetch(endpoint + '/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: (S.config && S.config.ollamaModel) || 'llava',
          prompt: prompt,
          images: [b64],
          stream: false
        })
      });
      var data = await resp.json();
      if (data.response) return data.response;
    } catch(e) { console.warn('[EVA Vision] Ollama error:', e); }
    return null;
  }

  /* ── Qwen / EVA Local — vision non disponible ── */
  if (prov === 'qwen' || prov === 'eva') return null;

  /* ── Pollinations — pas d'API vision native ──
     Fallback vers Puter (gpt-4o) si disponible, sinon null.
     NB : Cette branche ne devrait plus être atteinte car le bouton
          d'upload image est désactivé pour Pollinations via _providerSupportsVision.
          Garde-fou au cas où l'image passe quand même. */
  if (prov === 'pollinations') {
    if (typeof puter !== 'undefined') {
      console.info('[EVA Vision] Pollinations sans vision native → fallback Puter gpt-4o');
      try {
        var msg = [{ role:'user', content:[
          { type:'image_url', image_url:{ url: base64Data } },
          { type:'text', text: prompt }
        ]}];
        var resp2 = await puter.ai.chat(msg, { model:'gpt-4o' });
        if (typeof resp2 === 'string') return resp2;
        if (resp2 && resp2.message && resp2.message.content) return resp2.message.content;
      } catch(e) { console.warn('[EVA Vision] Puter fallback error:', e); }
    }
    return null;
  }

  /* ── Puter (défaut / fallback) ── */
  if (typeof puter === 'undefined') return null;
  try {
    var msg = [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: base64Data } },
        { type: 'text', text: prompt }
      ]
    }];
    var resp = await puter.ai.chat(msg, { model: 'gpt-4o' });
    if (typeof resp === 'string') return resp;
    if (resp && resp.message && resp.message.content) return resp.message.content;
    return null;
  } catch(e) { return null; }
}



function sendQuick(prompt) {
  document.getElementById('msgInput').value = prompt;
  document.getElementById('sendBtn').disabled = false;
  setView('chat');
  handleSend();
}
window.sendQuick = sendQuick;

/* ═══ FILE ATTACH ═══ */
/* ── File type helpers ─────────────────────────────────── */
var DOC_ICONS = { pdf:'📕', doc:'📝', docx:'📝', xls:'📊', xlsx:'📊', ppt:'📊', pptx:'📊', txt:'📃', csv:'📃' };
function _docExt(file) {
  return (file.name.split('.').pop() || '').toLowerCase();
}
function _docIcon(file) {
  return DOC_ICONS[_docExt(file)] || '📄';
}
function _docIconExt(ext) {
  return DOC_ICONS[(ext || '').toLowerCase()] || '📄';
}
function _fmtSize(bytes) {
  if (bytes < 1024) return bytes + ' o';
  if (bytes < 1024*1024) return (bytes/1024).toFixed(1) + ' Ko';
  return (bytes/(1024*1024)).toFixed(1) + ' Mo';
}

/* ── Chargement dynamique de bibliothèques ─────────────── */
function _loadScript(src, globalKey) {
  return new Promise(function(resolve, reject) {
    if (window[globalKey]) { resolve(); return; }
    var s = document.createElement('script');
    s.src = src; s.async = true;
    s.onload = function() { resolve(); };
    s.onerror = function() { reject(new Error('Impossible de charger: ' + src)); };
    document.head.appendChild(s);
  });
}

/* ── Extraction de texte selon le type de fichier ─────── */
async function extractDocumentText(file) {
  var ext = _docExt(file);
  var MAX = 5000; // max chars envoyés à l'IA

  /* TXT / CSV : lecture directe */
  if (ext === 'txt' || ext === 'csv') {
    return new Promise(function(resolve, reject) {
      var reader = new FileReader();
      reader.onload = function(ev) { resolve(ev.target.result.slice(0, MAX)); };
      reader.onerror = reject;
      reader.readAsText(file, 'UTF-8');
    });
  }

  /* PDF : PDF.js */
  if (ext === 'pdf') {
    await _loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js', 'pdfjsLib');
    var pdfLib = window['pdfjs-dist/build/pdf'] || window.pdfjsLib;
    if (!pdfLib) throw new Error('PDF.js indisponible');
    pdfLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    var buf = await file.arrayBuffer();
    var pdf = await pdfLib.getDocument({ data: buf }).promise;
    var text = '';
    var pages = Math.min(pdf.numPages, 20);
    for (var p = 1; p <= pages; p++) {
      var page = await pdf.getPage(p);
      var content = await page.getTextContent();
      text += content.items.map(function(i){ return i.str; }).join(' ') + '\n';
      if (text.length > MAX) break;
    }
    return text.trim().slice(0, MAX);
  }

  /* DOCX : JSZip + extraction XML */
  if (ext === 'docx' || ext === 'doc') {
    await _loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js', 'JSZip');
    if (!window.JSZip) throw new Error('JSZip indisponible');
    var buf2 = await file.arrayBuffer();
    var zip = await window.JSZip.loadAsync(buf2);
    var xmlFile = zip.file('word/document.xml');
    if (!xmlFile) throw new Error('Fichier DOCX invalide');
    var xml = await xmlFile.async('text');
    var txt = xml
      .replace(/<w:p[ >]/g, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').replace(/&nbsp;/g,' ')
      .replace(/\n{3,}/g, '\n\n').trim();
    return txt.slice(0, MAX);
  }

  /* XLSX / XLS : SheetJS */
  if (ext === 'xlsx' || ext === 'xls') {
    await _loadScript('https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js', 'XLSX');
    if (!window.XLSX) throw new Error('SheetJS indisponible');
    var buf3 = await file.arrayBuffer();
    var wb = window.XLSX.read(buf3, { type: 'array' });
    var text3 = '';
    wb.SheetNames.slice(0, 5).forEach(function(name) {
      text3 += '=== Feuille : ' + name + ' ===\n';
      text3 += window.XLSX.utils.sheet_to_csv(wb.Sheets[name]).slice(0, 2000) + '\n\n';
    });
    return text3.trim().slice(0, MAX);
  }

  /* PPTX / PPT : JSZip + extraction XML des diapositives */
  if (ext === 'pptx' || ext === 'ppt') {
    await _loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js', 'JSZip');
    if (!window.JSZip) throw new Error('JSZip indisponible');
    var buf4 = await file.arrayBuffer();
    var zip2 = await window.JSZip.loadAsync(buf4);
    var slideText = '';
    for (var si = 1; si <= 30; si++) {
      var sf = zip2.file('ppt/slides/slide' + si + '.xml');
      if (!sf) break;
      var sxml = await sf.async('text');
      var stxt = sxml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      slideText += 'Diapositive ' + si + ' : ' + stxt + '\n';
      if (slideText.length > MAX) break;
    }
    return slideText.trim().slice(0, MAX) || 'Aucun texte extrait de la présentation.';
  }

  throw new Error('Format non supporté : ' + ext);
}

/* ── Sélection de fichier ──────────────────────────────── */
function handleFileSelect(e) {
  var files = Array.from(e.target.files || []);
  if (!files.length) return;
  e.target.value = '';

  if (!S.images) S.images = [];
  if (!S.documents) S.documents = [];

  var pendingDocs = 0;
  var docErrors = 0;

  /* Vérification des capacités vision du modèle actif */
  var _prov = (S.config && S.config.aiProvider) || 'puter';
  var _model = (window.getActiveModel && window.getActiveModel()) || '';
  var _canPhoto = window._providerSupportsVision ? window._providerSupportsVision(_prov, _model) : true;

  files.forEach(function(file) {
    /* ── Images ─────────────────────────────────────── */
    if (file.type.startsWith('image/')) {
      if (!_canPhoto) {
        toast('Ce modèle (' + (_prov === 'qwen' ? 'local' : _prov) + ') ne supporte pas les images — joignez un document (PDF, Word…) à la place', 'warning');
        return;
      }
      if (file.size > 10*1024*1024) { toast('Image "'+file.name+'" trop grande (max 10 Mo)','error'); return; }
      var reader = new FileReader();
      reader.onload = (function(f) {
        return function(ev) {
          S.images.push({ url: ev.target.result, data: ev.target.result, name: f.name });
          S.image = S.images[0];
          _refreshFilePreviewBars();
          document.getElementById('sendBtn').disabled = false;
        };
      })(file);
      reader.readAsDataURL(file);
      return;
    }

    /* ── Documents ───────────────────────────────────── */
    var ext = _docExt(file);
    var allowed = ['pdf','doc','docx','xls','xlsx','ppt','pptx','txt','csv'];
    if (!allowed.includes(ext)) { toast('Format non supporté : '+file.name,'error'); return; }
    if (file.size > 30*1024*1024) { toast('Document "'+file.name+'" trop grand (max 30 Mo)','error'); return; }

    pendingDocs++;
    document.getElementById('sendBtn').disabled = true;
    /* Afficher nom immédiatement */
    S.documents.push({ name: file.name, ext: ext, text: null, size: file.size, _loading: true });
    S.document = S.documents[0];
    _refreshFilePreviewBars();

    var loadTimer = setTimeout(function(){ toast('Lecture de "'+file.name+'"…','info'); }, 800);
    extractDocumentText(file).then((function(f, ext2) {
      return function(text) {
        clearTimeout(loadTimer);
        var entry = S.documents.find(function(d){ return d.name === f.name && d._loading; });
        if (entry) { entry.text = text; entry._loading = false; }
        S.document = S.documents.find(function(d){ return !d._loading; }) || null;
        pendingDocs--;
        _refreshFilePreviewBars();
        if (pendingDocs === 0) {
          document.getElementById('sendBtn').disabled = !document.getElementById('msgInput').value.trim() && !S.images.length && !S.documents.filter(function(d){return !d._loading;}).length;
          toast(S.documents.length > 1 ? S.documents.length + ' documents prêts ✓' : '"'+f.name+'" prêt ✓','success');
        }
      };
    })(file, ext)).catch((function(f) {
      return function(err) {
        clearTimeout(loadTimer);
        docErrors++;
        S.documents = S.documents.filter(function(d){ return d.name !== f.name; });
        S.document = S.documents[0] || null;
        pendingDocs--;
        _refreshFilePreviewBars();
        toast('Erreur lecture "'+f.name+'" : '+(err.message||'Format non supporté'),'error');
        document.getElementById('sendBtn').disabled = !document.getElementById('msgInput').value.trim() && !S.images.length && !S.documents.length;
      };
    })(file));
  });
}

function _refreshFilePreviewBars() {
  var imgBar = document.getElementById('imagePreviewBar');
  var docBar = document.getElementById('docPreviewBar');
  if (!imgBar || !docBar) return;

  /* ── Images : thumbnails carrées avec bouton X ── */
  if (S.images && S.images.length) {
    imgBar.innerHTML = S.images.map(function(im, i) {
      var shortName = (im.name || 'image').length > 10
        ? (im.name||'image').slice(0, 9) + '…'
        : (im.name || 'image');
      return '<div class="attach-img-card">' +
        '<img src="' + im.url + '" alt="' + esc(im.name||'image') + '" title="' + esc(im.name||'image') + '">' +
        '<button class="attach-remove" onclick="removeImageAttachment(' + i + ')" title="Retirer">✕</button>' +
        '<span class="attach-name">' + esc(shortName) + '</span>' +
        '</div>';
    }).join('');
    imgBar.style.display = 'flex';
  } else {
    imgBar.style.display = 'none';
  }

  /* ── Documents : cartes avec icône, nom, extension, taille ── */
  if (S.documents && S.documents.length) {
    docBar.innerHTML = S.documents.map(function(doc, i) {
      var loading = doc._loading;
      var sizeStr = doc.size ? (doc.size > 1024*1024
        ? (doc.size/(1024*1024)).toFixed(1) + ' Mo'
        : Math.round(doc.size/1024) + ' Ko') : '';
      var icon = loading ? '⏳' : _docIconExt(doc.ext || '');
      return '<div class="attach-doc-card">' +
        '<span class="attach-doc-icon">' + icon + '</span>' +
        '<div class="attach-doc-info">' +
          '<span class="attach-doc-name" title="' + esc(doc.name||'document') + '">' + esc(doc.name||'document') + '</span>' +
          '<div class="attach-doc-meta">' +
            (doc.ext ? '<span class="attach-doc-ext">' + doc.ext + '</span>' : '') +
            (sizeStr ? '<span class="attach-doc-size">' + sizeStr + '</span>' : '') +
            (loading ? '<span class="attach-doc-loading">Lecture...</span>' : '') +
          '</div>' +
        '</div>' +
        (!loading ? '<button class="attach-remove" onclick="removeDocAttachment(' + i + ')" title="Retirer">✕</button>' : '') +
        '</div>';
    }).join('');
    docBar.style.display = 'flex';
  } else {
    docBar.style.display = 'none';
  }
}
window._refreshFilePreviewBars = _refreshFilePreviewBars;

function _docIconExt(ext) {
  var icons = { pdf:'📄', doc:'📝', docx:'📝', xls:'📊', xlsx:'📊', ppt:'📋', pptx:'📋', txt:'📃', csv:'📊' };
  return icons[ext] || '📎';
}

function clearImageAttachment() {
  S.image = null; S.images = [];
  document.getElementById('imagePreviewBar').style.display = 'none';
  if (!document.getElementById('msgInput').value.trim() && !S.document && !S.documents.length) {
    document.getElementById('sendBtn').disabled = true;
  }
}
window.clearImageAttachment = clearImageAttachment;

function removeImageAttachment(idx) {
  if (!S.images) S.images = [];
  S.images.splice(idx, 1);
  S.image = S.images[0] || null;
  _refreshFilePreviewBars();
  if (!document.getElementById('msgInput').value.trim() && !S.images.length && !S.documents.length) {
    document.getElementById('sendBtn').disabled = true;
  }
}
window.removeImageAttachment = removeImageAttachment;

function clearDocAttachment() {
  S.document = null; S.documents = [];
  document.getElementById('docPreviewBar').style.display = 'none';
  if (!document.getElementById('msgInput').value.trim() && !S.image && !S.images.length) {
    document.getElementById('sendBtn').disabled = true;
  }
}
window.clearDocAttachment = clearDocAttachment;

function removeDocAttachment(idx) {
  if (!S.documents) S.documents = [];
  S.documents.splice(idx, 1);
  S.document = S.documents[0] || null;
  _refreshFilePreviewBars();
  if (!document.getElementById('msgInput').value.trim() && !S.images.length && !S.documents.length) {
    document.getElementById('sendBtn').disabled = true;
  }
}
window.removeDocAttachment = removeDocAttachment;

/* ═══ MIC ═══ */
function handleMic() {
  var btn = document.getElementById('micBtn');
  if (!window.EVASTS) { toast('Micro non supporté','error'); return; }
  if (window.EVASTS.getIsListening()) {
    window.EVASTS.stopListening();
    btn.classList.remove('recording');
    if (window.EvaCharacter) window.EvaCharacter.setIdle();
    setEvaStatusHeader(null);
    if (S.wakeWordOn && window.EVAWakeWord) setTimeout(function(){ window.EVAWakeWord.start(); }, 600);
    return;
  }
  var perm = window.EVASTS.requestMicPermission();
  perm.then(function(ok) {
    if (!ok) { toast('Permission micro refusée','error'); return; }
    if (S.wakeWordOn && window.EVAWakeWord) window.EVAWakeWord.stop();
    btn.classList.add('recording');
    if (window.EvaCharacter) window.EvaCharacter.setListening();
    setEvaStatusHeader('🎤 ÉCOUTE...', 'listening');
    window.EVASTS.startListening(
      function(transcript, isFinal) {
        /* Mise à jour en temps réel dans la barre — pas d'envoi automatique */
        var input = document.getElementById('msgInput');
        input.value = transcript;
        document.getElementById('sendBtn').disabled = !transcript.trim();
        autoResize(input);
        /* On continue d'écouter — isFinal ne déclenche plus d'envoi ni d'arrêt */
      },
      function() {
        /* Arrêt définitif (erreur non récupérable) */
        btn.classList.remove('recording');
        if (window.EvaCharacter) window.EvaCharacter.setIdle();
        setEvaStatusHeader(null);
        if (S.wakeWordOn && window.EVAWakeWord) setTimeout(function(){ window.EVAWakeWord.start(); }, 800);
      }
    );
  });
}

/* ══════════════════════════════════════════════════════════
   DRAG & DROP + PASTE D'IMAGES
══════════════════════════════════════════════════════════ */
function _processDroppedOrPastedFiles(files) {
  if (!S.images) S.images = [];
  if (!S.documents) S.documents = [];

  var _prov = (S.config && S.config.aiProvider) || 'puter';
  var _model = (window.getActiveModel && window.getActiveModel()) || '';
  var _canPhoto = window._providerSupportsVision ? window._providerSupportsVision(_prov, _model) : true;

  files.forEach(function(file) {
    if (!file) return;
    if (file.type.startsWith('image/')) {
      if (!_canPhoto) {
        toast('Ce modèle ne supporte pas les images — joignez un document (PDF, Word…) à la place', 'warning');
        return;
      }
      if (file.size > 10 * 1024 * 1024) { toast('Image "' + file.name + '" trop grande (max 10 Mo)', 'error'); return; }
      var reader = new FileReader();
      reader.onload = (function(f) {
        return function(ev) {
          S.images.push({ url: ev.target.result, data: ev.target.result, name: f.name });
          S.image = S.images[0];
          _refreshFilePreviewBars();
          document.getElementById('sendBtn').disabled = false;
          toast('📷 Image ajoutée — ' + f.name, 'success');
        };
      })(file);
      reader.readAsDataURL(file);
    } else {
      /* Traiter comme document via handleFileSelect */
      var fakeEvt = { target: { files: [file], value: '' } };
      handleFileSelect(fakeEvt);
    }
  });
}

function initChatDragDropPaste() {
  /* Créer l'overlay de drop */
  var overlay = document.createElement('div');
  overlay.id = 'dropOverlay';
  overlay.className = 'drop-overlay';
  overlay.innerHTML =
    '<div class="drop-overlay-inner">' +
      '<svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="var(--cyan)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>' +
        '<polyline points="17 8 12 3 7 8"/>' +
        '<line x1="12" y1="3" x2="12" y2="15"/>' +
      '</svg>' +
      '<span>Déposer une image ou un fichier</span>' +
    '</div>';
  document.body.appendChild(overlay);

  var dragCount = 0;

  document.addEventListener('dragenter', function(e) {
    var dt = e.dataTransfer;
    if (!dt || !dt.types) return;
    var hasFiles = Array.prototype.indexOf.call(dt.types, 'Files') !== -1;
    if (hasFiles) { dragCount++; overlay.classList.add('visible'); }
  });

  document.addEventListener('dragleave', function() {
    dragCount = Math.max(0, dragCount - 1);
    if (dragCount === 0) overlay.classList.remove('visible');
  });

  document.addEventListener('dragover', function(e) {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
  });

  document.addEventListener('drop', function(e) {
    e.preventDefault();
    dragCount = 0;
    overlay.classList.remove('visible');
    var files = Array.from((e.dataTransfer && e.dataTransfer.files) || []);
    if (files.length) _processDroppedOrPastedFiles(files);
  });

  /* Paste d'images depuis le presse-papiers */
  document.addEventListener('paste', function(e) {
    var cd = e.clipboardData || (e.originalEvent && e.originalEvent.clipboardData);
    if (!cd) return;
    var imgFiles = Array.prototype.slice.call(cd.items || [])
      .filter(function(item) { return item.kind === 'file' && item.type.startsWith('image/'); })
      .map(function(item) { return item.getAsFile(); })
      .filter(Boolean);
    if (imgFiles.length) {
      e.preventDefault();
      _processDroppedOrPastedFiles(imgFiles);
    }
  });
}
window.initChatDragDropPaste = initChatDragDropPaste;
