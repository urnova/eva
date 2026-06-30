/**
 * ═══════════════════════════════════════════════════════════════
 * E.V.A TTS MANAGER — window.EVATTS
 * Manager central de la synthèse vocale d'EVA
 *
 * Priorité des engines (configurée via S.config.voiceProvider) :
 *   1. 'eva-custom'  → Piper VITS (qualité max, cross-browser)
 *   2. 'kokoro'      → Kokoro TTS (si disponible)
 *   3. 'piper'       → Piper direct
 *   4. 'native'      → Web Speech API (fallback universel)
 *
 * NB : tts.js est chargé AVANT les engines specifiques (eva-custom-tts.js etc.)
 *      donc il initialise EVATTS avec des méthodes qui délèguent dynamiquement
 *      vers window.EvaCustomTTS / window.KokoroTTS / etc. une fois chargés.
 * ═══════════════════════════════════════════════════════════════
 */
(function() {
'use strict';

/* ── État interne ── */
var _speaking    = false;
var _muted       = false;
var _currentText = '';
var _skipTtsBtn  = null; /* bouton "couper la voix" dans le header */
var _elevenlabsAudio = null; /* Audio en cours pour ElevenLabs */

/* ── Appel le bon engine selon la config ── */
function _getEngine(config) {
  var prov = (config && config.voiceProvider) || 'eva-custom';
  if (prov === 'eva-custom' || prov === 'piper-vits') {
    return window.EvaCustomTTS || null;
  }
  if (prov === 'kokoro') {
    return window.KokoroTTS || window.EvaCustomTTS || null;
  }
  if (prov === 'piper') {
    return window.PiperTTS || window.EvaCustomTTS || null;
  }
  if (prov === 'elevenlabs') {
    /* Engine ElevenLabs inline */
    return {
      speak: function(text, cfg, onStart, onEnd) {
        var key     = cfg && cfg.elevenLabsApiKey;
        var voiceId = (cfg && cfg.elevenLabsVoiceId) || '21m00Tcm4TlvDq8ikWAM'; /* Rachel par défaut */
        if (!key) {
          /* Pas de clé → fallback natif silencieux */
          console.warn('[EVA TTS] ElevenLabs : clé API manquante, fallback navigateur.');
          if (typeof speechSynthesis !== 'undefined') {
            var utt = new SpeechSynthesisUtterance(text);
            utt.lang = 'fr-FR'; utt.rate = 0.92;
            utt.onend = function() { if (onEnd) onEnd(); };
            speechSynthesis.speak(utt);
          }
          return;
        }
        if (onStart) onStart();
        fetch('https://api.elevenlabs.io/v1/text-to-speech/' + voiceId + '/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'xi-api-key': key },
          body: JSON.stringify({
            text: text,
            model_id: 'eleven_multilingual_v2',
            voice_settings: { stability: 0.45, similarity_boost: 0.80 }
          })
        }).then(function(r) {
          if (!r.ok) throw new Error('ElevenLabs HTTP ' + r.status);
          return r.blob();
        }).then(function(blob) {
          var url = URL.createObjectURL(blob);
          _elevenlabsAudio = new Audio(url);
          _elevenlabsAudio.onended = function() {
            URL.revokeObjectURL(url);
            _elevenlabsAudio = null;
            if (onEnd) onEnd();
          };
          _elevenlabsAudio.onerror = function() {
            URL.revokeObjectURL(url);
            _elevenlabsAudio = null;
            if (onEnd) onEnd();
          };
          _elevenlabsAudio.play();
        }).catch(function(e) {
          console.error('[EVA TTS] ElevenLabs erreur:', e);
          _elevenlabsAudio = null;
          if (onEnd) onEnd();
        });
      }
    };
  }
  if (prov === 'openai') {
    /* Engine OpenAI TTS inline */
    return {
      speak: function(text, cfg, onStart, onEnd) {
        var key   = cfg && (cfg.openAITTSApiKey || cfg.openaiApiKey);
        var voice = (cfg && cfg.openAITTSVoice) || 'nova'; /* nova = voix féminine douce */
        if (!key) {
          /* Pas de clé → fallback natif */
          console.warn('[EVA TTS] OpenAI TTS : clé API manquante, fallback navigateur.');
          if (typeof speechSynthesis !== 'undefined') {
            var utt = new SpeechSynthesisUtterance(text);
            utt.lang = 'fr-FR'; utt.rate = 0.92;
            utt.onend = function() { if (onEnd) onEnd(); };
            speechSynthesis.speak(utt);
          }
          return;
        }
        if (onStart) onStart();
        fetch('https://api.openai.com/v1/audio/speech', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
          body: JSON.stringify({ model: 'tts-1', input: text, voice: voice, response_format: 'mp3' })
        }).then(function(r) {
          if (!r.ok) throw new Error('OpenAI TTS HTTP ' + r.status);
          return r.blob();
        }).then(function(blob) {
          var url = URL.createObjectURL(blob);
          var audio = new Audio(url);
          audio.onended = function() { URL.revokeObjectURL(url); if (onEnd) onEnd(); };
          audio.onerror = function() { URL.revokeObjectURL(url); if (onEnd) onEnd(); };
          audio.play();
        }).catch(function(e) {
          console.error('[EVA TTS] OpenAI TTS erreur:', e);
          if (onEnd) onEnd();
        });
      }
    };
  }
  /* 'native' / fallback */
  return null; /* on utilisera Web Speech directement */
}

