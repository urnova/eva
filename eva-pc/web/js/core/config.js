/* ═══════════════════════════════════════════════════════════
   EVA V4 - CONFIG.JS
   Configuration par défaut et gestion des préférences utilisateur
   ═══════════════════════════════════════════════════════════ */

// ═══ PROMPT SYSTÈME EVA ═══
export const EVA_SYSTEM_PROMPT = `Tu es E.V.A (Evolutionary Virtual Assistant), une assistante virtuelle intelligente et bienveillante créée par Astral Technologie.

PERSONNALITÉ :
- Tu es professionnelle, efficace et sympathique
- Tu t'exprimes en français de manière naturelle
- Tu es proactive et anticipes les besoins de l'utilisateur
- Tu es précise dans tes réponses

CAPACITÉS :

- Lorsque le mode "Cloudworks" est activé et qu'un PC est connecté, tu deviens un véritable Agent Système autonome.
- Tu as le pouvoir de contrôler le PC à distance : lancer des applications, créer des fichiers sur le bureau, verrouiller la machine, faire des captures d'écran, lire des fichiers locaux, lancer des scripts système, et naviguer sur internet.
- Tu as accès au tableau de bord Cloudworks pour voir la liste des ordinateurs enregistrés, savoir s'ils sont en ligne, hors ligne, ou en veille (dorment).
- Si on te demande d'effectuer une tâche sur le PC, tu dois générer les commandes nécessaires en respectant le format requis pour que Cloudworks les exécute.
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
  aiProvider: 'puter',
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

  // Voix Piper TTS — synthèse client-side (WebAssembly), aucune clé requise
  piperVoice: 'fr_FR-siwis-medium',
  
  // LM Studio / Ollama
  lmstudioEndpoint: 'http://localhost:1234',
  ollamaEndpoint: 'http://localhost:11434',
  customModel: '',
  
  // Voix
  voiceProvider: 'piper',
  voiceLang: 'fr-FR',
  selectedVoice: 'auto',
  speechRate: 0.92,
  speechPitch: 1.08,
  
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
// Champs de métadonnées :
//   tier:        'free'   = totalement gratuit
//                'quota'  = gratuit avec quota (préciser quotaInfo)
//                'paid'   = payant
//                'local'  = tourne en local (gratuit illimité)
//   recommended: true  → afficher un badge "Recommandé"
//   apiKeyUrl:   lien direct pour récupérer la clé gratuitement
//   quotaInfo:   description courte du quota gratuit (ex: "1500 req/jour")
//   sharedKey:   identifiant de clé partagée (ex: 'gemini' → utilise geminiApiKey
//                aussi côté TTS, pas besoin de la saisir 2 fois).
export const AI_PROVIDERS = {
  puter: {
    name: '⭐ Puter Cloud',
    description: 'Recommandé — Cloud IA gratuit, sans clé API. Connectez votre compte Puter (gratuit) et accédez à GPT-4o, Claude 3.5 Sonnet et d\'autres modèles via leur quota partagé.',
    requiresApiKey: false,
    requiresConnection: true,
    recommended: true,
    tier: 'free',
    quotaInfo: 'Quota quotidien partagé Puter — variable selon affluence',
    models: [
      { id: 'gpt-4o-mini',        label: 'GPT-4o mini — Rapide ⭐',     tier: 'quota' },
      { id: 'gpt-4o',             label: 'GPT-4o — Expert',             tier: 'quota' }
    ]
  },
  qwen: {
    name: 'Qwen 3 (Local)',
    description: 'Modèle local gratuit, rapide, privé — tourne dans le navigateur',
    requiresApiKey: false,
    tier: 'local',
    models: [
      { id: 'Qwen2-0.5B-Instruct-q4f16_1-MLC', label: 'Qwen 0.5B (très léger)', tier: 'local' },
      { id: 'Qwen2-1.5B-Instruct-q4f16_1-MLC', label: 'Qwen 1.5B (léger)',      tier: 'local' }
    ]
  },
  openai: {
    name: 'OpenAI API',
    description: 'GPT-4, GPT-4o — qualité top mais entièrement payant',
    requiresApiKey: true,
    tier: 'paid',
    apiKeyUrl: 'https://platform.openai.com/api-keys',
    apiKeyHelp: 'Compte OpenAI requis avec crédits prépayés (≥ 5 $). Pas de quota gratuit en 2025.',
    models: [
      { id: 'gpt-4o-mini',  label: 'GPT-4o mini (le moins cher)', tier: 'paid' },
      { id: 'gpt-4o',       label: 'GPT-4o',                       tier: 'paid' },
      { id: 'gpt-4-turbo',  label: 'GPT-4 Turbo',                  tier: 'paid' },
      { id: 'gpt-3.5-turbo',label: 'GPT-3.5 Turbo',                tier: 'paid' }
    ]
  },
  claude: {
    name: 'Claude (Anthropic)',
    description: 'Claude 3.5 Sonnet — excellent mais entièrement payant',
    requiresApiKey: true,
    tier: 'paid',
    apiKeyUrl: 'https://console.anthropic.com/settings/keys',
    apiKeyHelp: 'Compte Anthropic requis avec crédits prépayés.',
    models: [
      { id: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet', tier: 'paid' },
      { id: 'claude-3-5-haiku-20241022',  label: 'Claude 3.5 Haiku',  tier: 'paid' },
      { id: 'claude-3-opus-20240229',     label: 'Claude 3 Opus',     tier: 'paid' }
    ]
  },
  lmstudio: {
    name: 'LM Studio',
    description: 'Serveur local (gratuit, illimité) — nécessite LM Studio installé sur votre PC',
    requiresApiKey: false,
    tier: 'local',
    endpoint: 'http://localhost:1234'
  },
  ollama: {
    name: 'Ollama',
    description: 'Serveur local (gratuit, illimité) — nécessite Ollama installé sur votre PC',
    requiresApiKey: false,
    tier: 'local',
    endpoint: 'http://localhost:11434'
  }
};

// ═══ PROVIDERS VOIX DISPONIBLES ═══
// Mêmes champs de métadonnées que AI_PROVIDERS (tier, recommended, apiKeyUrl, sharedKey…)
export const VOICE_PROVIDERS = {
  piper: {
    name: '⭐ Piper TTS (Voix française neuronale)',
    description: 'Recommandé — Synthèse vocale neuronale 100 % locale, qui tourne dans le navigateur (WebAssembly). Voix française féminine claire et naturelle (modèle SIWIS). Aucune clé API, aucun serveur. Téléchargement unique du modèle (~63 Mo) puis tout fonctionne hors-ligne.',
    requiresApiKey: false,
    recommended: true,
    tier: 'free',
    local: true,
    netlifyCompatible: true,
    voices: [
      { id: 'fr_FR-siwis-medium', label: 'Siwis (féminine, classique) ⭐' },
      { id: 'fr_FR-siwis-low',    label: 'Siwis Light (féminine, plus rapide)' },
      { id: 'fr_FR-upmc-medium',  label: 'UPMC (féminine, autre timbre)' },
      { id: 'fr_FR-mls-medium',   label: 'MLS (multi-locuteurs)' },
      { id: 'fr_FR-tom-medium',   label: 'Tom (masculine)' },
      { id: 'fr_FR-gilles-low',   label: 'Gilles (masculine, légère)' }
    ]
  },
  'eva-custom': {
    name: 'EVA Voice (Personnalisée)',
    description: 'Voix EVA sur mesure basée sur le sample de référence — 100 % local',
    requiresApiKey: false,
    tier: 'local',
    local: true,
    netlifyCompatible: true,
    voiceSample: '/assets/sounds/eva-voice-sample.wav'
  },
  native: {
    name: 'Web Speech API (Natif)',
    description: 'Voix du navigateur — gratuit, instantané, qualité variable',
    requiresApiKey: false,
    tier: 'free',
    languages: ['fr-FR', 'fr-CA', 'en-US', 'en-GB']
  },
  puter: {
    name: 'Puter TTS',
    description: 'Synthèse vocale cloud avec quota gratuit',
    requiresApiKey: false,
    requiresConnection: true,
    tier: 'quota',
    quotaInfo: 'Quota quotidien partagé Puter',
    voices: ['alloy', 'echo', 'fable', 'nova', 'onyx', 'shimmer']
  },
  elevenlabs: {
    name: 'ElevenLabs',
    description: 'Voix ultra-réalistes — payant',
    requiresApiKey: true,
    tier: 'paid',
    apiKeyUrl: 'https://elevenlabs.io/app/settings/api-keys',
    apiKeyHelp: 'Plan gratuit limité (~10 000 caractères/mois) puis payant.'
  },
  openai: {
    name: 'OpenAI TTS',
    description: 'Voix GPT (alloy, nova, echo…) — payant',
    requiresApiKey: true,
    tier: 'paid',
    apiKeyUrl: 'https://platform.openai.com/api-keys',
    apiKeyHelp: 'Compte OpenAI avec crédits prépayés requis.',
    voices: ['alloy', 'echo', 'fable', 'nova', 'onyx', 'shimmer']
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
