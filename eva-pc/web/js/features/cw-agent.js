/* =============================================================
   CW-AGENT.JS - Orchestrateur agentique CloudWorks Phase 1
   Boucle: LLM -> parse tool_call -> validate -> execute -> LLM
   ============================================================= */

(function() {
'use strict';

var MAX_TURNS = 8;        // Nombre max d'allers-retours LLM
var APPROVAL_TIMEOUT = 30000;  // 30s pour valider une action
var _activeAgent = null;  // Instance active (une seule tache a la fois)

/* Systeme prompt court pour le LLM */
function _buildSystemPrompt() {
  return (
    'Tu es EVA CloudWorks, agent autonome sur le PC de l\'utilisateur. ' +
    'Tu peux appeler des outils en repondant EXACTEMENT avec:\n' +
    '<tool_call>{"name": "nom_outil", "args": {...}}</tool_call>\n' +
    'Outils disponibles: web_search, web_fetch, file_list, file_read, file_search, ' +
    'file_create, document_create, data_analyze, system_status, screenshot_take.\n' +
    'REGLES ABSOLUES:\n' +
    '1. Appelle UN SEUL outil a la fois.\n' +
    '2. Apres le resultat, continue ou reponds a l\'utilisateur.\n' +
    '3. Ne revele JAMAIS de cles API, tokens ou mots de passe.\n' +
    '4. Reponds en francais, sois concis et precis.\n' +
    '5. Quand la tache est terminee, ecris [TACHE_TERMINEE] a la fin.'
  );
}

/* Parse un tool_call dans la reponse LLM */
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

/* Retire le bloc tool_call du texte */
function _stripToolCall(text) {
  return text.replace(/<tool_call>[\s\S]*?<\/tool_call>/g, '').trim();
}

/* Demande la validation a l'utilisateur - retourne 'accepted' | 'refused' | 'timeout' */
async function _requestApproval(toolName, args, stepEl) {
  return new Promise(function(resolve) {
    if (!stepEl) { resolve('refused'); return; }

    // Construire la carte de validation
    var argsPreview = JSON.stringify(args, null, 2).substring(0, 300);
    var riskLabel = { file_create: 'ECRITURE', document_create: 'CREATION', file_search: 'LECTURE ETENDUE', web_fetch: 'RESEAU', data_analyze: 'ANALYSE' }[toolName] || 'ACTION';

    var card = document.createElement('div');
    card.className = 'cw-approval-card';
    card.innerHTML =
      '<div class="cw-approval-header">' +
        '<span class="cw-approval-risk cw-risk-' + riskLabel.toLowerCase() + '">' + riskLabel + '</span>' +
        '<span class="cw-approval-tool">' + toolName + '</span>' +
      '</div>' +
      '<pre class="cw-approval-args">' + _escHtml(argsPreview) + '</pre>' +
      '<div class="cw-approval-timer" id="cwApprovalTimer">30s</div>' +
      '<div class="cw-approval-actions">' +
        '<button class="cw-btn cw-btn-danger cw-btn-sm" id="cwApprovalRefuse">Refuser</button>' +
        '<button class="cw-btn cw-btn-primary cw-btn-sm" id="cwApprovalAccept">Accepter</button>' +
      '</div>';

    stepEl.appendChild(card);

    var timerEl = card.querySelector('#cwApprovalTimer');
    var remaining = 30;
    var timer = setInterval(function() {
      remaining--;
      if (timerEl) timerEl.textContent = remaining + 's';
      if (remaining <= 0) {
        clearInterval(timer);
        card.style.opacity = '0.5';
        resolve('timeout');
      }
    }, 1000);

    card.querySelector('#cwApprovalAccept').addEventListener('click', function() {
      clearInterval(timer);
      card.style.opacity = '0.5';
      resolve('accepted');
    });
    card.querySelector('#cwApprovalRefuse').addEventListener('click', function() {
      clearInterval(timer);
      card.style.opacity = '0.5';
      resolve('refused');
    });
  });
}

function _escHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* Appel LLM via IPC */
async function _callLLM(messages) {
  if (!window.eva || !window.eva.system || !window.eva.system.llmChat) {
    throw new Error('API LLM non disponible');
  }
  var result = await window.eva.system.llmChat(messages);
  if (!result || !result.choices || !result.choices[0]) {
    throw new Error('Reponse LLM invalide');
  }
  return result.choices[0].message.content;
}

/* Log une action dans Firestore action_log */
async function _logAction(uid, taskId, toolName, args, resultObj, decision) {
  try {
    if (!window.db || !uid) return;
    await window.db
      .collection('cloudworks').doc(uid)
      .collection('action_log').add({
        ts: firebase.firestore.FieldValue.serverTimestamp(),
        taskId: taskId,
        tool: toolName,
        args: args,
        result: resultObj && resultObj.success !== undefined ? { success: resultObj.success } : {},
        status: resultObj && resultObj.success ? 'success' : 'error',
        user_decision: decision || null
      });
  } catch(e) { /* non-bloquant */ }
}

/* Classe principale */
class CWAgent {
  constructor(uid, options) {
    this.uid = uid;
    this.options = options || {};
    this.approvalMode = options.approvalMode !== false;  // true par defaut
    this.autonomousMode = options.autonomousMode === true;  // false par defaut
    this._stopRequested = false;
    this._taskId = 'cw_' + Date.now();
  }

  stop() {
    this._stopRequested = true;
  }

  /* Lance une tache agentique et remplit le DOM stepEl */
  async run(prompt, stepEl, onStep) {
    _activeAgent = this;
    this._stopRequested = false;

    var _emit = function(text, cls) {
      if (onStep) onStep(text, cls || 'running');
      if (!stepEl) return;
      var d = document.createElement('div');
      d.className = 'cw-task-step ' + (cls || 'running');
      d.textContent = text;
      stepEl.appendChild(d);
      stepEl.scrollTop = stepEl.scrollHeight;
      while (stepEl.children.length > 30) stepEl.removeChild(stepEl.firstChild);
    };

    var messages = [
      { role: 'system', content: _buildSystemPrompt() },
      { role: 'user', content: prompt }
    ];

    _emit('Connexion au LLM local...', 'running');

    var turns = 0;
    var lastResponse = '';

    try {
      while (turns < MAX_TURNS && !this._stopRequested) {
        turns++;
        _emit('Reflexion EVA (tour ' + turns + ')...', 'running');

        var response;
        try {
          response = await _callLLM(messages);
        } catch(e) {
          _emit('Erreur LLM: ' + e.message, 'error');
          return { success: false, error: e.message };
        }

        lastResponse = response;
        var toolCall = _parseToolCall(response);
        var textPart = _stripToolCall(response);

        // Afficher la partie texte si presente
        if (textPart) {
          _emit('EVA: ' + textPart.substring(0, 200), 'info');
        }

        // Tache terminee
        if (!toolCall || response.includes('[TACHE_TERMINEE]')) {
          _emit('Tache terminee.', 'done');
          break;
        }

        var toolName = toolCall.name;
        var toolArgs = toolCall.args;

        // Verifier que l'outil existe
        if (!window.CWTools || !window.CWTools.TOOL_CLASSIFICATION[toolName]) {
          _emit('Outil inconnu: ' + toolName, 'error');
          messages.push({ role: 'assistant', content: response });
          messages.push({ role: 'user', content: 'ERREUR: Outil "' + toolName + '" inconnu. Utilise uniquement les outils listes.' });
          continue;
        }

        var classification = window.CWTools.TOOL_CLASSIFICATION[toolName];
        var decision = 'auto';

        // Gestion de la validation
        if (classification === 'SENSITIVE' && !this.autonomousMode) {
          if (this.approvalMode) {
            _emit('Validation requise: ' + toolName, 'pending');
            decision = await _requestApproval(toolName, toolArgs, stepEl);
            if (decision !== 'accepted') {
              _emit('Action refusee: ' + toolName, 'error');
              messages.push({ role: 'assistant', content: response });
              messages.push({ role: 'user', content: 'L\'utilisateur a refuse l\'action "' + toolName + '". Propose une alternative ou termine la tache.' });
              await _logAction(this.uid, this._taskId, toolName, toolArgs, { success: false }, decision);
              continue;
            }
          }
        }

        // Executer l'outil
        _emit('Execution: ' + toolName + '...', 'running');
        var toolResult;
        try {
          toolResult = await window.CWTools.executeTool(toolName, toolArgs);
        } catch(e) {
          toolResult = { success: false, error: e.message };
        }

        await _logAction(this.uid, this._taskId, toolName, toolArgs, toolResult, decision);

        if (toolResult.success) {
          var summary = toolResult.result && toolResult.result.summary ? toolResult.result.summary : (toolResult.result ? JSON.stringify(toolResult.result).substring(0, 200) : 'OK');
          _emit('Resultat ' + toolName + ': ' + summary.substring(0, 150), 'done');
          var resultStr = JSON.stringify(toolResult.result, null, 2).substring(0, 2000);
          messages.push({ role: 'assistant', content: response });
          messages.push({ role: 'user', content: 'RESULTAT de ' + toolName + ':\n' + resultStr + '\n\nContinue la tache.' });
        } else {
          _emit('Echec ' + toolName + ': ' + (toolResult.error || 'Inconnu'), 'error');
          messages.push({ role: 'assistant', content: response });
          messages.push({ role: 'user', content: 'ERREUR de ' + toolName + ': ' + (toolResult.error || 'Inconnu') + '. Continue ou propose une alternative.' });
        }

        if (this._stopRequested) break;
      }

      if (this._stopRequested) {
        _emit('Tache interrompue par l\'utilisateur.', 'error');
        return { success: false, error: 'Interrompu', response: lastResponse };
      }

      if (turns >= MAX_TURNS) {
        _emit('Nombre maximum de tours atteint.', 'error');
      }

      return { success: true, response: lastResponse };

    } catch(e) {
      _emit('Erreur critique: ' + e.message, 'error');
      return { success: false, error: e.message };
    } finally {
      _activeAgent = null;
    }
  }
}

/* Stopper l'agent actif */
function stopActiveAgent() {
  if (_activeAgent) _activeAgent.stop();
}

/* Export global */
window.CWAgent = CWAgent;
window.CWAgentStop = stopActiveAgent;

})();
