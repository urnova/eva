/* ═══════════════════════════════════════════════════════════
   EVA V3 - CHAT-HANDLER.JS
   Gestion des messages et réponses IA
   Chargé comme script classique (pas ES6 module)
   ═══════════════════════════════════════════════════════════ */

(function() {

// Toast fallback (utilise window.showEvaToast si disponible)
function toast(msg, type) {
  if (window.showEvaToast) {
    window.showEvaToast(msg, type);
  } else {
    console.log('[EVA ' + (type || 'info') + ']', msg);
  }
}

// Variables privées
let currentProvider = null;
let currentConfig = null;
let conversationContext = [];
let isProcessing = false;

// ═══ INIT CHAT HANDLER ═══
async function initChatHandler(config) {
  currentConfig = config;

  try {
    if (!window.EVAProviders) {
      throw new Error('EVAProviders not loaded');
    }

    // Créer le provider
    currentProvider = window.EVAProviders.createProvider(config.aiProvider, config);

    // Initialiser si nécessaire
    if (currentProvider.initialize) {
      const result = await currentProvider.initialize();
      if (!result.success) {
        console.warn('Provider init warning:', result.error);
        toast(`Provider ${config.aiProvider} : ${result.error}`, 'warning');
      }
    }

    return { success: true };
  } catch (error) {
    console.error('Chat handler init error:', error);
    return { success: false, error: error.message };
  }
}

// ═══ SEND MESSAGE ═══
async function sendMessage(userMessage, options) {
  options = options || {};

  if (isProcessing) {
    toast('Message en cours de traitement...', 'info');
    return { success: false, error: 'Already processing' };
  }

  if (!currentProvider) {
    toast('Provider IA non initialisé. Configurez-le dans Paramètres > IA', 'error');
    return { success: false, error: 'Provider not initialized' };
  }

  isProcessing = true;

  try {
    // Ajouter le message utilisateur au contexte
    conversationContext.push({
      role: 'user',
      content: userMessage
    });

    // Limiter le contexte (garder les N derniers messages)
    const contextLimit = (currentConfig && currentConfig.contextLength) || 10;
    if (conversationContext.length > contextLimit * 2) {
      conversationContext = conversationContext.slice(-contextLimit * 2);
    }

    // Construire le prompt système
    let systemPrompt = window.EVA_SYSTEM_PROMPT || 'Tu es Eva, une assistante IA bienveillante. Réponds en français.';

    // Ajouter le ton si spécifié
    const tones = window.CONVERSATION_TONES || {};
    if (options.tone && tones[options.tone]) {
      systemPrompt += '\n\n' + tones[options.tone].prompt;
    }

    // Ajouter le contexte de rôle si applicable
    if (options.roleContext) {
      systemPrompt += '\n\n' + options.roleContext;
    }

    // Ajouter le surnom si disponible
    if (options.nickname) {
      systemPrompt += `\n\nL'utilisateur s'appelle ${options.nickname}.`;
    }

    // Envoyer au provider
    const response = await currentProvider.sendMessage(
      conversationContext,
      systemPrompt
    );

    if (!response.success) {
      throw new Error(response.error);
    }

    // Ajouter la réponse au contexte
    conversationContext.push({
      role: 'assistant',
      content: response.content
    });

    isProcessing = false;

    return {
      success: true,
      content: response.content,
      provider: currentConfig ? currentConfig.aiProvider : 'unknown'
    };

  } catch (error) {
    isProcessing = false;
    console.error('Send message error:', error);

    // Message d'erreur personnalisé
    let errorMessage = 'Erreur IA';

    if (error.message && (error.message.includes('quota') || error.message.includes('rate limit'))) {
      errorMessage = 'Quota dépassé. Essayez un autre provider.';
    } else if (error.message && (error.message.includes('network') || error.message.includes('fetch'))) {
      errorMessage = 'Erreur réseau. Vérifiez votre connexion.';
    } else if (error.message && (error.message.includes('key') || error.message.includes('auth'))) {
      errorMessage = 'Clé API invalide ou manquante.';
    }

    toast(errorMessage, 'error');

    return {
      success: false,
      error: error.message,
      fallbackMessage: "Désolée, je n'ai pas pu traiter votre message. Vérifiez la configuration IA dans les paramètres."
    };
  }
}

// ═══ SWITCH PROVIDER ═══
async function switchProvider(providerName, config) {
  try {
    if (!window.EVAProviders) throw new Error('EVAProviders not loaded');
    currentConfig = config;
    currentProvider = window.EVAProviders.createProvider(providerName, config);

    if (currentProvider.initialize) {
      await currentProvider.initialize();
    }

    toast(`Provider changé : ${providerName}`, 'success');
    return { success: true };
  } catch (error) {
    console.error('Switch provider error:', error);
    toast('Erreur changement de provider', 'error');
    return { success: false, error: error.message };
  }
}

// ═══ CLEAR CONTEXT ═══
function clearContext() {
  conversationContext = [];
}

// ═══ GET CONTEXT ═══
function getContext() {
  return conversationContext.slice();
}

// ═══ SET CONTEXT ═══
function setContext(context) {
  conversationContext = context || [];
}

// ═══ ADD TO CONTEXT ═══
function addToContext(role, content) {
  conversationContext.push({ role, content });
}

// ═══ GET LAST MESSAGE ═══
function getLastMessage() {
  if (conversationContext.length === 0) return null;
  return conversationContext[conversationContext.length - 1];
}

// ═══ GET LAST USER MESSAGE ═══
function getLastUserMessage() {
  for (let i = conversationContext.length - 1; i >= 0; i--) {
    if (conversationContext[i].role === 'user') {
      return conversationContext[i];
    }
  }
  return null;
}

// ═══ GET LAST ASSISTANT MESSAGE ═══
function getLastAssistantMessage() {
  for (let i = conversationContext.length - 1; i >= 0; i--) {
    if (conversationContext[i].role === 'assistant') {
      return conversationContext[i];
    }
  }
  return null;
}

// ═══ GET CONVERSATION SUMMARY ═══
function getConversationSummary() {
  const userMessages = conversationContext.filter(m => m.role === 'user');
  const assistantMessages = conversationContext.filter(m => m.role === 'assistant');

  return {
    totalMessages: conversationContext.length,
    userMessages: userMessages.length,
    assistantMessages: assistantMessages.length,
    contextLength: conversationContext.length
  };
}

// ═══ IS PROCESSING ═══
function getIsProcessing() {
  return isProcessing;
}

// ═══ RETRY LAST MESSAGE ═══
async function retryLastMessage(options) {
  options = options || {};
  const lastUserMessage = getLastUserMessage();

  if (!lastUserMessage) {
    return { success: false, error: 'No message to retry' };
  }

  // Retirer le dernier message assistant (s'il existe)
  if (getLastAssistantMessage()) {
    conversationContext.pop();
  }

  // Retirer le dernier message user
  conversationContext.pop();

  // Renvoyer
  return await sendMessage(lastUserMessage.content, options);
}

// Expose globally
window.EVAChatHandler = {
  initChatHandler,
  sendMessage,
  switchProvider,
  clearContext,
  getContext,
  setContext,
  addToContext,
  getLastMessage,
  getLastUserMessage,
  getLastAssistantMessage,
  getConversationSummary,
  getIsProcessing,
  retryLastMessage
};

})();
