/* ═══════════════════════════════════════════════════
   EVA ACTION PARSER — Création notes/alarmes/events par IA
═══════════════════════════════════════════════════ */
/* ── Extraction JSON robuste : compte les accolades pour trouver le vrai }  ──
   Contrairement au regex \{...\} non-greedy, cette fonction gère les objets
   imbriqués (slides:[{...},{...}], rows:[[...],[...]], etc.)                */
function _extractJsonObject(str, startIdx) {
  if (!str || str[startIdx] !== '{') return null;
  var depth = 0, inStr = false, esc = false;
  for (var i = startIdx; i < str.length; i++) {
    var ch = str[i];
    if (esc)       { esc = false; continue; }
    if (ch === '\\' && inStr) { esc = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (inStr)     continue;
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) return str.slice(startIdx, i + 1); }
  }
  return null;
}

/* Tentative de réparation JSON souple (virgules en trop, retours à la ligne, guillemets) */
function _lenientParse(jsonStr) {
  if (!jsonStr) return null;
  /* Passe 1 : JSON valide */
  try { return JSON.parse(jsonStr); } catch(e) {}
  /* Passe 2 : virgules en trop avant } ou ] */
  try { return JSON.parse(jsonStr.replace(/,\s*([}\]])/g, '$1')); } catch(e) {}
  /* Passe 3 : retours à la ligne / tabs littéraux dans les valeurs string */
  function _escapeControlChars(s) {
    return s.replace(/[\n\r\t]/g, function(ch) {
      if (ch === '\n') return '\\n';
      if (ch === '\r') return '\\r';
      return '\\t';
    });
  }
  try { return JSON.parse(_escapeControlChars(jsonStr)); } catch(e) {}
  try { return JSON.parse(_escapeControlChars(jsonStr).replace(/,\s*([}\]])/g, '$1')); } catch(e) {}
  /* Passe 4 : extraction partielle — tenter de récupérer les champs clés par regex
     utile quand le champ "content" long a des guillemets non échappés */
  try {
    var typeM    = jsonStr.match(/"type"\s*:\s*"([^"]+)"/);
    var fileM    = jsonStr.match(/"filename"\s*:\s*"([^"]+)"/);
    var titleM   = jsonStr.match(/"title"\s*:\s*"([^"]+)"/);
    if (typeM) {
      var partial = { type: typeM[1] };
      if (fileM)  partial.filename = fileM[1];
      if (titleM) partial.title    = titleM[1];
      /* Essayer d'extraire "content" entre première et dernière occurrence de ","content": */
      var cStart = jsonStr.indexOf('"content"');
      if (cStart !== -1) {
        var qStart = jsonStr.indexOf('"', cStart + 9);
        if (qStart !== -1) {
          /* Prendre tout jusqu'à la dernière " avant } */
          var qEnd = jsonStr.lastIndexOf('"');
          if (qEnd > qStart) {
            partial.content = jsonStr.slice(qStart + 1, qEnd)
              .replace(/\\n/g, '\n').replace(/\\t/g, '\t');
          }
        }
      }
      return partial;
    }
  } catch(e) {}
  return null;
}

