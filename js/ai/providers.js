/* ═══════════════════════════════════════════════════════════
   EVA V3 - PROVIDERS.JS
   Gestion des providers IA (Qwen, Puter, OpenAI, Claude, etc.)
   Chargé comme script classique (pas ES6 module)
   ═══════════════════════════════════════════════════════════ */

(function() {

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
      const selectedModel = this.config.qwenModel || 'Qwen2-1.5B-Instruct-q4f16_1-MLC';

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
        max_tokens: 1000
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
  }

  async initialize() {
    if (typeof puter === 'undefined') {
      return { success: false, error: 'Puter not loaded' };
    }

    try {
      // Check if connected
      const user = await puter.auth.getUser();
      if (user) {
        this.ready = true;
        return { success: true };
      } else {
        // Puter sometimes works without explicit login for AI calls
        this.ready = true;
        return { success: true };
      }
    } catch (error) {
      // Try anyway - puter AI sometimes works without auth
      this.ready = true;
      return { success: true };
    }
  }

  async sendMessage(messages, systemPrompt) {
    if (systemPrompt === undefined) systemPrompt = window.EVA_SYSTEM_PROMPT || 'Tu es Eva, une assistante IA bienveillante.';
    if (!this.ready) {
      const init = await this.initialize();
      if (!init.success) return init;
    }

    try {
      const model = this.config.puterModel || 'gpt-4o-mini';

      const formattedMessages = [
        { role: 'system', content: systemPrompt },
        ...messages
      ];

      const response = await puter.ai.chat(formattedMessages, { model });

      // Handle different puter response formats
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
      return { success: false, error: error.message };
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
          max_tokens: 1000
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
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model,
          system: systemPrompt,
          messages,
          max_tokens: 1000
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
          max_tokens: 1000
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

// ═══ PROVIDER FACTORY ═══
function createProvider(providerName, config) {
  switch (providerName) {
    case 'qwen':
      return new QwenProvider(config);
    case 'puter':
      return new PuterProvider(config);
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
  QwenProvider,
  PuterProvider,
  OpenAIProvider,
  ClaudeProvider,
  LMStudioProvider,
  OllamaProvider,
  createProvider
};

})();