/* ── Fallback Web Speech ── */
function _speakNative(text, config) {
  if (typeof speechSynthesis === 'undefined') return;
  try { speechSynthesis.cancel(); } catch(e) {}
  var utt = new SpeechSynthesisUtterance(text);
  utt.lang = 'fr-FR';
  var rate = parseFloat(config && config.speechRate);
  utt.rate  = (rate && rate !== 1.0) ? Math.min(1.2, Math.max(0.75, rate)) : 0.92;
  utt.pitch = 1.15;
  utt.volume = 1.0;

  /* Chercher voix féminine française */
  try {
    var voices = speechSynthesis.getVoices() || [];
    var frVoices = voices.filter(function(v) { return v.lang && v.lang.startsWith('fr'); });
    var femKeys = ['Denise','Amelie','Amélie','Audrey','Marie','Virginie','Léa','Lea','Julie'];
    var best = null;
    for (var i = 0; i < femKeys.length; i++) {
      var k = femKeys[i];
      best = frVoices.find(function(v) { return v.name && v.name.includes(k); });
      if (best) break;
    }
    if (!best && frVoices.length) best = frVoices[0];
    if (best) { utt.voice = best; utt.lang = best.lang; }
  } catch(e) {}

  utt.onend   = function() { _speaking = false; _updateSkipBtn(); _onSpeakEnd(); };
  utt.onerror = function() { _speaking = false; _updateSkipBtn(); _onSpeakEnd(); };
  _speaking = true;
  _updateSkipBtn();
  try { speechSynthesis.speak(utt); } catch(e) { _speaking = false; _updateSkipBtn(); }
}

