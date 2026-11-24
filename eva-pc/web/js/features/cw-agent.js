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
  // FIX v5.6.19: Supporte <thought>...</thought> ET <think>...</think> (variante du modele GGUF)
  var match = text.match(/<(?:thought|think)>([\s\S]*?)<\/(?:thought|think)>/i);
  return match ? match[1].trim() : null;
}

function _parseToolCall(text) {
  if (!text) return null;
  // FIX v5.6.19: Tolere aussi <tool_call> sans balise fermante (token tronque par max_tokens)
  var match = text.match(/<tool_call>([\s\S]*?)(?:<\/tool_call>|$)/);
  if (!match) return null;
  var raw = match[1].trim();
  // Nettoyer les traces de </think> ou texte apres le JSON
  var jsonEnd = raw.lastIndexOf('}');
  if (jsonEnd >= 0) raw = raw.substring(0, jsonEnd + 1);
  try {
    var parsed = JSON.parse(raw);
    if (!parsed.name) return null;
    return { name: parsed.name, args: parsed.args || {} };
  } catch(e) {
    return null;
  }
}

function _stripTags(text) {
  // FIX v5.6.19: Supporte <think> en plus de <thought>
  return text
    .replace(/<(?:thought|think)>[\s\S]*?<\/(?:thought|think)>/gi, '')
    .replace(/<tool_call>[\s\S]*?(?:<\/tool_call>|$)/g, '')
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
        var errMsg = e.message || 'Erreur inconnue';
        // Erreurs LLM spécifiques — message lisible pour l'utilisateur
        if (errMsg.startsWith('LLM_NOT_AVAILABLE')) {
          _emit('⚠️ Modèle LLM non téléchargé. Allez dans CloudWorks > LLM Local pour le télécharger (2 Go).', 'error');
          if (window.toast) window.toast('Téléchargez le LLM dans la section CloudWorks pour utiliser les tâches libres.', 'warning');
        } else if (errMsg.startsWith('LLM_START_TIMEOUT') || errMsg.startsWith('LLM_START_FAILED')) {
          _emit('⚠️ Le LLM local n\'a pas pu démarrer. Essayez de le redémarrer dans la section CloudWorks.', 'error');
          if (window.toast) window.toast('LLM local indisponible — redémarrez-le depuis CloudWorks.', 'error');
        } else if (errMsg.startsWith('LLM_EMPTY')) {
          _emit('Le LLM n\'a pas répondu. Réessayez.', 'error');
        } else {
          _emit('Erreur LLM: ' + errMsg, 'error');
        }
        return { success: false, error: errMsg };
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
        // Detection de fin de tache (avec ou sans texte visible)
        if (response.includes('[TACHE_TERMINEE]')) {
          if (visibleText) _emit(visibleText, 'done');
          return { success: true, response: visibleText || response };
        }

        // FIX v5.6.19: Si texte visible (hors balises thought/tool_call) -> tache terminee par reponse prose
        if (visibleText && visibleText.trim()) {
          _emit(visibleText, 'done');
          return { success: true, response: visibleText };
        }

        // FIX v5.6.19: Si seulement <thought> (pas de texte visible, pas de tool_call)
        // -> Le LLM a reflechi mais n'a pas agi. On le pousse a emettre un tool_call.
        // On evite la boucle infinie en comptant les nudges consecutifs.
        var nudgeKey = '__nudgeCount';
        messages[nudgeKey] = (messages[nudgeKey] || 0) + 1;
        if (messages[nudgeKey] >= 3) {
          // Apres 3 nudges sans action -> on abandonne proprement
          _emit('Le LLM n\'a pas pu determiner une action. Essayez de reformuler.', 'error');
          return { success: false, error: 'LLM_NO_ACTION: Aucun outil emis apres ' + messages[nudgeKey] + ' tentatives.' };
        }
        // Pousser le LLM a agir
        messages.push({ role: 'assistant', content: response });
        messages.push({
          role: 'user',
          content: 'Tu as bien reflechi. Maintenant passe a l\'action en utilisant un outil. Format obligatoire :\n<tool_call>{"name": "NOM_OUTIL", "args": {...}}</tool_call>'
        });
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
  /* FIX v5.6.16 : CloudWorks = LLM LOCAL UNIQUEMENT
     Pas de fallback Pollinations ni Puter.
     CloudWorks tourne entièrement en local, gratuitement et sans limite.
     Si le LLM n'est pas disponible, on lève une erreur claire. */

  if (!window.eva || !window.eva.system || typeof window.eva.system.llmChat !== 'function') {
    throw new Error('LLM_NOT_AVAILABLE: Le moteur LLM local n\'est pas accessible. Téléchargez le modèle dans la section CloudWorks.');
  }

  // Vérifier si le LLM est actif
  var status = null;
  try { status = await window.eva.system.llmStatus(); } catch(_) {}

  if (!status || !status.running) {
    // Tenter de démarrer le LLM automatiquement
    console.log('[CWAgent] LLM local arrêté — démarrage automatique...');
    try {
      await window.eva.system.llmStart();
      // Attendre jusqu'à 15s que le moteur soit prêt
      for (var i = 0; i < 15; i++) {
        await new Promise(function(r){ setTimeout(r, 1000); });
        var s2 = null;
        try { s2 = await window.eva.system.llmStatus(); } catch(_) {}
        if (s2 && s2.running) {
          console.log('[CWAgent] LLM local démarré après', i + 1, 'secondes');
          break;
        }
        if (i === 14) {
          throw new Error('LLM_START_TIMEOUT: Le LLM local n\'a pas démarré dans les temps. Vérifiez la section CloudWorks.');
        }
      }
    } catch(startErr) {
      if (startErr.message.startsWith('LLM_')) throw startErr;
      throw new Error('LLM_START_FAILED: Impossible de démarrer le LLM local : ' + startErr.message);
    }
  }

  // Appel LLM local
  console.log('[CWAgent] Appel LLM local (node-llama-cpp)');
  var result = await window.eva.system.llmChat(messages, {
    max_tokens: 2048,     // FIX v5.6.19: snake_case pour compatibilite
    maxTokens: 2048,      // FIX v5.6.19: camelCase lu par main.ts handler
    temperature: 0.3,
    sessionId: (this && this._taskId) ? this._taskId : 'cw_agent_session', // FIX v5.6.20: sessionId stable pour cache KV
    stopTriggers: []      // FIX v5.6.19: desactiver les stop triggers [CMD]/[REPORT] du pc-agent (CWAgent utilise <tool_call>)
  });

  // Le handler llm:chat retourne { choices: [{ message: { role, content } }] }
  if (result && result.choices && result.choices[0] && result.choices[0].message && result.choices[0].message.content) {
    return result.choices[0].message.content;
  }
  // Fallback: string directe
  if (typeof result === 'string' && result.trim()) return result;
  // Fallback: result.content (ancien format)
  if (result && result.content && typeof result.content === 'string' && result.content.trim()) return result.content;
  throw new Error('LLM_EMPTY: Le LLM local a renvoyé une réponse vide.');
}

