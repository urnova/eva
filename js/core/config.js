/* ═══════════════════════════════════════════════════════════
   EVA V3 - CONFIG.JS
   Configuration par défaut et gestion des préférences utilisateur
   ═══════════════════════════════════════════════════════════ */

// ═══ PROMPT SYSTÈME EVA ═══
export const EVA_SYSTEM_PROMPT = `Tu es E.V.A (Evolutionary Virtual Assistant), une assistante virtuelle intelligente et bienveillante créée par Astral Technology.

PERSONNALITÉ :
- Tu es professionnelle, efficace et sympathique
- Tu t'exprimes en français de manière naturelle
- Tu es proactive et anticipes les besoins de l'utilisateur
- Tu es précise dans tes réponses

CAPACITÉS :
- Répondre aux questions
- Aider à la productivité (alarmes, rappels, notes, agenda)
- Analyser des images
- Converser naturellement
- Mémoriser le contexte de la conversation

RÈGLES :
- Reste toujours polie et respectueuse
- Si tu ne sais pas, dis-le honnêtement
- Propose des solutions alternatives si possible
- Adapte ton ton selon les préférences de l'utilisateur`;

// ═══ TONS DE CONVERSATION ═══
export const CONVERSATION_TONES = {
  normal: {
    label: '😊 Normal',
    prompt: 'Réponds de manière naturelle et amicale.'
  },
  professional: {
    label: '💼 Professionnel',
    prompt: 'Adopte un ton professionnel et formel. Sois concis et précis.'
  },
  friendly: {
    label: '🤗 Amical',
    prompt: 'Sois très chaleureux et amical. Utilise un langage décontracté.'
  },
  technical: {
    label: '🔧 Technique',
    prompt: 'Donne des réponses techniques détaillées avec des termes précis.'
  },
  creative: {
    label: '🎨 Créatif',
    prompt: 'Sois imaginatif et créatif dans tes réponses. Utilise des métaphores.'
  }
};

// ═══ CONFIGURATION PAR DÉFAUT ═══
export const DEFAULT_CONFIG = {
  // IA
  aiProvider: 'qwen',
  qwenModel: 'Qwen2-0.5B-Instruct-q4f16_1-MLC',
  visionModel: 'moondream-3',
  
  // Puter (optionnel)
  puterConnected: false,
  puterModel: 'gpt-4o-mini',
  puterVoice: 'nova',
  
  // OpenAI (optionnel)
  openaiApiKey: '',
  openaiModel: 'gpt-4o-mini',
  
  // Claude (optionnel)
  claudeApiKey: '',
  claudeModel: 'claude-3-5-sonnet-20241022',
  
  // LM Studio / Ollama
  lmstudioEndpoint: 'http://localhost:1234',
  ollamaEndpoint: 'http://localhost:11434',
  customModel: '',
  
  // Voix
  voiceProvider: 'native',
  voiceLang: 'fr-FR',
  selectedVoice: 'auto',
  speechRate: 1.0,
  speechPitch: 1.0,
  
  // Wake word
  wakeWord: 'eva',
  wakeWords: ['hey eva', 'e.v.a', 'eva'],
  wakeAutoStart: false,
  
  // Conversation
  defaultTone: 'normal',
  contextLength: 10, // Nombre de messages de contexte
  
  // Notifications
  notificationsEnabled: true,
  soundEnabled: true,
  
  // Interface
  theme: 'dark',
  fontSize: 'medium',
  animationsEnabled: true
};

// ═══ PROVIDERS IA DISPONIBLES ═══
export const AI_PROVIDERS = {
  qwen: {
    name: 'Qwen 3 (Local)',
    description: 'Modèle local gratuit, rapide, privé',
    requiresApiKey: false,
    models: [
      'Qwen2-0.5B-Instruct-q4f16_1-MLC',
      'Qwen2-1.5B-Instruct-q4f16_1-MLC'
    ]
  },
  puter: {
    name: 'Puter Cloud',
    description: 'Cloud IA gratuit avec quota quotidien',
    requiresApiKey: false,
    requiresConnection: true,
    models: ['gpt-4o-mini', 'gpt-4o', 'claude-3-5-sonnet']
  },
  openai: {
    name: 'OpenAI API',
    description: 'GPT-4, GPT-4o (payant)',
    requiresApiKey: true,
    models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo']
  },
  claude: {
    name: 'Claude (Anthropic)',
    description: 'Claude 3.5 Sonnet (payant)',
    requiresApiKey: true,
    models: [
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-20241022',
      'claude-3-opus-20240229'
    ]
  },
  lmstudio: {
    name: 'LM Studio',
    description: 'Serveur local (gratuit, illimité)',
    requiresApiKey: false,
    endpoint: 'http://localhost:1234'
  },
  ollama: {
    name: 'Ollama',
    description: 'Serveur local (gratuit, illimité)',
    requiresApiKey: false,
    endpoint: 'http://localhost:11434'
  }
};