function parseEvaActions(content) {
  if (!content || !S.user) return content;
  /* Garde absolue : tronquer les réponses anormalement longues AVANT tout traitement */
  if (content.length > 40000) content = content.slice(0, 40000);
  var actions = [];
  var removeRanges = []; /* [start, end] à effacer du texte affiché */

  /* ── 1. Blocs [ACTION:{...}] — extraction par comptage d'accolades ── */
  var pos = 0;
  while (true) {
    var aStart = content.indexOf('[ACTION:', pos);
    if (aStart === -1) break;
    /* Trouver le { (peut y avoir des espaces/sauts après [ACTION:) */
    var braceStart = aStart + 8;
    while (braceStart < content.length && /[\s]/.test(content[braceStart])) braceStart++;
    if (content[braceStart] !== '{') { pos = aStart + 1; continue; }
    var jsonStr = _extractJsonObject(content, braceStart);
    if (!jsonStr) { pos = aStart + 1; continue; }
    /* Vérifier que le bloc se ferme bien par ] — accepter tout espace/saut entre } et ] */
    var closeIdx = braceStart + jsonStr.length;
    while (closeIdx < content.length && /[\s]/.test(content[closeIdx])) closeIdx++;
    if (content[closeIdx] !== ']') { pos = aStart + 1; continue; }
    var blockEnd = closeIdx + 1;
    var action = _lenientParse(jsonStr);
    if (action && typeof action === 'object') {
      actions.push(action);
    } else {
      console.warn('[EVA] action parse error sur :', jsonStr.slice(0, 120));
    }
    removeRanges.push([aStart, blockEnd]);
    pos = blockEnd;
  }

  /* ── 2. Blocs ```pdf / ```pptx / ```excel / ```csv / ```txt ── */
  var fileCodeRe = /```(pdf|pptx?|xlsx?|excel|csv|txt)\s*\n([\s\S]*?)```/gi;
  var fcMatch;
  while ((fcMatch = fileCodeRe.exec(content)) !== null) {
    /* Éviter les doublons si ce bloc était déjà dans une plage ACTION */
    var skip = false;
    for (var k = 0; k < removeRanges.length; k++) {
      if (fcMatch.index >= removeRanges[k][0] && fcMatch.index < removeRanges[k][1]) { skip = true; break; }
    }
    if (skip) continue;
    var fLang = fcMatch[1].toLowerCase();
    var fBody = (fcMatch[2] || '').trim();
    var blockRange = [fcMatch.index, fcMatch.index + fcMatch[0].length];
    /* Essai 1 : corps = JSON pur */
    var fAct = _lenientParse(fBody);
    if (fAct && typeof fAct === 'object') { actions.push(fAct); removeRanges.push(blockRange); continue; }
    /* Essai 2 : corps contient [ACTION:{...}] */
    var innerPos = fBody.indexOf('[ACTION:');
    if (innerPos !== -1) {
      var innerBrace = fBody.indexOf('{', innerPos + 8);
      if (innerBrace !== -1) {
        var innerJson = _extractJsonObject(fBody, innerBrace);
        if (innerJson) { var act2 = _lenientParse(innerJson); if (act2) { actions.push(act2); removeRanges.push(blockRange); continue; } }
      }
    }
    /* Essai 3 : synthétiser depuis le texte brut */
    var typeMap = { pdf:'pdf', pptx:'pptx', ppt:'pptx', xlsx:'excel', xls:'excel', excel:'excel', csv:'csv', txt:'txt' };
    var synType = typeMap[fLang] || 'txt';
    if (synType === 'txt' || synType === 'pdf') {
      actions.push({ type: synType, filename: 'eva_document.' + (synType === 'pdf' ? 'pdf' : 'txt'), title: 'Document EVA', content: fBody });
      removeRanges.push(blockRange);
    }
  }

  /* ── Exécuter les actions détectées ── */
  var _fileActionTypes = ['pdf','excel','pptx','txt','csv','pdf_repair'];
  actions.forEach(function(action) {
    if (action && _fileActionTypes.indexOf(action.type) !== -1) {
      /* Capturer _evaFileTarget maintenant (avant qu'il soit remis à null) */
      var _capturedTarget = window._evaFileTarget || null;
      /* Différer la création de la carte fichier pour qu'elle s'affiche APRÈS le texte */
      setTimeout(function(){
        var _prev = window._evaFileTarget;
        if (_capturedTarget) window._evaFileTarget = _capturedTarget;
        executeEvaAction(action);
        window._evaFileTarget = _prev;
      }, 0);
    } else {
      executeEvaAction(action);
    }
  });


  /* ── Extraction des suggestions de suivi ── */
  var suggestions = null;
  var sugRe = /\[SUGGESTIONS:\s*(\[[^\]]+\])\s*\]/g;
  var sm;
  while ((sm = sugRe.exec(content)) !== null) {
    try {
      suggestions = JSON.parse(sm[1]);
      removeRanges.push([sm.index, sm.index + sm[0].length]);
    } catch(e) {}
  }
  
  /* ── Nettoyage du texte affiché — supprimer les plages (du dernier au premier) ── */
  removeRanges.sort(function(a, b) { return b[0] - a[0]; });
  var clean = content;
  removeRanges.forEach(function(r) { clean = clean.slice(0, r[0]) + clean.slice(r[1]); });
  /* Filet de sécurité : blocs code fichier restants */
  clean = clean.replace(/```(pdf|pptx?|xlsx?|excel|csv|txt)\s*\n[\s\S]*?```/gi, '');
  /* Faux liens sandbox:/file:// générés par certains modèles */
  clean = clean.replace(/\[([^\]]+)\]\((sandbox:|file:\/\/)[^\)]*\)/gi, function(m, label) { return '**' + label + '**'; });
  clean = clean.replace(/sandbox:\/[^\s\)"]*/gi, '').replace(/file:\/\/[^\s\)"]*/gi, '');
  /* Filet final : retire tout [ACTION:{...}] résiduel même si JSON non parsé
     Utilise \s* entre } et ] pour gérer les sauts de ligne entre les deux */
  clean = clean.replace(/\[ACTION:\s*\{[\s\S]*?\}\s*\]/g, '');
  /* Filet agressif : si [ACTION:{ reste sans fermeture valide, effacer jusqu'à la fin */
  clean = clean.replace(/\[ACTION:\s*\{[\s\S]*/g, '');
  /* Retire les blocs trop volumineux (> 12000 chars = réponse anormale) */
  if (clean.length > 12000) {
    clean = clean.slice(0, 12000) + '\n\n_[Réponse tronquée pour des raisons de performance]_';
  }

  /* ── Si des fichiers ont été générés, réduire le texte à 1 phrase courte ── */
  var FILE_TYPES = ['pdf', 'excel', 'pptx', 'txt', 'csv'];
  var hasFileAction = actions.some(function(a) { return a && FILE_TYPES.indexOf(a.type) !== -1; });
  if (hasFileAction) {
    var trimmed = clean.trim();
    /* Chercher la première fin de phrase (. ! ?) */
    var stopIdx = trimmed.search(/[.!?](\s|$)/);
    if (stopIdx !== -1 && stopIdx < 250) {
      trimmed = trimmed.slice(0, stopIdx + 1).trim();
    } else if (trimmed.length > 180) {
      /* Texte trop long sans fin de phrase → supprimer */
      trimmed = '';
    }
    return trimmed;
  }

    window._lastEvaSuggestions = suggestions;
  return clean.trim();
}

async function executeEvaAction(action) {
  if (!action || !action.type || !S.user) return;
  var uid = S.user.uid;
  try {
    if (action.type === 'agentic_task') {
      try {
        var onlineDevice = action.deviceId || null;
          if (!onlineDevice) {
            var snap = await window.db.collection('cloudworks').doc(uid).collection('devices').where('deviceType','==','windows').get();
            snap.forEach(function(d) { if (d.data().online) onlineDevice = d.id; });
          }
        if (onlineDevice) {
          if(window.setEvaStatus) window.setEvaStatus('🚀 MISSION AGENTIQUE...', 'action');
          var cmdRef = await window.db.collection('cloudworks').doc(uid).collection('commands').add({
            deviceId: onlineDevice,
            type: 'agentic_task',
            payload: { prompt: action.prompt || "Trouve un moyen de le faire." },
            status: 'pending',
            createdAt: typeof window.timestamp === 'function' ? window.timestamp() : new Date()
          });
          if (window.appendCloudWorksTracker) window.appendCloudWorksTracker(cmdRef.id, action.prompt || "Trouve un moyen de le faire.");
          if (window.toast) window.toast('Agent Local : Tâche envoyée avec succès au PC !', 'success');
        } else {
          if (window.toast) window.toast('Action échouée : Le PC Agent est déconnecté.', 'error');
        }
      } catch(e) { console.error('Erreur agentic_task:', e); }
    } else if (action.type === 'note') {
      setEvaStatus('📝 CRÉATION NOTE...', 'action');
      await db.collection('users').doc(uid).collection('notes').add({
        title: action.title || 'Note d\'EVA',
        body: action.body || action.content || '',
        tag: action.tag || '',
        createdAt: window.timestamp(),
        updatedAt: window.timestamp()
      });
      toast('📝 Note créée par EVA : ' + (action.title || ''), 'success');
      setEvaStatus('📝 NOTE CRÉÉE !', 'action');
      setTimeout(function(){ setEvaStatus(null); }, 3000);

    } else if (action.type === 'alarm') {
      setEvaStatus('⏰ CRÉATION ALARME...', 'action');
      await db.collection('users').doc(uid).collection('alarms').add({
        time: action.time || '08:00',
        label: action.label || 'Alarme EVA',
        repeat: action.repeat || 'once',
        active: true,
        createdAt: window.timestamp()
      });
      toast('⏰ Alarme créée par EVA : ' + (action.label || action.time || ''), 'success');
      setEvaStatus('⏰ ALARME CRÉÉE !', 'action');
      setTimeout(function(){ setEvaStatus(null); }, 3000);

    } else if (action.type === 'reminder') {
      setEvaStatus('📌 CRÉATION RAPPEL...', 'action');
      var reminderDatetime;
      if (action.date && action.time) {
        reminderDatetime = new Date(action.date + 'T' + action.time + ':00');
      } else if (action.date) {
        reminderDatetime = new Date(action.date + 'T09:00:00');
      } else {
        var d = new Date(); d.setHours(d.getHours() + 1);
        reminderDatetime = d;
      }
      await db.collection('users').doc(uid).collection('reminders').add({
        text: action.text || 'Rappel EVA',
        datetime: reminderDatetime,
        completed: false,
        notified: false,
        createdAt: window.timestamp()
      });
      toast('📌 Rappel créé par EVA : ' + (action.text || ''), 'success');
      setEvaStatus('📌 RAPPEL CRÉÉ !', 'action');
      setTimeout(function(){ setEvaStatus(null); }, 3000);
      if (window._currentView === 'reminders') loadReminders();

    } else if (action.type === 'event') {
      setEvaStatus('📅 AGENDA...', 'action');
      await db.collection('users').doc(uid).collection('events').add({
        title: action.title || 'Événement EVA',
        date: action.date || new Date().toISOString().slice(0,10),
        time: action.time || '',
        description: action.description || '',
        createdAt: window.timestamp()
      });
      toast('📅 Événement ajouté par EVA : ' + (action.title || ''), 'success');
      setEvaStatus('📅 ÉVÉNEMENT AJOUTÉ !', 'action');
      setTimeout(function(){ setEvaStatus(null); }, 3000);

    } else if (action.type === 'pdf') {
      _evaGeneratePdf(action);

    } else if (action.type === 'excel') {
      _evaGenerateExcel(action);

    } else if (action.type === 'pptx') {
      _evaGeneratePptx(action);

    } else if (action.type === 'txt') {
      _evaGenerateTxt(action);

    } else if (action.type === 'csv') {
      _evaGenerateCsv(action);

    } else if (action.type === 'pdf_repair') {
      _evaGenerateRepairPdf(action);
    }
  } catch(e) {
    console.error('executeEvaAction error:', e);
    toast('Erreur lors de la création par EVA', 'error');
    setEvaStatus(null);
  }
}

/* ═══════════════════════════════════════════════════
   GÉNÉRATION DE FICHIERS — EVA File Tools
═══════════════════════════════════════════════════ */

/* ── Icônes SVG par type de fichier ── */
function _fileIconSvg(ext, sz) {
  sz = sz || 32;
  var colorMap = {pdf:'#ff6b6b',xlsx:'#51cf66',pptx:'#ff922b',txt:'#74c0fc',csv:'#69db7c',repair:'#f59e0b'};
  var c = colorMap[ext] || '#7b8bf5';
  var pathMap = {
    pdf: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/>',
    xlsx: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>',
    pptx: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/><rect x="6" y="7" width="5" height="4" rx="1"/>',
    txt: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="12" y2="17"/>',
    csv: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><rect x="7" y="12" width="10" height="7" rx="1"/>',
    repair: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M10 12h4M10 16h2"/>'
  };
  var p = pathMap[ext] || pathMap.txt;
  return '<svg viewBox="0 0 24 24" width="'+sz+'" height="'+sz+'" fill="none" stroke="'+c+'" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;">'+p+'</svg>';
}

/* Crée une carte "en cours de génération" dans le chat, retourne la bulle */
function _evaGenCard(fileExt, filename) {
  var listId = window._evaFileTarget || 'messagesList';
  var list = document.getElementById(listId);
  if (!list) list = document.getElementById('messagesList');
  if (!list) return null;
  var isVision = listId === 'vrMessages' || listId === 'vaMessages';
  var div = document.createElement('div');
  var colorMap = {pdf:'#ff6b6b',xlsx:'#51cf66',pptx:'#ff922b',txt:'#74c0fc',csv:'#69db7c',repair:'#f59e0b'};
  var accentColor = colorMap[fileExt] || '#7b8bf5';
  if (isVision) {
    div.className = 'vision-msg assistant';
    div.innerHTML = '<div class="eva-file-card" style="background:rgba(123,139,245,0.04);border:1px solid rgba(123,139,245,0.18);border-radius:12px;padding:14px 16px;min-width:230px;max-width:390px;"></div>';
  } else {
    div.className = 'message eva';
    div.innerHTML =
      '<div class="msg-content" style="flex:1;min-width:0;">' +
        '<div class="msg-bubble eva-file-card" style="background:rgba(123,139,245,0.03);border:1px solid rgba(123,139,245,0.15);border-radius:14px;padding:16px 18px;max-width:400px;"></div>' +
        '<div class="msg-time" style="font-size:0.62em;color:var(--text-dim);margin-top:4px;padding-left:2px;">' + new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}) + '</div>' +
      '</div>';
  }
  list.appendChild(div);
  var bubble = div.querySelector('.eva-file-card');
  /* Affiche spinner "en cours" */
  bubble.innerHTML =
    '<div style="display:flex;align-items:center;gap:14px;">' +
      '<div style="width:42px;height:42px;border-radius:10px;background:rgba('+_hexToRgb(accentColor)+',0.1);border:1px solid rgba('+_hexToRgb(accentColor)+',0.2);display:flex;align-items:center;justify-content:center;flex-shrink:0;">' +
        _fileIconSvg(fileExt, 20) +
      '</div>' +
      '<div style="flex:1;min-width:0;">' +
        '<div style="font-size:0.8em;font-weight:600;color:var(--text);word-break:break-all;margin-bottom:5px;line-height:1.3;">' + filename + '</div>' +
        '<div style="display:flex;align-items:center;gap:8px;">' +
          '<div class="eva-file-spinner" style="width:11px;height:11px;border:2px solid rgba(123,139,245,0.15);border-top-color:#7b8bf5;border-radius:50%;animation:evaSpin 0.75s linear infinite;flex-shrink:0;"></div>' +
          '<span style="font-size:0.68em;color:rgba(123,139,245,0.7);letter-spacing:0.01em;">Génération en cours…</span>' +
        '</div>' +
      '</div>' +
    '</div>';
  if (!document.getElementById('evaSpinStyle')) {
    var st = document.createElement('style');
    st.id = 'evaSpinStyle';
    st.textContent = '@keyframes evaSpin{to{transform:rotate(360deg)}}';
    document.head.appendChild(st);
  }
  list.scrollTop = list.scrollHeight;
  return bubble;
}