/* ================================================================
   API PUBLIQUE
   ================================================================ */
function stopActiveAgent() {
  if (_activeAgent) _activeAgent.stop();
}

/* ================================================================
   INTEGRATION CWEngine v5.6
   Lance une tâche avec suivi des 10 états + sync Firestore + UI modale.
   ================================================================ */
async function runWithEngine(uid, prompt, options) {
  options = options || {};
  var deviceId = options.deviceId || 'web';
  var container = options.container || null; // élément DOM pour la carte

  // 1. Créer la tâche dans CWEngine
  if (!window.CWEngine) {
    console.warn('[CWAgent] CWEngine non disponible, fallback legacy');
    var agent = new CWAgent(uid, 'legacy_' + Date.now(), options);
    return agent.run(prompt, options.emitFn, options.stepEl);
  }

  var task = window.CWEngine.createTask({ prompt: prompt, uid: uid, deviceId: deviceId });

  // 2. Créer la carte UI
  var card = null;
  if (window.CWModal && container) {
    card = window.CWModal.createTrackerCard(task);
    container.insertBefore(card, container.firstChild);

    // Bouton annuler
    var cancelBtn = card.querySelector('.cw-cancel-btn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', function() {
        window.CWEngine.cancelTask(task.id);
        if (window.CWFirestore) {
          window.CWFirestore.updateCommandState(uid, task.id, 'cancelled');
        }
      });
    }
  }

  // 3. Push Firestore
  if (window.CWFirestore) {
    window.CWFirestore.pushCommand(uid, task).catch(function(e) {
      console.warn('[CWAgent] pushCommand err:', e);
    });
  }

  // 4. Émettre vers l'UI
  function _emit(text, status, isThought) {
    if (card) {
      if (isThought && window.CWModal) {
        window.CWModal.appendThought(card, text);
      }
    }
    if (typeof options.emitFn === 'function') options.emitFn(text, status, isThought);
  }

  // 5. Lancer l'agent ReAct
  task.setState(window.CW_STATES.RUNNING);
  if (window.CWModal) window.CWModal.updateCard(card, task);
  if (window.CWFirestore) window.CWFirestore.updateCommandState(uid, task.id, 'running');

  var agent = new CWAgent(uid, task.id, options);

  // Écouter les états
  task.on('stateChange', function(data) {
    if (window.CWModal) window.CWModal.updateCard(card, task);
    if (window.CWFirestore) {
      window.CWFirestore.updateCommandState(uid, task.id, data.state, data.meta);
    }
  });

  var result;
  try {
    task.setState(window.CW_STATES.EXECUTING);
    result = await agent.run(prompt, _emit, options.stepEl);
  } catch(e) {
    result = { success: false, error: e.message };
  }

  // 6. Finaliser l'état
  if (task.state !== window.CW_STATES.CANCELLED && task.state !== window.CW_STATES.EXPIRED) {
    var finalState = result.success ? window.CW_STATES.SUCCEEDED : window.CW_STATES.FAILED;
    task.setState(finalState);
    if (window.CWModal) {
      window.CWModal.showResult(card, finalState, result.error || null);
    }
    if (window.CWFirestore) {
      window.CWFirestore.updateCommandState(uid, task.id, finalState, {
        completed_at: Date.now(),
        error: result.error || null
      });
    }
  }

  return result;
}

window.CWAgent = CWAgent;
window.CWAgentStop = stopActiveAgent;
window.CWAgentRun = runWithEngine;

})();