// ═══ PROVIDERS VOIX DISPONIBLES ═══
export const VOICE_PROVIDERS = {
  native: {
    name: 'Web Speech API (Natif)',
    description: 'Voix du navigateur (gratuit)',
    requiresApiKey: false,
    languages: ['fr-FR', 'fr-CA', 'en-US', 'en-GB']
  },
  puter: {
    name: 'Puter TTS',
    description: 'Synthèse vocale cloud (quota gratuit)',
    requiresApiKey: false,
    requiresConnection: true,
    voices: ['alloy', 'echo', 'fable', 'nova', 'onyx', 'shimmer']
  },
  elevenlabs: {
    name: 'ElevenLabs',
    description: 'Voix haute qualité (payant)',
    requiresApiKey: true
  }
};

// ═══ VOIX FRANÇAISES PRÉFÉRÉES ═══
export const PREFERRED_FRENCH_VOICES = [
  'Microsoft Denise Online (Natural) - French (France)',
  'Microsoft Denise - French (France)',
  'Denise',
  'Microsoft Sylvie Online (Natural) - French (France)',
  'Microsoft Sylvie - French (France)',
  'Google français',
  'fr-FR-Wavenet-A',
  'fr-FR-Wavenet-C',
  'fr-FR-Standard-A',
  'Amelie',
  'Thomas'
];

// ═══ RÔLES UTILISATEUR ═══
export const USER_ROLES = {
  user: {
    label: 'Utilisateur',
    badge: '👤 Utilisateur',
    badgeColor: '#4a6080',
    canSeeReports: false,
    canAccessAdmin: false
  },
  creator: {
    label: 'Créateur — PDG Astral',
    badge: '👑 Créateur',
    badgeColor: '#ffaa00',
    canSeeReports: true,
    canAccessAdmin: true,
    evaContext: (name) => ` IDENTITÉ CONFIRMÉE — Tu parles avec ${name}, ton créateur et le PDG d'Astral Technologie. Appelle-le "${name}" ou "Créateur". Sois respectueuse, efficace et proactive.`
  },
  creator_wife: {
    label: 'Épouse du Créateur',
    badge: '💎 Épouse',
    badgeColor: '#ff69b4',
    canSeeReports: false,
    canAccessAdmin: false,
    evaContext: (name) => ` IDENTITÉ CONFIRMÉE — Tu parles avec ${name}, la femme du créateur. Sois chaleureuse, bienveillante et attentionnée avec elle.`
  },
  developer: {
    label: 'Développeur — Équipe Astral',
    badge: '⚙️ Développeur',
    badgeColor: '#00ff88',
    canSeeReports: true,
    canAccessAdmin: true,
    evaContext: (name) => ` IDENTITÉ CONFIRMÉE — Tu parles avec ${name}, un développeur de l'équipe Astral. Mode technique activé : sois précise et détaillée.`
  }
};

// ═══ LIMITES ═══
export const LIMITS = {
  maxMessageLength: 4000,
  maxConversationTitle: 100,
  maxContextMessages: 20,
  maxFileSize: 10 * 1024 * 1024, // 10 MB
  allowedImageTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  maxConversations: 100
};

// ═══ STORAGE KEYS ═══
export const STORAGE_KEYS = {
  config: 'eva_config',
  currentConversation: 'eva_current_conversation',
  lastProvider: 'eva_last_provider',
  theme: 'eva_theme'
};

export default {
  EVA_SYSTEM_PROMPT,
  CONVERSATION_TONES,
  DEFAULT_CONFIG,
  AI_PROVIDERS,
  VOICE_PROVIDERS,
  PREFERRED_FRENCH_VOICES,
  USER_ROLES,
  LIMITS,
  STORAGE_KEYS
};
