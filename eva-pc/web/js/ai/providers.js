/* ═══════════════════════════════════════════════════════════
   EVA V4 - PROVIDERS.JS
   Gestion des providers IA (Qwen, Puter, OpenAI, Claude, etc.)
   Chargé comme script classique (pas ES6 module)
   ═══════════════════════════════════════════════════════════ */

(function() {

// ═══ SANITIZE LLM OUTPUT (préfixes parasites style "cyan actif") ═══
function _stripLeakedPrefix(text) {
  if (!text || typeof text !== 'string') return text;
  let out = text;
  for (let i = 0; i < 3; i++) {
    const before = out;
    out = out.replace(
      /^[\s>*_`]*[\[\(]?\s*(cyan\s*actif|système\s*:\s*cyan\s*actif|outil\s*[:\-]?\s*cyan\s*actif|tool\s*[:\-]?\s*cyan\s*actif|cyan|tool_call|tool\s*call|system|assistant|réponse|response)\s*[\]\)]?\s*[:\-–.]?[\s*_`]*/i,
      ''
    );
    out = out.replace(/^\s*\n+/, '');
    if (out === before) break;
  }
  return out.trim() || text;
}

// ═══ EVA LOCAL PROVIDER (Electron LLM) ═══
class EvaLocalProvider {
  constructor(config) {
    this.config = config;
    this.ready = true;
  }

  async initialize() {
    if (window.eva && window.eva.system && window.eva.system.llmStart) {
        await window.eva.system.llmStart();
        return { success: true };
    }
    return { success: false, error: 'Non disponible en mode web.' };
  }

  async sendMessage(messages, systemPrompt) {
    if (!window.eva || !window.eva.system || !window.eva.system.llmChat) {
        return { success: false, error: 'Agent local non disponible.' };
    }
    
    if (systemPrompt === undefined) {
      systemPrompt = window.EVA_SYSTEM_PROMPT || 'Tu es Eva, assistante IA locale.';
    }

    try {
      let history = [
        { role: 'system', content: systemPrompt },
        ...messages
      ];

      // On boucle au cas où l'IA génère des commandes [CMD]
      for (let i = 0; i < 10; i++) {
        if (window.eva && window.eva.overlay) window.eva.overlay.show('thinking');
        const data = await window.eva.system.llmChat(history);
        
        let text = '';
        if (data && data.choices && data.choices[0] && data.choices[0].message) {
            text = data.choices[0].message.content;
        } else if (data && data.content) {
            text = data.content;
        }

        history.push({role: 'assistant', content: text});
        
        // 1. Check for REPORT
        const reportMatch = text.match(/\[REPORT\]([\s\S]*?)\[\/REPORT\]/i);
        if(reportMatch) {
          if (window.eva && window.eva.overlay) window.eva.overlay.hide();
          return { success: true, content: _stripLeakedPrefix(reportMatch[1].trim()) };
        }
        
        // 2. Check for CMD
        const cmdMatch = text.match(/\[CMD\]([\s\S]*?)\[\/CMD\]/i);
        if(cmdMatch) {
          const cmd = cmdMatch[1].trim();
          if (window.eva && window.eva.overlay) window.eva.overlay.show('cloudworks', 'Exécution: ' + cmd);
          
          let cmdResult = '';
          try {
            const res = await window.eva.system.exec(cmd);
            cmdResult = res.success ? (res.stdout || 'Succès') : (res.stderr || res.error);
          } catch(e) { cmdResult = 'Erreur: ' + e; }
          
          history.push({role: 'user', content: "Résultat de la commande:\n" + cmdResult + "\n\nQue fais-tu ensuite ? (Utilise [CMD] ou [REPORT])"});
        } else {
          // No tags, just standard chat reply
          if (window.eva && window.eva.overlay) window.eva.overlay.hide();
          return {
            success: true,
            content: _stripLeakedPrefix(text)
          };
        }
      }
      
      if (window.eva && window.eva.overlay) window.eva.overlay.hide();
      return { success: true, content: 'Boucle agentique terminée sans rapport clair.' };

    } catch (error) {
      if (window.eva && window.eva.overlay) window.eva.overlay.hide();
      return { success: false, error: error.message };
    }
  }
}

// ═══ QWEN 3 (WebLLM - Local) ═══
class QwenProvider {
  constructor(config) {
    this.config = config;
    this.engine = null;
    this.ready = false;
    this._initializing = false;
  }

  // Lazy init — ne télécharge pas au démarrage
  async initialize() {
    return { success: true };
  }

  // Téléchargement réel avec modal de progression
  async _doDownload() {
    if (this._initializing) return;
    this._initializing = true;
    try {
      const { CreateMLCEngine } = await import('https://esm.run/@mlc-ai/web-llm');
      const selectedModel = this.config.qwenModel || 'Llama-3.2-3B-Instruct-q4f16_1-MLC';

      if (window.showQwenDownloadModal) window.showQwenDownloadModal(selectedModel);

      this.engine = await CreateMLCEngine(selectedModel, {
        initProgressCallback: (progress) => {
          console.log('Qwen progress:', progress);
          if (window.updateQwenDownloadProgress) window.updateQwenDownloadProgress(progress);
        }
      });

      this.ready = true;
      if (window.hideQwenDownloadModal) window.hideQwenDownloadModal();
    } catch (error) {
      this._initializing = false;
      if (window.hideQwenDownloadModal) window.hideQwenDownloadModal();
      console.error('Qwen init error:', error);
      throw error;
    }
    this._initializing = false;
  }

  async sendMessage(messages, systemPrompt) {
    if (systemPrompt === undefined) {
      systemPrompt = window.EVA_SYSTEM_PROMPT ||
        'Tu es Eva, une assistante IA bienveillante créée par Astral Technologie. ' +
        'Tu es un assistant personnel conversationnel. ' +
        'IMPORTANT : Tu es l\'IA, PAS l\'utilisateur. Réponds toujours en tant qu\'Eva. ' +
        '⚠️ Ce modèle Qwen est un assistant uniquement — il ne génère pas de code. ' +
        'Réponds en français de manière naturelle et bienveillante.';
    }
    if (!this.ready) {
      await this._doDownload();
    }

    try {
      const formattedMessages = [
        { role: 'system', content: systemPrompt },
        ...messages
      ];

      const response = await this.engine.chat.completions.create({
        messages: formattedMessages,
        temperature: 0.7,
        max_tokens: 8000
      });

      return {
        success: true,
        content: response.choices[0].message.content
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

// ═══ PUTER (Cloud) ═══
  class PuterProvider {
    constructor(config) {
      this.config = config;
      this.ready = false;
      this._isEdge = /Edg\//.test(navigator.userAgent);
    }

    // Attend que puter soit dispo (SDK chargé en script externe)
    _waitForPuter(timeoutMs) {
      timeoutMs = timeoutMs || 8000;
      return new Promise(function(resolve, reject) {
        if (typeof puter !== 'undefined') { resolve(); return; }
        var waited = 0;
        var iv = setInterval(function() {
          waited += 200;
          if (typeof puter !== 'undefined') { clearInterval(iv); resolve(); return; }
          if (waited >= timeoutMs) {
            clearInterval(iv);
            reject(new Error('Puter SDK non disponible (timeout)'));
          }
        }, 200);
      });
    }

    async initialize() {
      try {
        await this._waitForPuter();
      } catch (err) {
        return { success: false, error: 'Puter SDK non chargé. Vérifiez votre connexion.' };
      }

      try {
        const user = await puter.auth.getUser();
        if (user) {
          this.ready = true;
          return { success: true };
        }
      } catch (_) {
        // Pas connecté — on tente un appel direct pour voir si ça passe quand même
      }

      // Fallback : on marque ready et on tente l'appel IA directement
      // Si l'utilisateur n'est pas connecté, cela échouera proprement plus tard
      // au lieu de déclencher une popup intempestive (bloquée par Edge).
      this.ready = true;
      return { success: true };
    }

    async sendMessage(messages, systemPrompt) {
      if (systemPrompt === undefined) systemPrompt = window.EVA_SYSTEM_PROMPT || 'Tu es Eva, une assistante IA bienveillante.';

      if (!this.ready) {
        const init = await this.initialize();
        if (!init.success) return init;
      }

      // Vérification SDK au moment de l'appel (Edge peut décharger les contextes)
      if (typeof puter === 'undefined') {
        return { success: false, error: 'Puter non disponible. Rechargez la page.' };
      }

      try {
        const model = this.config.puterModel || 'gpt-4o-mini';

        const formattedMessages = [
          { role: 'system', content: systemPrompt },
          ...messages
        ];

        const response = await puter.ai.chat(formattedMessages, { model, max_tokens: 8000 });

        // Gestion des différents formats de réponse Puter
        let content = '';
        if (typeof response === 'string') {
          content = response;
        } else if (response && response.message && response.message.content) {
          content = response.message.content;
        } else if (response && response.choices && response.choices[0]) {
          content = response.choices[0].message.content;
        } else {
          content = String(response);
        }

        return { success: true, content };
      } catch (error) {
        const msg = error.message || '';
        const msgLow = msg.toLowerCase();

        // Quota Puter dépassé
        if (msgLow.includes('quota') || msgLow.includes('limit') || msgLow.includes('rate')) {
          return {
            success: false,
            error: 'Quota Puter atteint pour aujourd\'hui. Revenez demain ou changez de provider dans les Paramètres.'
          };
        }

        // Non authentifié ou session expirée
        if (msgLow.includes('auth') || msgLow.includes('login') || msgLow.includes('sign') ||
            msgLow.includes('unauthorized') || msgLow.includes('403')) {
          this.ready = false;
          /* Enregistrer l'action de reconnexion pour qu'elle puisse être déclenchée par un bouton */
          window._puterReconnectAction = async function() {
            try {
              await window.evaSafePuterSignIn();
              window._puterReconnectAction = null;
              if (window.toast) window.toast('Reconnecté à Puter !', 'success');
              return true;
            } catch(e) {
              if (window.toast) window.toast('Connexion Puter échouée : ' + e.message, 'error');
              return false;
            }
          };
          return {
            success: false,
            error: 'SESSION_PUTER_EXPIRED'
          };
        }

        // Edge : popup bloquée ou cookies tiers
        if (this._isEdge) {
          return {
            success: false,
            error: 'PuterEdgeBlock'
          };
        }

        return { success: false, error: msg || 'Erreur Puter inconnue' };
      }
    }
  }

  // ═══ OPENAI API ═══
class OpenAIProvider {
  constructor(config) {
    this.config = config;
    this.apiKey = config.openaiApiKey;
    this.ready = !!this.apiKey;
  }

  async sendMessage(messages, systemPrompt) {
    if (systemPrompt === undefined) systemPrompt = window.EVA_SYSTEM_PROMPT || 'Tu es Eva, une assistante IA bienveillante.';
    if (!this.ready) {
      return { success: false, error: 'OpenAI API key not configured' };
    }

    try {
      const model = this.config.openaiModel || 'gpt-4o-mini';

      const formattedMessages = [
        { role: 'system', content: systemPrompt },
        ...messages
      ];

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model,
          messages: formattedMessages,
          temperature: 0.7,
          max_tokens: 8000
        })
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error.message);
      }

      return {
        success: true,
        content: data.choices[0].message.content
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

// ═══ CLAUDE (Anthropic) ═══
class ClaudeProvider {
  constructor(config) {
    this.config = config;
    this.apiKey = config.claudeApiKey;
    this.ready = !!this.apiKey;
  }

  async sendMessage(messages, systemPrompt) {
    if (systemPrompt === undefined) systemPrompt = window.EVA_SYSTEM_PROMPT || 'Tu es Eva, une assistante IA bienveillante.';
    if (!this.ready) {
      return { success: false, error: 'Claude API key not configured' };
    }

    try {
      const model = this.config.claudeModel || 'claude-3-5-sonnet-20241022';

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model,
          system: systemPrompt,
          messages,
          max_tokens: 8000
        })
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error.message);
      }

      return {
        success: true,
        content: data.content[0].text
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

// ═══ LM STUDIO (Local Server) ═══
class LMStudioProvider {
  constructor(config) {
    this.config = config;
    this.endpoint = config.lmstudioEndpoint || 'http://localhost:1234';
    this.ready = false;
  }

  async initialize() {
    try {
      const response = await fetch(`${this.endpoint}/v1/models`);
      if (response.ok) {
        this.ready = true;
        return { success: true };
      }
      return { success: false, error: 'LM Studio not running' };
    } catch (error) {
      return { success: false, error: 'Cannot connect to LM Studio' };
    }
  }

  async sendMessage(messages, systemPrompt) {
    if (systemPrompt === undefined) systemPrompt = window.EVA_SYSTEM_PROMPT || 'Tu es Eva, une assistante IA bienveillante.';
    if (!this.ready) {
      const init = await this.initialize();
      if (!init.success) return init;
    }

    try {
      const formattedMessages = [
        { role: 'system', content: systemPrompt },
        ...messages
      ];

      const response = await fetch(`${this.endpoint}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: formattedMessages,
          temperature: 0.7,
          max_tokens: 8000
        })
      });

      const data = await response.json();

      return {
        success: true,
        content: data.choices[0].message.content
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

// ═══ OLLAMA (Local Server) ═══
class OllamaProvider {
  constructor(config) {
    this.config = config;
    this.endpoint = config.ollamaEndpoint || 'http://localhost:11434';
    this.model = config.customModel || 'llama2';
    this.ready = false;
  }

  async initialize() {
    try {
      const response = await fetch(`${this.endpoint}/api/tags`);
      if (response.ok) {
        this.ready = true;
        return { success: true };
      }
      return { success: false, error: 'Ollama not running' };
    } catch (error) {
      return { success: false, error: 'Cannot connect to Ollama' };
    }
  }

  async sendMessage(messages, systemPrompt) {
    if (systemPrompt === undefined) systemPrompt = window.EVA_SYSTEM_PROMPT || 'Tu es Eva, une assistante IA bienveillante.';
    if (!this.ready) {
      const init = await this.initialize();
      if (!init.success) return init;
    }

    try {
      let prompt = systemPrompt + '\n\n';
      messages.forEach(msg => {
        prompt += `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}\n`;
      });
      prompt += 'Assistant:';

      const response = await fetch(`${this.endpoint}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          prompt,
          stream: false
        })
      });

      const data = await response.json();

      return {
        success: true,
        content: data.response
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// EVA.IA — Modèles officiels Astral Technologie (WebLLM local)
//
// TÉLÉCHARGEMENT DES MODÈLES OFFICIELS EVA (Google Drive) :
// ──────────────────────────────────────────────────────────
// EVA Rapide (LLM 1B)  : https://drive.google.com/file/d/1S5PIWb7ehEr5rSoSGZ8BkLeHfJLPokT_/view?usp=drive_link
// EVA Expert (LLM 3B)  : https://drive.google.com/file/d/1-zgEshLjZ4v8Y5wM75TPeLpc3Mvl0l8j/view?usp=drive_link
// EVA Codeur (LLM 1.5B): https://drive.google.com/file/d/12uEifm03SX_c8Z_2V5PhlqTPL430wtdm/view?usp=drive_link
// EVA Voice (TTS)      : https://drive.google.com/file/d/1MgN6ZaJQF60qSNLfgAMa7cJAQuAXdT_U/view?usp=drive_link
//
// NOTICE D'INSTALLATION — À LIRE AVANT DÉPLOIEMENT :
// ──────────────────────────────────────────────────
// 1. Téléchargez les fichiers modèles depuis les liens Google Drive ci-dessus.
// 2. Décompressez chaque archive.
// 3. Placez les fichiers dans le dossier /models/eva/ à la racine du site.
//
// Structure attendue :
//
//   public/
//   └── models/
//       └── eva/
//           ├── eva-rapide/          ← EVA Rapide (modèle 1B, ~700 MB)
//           │   ├── mlc-chat-config.json
//           │   ├── tokenizer.model
//           │   ├── tokenizer.json
//           │   ├── params_shard_0.bin
//           │   └── eva-rapide-webgpu.wasm
//           ├── eva-expert/          ← EVA Expert (modèle 3B, ~2.2 GB)
//           │   ├── mlc-chat-config.json
//           │   ├── tokenizer.model
//           │   ├── tokenizer.json
//           │   ├── params_shard_*.bin
//           │   └── eva-expert-webgpu.wasm
//           ├── eva-codeur/          ← EVA Codeur (modèle 1.5B, ~1 GB)
//           │   ├── mlc-chat-config.json
//           │   ├── tokenizer.model
//           │   ├── tokenizer.json
//           │   ├── params_shard_0.bin
//           │   └── eva-codeur-webgpu.wasm
//           └── eva-voice/           ← EVA Voice (modèle TTS)
//               └── (fichiers modèle TTS)
//
// ═══════════════════════════════════════════════════════════════

class EvaProvider {
  constructor(config) {
    this.config = config;
    this.engine = null;
    this.ready = false;
    this._initializing = false;
  }

  async initialize() {
    return { success: true };
  }

  // Modèles EVA — utilise le registre WebLLM intégré (téléchargement + cache navigateur automatique)
  // Les IDs correspondent aux modèles de base fine-tunés par Astral Technologie
  _getModelConfig(modelKey) {
    const models = {
      'EVA-Rapide': {
        id:    'Llama-3.2-1B-Instruct-q4f16_1-MLC',
        label: 'EVA Rapide (1B)',
      },
      'EVA-Expert': {
        id:    'Llama-3.2-3B-Instruct-q4f16_1-MLC',
        label: 'EVA Expert (3B)',
      },
    };
    return models[modelKey] || models['EVA-Expert'];
  }

  async _doDownload() {
    if (this._initializing) return;
    this._initializing = true;
    const selectedModelKey = this.config.evaModel || 'EVA-Expert';
    const modelInfo = this._getModelConfig(selectedModelKey);
    try {
      const { CreateMLCEngine } = await import('https://esm.run/@mlc-ai/web-llm');
      if (window.showQwenDownloadModal) window.showQwenDownloadModal(modelInfo.label);
      // Utilise le registre intégré WebLLM — pas de appConfig personnalisé nécessaire
      this.engine = await CreateMLCEngine(modelInfo.id, {
        initProgressCallback: (progress) => {
          if (window.updateQwenDownloadProgress) window.updateQwenDownloadProgress(progress);
        }
      });
      this.ready = true;
      if (window.hideQwenDownloadModal) window.hideQwenDownloadModal();
    } catch (error) {
      this._initializing = false;
      if (window.hideQwenDownloadModal) window.hideQwenDownloadModal();
      console.error('EVA model init error:', error);
      throw error;
    }
    this._initializing = false;
  }

  async sendMessage(messages, systemPrompt) {
    if (systemPrompt === undefined) {
      systemPrompt = window.EVA_SYSTEM_PROMPT ||
        'Tu es EVA — Evolutionary Virtual Assistant — créée par Astral Technologie. ' +
        'Tu es un assistant IA bienveillant, élégant et proactif. ' +
        'IMPORTANT : Tu es EVA, PAS l\'utilisateur. Réponds toujours en tant qu\'EVA. ' +
        'Réponds en français de manière naturelle et structurée.';
    }
    if (!this.ready) {
      await this._doDownload();
    }
    try {
      const formattedMessages = [
        { role: 'system', content: systemPrompt },
        ...messages
      ];
      const response = await this.engine.chat.completions.create({
        messages: formattedMessages,
        temperature: 0.7,
        max_tokens: 8000
      });
      // Strip "cyan actif" et autres préfixes parasites typiques des petits LLM
      return { success: true, content: _stripLeakedPrefix(response.choices[0].message.content) };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

// ═══ POLLINATIONS.AI (Gratuit — Sans compte ni clé API) ═══
// Endpoint principal  : https://api.pollinations.ai/v1/chat/completions (nouveau domaine stable)
// Endpoint secondaire : https://text.pollinations.ai/openai (legacy, peut avoir ENOSPC)
class PollinationsProvider {
  constructor(config) {
    this.config = config;
    this.ready = true;
  }

  async initialize() {
    return { success: true };
  }

  async sendMessage(messages, systemPrompt) {
    if (systemPrompt === undefined) systemPrompt = window.EVA_SYSTEM_PROMPT || 'Tu es Eva, une assistante IA bienveillante.';
    const model = this.config.pollinationsModel || 'openai';
    const allMessages = [{ role: 'system', content: systemPrompt }, ...messages];

    /* Modèles de raisonnement (exposent leurs vraies pensées) */
    const isReasoningModel = (model === 'gemini-thinking' || model === 'deepseek-reasoning' ||
                              model === 'deepseek-r1' || model.includes('thinking') || model.includes('-r1'));

    /* L'endpoint text.pollinations.ai est le seul à supporter CORS nativement */
    const ENDPOINTS = [
      'https://text.pollinations.ai/openai'
    ];

    /* Fonction d'appel avec timeout via AbortController */
    const _fetchEndpoint = async (url, mdl, timeoutMs) => {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: ctrl.signal,
          body: JSON.stringify({ model: mdl, messages: allMessages, stream: false })
        });
        clearTimeout(timer);
        return response;
      } catch(e) {
        clearTimeout(timer);
        throw e;
      }
    };

    /* ── Tentative 1 & 2 : nouveau domaine puis legacy ── */
    let response = null;
    let lastError = null;

    for (const endpoint of ENDPOINTS) {
      try {
        const r = await _fetchEndpoint(endpoint, model, 40000);
        /* Succès HTTP ou erreur récupérable */
        if (r.ok) { response = r; break; }

        /* Erreur serveur (500, ENOSPC, etc.) → essayer l'endpoint suivant */
        const errText = await r.text().catch(() => '');
        const isServerErr = r.status >= 500;
        const isEnospc    = errText.includes('ENOSPC') || errText.includes('no space left');

        if (r.status === 429) {
          return { success: false, error: 'Pollinations — trop de requêtes. Réessaie dans quelques secondes.' };
        }
        if (isServerErr && endpoint === ENDPOINTS[ENDPOINTS.length - 1]) {
          /* Dernier endpoint aussi en erreur */
          lastError = isEnospc
            ? 'Serveurs Pollinations saturés (ENOSPC). Bascule automatique en cours...'
            : 'Pollinations erreur ' + r.status + '. Nouvelle tentative...';
          break;
        }
        if (isServerErr) {
          console.warn('[EVA Pollinations] ' + endpoint + ' → ' + r.status + (isEnospc ? ' (ENOSPC)' : '') + ' — essai endpoint suivant…');
          continue; /* Essayer l'endpoint suivant */
        }
        /* Autre erreur HTTP non-5xx */
        lastError = 'Pollinations erreur ' + r.status;
        break;
      } catch(e) {
        if (e.name === 'AbortError') {
          console.warn('[EVA Pollinations] Timeout sur ' + endpoint + ' — essai suivant…');
          lastError = 'Délai dépassé';
        } else {
          lastError = e.message;
        }
      }
    }

    /* ── Fallback Puter si Pollinations entièrement indisponible ── */
    if (!response) {
      if (window.puter && this.config.puterUsername) {
        console.warn('[EVA Pollinations] Tous les endpoints en échec — fallback Puter AI...');
        if (window.toast) window.toast('Pollinations indisponible — bascule sur Puter AI', 'warning');
        try {
          const puterResp = await puter.ai.chat(
            allMessages.map(m => m.role + ': ' + m.content).join('\n'),
            { model: 'gpt-4o-mini' }
          );
          const content = typeof puterResp === 'string' ? puterResp
            : (puterResp && puterResp.message && puterResp.message.content)
            || (puterResp && puterResp.content) || '';
          if (content) return { success: true, content: content.trim(), thinking: null, isReasoning: false };
        } catch(pe) {
          console.warn('[EVA] Fallback Puter aussi échoué:', pe);
        }
      }
      return { success: false, error: lastError || 'Pollinations inaccessible. Vérifiez votre connexion ou changez de provider IA.' };
    }

    /* ── Lecture de la réponse ── */
    let data;
    try {
      data = await response.json();
    } catch(e) {
      return { success: false, error: 'Réponse Pollinations invalide (JSON malformé)' };
    }

    if (!data || !data.choices || !data.choices[0] || !data.choices[0].message) {
      return { success: false, error: 'Réponse invalide de Pollinations' };
    }

    let rawContent = data.choices[0].message.content || '';
    let thinkingContent = null;

    /* Extraire le vrai bloc <think>...</think> des modèles de raisonnement */
    if (isReasoningModel) {
      const thinkMatch = rawContent.match(/<think>([\s\S]*?)<\/think>/i);
      if (thinkMatch) {
        thinkingContent = thinkMatch[1].trim();
        rawContent = rawContent.replace(/<think>[\s\S]*?<\/think>/i, '').trim();
      }
      if (!thinkingContent && data.choices[0].message.thinking) {
        thinkingContent = data.choices[0].message.thinking;
      }
    }

    return {
      success: true,
      content: rawContent.trim(),
      thinking: thinkingContent,
      isReasoning: !!thinkingContent
    };
  }
}

// ═══ PROVIDER FACTORY ═══
function createProvider(providerName, config) {
  switch (providerName) {
    case 'evalocal':
      return new EvaLocalProvider(config);
    case 'eva':
      return new EvaProvider(config);
    case 'qwen':
      return new QwenProvider(config);
    case 'puter':
      return new PuterProvider(config);
    case 'pollinations':
      return new PollinationsProvider(config);
    case 'openai':
      return new OpenAIProvider(config);
    case 'claude':
      return new ClaudeProvider(config);
    case 'lmstudio':
      return new LMStudioProvider(config);
    case 'ollama':
      return new OllamaProvider(config);
    default:
      throw new Error(`Unknown provider: ${providerName}`);
  }
}

// Expose globally
window.EVAProviders = {
  EvaProvider,
  QwenProvider,
  PuterProvider,
  PollinationsProvider,
  OpenAIProvider,
  ClaudeProvider,
  LMStudioProvider,
  OllamaProvider,
  createProvider
};

})();
