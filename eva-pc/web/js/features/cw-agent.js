/* =============================================================
   CW-AGENT.JS - Agent ReAct CloudWorks (PC Electron)
   Cycle : Penser -> Agir -> Observer -> Penser -> ...
   Le LLM raisonne a voix haute avant chaque action.
   ============================================================= */

(function() {
'use strict';

var MAX_TURNS = 12;
var APPROVAL_TIMEOUT = 30000;
var _activeAgent = null;

/* ================================================================
   SYSTEM PROMPT - Coeur du raisonnement ReAct
   ================================================================ */
function _buildSystemPrompt() {
  return (
    'Tu es EVA CloudWorks, un agent autonome qui a un acces complet au PC Windows de l\'utilisateur.\n' +
    'Tu fonctionnes en mode ReAct : avant chaque action, tu reflechis a voix haute.\n\n' +
    '=== TON CYCLE DE RAISONNEMENT ===\n' +
    'Pour CHAQUE etape, tu dois :\n' +
    '1. Ecrire ta pensee entre balises <thought>...</thought>\n' +
    '   Dans ta pensee : decompose la demande, explique CE QUE TU COMPRENDS, ce que tu vas faire et POURQUOI.\n' +
    '2. Ensuite, si une action est necessaire, appele UN outil avec <tool_call>{...}</tool_call>\n' +
    '3. Tu recevras le resultat. Relis-le dans ta pensee, et decide de la suite.\n' +
    '4. Quand la tache est completement terminee, ecris [TACHE_TERMINEE] suivi d\'un bref recapitulatif.\n\n' +
    '=== COMMENT RAISONNER (exemples) ===\n' +
    '\n' +
    'Exemple 1 - "Lance YouTube"\n' +
    '<thought>YouTube est un site web. Je dois l\'ouvrir dans le navigateur. ' +
    'J\'utilise web_browse qui ouvre automatiquement dans le navigateur par defaut.</thought>\n' +
    '<tool_call>{"name": "web_browse", "args": {"url": "https://www.youtube.com"}}</tool_call>\n' +
    '\n' +
    'Exemple 2 - "Lance YouTube sur Firefox"\n' +
    '<thought>L\'utilisateur veut YouTube sur Firefox specifiquement. Je dois d\'abord verifier que Firefox est installe.</thought>\n' +
    '<tool_call>{"name": "app_resolve", "args": {"query": "firefox"}}</tool_call>\n' +
    '(apres resultat) <thought>Firefox est a C:\\Program Files\\Mozilla Firefox\\firefox.exe. Je lance avec l\'URL en argument.</thought>\n' +
    '<tool_call>{"name": "app_launch", "args": {"target": "C:\\\\Program Files\\\\Mozilla Firefox\\\\firefox.exe", "args": "https://www.youtube.com"}}</tool_call>\n' +
    '\n' +
    'Exemple 3 - "Lance Discord"\n' +
    '<thought>Discord est une application installee. J\'utilise app_launch directement avec le nom court "Discord".</thought>\n' +
    '<tool_call>{"name": "app_launch", "args": {"target": "Discord"}}</tool_call>\n' +
    '\n' +
    'Exemple 4 - "Installe VLC"\n' +
    '<thought>L\'utilisateur veut installer VLC. Je verifie d\'abord s\'il est deja installe.</thought>\n' +
    '<tool_call>{"name": "app_check", "args": {"name": "VLC"}}}\n' +
    '(apres resultat) <thought>VLC n\'est pas installe. Je le telecharge et l\'installe via Winget.</thought>\n' +
    '<tool_call>{"name": "app_install", "args": {"name": "VLC"}}</tool_call>\n' +
    '\n' +
    'Exemple 5 - "Ouvre mon dossier Documents et dis-moi ce qu\'il y a"\n' +
    '<thought>L\'utilisateur veut voir son dossier Documents. Je liste son contenu avec file_list.</thought>\n' +
    '<tool_call>{"name": "file_list", "args": {"path": "$env:USERPROFILE\\\\Documents"}}</tool_call>\n' +
    '\n' +
    '=== REGLES DE BON SENS ===\n' +
    '- YouTube, Netflix, Twitch, Gmail, ChatGPT, GitHub = SITES WEB -> utilise web_browse avec l\'URL\n' +
    '- Discord, Steam, Spotify, Chrome, Firefox, VSCode = APPS INSTALLEES -> utilise app_launch avec le nom court\n' +
    '- Pour app_resolve, utilise TOUJOURS un nom court : "discord" et non "Lance Discord sur mon PC"\n' +
    '- Si une action echoue, analyse l\'erreur dans ta pensee et essaie une approche alternative\n' +
    '- Ne repete jamais la meme action qui a echoue sans changer les parametres\n' +
    '- Reponds en francais, sois concis dans tes recapitulatifs\n' +
    '- Ne revele jamais de cles API, tokens ou donnees sensibles\n' +
    '\n' +
    '=== OUTILS DISPONIBLES ===\n' +
    'web_browse(url?: string, query?: string) - Ouvre une URL dans le navigateur par defaut, ou effectue une recherche\n' +
    'app_launch(target: string, args?: string) - Lance une app installee par nom court. target = nom app (ex: "Discord") ou chemin exe\n' +
    'app_resolve(query: string) - Trouve le chemin/AppID exact d\'une app installee. query = nom court (ex: "firefox")\n' +
    'app_check(name: string) - Verifie si une app est installee. Retourne si disponible via Winget aussi\n' +
    'app_install(name: string) - Installe une app via Winget (ex: "VLC", "Discord", "Chrome")\n' +
    'app_close(name: string) - Ferme une application en cours\n' +
    'file_list(path: string, depth?: number) - Liste les fichiers d\'un dossier\n' +
    'file_read(path: string) - Lit le contenu d\'un fichier texte\n' +
    'file_search(query: string, path?: string) - Recherche des fichiers par nom\n' +
    'file_create(path: string, content: string, append?: bool) - Cree ou modifie un fichier (txt, md, py, js, csv...)\n' +
    'folder_create(path: string) - Cree un dossier\n' +
    'folder_organize(sourcePath: string, groupBy: "date_month"|"extension", dryRun?: bool) - Organise un dossier\n' +
    'pdf_create(path: string, title: string, content: string) - Cree un PDF\n' +
    'excel_create(path: string, sheetName: string, headers: array, rows: array) - Cree un fichier Excel\n' +
    'document_create(format: string, filename: string, content: string, destination: string) - Cree un document\n' +
    'web_search(query: string, max_results?: number) - Recherche sur Internet\n' +
    'web_fetch(url: string) - Recupere le contenu d\'une page web\n' +
    'system_status() - Infos CPU, RAM, systeme\n' +
    'screenshot_take() - Prend une capture d\'ecran\n' +
    'process_verify(type: "file"|"folder"|"process", target: string) - Verifie qu\'un fichier/dossier/processus existe\n' +
    'command_run(command: string) - Execute une commande PowerShell (outil avance, utiliser avec discernement)\n'
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
   VALIDATION UTILISATEUR
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

    var timer = setTimeout(function() { cleanup(); resolve('timeout'); }, APPROVAL_TIMEOUT);

    function cleanup() {
      clearTimeout(timer);
      var block = stepsContainer.querySelector('.cw-approval-block');
      if (block) block.remove();
      card.classList.remove('pending_approval');
    }

    stepsContainer.querySelector('.cw-approval-btn.accept').addEventListener('click', function() { cleanup(); resolve('accepted'); });
    stepsContainer.querySelector('.cw-approval-btn.reject').addEventListener('click', function() { cleanup(); resolve('refused'); });
  });
}

/* ================================================================
   APPEL LLM
   ================================================================ */
async function _callLLM(messages) {
  // Provider principal : Pollinations (compatible OpenAI API, gratuit)
  var body = {
    model: (window.S && window.S.pollinationsModel) || 'openai-fast',
    messages: messages,
    max_tokens: 1200,
    temperature: 0.3
  };
  var resp = await fetch('https://text.pollinations.ai/openai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(35000)
  });
  if (!resp.ok) {
    // Fallback Puter si disponible
    if (window.puter && window.puter.ai && window.puter.ai.chat) {
      var fullPrompt = messages.map(function(m) {
        return (m.role === 'system' ? '[SYSTEME] ' : m.role === 'user' ? 'USER: ' : 'ASSISTANT: ') + m.content;
      }).join('\n\n');
      var puterRes = await window.puter.ai.chat(fullPrompt);
      return typeof puterRes === 'string' ? puterRes : (puterRes && puterRes.message && puterRes.message.content && puterRes.message.content[0] && puterRes.message.content[0].text) || '';
    }
    throw new Error('LLM HTTP ' + resp.status);
  }
  var data = await resp.json();
  var content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  if (!content) throw new Error('Reponse LLM vide');
  return content;
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

  function _emit(text, status, isThought) {
    if (typeof emitFn === 'function') emitFn(text, status, isThought);
  }

  try {
    var messages = [
      { role: 'system', content: _buildSystemPrompt() },
      { role: 'user',   content: userPrompt }
    ];

    var lastResponse = '';
    var turns = 0;

    while (turns < MAX_TURNS && !this._stopRequested) {
      turns++;

      _emit('Reflexion...', 'running');
      var response = '';
      try {
        response = await _callLLM(messages);
      } catch(e) {
        _emit('Erreur LLM: ' + e.message, 'error');
        return { success: false, error: e.message };
      }

      lastResponse = response;

      // Afficher la pensee de l'agent
      var thought = _parseThought(response);
      if (thought) {
        _emit(thought, 'thought', true);
      }

      // Chercher un appel d'outil
      var toolCall = _parseToolCall(response);
      var visibleText = _stripTags(response);

      if (!toolCall) {
        if (visibleText) _emit(visibleText, 'done');
        if (response.includes('[TACHE_TERMINEE]')) {
          return { success: true, response: visibleText };
        }
        messages.push({ role: 'assistant', content: response });
        messages.push({ role: 'user', content: 'Continue. Si la tache est terminee, ecris [TACHE_TERMINEE] suivi d\'un bref recapitulatif.' });
        continue;
      }

      var toolName = toolCall.name;
      var toolArgs = toolCall.args;

      if (!window.CWTools || !window.CWTools.executeTool) {
        _emit('CWTools non disponible.', 'error');
        return { success: false, error: 'CWTools non disponible' };
      }

      if (!window.CWTools.TOOL_CLASSIFICATION[toolName]) {
        messages.push({ role: 'assistant', content: response });
        messages.push({ role: 'user', content: 'ERREUR: outil "' + toolName + '" inconnu. Utilise uniquement les outils listes dans ton prompt systeme.' });
        continue;
      }

      // Validation si necessaire
      var classification = window.CWTools.TOOL_CLASSIFICATION[toolName];
      var decision = 'auto';
      if (classification === 'SENSITIVE' && !this.autonomousMode && this.approvalMode) {
        _emit('Action sensible : ' + toolName, 'pending');
        decision = await _requestApproval(toolName, toolArgs, stepEl);
        if (decision !== 'accepted') {
          _emit('Action refusee.', 'error');
          messages.push({ role: 'assistant', content: response });
          messages.push({ role: 'user', content: 'L\'utilisateur a refuse l\'action "' + toolName + '". Propose une alternative.' });
          await _logAction(this.uid, this._taskId, toolName, toolArgs, { success: false }, decision);
          continue;
        }
      }

      // Execution
      _emit('Execution : ' + toolName + ' ...', 'running');
      var toolResult;
      try {
        toolResult = await window.CWTools.executeTool(toolName, toolArgs);
      } catch(e) {
        toolResult = { success: false, error: e.message };
      }

      await _logAction(this.uid, this._taskId, toolName, toolArgs, toolResult, decision);

      // Verification post-action fichiers
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

      if (toolResult.success) {
        var resultSummary = (toolResult.result && toolResult.result.summary)
          ? toolResult.result.summary
          : JSON.stringify(toolResult.result || {}).substring(0, 500);
        _emit('[' + toolName + '] OK : ' + resultSummary.substring(0, 200), 'done');
        messages.push({ role: 'assistant', content: response });
        messages.push({
          role: 'user',
          content: 'RESULTAT de ' + toolName + ':\n' + JSON.stringify(toolResult.result, null, 2).substring(0, 2000) + '\n\nReflechis au resultat dans <thought> et continue. Ecris [TACHE_TERMINEE] quand tout est fait.'
        });
      } else {
        var errMsg = toolResult.error || 'Erreur inconnue';
        _emit('[' + toolName + '] ECHEC : ' + errMsg, 'error');
        messages.push({ role: 'assistant', content: response });
        messages.push({
          role: 'user',
          content: 'ECHEC de ' + toolName + ': ' + errMsg + '\n\nAnalyse dans <thought> et essaie une approche differente.'
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
   API PUBLIQUE
   ================================================================ */
function stopActiveAgent() {
  if (_activeAgent) _activeAgent.stop();
}

window.CWAgent = CWAgent;
window.CWAgentStop = stopActiveAgent;

console.log('[CW Agent] ReAct v2 charge - Pensee + Action + Observation');

})();
