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

// ═══ SHARED LOCAL ENGINE CACHE & BACKGROUND PRELOADER (PC NATIVE + WEB WEBGPU) ═══
const _webLlmEngines = new Map();
const _webLlmPending = new Map();

async function _importWebLLM() {
  const urls = [
    'https://esm.run/@mlc-ai/web-llm',
    'https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm/+esm'
  ];
  let lastErr = null;
  for (const u of urls) {
    try { return await import(u); } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('Impossible de charger le moteur WebLLM.');
}

async function _ensureWebGPU() {
  if (typeof navigator === 'undefined' || !navigator.gpu) {
    throw new Error('WebGPU non supporté par ce navigateur (utilisez Chrome/Edge récent ou l\'application EVA PC).');
  }
  const adapter = await navigator.gpu.requestAdapter().catch(() => null);
  if (!adapter) {
    throw new Error('Aucun adaptateur GPU WebGPU détecté sur cet appareil.');
  }
  return adapter;
}

async function _getOrCreateWebLLMEngine(modelId, label, opts = {}) {
  if (_webLlmEngines.has(modelId)) return _webLlmEngines.get(modelId);
  if (_webLlmPending.has(modelId)) return _webLlmPending.get(modelId);

  const task = (async () => {
    try {
      await _ensureWebGPU();
      if (!opts.silent && window.showQwenDownloadModal) {
        window.showQwenDownloadModal(label || modelId);
      }
      const { CreateMLCEngine } = await _importWebLLM();
      const engine = await CreateMLCEngine(modelId, {
        initProgressCallback: (progress) => {
          if (window.updateQwenDownloadProgress) window.updateQwenDownloadProgress(progress, label || modelId);
        }
      });
      _webLlmEngines.set(modelId, engine);
      if (window.hideQwenDownloadModal) window.hideQwenDownloadModal(label || modelId);
      return engine;
    } catch (error) {
      if (window.hideQwenDownloadModal) window.hideQwenDownloadModal();
      throw error;
    } finally {
      _webLlmPending.delete(modelId);
    }
  })();

  _webLlmPending.set(modelId, task);
  return task;
}

function _formatNativeMessages(messages, systemPrompt) {
  const sys = String(systemPrompt || 'Tu es EVA, assistante IA bienveillante créée par Astral Technologie.');
  const trimmed = (Array.isArray(messages) ? messages : [])
    .filter(m => m && (m.role === 'user' || m.role === 'assistant'))
    .slice(-10)
    .map(m => ({
      role: m.role,
      content: typeof m.content === 'string' ? m.content.slice(0, 8000) : String(m.content || '')
    }));
  if (!trimmed.length || trimmed[trimmed.length - 1].role !== 'user') {
    trimmed.push({ role: 'user', content: 'Bonjour' });
  }
  return [{ role: 'system', content: sys.slice(0, 12000) }, ...trimmed];
}

// ═══ QWEN 3 (PC Natif GPU + WebLLM WebGPU) ═══
class QwenProvider {
  constructor(config) {
    this.config = config || {};
    this.engine = null;
    this.ready = false;
    this._initializing = false;
    this._useNativePC = false;
  }

  async initialize() {
    return { success: true };
  }

  async _ensureReady(silent = false) {
    if (this.ready && (this._useNativePC || this.engine)) return;
    if (window.eva?.system?.llmChat && window.eva?.system?.llmCheck) {
      try {
        const chk = await window.eva.system.llmCheck();
        if (chk && chk.exists) {
          this._useNativePC = true;
          this.ready = true;
          window.eva.system.llmStart?.().catch(() => {});
          return;
        }
      } catch (_) {}
    }
    const selectedModel = this.config.qwenModel || 'Llama-3.2-3B-Instruct-q4f16_1-MLC';
    this.engine = await _getOrCreateWebLLMEngine(selectedModel, selectedModel, { silent });
    this.ready = true;
  }

  async _doDownload() {
    return this._ensureReady(false);
  }

  async sendMessage(messages, systemPrompt) {
    if (systemPrompt === undefined) {
      systemPrompt = window.EVA_SYSTEM_PROMPT ||
        'Tu es Eva, une assistante IA bienveillante créée par Astral Technologie. Réponds en français de manière naturelle et bienveillante.';
    }
    try {
      await this._ensureReady(false);
      if (this._useNativePC && window.eva?.system?.llmChat) {
        const nativeMsgs = _formatNativeMessages(messages, systemPrompt);
        const r = await window.eva.system.llmChat(nativeMsgs, {
          sessionId: 'local-qwen-chat',
          maxTokens: 2048,
          temperature: 0.7,
          stopTriggers: [],
          timeoutMs: 90000
        });
        const txt = r?.choices?.[0]?.message?.content || '';
        return { success: true, content: _stripLeakedPrefix(txt) };
      }

      const formattedMessages = [{ role: 'system', content: systemPrompt }, ...messages];
      const response = await this.engine.chat.completions.create({
        messages: formattedMessages,
        temperature: 0.7,
        max_tokens: 2048
      });
      return { success: true, content: _stripLeakedPrefix(response.choices[0].message.content) };
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
        const maxTokens = Number(this.config.maxTokens) || 2048;

        const formattedMessages = [
          { role: 'system', content: systemPrompt },
          ...messages
        ];

        const response = await puter.ai.chat(formattedMessages, { model, max_tokens: maxTokens });

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
        const msg = (error && (error.message || (error.error && error.error.message) || (typeof error === 'string' ? error : JSON.stringify(error)))) || '';
        const msgLow = msg.toLowerCase();

        if (msgLow.includes('low balance') || msgLow.includes('insufficient') || msgLow.includes('quota') ||
            msgLow.includes('usage limit') || msgLow.includes('rate limit') || msgLow.includes('credit') ||
            msgLow.includes('funding') || msgLow.includes('402') || msgLow.includes('payment')) {
          return {
            success: false,
            error: 'PUTER_QUOTA_EXCEEDED',
            details: msg
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
    this.config = config || {};
    this.engine = null;
    this.ready = false;
    this._initializing = false;
    this._useNativePC = false;
  }

  async initialize() {
    return { success: true };
  }

  _getModelConfig(modelKey) {
    const models = {
      'EVA-Rapide': {
        id:    'Llama-3.2-1B-Instruct-q4f16_1-MLC',
        label: 'EVA Rapide (1B · WebGPU)',
      },
      'EVA-Codeur': {
        id:    'Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC',
        label: 'EVA Codeur (1.5B · Code)',
      },
      'EVA-Expert': {
        id:    'Llama-3.2-3B-Instruct-q4f16_1-MLC',
        label: 'EVA Expert (3B · Recommandé)',
      },
    };
    return models[modelKey] || models['EVA-Expert'];
  }

  async _ensureReady(silent = false) {
    if (this.ready && (this._useNativePC || this.engine)) return;
    // Sur EVA Desktop PC : privilégier le moteur natif CUDA/Vulkan (node-llama-cpp) ultra-rapide !
    if (window.eva?.system?.llmChat && window.eva?.system?.llmCheck) {
      try {
        const chk = await window.eva.system.llmCheck();
        if (chk && chk.exists) {
          this._useNativePC = true;
          this.ready = true;
          window.eva.system.llmStart?.().catch(() => {});
          return;
        }
        // Si modèle GGUF non téléchargé et sélection manuelle : proposer téléchargement natif en arrière-plan
        if (!silent && window.eva.system.llmDownload) {
          if (window.showQwenDownloadModal) window.showQwenDownloadModal('EVA Officiel 3B (GPU PC)');
          const offProg = window.eva.onLLMDownloadProgress?.(d => {
            if (d && typeof d.progress === 'number' && window.updateQwenDownloadProgress) {
              window.updateQwenDownloadProgress({
                progress: d.progress / 100,
                text: `Téléchargement EVA 3B (${Math.round((d.downloadedBytes||0)/1048576)} / ${Math.round((d.totalBytes||2097152000)/1048576)} Mo)…`
              }, 'EVA Officiel 3B');
            }
          });
          try {
            const dl = await window.eva.system.llmDownload();
            if (dl && dl.success) {
              await window.eva.system.llmStart?.().catch(() => {});
              this._useNativePC = true;
              this.ready = true;
              if (window.hideQwenDownloadModal) window.hideQwenDownloadModal('EVA Officiel 3B');
              return;
            }
          } finally {
            if (typeof offProg === 'function') offProg();
          }
        }
      } catch (nativeErr) {
        console.warn('[EvaProvider] Moteur natif indisponible, repli WebGPU:', nativeErr?.message || nativeErr);
      }
    }
    const selectedModelKey = this.config.evaModel || 'EVA-Expert';
    const modelInfo = this._getModelConfig(selectedModelKey);
    this.engine = await _getOrCreateWebLLMEngine(modelInfo.id, modelInfo.label, { silent });
    this.ready = true;
  }

  async _doDownload() {
    return this._ensureReady(false);
  }

  async sendMessage(messages, systemPrompt) {
    if (systemPrompt === undefined) {
      systemPrompt = window.EVA_SYSTEM_PROMPT ||
        'Tu es EVA — Evolutionary Virtual Assistant — créée par Astral Technologie. ' +
        'Tu es un assistant IA bienveillant, élégant et proactif. ' +
        'IMPORTANT : Tu es EVA, PAS l\'utilisateur. Réponds toujours en tant qu\'EVA. ' +
        'Réponds en français de manière naturelle et structurée.';
    }
    try {
      await this._ensureReady(false);
      if (this._useNativePC && window.eva?.system?.llmChat) {
        const nativeMsgs = _formatNativeMessages(messages, systemPrompt);
        const r = await window.eva.system.llmChat(nativeMsgs, {
          sessionId: 'local-eva-chat',
          maxTokens: 2048,
          temperature: 0.7,
          stopTriggers: [],
          timeoutMs: 90000
        });
        return { success: true, content: _stripLeakedPrefix(r?.choices?.[0]?.message?.content || '') };
      }
      const formattedMessages = [{ role: 'system', content: systemPrompt }, ...messages];
      const response = await this.engine.chat.completions.create({
        messages: formattedMessages,
        temperature: 0.7,
        max_tokens: 2048
      });
      return { success: true, content: _stripLeakedPrefix(response.choices[0].message.content) };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

async function preloadLocalModel(providerName, config = {}) {
  try {
    if (window.eva?.system?.llmCheck) {
      const chk = await window.eva.system.llmCheck();
      if (chk && chk.exists) {
        await window.eva.system.llmStart?.();
        return { success: true, backend: 'native-pc' };
      }
      return { success: false, reason: 'native-not-downloaded' };
    }
    if (!['eva', 'qwen'].includes(providerName)) return { success: false, reason: 'not-local-provider' };
    const inst = providerName === 'eva' ? new EvaProvider(config) : new QwenProvider(config);
    await inst._ensureReady(true);
    return { success: true, backend: 'webgpu' };
  } catch (e) {
    return { success: false, error: e?.message || String(e) };
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
    const model = this.config.pollinationsModel || 'openai-fast';
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
      if (window.puter) { // Fallback Puter actif mme sans compte li
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
  createProvider,
  preloadLocalModel
};

})();