function _hexToRgb(hex) {
  var r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return r+','+g+','+b;
}

/* Met à jour la carte avec le bouton télécharger final */
function _evaCardReady(bubble, fileExt, filename, blobUrl) {
  if (!bubble) return;
  var extMap = {pdf:'PDF',xlsx:'Excel',pptx:'PowerPoint',txt:'Texte',csv:'CSV',repair:'PDF Diagnostic'};
  var ext = filename.split('.').pop().toLowerCase();
  var typeLabel = extMap[ext] || ext.toUpperCase();
  var colorMap = {pdf:'#ff6b6b',xlsx:'#51cf66',pptx:'#ff922b',txt:'#74c0fc',csv:'#69db7c',repair:'#f59e0b'};
  var fext = (typeof fileExt === 'string' && colorMap[fileExt]) ? fileExt : ext;
  var color = colorMap[fext] || '#7b8bf5';
  bubble.innerHTML =
    '<div style="display:flex;align-items:center;gap:14px;margin-bottom:14px;">' +
      '<div style="width:42px;height:42px;border-radius:10px;background:rgba('+_hexToRgb(color)+',0.1);border:1px solid rgba('+_hexToRgb(color)+',0.2);display:flex;align-items:center;justify-content:center;flex-shrink:0;">' +
        _fileIconSvg(fext, 20) +
      '</div>' +
      '<div style="flex:1;min-width:0;">' +
        '<div style="font-size:0.8em;font-weight:600;color:var(--text);word-break:break-all;line-height:1.3;">' + filename + '</div>' +
        '<div style="font-size:0.67em;color:rgba(255,255,255,0.35);margin-top:3px;display:flex;align-items:center;gap:5px;">' +
          '<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="'+color+'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' +
          'Fichier ' + typeLabel + ' généré' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<button onclick="window.openDocumentViewer({name: \''+esc(filename)+'\', ext: \''+ext+'\', url: \''+blobUrl+'\'})" style="display:flex;align-items:center;justify-content:center;gap:8px;background:'+color+';border:none;cursor:pointer;color:#0a0a0c;text-decoration:none;font-size:0.75em;font-weight:700;border-radius:8px;padding:9px 16px;letter-spacing:0.03em;transition:opacity .15s;width:100%;box-sizing:border-box;" onmouseover="this.style.opacity=\'0.85\'" onmouseout="this.style.opacity=\'1\'">' +
      '<svg viewBox="0 0 24 24" style="width:13px;height:13px;fill:none;stroke:#0a0a0c;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round;flex-shrink:0;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>' +
      'Visualiser' +
    '</button>';
  var listId2 = window._evaFileTarget || 'messagesList';
  var list = document.getElementById(listId2) || document.getElementById('messagesList');
  if (list) list.scrollTop = list.scrollHeight;
}