/* ── Extrait le texte lisible (enlève markdown, actions, code) ── */
function _cleanForTts(text) {
  if (!text) return '';
  return text
    .replace(/```[\w]*\n[\s\S]*?```/g, '') /* blocs code/actions */
    .replace(/\[ACTION:\{[^}]*\}\]/g, '')  /* actions inline */
    .replace(/#{1,6}\s*/g, '')             /* titres markdown */
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1') /* gras/italique */
    .replace(/`[^`]+`/g, '')              /* code inline */
    .replace(/!\[.*?\]\(.*?\)/g, '')      /* images */
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') /* liens */
    .replace(/>\s*/gm, '')                /* blockquotes */
    .replace(/---+/g, '')                 /* séparateurs */
    .replace(/\n{3,}/g, '\n')            /* sauts multiples */
    .trim();
}

function _onSpeakEnd() {
  /* Remettre l'orbe en idle après la voix */
  if (window.EvaCharacter && typeof window.EvaCharacter.setIdle === 'function') {
    try { window.EvaCharacter.setIdle(); } catch(e) {}
  }
  if (window.setEvaStatusHeader) {
    try { window.setEvaStatusHeader(null); } catch(e) {}
  }
}

function _updateSkipBtn() {
  if (!_skipTtsBtn) _skipTtsBtn = document.getElementById('skipTtsBtn');
  if (_skipTtsBtn) _skipTtsBtn.style.display = _speaking ? 'inline-flex' : 'none';
}

/* ════════════════════════════════════════════════════════════════
   API PUBLIQUE — window.EVATTS
   ════════════════════════════════════════════════════════════════ */

window.EVATTS = {

  /**
   * speakText(text, config)
   * Lecture simple d'un texte (nettoyé automatiquement)
   */
  speakText: function(text, config) {
    if (_muted || !text) return;
    var clean = _cleanForTts(text);
    if (!clean) return;
    _currentText = clean;

    var engine = _getEngine(config);
    if (engine && typeof engine.speak === 'function') {
      _speaking = true;
      _updateSkipBtn();
      /* Utiliser l'Orbe si disponible */
      if (window.EvaCharacter && typeof window.EvaCharacter.setSpeaking === 'function') {
        try { window.EvaCharacter.setSpeaking(); } catch(e) {}
      }
      engine.speak(clean, config,
        function onStart() { _speaking = true; _updateSkipBtn(); },
        function onEnd()   { _speaking = false; _updateSkipBtn(); _onSpeakEnd(); }
      );
    } else {
      /* Fallback Web Speech */
      _speakNative(clean, config);
    }
  },

  /**
   * speakTextStreaming(text, config)
   * Alias de speakText — compatibilité avec le code existant
   * Stoppe la voix en cours avant de démarrer la nouvelle
   */
  speakTextStreaming: function(text, config) {
    this.stopTTS();
    var self = this;
    /* Petit délai pour laisser l'arrêt prendre effet */
    setTimeout(function() { self.speakText(text, config); }, 120);
  },

  /**
   * stopTTS()
   * Stoppe toute lecture vocale en cours
   */
  stopTTS: function() {
    _speaking = false;
    _updateSkipBtn();
    /* Stopper tous les engines chargés */
    if (window.EvaCustomTTS && typeof window.EvaCustomTTS.stop === 'function') {
      try { window.EvaCustomTTS.stop(); } catch(e) {}
    }
    if (window.KokoroTTS && typeof window.KokoroTTS.stop === 'function') {
      try { window.KokoroTTS.stop(); } catch(e) {}
    }
    if (window.PiperTTS && typeof window.PiperTTS.stop === 'function') {
      try { window.PiperTTS.stop(); } catch(e) {}
    }
    if (_elevenlabsAudio) {
      try { _elevenlabsAudio.pause(); _elevenlabsAudio = null; } catch(e) {}
    }
    if (typeof speechSynthesis !== 'undefined') {
      try { speechSynthesis.cancel(); } catch(e) {}
    }
  },

  /**
   * isSpeaking()
   * Retourne true si une voix est en cours
   */
  isSpeaking: function() {
    if (_speaking) return true;
    if (window.EvaCustomTTS && typeof window.EvaCustomTTS.isPlaying === 'function') {
      try { if (window.EvaCustomTTS.isPlaying()) return true; } catch(e) {}
    }
    if (typeof speechSynthesis !== 'undefined') {
      try { if (speechSynthesis.speaking) return true; } catch(e) {}
    }
    return false;
  },

  /** getMuted() / setMuted() — compatibilité ui-setup.js */
  getMuted:  function() { return _muted; },
  setMuted:  function(val) { _muted = !!val; if (_muted) this.stopTTS(); },

  /** skipTTS() — couper la voix actuelle (bouton header) */
  skipTTS: function() { this.stopTTS(); }
};

/* Exposer skipTTS en global pour le bouton HTML */
window.skipTTS = function() { window.EVATTS.stopTTS(); };

/* Fermer la voix quand l'onglet perd le focus (évite les conflits) */
document.addEventListener('visibilitychange', function() {
  if (document.hidden && window.EVATTS) {
    try { window.EVATTS.stopTTS(); } catch(e) {}
  }
});

})();
