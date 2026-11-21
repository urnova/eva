/* =============================================================
   CW-AGENT.JS - Agent ReAct CloudWorks
   Cycle : Penser -> Agir -> Observer -> Penser -> ...
   Le LLM raisonne a voix haute avant chaque action.
   ============================================================= */

(function() {
'use strict';

var MAX_TURNS = 12;
var APPROVAL_TIMEOUT = 30000;
var _activeAgent = null;

/* ================================================================
   SYSTEM PROMPT - Coeur du raisonnement
   On explique au LLM QUI il est, COMMENT il pense, et COMMENT il agit.
   On ne lui donne pas des regles mecaniques - on lui donne un cadre mental.
   ================================================================ */
function _buildSystemPrompt() {
  return (
    'Tu es EVA CloudWorks, un agent autonome qui a acces au PC Windows de l\'utilisateur.\n' +
    'Tu fonctionne en mode ReAct : avant chaque action, tu reflechis a voix haute.\n\n' +
    '=== TON CYCLE DE RAISONNEMENT ===\n' +
    'Pour CHAQUE etape, tu dois :\n' +
    '1. D\'abord ecrire ta pensee entre balises <thought>...</thought>\n' +
    '   Dans ta pensee : decompose la demande, explique CE QUE TU COMPRENDS, ce que tu vas faire et POURQUOI.\n' +
    '2. Ensuite, si une action est necessaire, appele UN outil avec <tool_call>{...}</tool_call>\n' +
    '3. Tu recevras le resultat de l\'outil. Relis-le, reflechis, et decide de la suite.\n' +
    '4. Quand la tache est completement terminee et verifiee, ecris [TACHE_TERMINEE] suivi d\'un bref recapitulatif.\n\n' +
    '=== COMMENT RAISONNER (exemples de pensees correctes) ===\n' +
    '\n' +
    'Exemple 1 - "Lance YouTube"\n' +
    '<thought>L\'utilisateur veut ouvrir YouTube. YouTube est un site web, pas une application Windows installee. ' +
    'La bonne approche est d\'ouvrir https://youtube.com dans le navigateur par defaut. ' +
    'Je n\'ai pas besoin de chercher "YouTube" dans le registre. J\'utilise app_launch avec l\'URL directement.</thought>\n' +
    '<tool_call>{"name": "app_launch", "args": {"target": "https://youtube.com"}}</tool_call>\n' +
    '\n' +
    'Exemple 2 - "Lance YouTube sur Firefox"\n' +
    '<thought>L\'utilisateur veut YouTube mais specifiquement sur Firefox. Je dois d\'abord verifier que Firefox est installe. ' +
    'Je vais utiliser app_resolve avec "firefox" comme query courte.</thought>\n' +
    '<tool_call>{"name": "app_resolve", "args": {"query": "firefox"}}</tool_call>\n' +
    '(apres le resultat) <thought>Firefox est trouve a C:\\Program Files\\Mozilla Firefox\\firefox.exe. ' +
    'Je lance Firefox avec l\'URL de YouTube en argument.</thought>\n' +
    '<tool_call>{"name": "app_launch", "args": {"target": "C:\\\\Program Files\\\\Mozilla Firefox\\\\firefox.exe", "args": "https://youtube.com"}}</tool_call>\n' +
    '\n' +
    'Exemple 3 - "Ouvre le dossier Documents et dis-moi ce qu\'il y a dedans"\n' +
    '<thought>L\'utilisateur veut voir le contenu de son dossier Documents. Je vais lister les fichiers avec file_list. ' +
    'Le chemin standard Windows est C:\\Users\\[username]\\Documents, mais je peux utiliser la variable d\'environnement.</thought>\n' +
    '<tool_call>{"name": "file_list", "args": {"path": "$env:USERPROFILE\\\\Documents"}}</tool_call>\n' +
    '\n' +
    'Exemple 4 - "Lance Discord et ensuite ouvre mon dossier telechargements"\n' +
    '<thought>Tache multiple : (1) lancer Discord, (2) ouvrir le dossier Telechargements. ' +
    'Je commence par Discord car c\'est cite en premier. Discord est une app installee, je cherche dans le menu Demarrer.</thought>\n' +
    '<tool_call>{"name": "app_resolve", "args": {"query": "discord"}}</tool_call>\n' +
    '\n' +
    '=== REGLES DE BON SENS ===\n' +
    '- YouTube, Netflix, Twitch, Gmail, ChatGPT, GitHub, Spotify web = SITES WEB -> utilise app_launch avec l\'URL https://\n' +
    '- Discord, Steam, Chrome, Firefox, VSCode, Word, Excel = APPS INSTALLEES -> utilise app_resolve puis app_launch\n' +
    '- Pour app_resolve, utilise TOUJOURS un nom court : "discord" et non "Lance Discord sur mon PC"\n' +
    '- Si l\'utilisateur dit "ouvre" sans preciser de navigateur, utilise directement app_launch avec l\'URL\n' +
    '- Si une action echoue, analyse l\'erreur dans ta pensee et essaie une approche alternative\n' +
    '- Ne repete jamais la meme action qui a echoue sans changer les parametres\n' +
    '- Reponds toujours en francais, sois concis dans tes recapitulatifs\n' +
    '- Ne revele jamais de cles API, tokens ou donnees sensibles\n' +
    '\n' +
    '=== OUTILS DISPONIBLES ===\n' +
    'app_resolve(query: string) - Cherche une app installee sur Windows. query = nom COURT (ex: "chrome", "discord", "word")\n' +
    'app_launch(target: string, args?: string) - Lance une app ou ouvre une URL. target = chemin exe OU url https://\n' +
    'file_list(path: string, depth?: number) - Liste les fichiers d\'un dossier\n' +
    'file_read(path: string) - Lit le contenu d\'un fichier texte\n' +
    'file_search(query: string, path?: string) - Recherche des fichiers par nom\n' +
    'file_create(path: string, content: string, append?: bool) - Cree ou modifie un fichier (txt, md, py, js, csv...)\n' +
    'folder_create(path: string) - Cree un dossier\n' +
    'folder_organize(sourcePath: string, groupBy: "date_month"|"extension", dryRun?: bool) - Organise un dossier\n' +
    'pdf_create(path: string, title: string, content: string) - Cree un PDF\n' +
    'excel_create(path: string, sheetName: string, headers: array, rows: array) - Cree un fichier Excel\n' +
    'document_create(format: string, filename: string, content: string, destination: string) - Cree un document formate\n' +
    'web_search(query: string, max_results?: number) - Recherche sur Internet\n' +
    'web_fetch(url: string) - Recupere le contenu d\'une page web\n' +
    'system_status() - Infos CPU, RAM, systeme\n' +
    'screenshot_take() - Prend une capture d\'ecran\n' +
    'process_verify(type: "file"|"folder"|"process", target: string) - Verifie qu\'un fichier/dossier/processus existe\n'
  );
}

/* ================================================================
   PARSEURS
   ================================================================ */
function _parseThought(text) {
  if (!text) return null;
  var match = text.match(/<thought>([\s\S]*?)<\/thought>/i);
  return match ? match[1].trim() : null;
}

function _parseToolCall(text) {
  if (!text) return null;
  var match = text.match(/<tool_call>([\s\S]*?)<\/tool_call>/);
  if (!match) return null;
  try {
    var parsed = JSON.parse(match[1].trim());
    if (!parsed.name) return null;
    return { name: parsed.name, args: parsed.args || {} };
  } catch(e) {
    return null;
  }
}

function _stripTags(text) {
  return text
    .replace(/<thought>[\s\S]*?<\/thought>/gi, '')
    .replace(/<tool_call>[\s\S]*?<\/tool_call>/g, '')
    .trim();
}

/* ================================================================
   LOGGING FIRESTORE
   ================================================================ */
async function _logAction(uid, taskId, toolName, toolArgs, result, decision) {
  if (!window.db || !uid || !taskId) return;
  try {
    await window.db.collection('users').doc(uid)
      .collection('cw_logs').doc(taskId)
      .collection('actions').add({
        tool: toolName,
        args: toolArgs,
        success: result.success,
        error: result.error || null,
        decision: decision,
        timestamp: window.timestamp ? window.timestamp() : new Date()
      });
  } catch(e) {}
}

/* ================================================================
   VALIDATION UTILISATEUR (demande approb avant action sensible)
   ================================================================ */
async function _requestApproval(toolName, args, stepEl) {
  return new Promise(function(resolve) {
    if (!stepEl) { resolve('refused'); return; }
    var argsPreview = JSON.stringify(args, null, 2).substring(0, 300);
    var card = stepEl.closest('.cw-tracker-card');
    if (!card) { resolve('refused'); return; }

    card.classList.add('pending_approval');
    var badge = card.querySelector('.cw-tracker-badge');
    if (badge) { badge.textContent = 'En attente'; badge.className = 'cw-tracker-badge pending'; }

    var approvalHtml = (
      '<div class="cw-approval-block" style="margin:10px 0; padding:12px; background:rgba(255,136,0,0.08); border:1px solid rgba(255,136,0,0.3); border-radius:10px;">' +
      '<div style="font-size:0.72em; color:#ff9900; font-weight:700; margin-bottom:6px;">Action requise : ' + toolName + '</div>' +
      '<pre style="font-size:0.65em; color:rgba(255,230,200,0.7); background:rgba(0,0,0,0.3); padding:8px; border-radius:6px; overflow:auto; max-height:120px;">' + argsPreview + '</pre>' +
      '<div style="display:flex; gap:8px; margin-top:10px;">' +
      '<button class="cw-approval-btn accept" style="flex:1;padding:7px;background:linear-gradient(135deg,#ff8800,#dd6600);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:0.72em;font-weight:600;">Autoriser</button>' +
      '<button class="cw-approval-btn reject" style="flex:1;padding:7px;background:rgba(255,77,109,0.1);color:#ff4d6d;border:1px solid rgba(255,77,109,0.25);border-radius:8px;cursor:pointer;font-size:0.72em;font-weight:600;">Refuser</button>' +
      '</div></div>'
    );

    var approvalEl = document.createElement('div');
    approvalEl.innerHTML = approvalHtml;
    var stepsContainer = card.querySelector('.cw-tracker-steps') || card;
    stepsContainer.appendChild(approvalEl.firstElementChild);

    var timer = setTimeout(function() {
      cleanup();
      resolve('timeout');
    }, APPROVAL_TIMEOUT);

    function cleanup() {
      clearTimeout(timer);
      var block = stepsContainer.querySelector('.cw-approval-block');
      if (block) block.remove();
      card.classList.remove('pending_approval');
    }

    stepsContainer.querySelector('.cw-approval-btn.accept').addEventListener('click', function() {
      cleanup(); resolve('accepted');
    });
    stepsContainer.querySelector('.cw-approval-btn.reject').addEventListener('click', function() {
      cleanup(); resolve('refused');
    });
  });
}

/* ================================================================
   CLASSE AGENT REACT
   ================================================================ */
function CWAgent(uid, taskId, options) {
  this.uid = uid;
  this._taskId = taskId;
  this.autonomousMode = options && options.autonomousMode;
  this.approvalMode   = options && options.approvalMode;
  this._stopRequested = false;
}

CWAgent.prototype.stop = function() {
  this._stopRequested = true;
};

CWAgent.prototype.run = async function(userPrompt, emitFn, stepEl) {
  _activeAgent = this;

  // Fonction locale d'emission de log dans l'UI
  function _emit(text, status, isThought) {
    if (typeof emitFn === 'function') emitFn(text, status, isThought);
  }

  try {
    // Historique de conversation pour le LLM
    var messages = [
      { role: 'system',    content: _buildSystemPrompt() },
      { role: 'user',      content: userPrompt }
    ];

    var lastResponse = '';
    var turns = 0;

    while (turns < MAX_TURNS && !this._stopRequested) {
      turns++;

      // Appel LLM
      _emit('Reflexion en cours...', 'running');
      var response = '';
      try {
        response = await _callLLM(messages);
      } catch(e) {
        _emit('Erreur LLM: ' + e.message, 'error');
        return { success: false, error: e.message };
      }

      lastResponse = response;

      // 1. Extraire et afficher la pensee de l'agent
      var thought = _parseThought(response);
      if (thought) {
        _emit(thought, 'thought', true);
      }

      // 2. Chercher un appel d'outil
      var toolCall = _parseToolCall(response);

      // 3. Extraire le texte visible (sans les balises)
      var visibleText = _stripTags(response);

      // Pas d'outil -> l'agent a fini ou attend une reponse
      if (!toolCall) {
        if (visibleText) {
          _emit(visibleText, 'done');
        }

        // Detection de fin de tache
        if (response.includes('[TACHE_TERMINEE]')) {
          return { success: true, response: visibleText };
        }

        // L'agent parle mais n'agit pas et ne termine pas -> on le relance
        messages.push({ role: 'assistant', content: response });
        messages.push({ role: 'user', content: 'Continue. Si la tache est terminee, ecris [TACHE_TERMINEE].' });
        continue;
      }

      var toolName = toolCall.name;
      var toolArgs = toolCall.args;

      // Outil inconnu
      if (!window.CWTools || !window.CWTools.executeTool) {
        _emit('CWTools non disponible.', 'error');
        return { success: false, error: 'CWTools non disponible' };
      }
      if (!window.CWTools.TOOL_CLASSIFICATION[toolName]) {
        messages.push({ role: 'assistant', content: response });
        messages.push({ role: 'user', content: 'ERREUR: outil "' + toolName + '" inconnu. Utilise uniquement les outils listes dans ton prompt.' });
        continue;
      }

      // Validation si necessaire
      var classification = window.CWTools.TOOL_CLASSIFICATION[toolName];
      var decision = 'auto';
      if (classification === 'SENSITIVE' && !this.autonomousMode && this.approvalMode) {
        _emit('Action sensible detectee : ' + toolName, 'pending');
        decision = await _requestApproval(toolName, toolArgs, stepEl);
        if (decision !== 'accepted') {
          _emit('Action refusee par l\'utilisateur.', 'error');
          messages.push({ role: 'assistant', content: response });
          messages.push({ role: 'user', content: 'L\'utilisateur a refuse l\'action "' + toolName + '". Propose une alternative ou explique pourquoi tu ne peux pas continuer.' });
          await _logAction(this.uid, this._taskId, toolName, toolArgs, { success: false }, decision);
          continue;
        }
      }

      // Execution de l'outil
      _emit('Execution : ' + toolName + ' ...', 'running');
      var toolResult;
      try {
        toolResult = await window.CWTools.executeTool(toolName, toolArgs);
      } catch(e) {
        toolResult = { success: false, error: e.message };
      }

      await _logAction(this.uid, this._taskId, toolName, toolArgs, toolResult, decision);

      // Verification post-action automatique pour les creations de fichiers
      if (toolResult.success && (toolName === 'file_create' || toolName === 'pdf_create' || toolName === 'excel_create' || toolName === 'document_create')) {
        var targetPath = toolArgs.path || (toolArgs.destination ? (toolArgs.destination + '\\' + (toolArgs.filename || 'doc')) : null);
        if (targetPath) {
          try {
            var vCheck = await window.CWTools.executeTool('process_verify', { type: 'file', target: targetPath });
            if (vCheck && vCheck.result && (!vCheck.result.exists || vCheck.result.isEmpty)) {
              toolResult.success = false;
              toolResult.error = 'Le fichier cree est vide ou n\'existe pas.';
            }
          } catch(ve) {}
        }
      }

      // Retour du resultat au LLM
      if (toolResult.success) {
        var resultSummary = toolResult.result && toolResult.result.summary
          ? toolResult.result.summary
          : JSON.stringify(toolResult.result || {}).substring(0, 500);
        _emit('[' + toolName + '] OK : ' + resultSummary.substring(0, 200), 'done');
        messages.push({ role: 'assistant', content: response });
        messages.push({
          role: 'user',
          content: 'RESULTAT de ' + toolName + ':\n' + JSON.stringify(toolResult.result, null, 2).substring(0, 2000) + '\n\nReflechis au resultat et continue la tache. Ecris [TACHE_TERMINEE] quand tout est fait.'
        });
      } else {
        var errMsg = toolResult.error || 'Erreur inconnue';
        _emit('[' + toolName + '] ECHEC : ' + errMsg, 'error');
        messages.push({ role: 'assistant', content: response });
        messages.push({
          role: 'user',
          content: 'ECHEC de ' + toolName + ': ' + errMsg + '\n\nAnalyse l\'erreur dans ta pensee <thought>...</thought> et essaie une approche differente.'
        });
      }

      if (this._stopRequested) break;
    }

    if (this._stopRequested) {
      _emit('Tache interrompue.', 'error');
      return { success: false, error: 'Interrompu', response: lastResponse };
    }
    if (turns >= MAX_TURNS) {
      _emit('Nombre maximum de tours atteint (' + MAX_TURNS + ').', 'error');
    }

    return { success: true, response: lastResponse };

  } catch(e) {
    if (typeof emitFn === 'function') emitFn('Erreur critique: ' + e.message, 'error');
    return { success: false, error: e.message };
  } finally {
    _activeAgent = null;
  }
};

/* ================================================================
   APPEL LLM - Utilise le provider actif d'EVA
   ================================================================ */
async function _callLLM(messages) {
  // Essai avec EVAChatHandler (provider principal d'EVA)
  if (window.EVAChatHandler && typeof window.EVAChatHandler.sendMessage === 'function') {
    // Convertir l'historique en un seul prompt contextualisé
    var contextPrompt = messages.slice(1).map(function(m) {
      if (m.role === 'system') return '';
      if (m.role === 'user') return 'USER: ' + m.content;
      if (m.role === 'assistant') return 'ASSISTANT: ' + m.content;
      return m.content;
    }).filter(Boolean).join('\n\n');

    var sysPrompt = messages[0] && messages[0].role === 'system' ? messages[0].content : _buildSystemPrompt();
    var origSys = window.EVA_SYSTEM_PROMPT;
    window.EVA_SYSTEM_PROMPT = sysPrompt;
    try {
      var res = await window.EVAChatHandler.sendMessage(contextPrompt, { skipHistory: true });
      if (res && res.success && res.content) return res.content;
    } finally {
      window.EVA_SYSTEM_PROMPT = origSys;
    }
  }

  // Fallback direct sur Pollinations
  var body = {
    model: 'openai-fast',
    messages: messages,
    max_tokens: 1000,
    temperature: 0.3
  };
  var resp = await fetch('https://text.pollinations.ai/openai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000)
  });
  if (!resp.ok) throw new Error('LLM HTTP ' + resp.status);
  var data = await resp.json();
  var content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  if (!content) throw new Error('Reponse LLM vide');
  return content;
}

/* ================================================================
   API PUBLIQUE
   ================================================================ */
function stopActiveAgent() {
  if (_activeAgent) _activeAgent.stop();
}

window.CWAgent = CWAgent;
window.CWAgentStop = stopActiveAgent;

})();