/* Détecte le style de PDF à partir du nom de fichier / title / hint EVA */
function _detectPdfStyle(action) {
  var hint = (action.style || '').toLowerCase();
  if (hint) return hint;
  var name = ((action.title || '') + ' ' + (action.filename || '')).toLowerCase();
  if (/rapport|compte.rendu|bilan|cr\b|synthèse|synthese/.test(name)) return 'report';
  if (/cv|resum|curriculum/.test(name)) return 'pro';
  if (/factur|devis|invoice/.test(name)) return 'pro';
  if (/cours|tp|td|examen|these|mémoire|academique|academic/.test(name)) return 'academic';
  if (/contrat|accord|convention|légal|legal/.test(name)) return 'pro';
  if (/créatif|creatif|portfolio|brochure/.test(name)) return 'creative';
  return 'pro';
}

async function _evaGeneratePdf(action) {
  setEvaStatus('GÉNÉRATION PDF/SLIDES (MARP)...', 'action');
  var filename = action.filename || 'document.pdf';
  var card = _evaGenCard('pdf', filename);
  try {
    if (!window.html2pdf) {
      await _loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js', 'html2pdf');
    }
    if (!window.MarpBundle) {
      await _loadScript('./js/lib/marp.bundle.min.js', 'marp');
    }

    var content = action.content || '';
    content = content.replace(/^\s*```(html|pdf|markdown|marp)\s*/i, '').replace(/\s*```\s*$/i, '');

    if (!content.includes('marp: true')) {
      content = "---\nmarp: true\ntheme: default\npaginate: true\n---\n\n" + content;
    }
    
    const marp = new window.MarpBundle.Marp({ html: true });
    const { html, css } = marp.render(content);

    var fullHtml = `
      <style>
        ${css}
        section { page-break-after: always; box-shadow: none !important; margin: 0 !important; }
      </style>
      <div class="marpit" style="width: 100%; height: auto; min-width: 800px;">
        ${html}
      </div>
    `;

    var container = document.createElement('div');
    container.innerHTML = fullHtml;
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    document.body.appendChild(container);
    
    if (action.type === 'marp_pptx' || action.type === 'pptx') {
      var standaloneHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${filename}</title><style>${css} body { margin: 0; padding: 0; display: flex; flex-direction: column; align-items: center; background: #333; } section { margin: 20px 0; box-shadow: 0 4px 10px rgba(0,0,0,0.5); }</style></head><body><div class="marpit">${html}</div></body></html>`;
      
      var blob = new Blob([standaloneHtml], { type: 'text/html' });
      var reader = new FileReader();
      reader.onloadend = function() {
        document.body.removeChild(container);
        var realFilename = filename.replace('.pptx', '.html');
        _evaFinalizeCard(card, 'code', reader.result, realFilename);
        setEvaStatus('Prêt', 'idle');
      };
      reader.readAsDataURL(blob);
      return;
    }

    var opt = {
      margin:       0,
      filename:     filename,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true },
      jsPDF:        { unit: 'in', format: 'letter', orientation: 'landscape' }
    };

    html2pdf().set(opt).from(container).output('datauristring').then(function(pdfAsString) {
      document.body.removeChild(container);
      _evaFinalizeCard(card, 'pdf', pdfAsString, filename);
      setEvaStatus('Prêt', 'idle');
    }).catch(function(err) {
      if(container.parentNode) document.body.removeChild(container);
      _evaFinalizeCard(card, 'pdf', null, filename, err.toString());
      setEvaStatus('Prêt', 'idle');
    });
  } catch (err) {
    _evaFinalizeCard(card, 'pdf', null, filename, err.toString());
    setEvaStatus('Prêt', 'idle');
  }
}

function _evaGenerateExcel(action) {
  setEvaStatus('GÉNÉRATION EXCEL…', 'action');
  var filename = action.filename || 'eva_donnees.xlsx';
  var card = _evaGenCard('xlsx', filename);
  try {
    var XLSXLib = window.XLSX;
    if (!XLSXLib || !XLSXLib.utils) { toast('Librairie Excel non chargée', 'error'); setEvaStatus(null); return; }
    var wsData = [];
    if (action.headers && action.headers.length) wsData.push(action.headers.map(String));
    if (action.rows && action.rows.length) {
      action.rows.forEach(function(r){ wsData.push(Array.isArray(r) ? r.map(String) : [String(r)]); });
    } else if (action.csv) {
      action.csv.split('\n').forEach(function(l){ if(l.trim()) wsData.push(l.split(',')); });
    }
    if (!wsData.length) wsData.push(['Aucune donnée']);
    var ws = XLSXLib.utils.aoa_to_sheet(wsData);
    /* Auto-largeur des colonnes basée sur le contenu */
    var colWidths = [];
    wsData.forEach(function(row) {
      row.forEach(function(cell, ci) {
        var len = String(cell || '').length;
        if (!colWidths[ci] || colWidths[ci] < len) colWidths[ci] = len;
      });
    });
    ws['!cols'] = colWidths.map(function(w){ return { wch: Math.min(Math.max(w + 2, 8), 60) }; });
    var wb = XLSXLib.utils.book_new();
    XLSXLib.utils.book_append_sheet(wb, ws, (action.title || 'Données').slice(0,31));
    var wbout = XLSXLib.write(wb, {bookType:'xlsx', type:'array'});
    var blob = new Blob([new Uint8Array(wbout)], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    var url = URL.createObjectURL(blob);
    toast('Excel prêt : ' + filename, 'success');
    setEvaStatus('EXCEL CRÉÉ', 'action');
    setTimeout(function(){ setEvaStatus(null); }, 3000);
    _evaCardReady(card, 'xlsx', filename, url);
  } catch(e) {
    console.error('[EVA Excel]', e);
    toast('Erreur génération Excel : ' + e.message, 'error');
    if (card) card.innerHTML = '<span style="color:#ff6b6b;font-size:0.75em;">❌ Erreur : ' + e.message + '</span>';
    setEvaStatus(null);
  }
}

async function _evaGeneratePptx(action) {
  action.type = 'marp_pptx';
  return _evaGeneratePdf(action);
}

function _evaGenerateTxt(action) {
  setEvaStatus('GÉNÉRATION TXT…', 'action');
  var filename = action.filename || 'eva_fichier.txt';
  var card = _evaGenCard('txt', filename);
  try {
    var content = (action.content || '').replace(/\\n/g, '\n');
    var blob = new Blob([content], {type:'text/plain;charset=utf-8'});
    var url = URL.createObjectURL(blob);
    toast('Fichier texte prêt : ' + filename, 'success');
    setEvaStatus('TXT CRÉÉ', 'action');
    setTimeout(function(){ setEvaStatus(null); }, 3000);
    _evaCardReady(card, 'txt', filename, url);
  } catch(e) {
    console.error('[EVA TXT]', e);
    toast('Erreur génération TXT : ' + e.message, 'error');
    if (card) card.innerHTML = '<span style="color:#ff6b6b;font-size:0.75em;">❌ Erreur : ' + e.message + '</span>';
    setEvaStatus(null);
  }
}

function _evaGenerateCsv(action) {
  setEvaStatus('GÉNÉRATION CSV…', 'action');
  var filename = action.filename || 'eva_donnees.csv';
  var card = _evaGenCard('csv', filename);
  try {
    var rows = [];
    if (action.headers && action.headers.length) rows.push(action.headers);
    if (action.rows && action.rows.length) action.rows.forEach(function(r){ rows.push(r); });
    var csv = rows.map(function(row){
      return row.map(function(cell){
        var s = String(cell==null?'':cell);
        if(s.includes(',')||s.includes('"')||s.includes('\n')) s='"'+s.replace(/"/g,'""')+'"';
        return s;
      }).join(',');
    }).join('\n');
    var blob = new Blob(['\uFEFF'+csv], {type:'text/csv;charset=utf-8'});
    var url = URL.createObjectURL(blob);
    toast('CSV prêt : ' + filename, 'success');
    setEvaStatus('CSV CRÉÉ', 'action');
    setTimeout(function(){ setEvaStatus(null); }, 3000);
    _evaCardReady(card, 'csv', filename, url);
  } catch(e) {
    console.error('[EVA CSV]', e);
    toast('Erreur génération CSV : ' + e.message, 'error');
    if (card) card.innerHTML = '<span style="color:#ff6b6b;font-size:0.75em;">❌ Erreur : ' + e.message + '</span>';
    setEvaStatus(null);
  }
}

/* ═══════════════════════════════════════════════════
   GÉNÉRATION PDF RÉPARATION — ASTRAL TECHNOLOGIE
   Design professionnel v2 — grille, signatures, analyse EVA
═══════════════════════════════════════════════════ */
async function _evaGenerateRepairPdf(action) {
  setEvaStatus('GÉNÉRATION COMPTE-RENDU…', 'action');
  var filename = action.filename || ('compte_rendu_' + new Date().toISOString().slice(0,10) + '.pdf');
  var card = _evaGenCard('repair', filename);
  try {
    if (!window.jspdf || !window.jspdf.jsPDF) { toast('Librairie PDF non chargée', 'error'); setEvaStatus(null); return; }
    var jsPDF = window.jspdf.jsPDF;

    /* ── Plafonnement des champs longs pour éviter le blocage JS ── */
    var CAP = 3000;
    function _capField(val) { return val && val.length > CAP ? val.slice(0, CAP) + '\n[…contenu tronqué]' : val; }

    /* Auto-fill technicien depuis profil */
    var techName = action.technician || (S.profile && (S.profile.displayName || S.profile.nickname)) || 'Non renseigné';
    var techRole = action.technician_role || (S.profile && S.profile.devKeyLabel) || (S.profile && S.profile.role) || 'Technicien';
    var clientName = action.client || 'Non fourni';
    var equipName = action.equipment || 'Non fourni';
    var serialNum = action.serial || 'Non fourni';
    var status = (action.status || 'En cours').trim();
    var dateStr = action.date || new Date().toLocaleDateString('fr-FR', {day:'2-digit', month:'long', year:'numeric'});
    var refNum = 'EVA-VR-' + Date.now().toString().slice(-6);

    /* Plafonnement des champs contenu */
    action.diagnostics      = _capField(action.diagnostics);
    action.interventions    = _capField(action.interventions);
    action.recommendations  = _capField(action.recommendations);
    action.user_notes       = _capField(action.user_notes || action.notes);
    action.eva_analysis     = _capField(action.eva_analysis);

    /* Logo */
    var logoB64 = null;
    try {
      var logoResp = await fetch('/assets/images/astral-logo.png');
      if (logoResp.ok) {
        var logoBlob = await logoResp.blob();
        logoB64 = await new Promise(function(res) { var rd = new FileReader(); rd.onload = function() { res(rd.result); }; rd.readAsDataURL(logoBlob); });
      }
    } catch(le) {}

    /* Céder le fil principal avant la génération synchrone jsPDF */
    await new Promise(function(res) { setTimeout(res, 0); });

    var doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    var pageW = 210, pageH = 297, margin = 15, usable = pageW - margin * 2, colW = (usable - 8) / 2;

    /* ════ CONSTANTES COULEURS ════ */
    var CYAN   = [0, 180, 216];
    var COPPER = [175, 105, 35];
    var AMBER  = [202, 138, 4];
    var CONTENT_BOTTOM = pageH - margin - 18;

    /* ════ HEADER ════ */
    var HEADER_H = 66;
    doc.setFillColor(10, 13, 20);
    doc.rect(0, 0, pageW, HEADER_H, 'F');
    doc.setFillColor(COPPER[0], COPPER[1], COPPER[2]);
    doc.rect(0, HEADER_H - 3, pageW, 3, 'F');
    doc.setFillColor(CYAN[0], CYAN[1], CYAN[2]);
    doc.rect(0, 0, 5, HEADER_H, 'F');

    /* ════ LOGO ════ */
    if (logoB64) {
      try { doc.addImage(logoB64, 'PNG', 10, 8, 34, 34); } catch(ie) {}
    } else {
      doc.setFillColor(CYAN[0], CYAN[1], CYAN[2]);
      doc.roundedRect(10, 10, 32, 28, 3, 3, 'F');
      doc.setTextColor(10, 13, 20);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('EVA', 26, 27, { align: 'center' });
    }

    /* ════ TITRE ════ */
    doc.setTextColor(COPPER[0], COPPER[1], COPPER[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(19);
    doc.text('ASTRAL TECHNOLOGIE', 50, 22);
    doc.setTextColor(CYAN[0], CYAN[1], CYAN[2]);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.text('COMPTE-RENDU DE RÉPARATION INFORMATIQUE', 50, 31);
    doc.setTextColor(105, 130, 155);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text('Réf. ' + refNum + '   ·   ' + dateStr, 50, 40);
    doc.text('Technicien : ' + techName + '   ·   ' + techRole, 50, 47);

    /* ════ BADGE STATUT ════ */
    var statusColMap = { 'Résolu': [22, 163, 74], 'En cours': [202, 138, 4], 'À surveiller': [234, 88, 12], 'Non résolu': [220, 38, 38] };
    var sc = statusColMap[status] || [100, 100, 120];
    doc.setFillColor(sc[0], sc[1], sc[2]);
    doc.roundedRect(pageW - margin - 45, 11, 45, 12, 2.5, 2.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text(status.toUpperCase(), pageW - margin - 22.5, 18.5, { align: 'center' });

    /* ════ GRILLE INFO 2×3 ════ */
    var y = HEADER_H + 6;
    var CELL_H = 22, CELL_GAP = 4, CELL_PAD = 4;
    var cells = [
      { label: 'CLIENT', value: clientName, ac: CYAN },
      { label: 'TECHNICIEN', value: techName + '\n' + techRole, ac: COPPER },
      { label: 'ÉQUIPEMENT', value: equipName, ac: CYAN },
      { label: 'N° DE SÉRIE', value: serialNum, ac: CYAN },
      { label: 'DATE', value: dateStr, ac: CYAN },
      { label: 'STATUT', value: status, ac: sc }
    ];
    for (var ci = 0; ci < cells.length; ci++) {
      var cell = cells[ci];
      var cx = (ci % 2 === 0) ? margin : margin + colW + CELL_GAP;
      var cy2 = y + Math.floor(ci / 2) * (CELL_H + 3);
      /* Fond cellule */
      doc.setFillColor(240, 245, 252);
      doc.roundedRect(cx, cy2, colW, CELL_H, 2, 2, 'F');
      /* Barre top colorée */
      doc.setFillColor(cell.ac[0], cell.ac[1], cell.ac[2]);
      doc.rect(cx, cy2, colW, 2.5, 'F');
      /* Label */
      doc.setTextColor(100, 115, 140);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.text(cell.label, cx + CELL_PAD, cy2 + 8.5);
      /* Valeur */
      doc.setTextColor(cell.ac[0], cell.ac[1], cell.ac[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      var valLines = doc.splitTextToSize(cell.value, colW - CELL_PAD * 2);
      valLines.forEach(function(vl, vi) {
        doc.text(vl, cx + CELL_PAD, cy2 + 15.5 + vi * 5.5);
      });
    }
    y = y + 3 * (CELL_H + 3) + 8;

    /* ════ HELPERS SECTIONS ════ */
    function chkPage(yy, needed) {
      if (yy + (needed || 20) > CONTENT_BOTTOM) { doc.addPage(); return margin; }
      return yy;
    }

    function sectionHdr(txt, accent, yy) {
      yy = chkPage(yy, 18);
      doc.setFillColor(12, 17, 28);
      doc.rect(margin, yy, usable, 12, 'F');
      doc.setFillColor(accent[0], accent[1], accent[2]);
      doc.rect(margin, yy, 4.5, 12, 'F');
      doc.setTextColor(accent[0], accent[1], accent[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.text(txt.toUpperCase(), margin + 9, yy + 8.5);
      return yy + 16;
    }

    function bodyLines(txt, accent, yy) {
      if (!txt) return yy;
      var cleaned = txt.replace(/\\n/g, '\n').replace(/\n{3,}/g, '\n\n');
      var paras = cleaned.split('\n');
      paras.forEach(function(para) {
        if (!para.trim()) { yy += 2.5; return; }
        var isBullet = /^[-•·–*]\s/.test(para.trim());
        if (isBullet) {
          yy = chkPage(yy, 8);
          doc.setTextColor(accent[0], accent[1], accent[2]);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(13);
          doc.text('•', margin + 4, yy);
          doc.setTextColor(35, 48, 68);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(10.5);
          var bTxt = para.trim().replace(/^[-•·–*]\s*/, '');
          var bLines = doc.splitTextToSize(bTxt, usable - 15);
          bLines.forEach(function(l, li) {
            if (li > 0) yy = chkPage(yy, 7);
            doc.text(l, margin + 9, yy);
            yy += 6.5;
          });
        } else {
          doc.setTextColor(35, 48, 68);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(10.5);
          var pLines = doc.splitTextToSize(para, usable - 8);
          pLines.forEach(function(l) {
            yy = chkPage(yy, 7);
            doc.text(l, margin + 5, yy);
            yy += 6.5;
          });
        }
        yy += 1.5;
      });
      return yy + 4;
    }

    /* ════ SECTIONS CONTENU ════ */
    if (action.diagnostics) {
      y = sectionHdr('Diagnostic', CYAN, y);
      y = bodyLines(action.diagnostics, CYAN, y);
    }
    if (action.interventions) {
      y = sectionHdr('Interventions réalisées', CYAN, y);
      y = bodyLines(action.interventions, CYAN, y);
    }
    if (action.recommendations) {
      y = sectionHdr('Recommandations & Suivi', CYAN, y);
      y = bodyLines(action.recommendations, CYAN, y);
    }

    /* ════ NOTES UTILISATEUR ════ */
    var userNotes = action.user_notes || action.notes;
    var notesPlaceholders = ['[Notes fournies par l\'utilisateur]', '[Informations complémentaires, observations, points d\'attention]', 'Non fourni'];
    if (userNotes && notesPlaceholders.indexOf(userNotes) === -1) {
      y = chkPage(y, 25);
      doc.setFillColor(248, 247, 242);
      doc.rect(margin, y, usable, 12, 'F');
      doc.setFillColor(COPPER[0], COPPER[1], COPPER[2]);
      doc.rect(margin, y, 4.5, 12, 'F');
      doc.setTextColor(COPPER[0], COPPER[1], COPPER[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.text('NOTES UTILISATEUR', margin + 9, y + 8.5);
      y += 16;
      y = bodyLines(userNotes, COPPER, y);
    }

    /* ════ ANALYSE EVA ════ */
    var evaAnalysis = action.eva_analysis;
    var analysisPlaceholders = ['[Ton analyse personnelle approfondie]', '[Ton analyse personnelle : pistes non explorées, risques futurs, hypothèses alternatives, recherches complémentaires recommandées.]'];
    if (evaAnalysis && analysisPlaceholders.indexOf(evaAnalysis) === -1) {
      y = sectionHdr('Analyse EVA — Évaluation technique approfondie', AMBER, y);
      y = bodyLines(evaAnalysis, AMBER, y);
    }

    /* ════ ZONES DE SIGNATURE ════ */
    var sigH = 48, sigW = (usable - 10) / 2;
    if (y + sigH + 10 > CONTENT_BOTTOM) { doc.addPage(); y = margin; }
    else { y += 8; }
    /* Box CLIENT */
    var b1x = margin;
    doc.setFillColor(248, 250, 255);
    doc.rect(b1x, y, sigW, sigH, 'F');
    doc.setDrawColor(200, 215, 230);
    doc.setLineWidth(0.4);
    doc.rect(b1x, y, sigW, sigH, 'S');
    doc.setFillColor(CYAN[0], CYAN[1], CYAN[2]);
    doc.rect(b1x, y, sigW, 2.5, 'F');
    doc.setTextColor(CYAN[0], CYAN[1], CYAN[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('SIGNATURE CLIENT', b1x + 4, y + 10);
    doc.setTextColor(70, 88, 115);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text('Nom :', b1x + 4, y + 22);
    doc.text('Date :', b1x + 4, y + 32);
    doc.setDrawColor(180, 200, 220);
    doc.setLineWidth(0.35);
    doc.line(b1x + 17, y + 22, b1x + sigW - 4, y + 22);
    doc.line(b1x + 18, y + 32, b1x + sigW - 4, y + 32);
    doc.setTextColor(200, 215, 230);
    doc.setFontSize(7);
    doc.setLineDashPattern([2, 2], 0);
    doc.line(b1x + 4, y + 44, b1x + sigW - 4, y + 44);
    doc.setLineDashPattern([], 0);
    doc.text('Signature', b1x + sigW / 2, y + 42, { align: 'center' });
    /* Box TECHNICIEN */
    var b2x = margin + sigW + 10;
    doc.setFillColor(248, 250, 255);
    doc.rect(b2x, y, sigW, sigH, 'F');
    doc.setDrawColor(200, 215, 230);
    doc.setLineWidth(0.4);
    doc.rect(b2x, y, sigW, sigH, 'S');
    doc.setFillColor(COPPER[0], COPPER[1], COPPER[2]);
    doc.rect(b2x, y, sigW, 2.5, 'F');
    doc.setTextColor(COPPER[0], COPPER[1], COPPER[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('SIGNATURE TECHNICIEN', b2x + 4, y + 10);
    doc.setTextColor(70, 88, 115);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text('Nom :', b2x + 4, y + 22);
    doc.text('Date :', b2x + 4, y + 32);
    doc.setDrawColor(180, 200, 220);
    doc.setLineWidth(0.35);
    doc.line(b2x + 17, y + 22, b2x + sigW - 4, y + 22);
    doc.line(b2x + 18, y + 32, b2x + sigW - 4, y + 32);
    /* Pré-remplir nom technicien */
    doc.setTextColor(35, 50, 72);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text(techName, b2x + 18, y + 22);
    doc.setTextColor(200, 215, 230);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setLineDashPattern([2, 2], 0);
    doc.line(b2x + 4, y + 44, b2x + sigW - 4, y + 44);
    doc.setLineDashPattern([], 0);
    doc.text('Signature', b2x + sigW / 2, y + 42, { align: 'center' });

    /* ════ FOOTER TOUTES PAGES ════ */
    var totalPg = doc.internal.getNumberOfPages();
    for (var pg = 1; pg <= totalPg; pg++) {
      doc.setPage(pg);
      doc.setFillColor(10, 13, 20);
      doc.rect(0, pageH - 14, pageW, 14, 'F');
      doc.setFillColor(COPPER[0], COPPER[1], COPPER[2]);
      doc.rect(0, pageH - 14, pageW, 1.5, 'F');
      doc.setTextColor(90, 112, 138);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.text('Astral Technologie  ·  Document confidentiel  ·  Généré par E.V.A Intelligence Artificielle', margin, pageH - 5.5);
      doc.setTextColor(CYAN[0], CYAN[1], CYAN[2]);
      doc.setFont('helvetica', 'bold');
      doc.text('Page ' + pg + ' / ' + totalPg, pageW - margin, pageH - 5.5, { align: 'right' });
    }

    var blob = doc.output('blob');
    var url = URL.createObjectURL(blob);
    toast('Compte-rendu prêt : ' + filename, 'success');
    setEvaStatus('RAPPORT CRÉÉ', 'action');
    setTimeout(function(){ setEvaStatus(null); }, 3000);
    _evaCardReady(card, 'repair', filename, url);
  } catch(e) {
    console.error('[EVA RepairPDF]', e);
    toast('Erreur génération compte-rendu : ' + e.message, 'error');
    if (card) card.innerHTML = '<span style="color:#ff6b6b;font-size:0.75em;">❌ Erreur : ' + e.message + '</span>';
    setEvaStatus(null);
  }
}

/* ═══════════════════════════════════════════════════
   DEV KEY ACTIVATION
═══════════════════════════════════════════════════ */