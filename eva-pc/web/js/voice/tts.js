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

/* ── Helper de secours vocal gratuit (EvaCustomTTS / Web Speech / SAPI) sans jamais bloquer le cycle ── */
var _lastTtsWarningTime = 0;
function _notifyTtsFallback(toastMsg, vocalNotice, originalText, cfg, onStart, onEnd) {
  if (window.toast) {
    try { window.toast(toastMsg, 'warning'); } catch(_) {}
  }
  var now = Date.now();
  var textToSpeak = originalText;
  // Ne vocaliser l'avertissement qu'une fois toutes les 5 minutes pour ne pas saturer l'écoute
  if (now - _lastTtsWarningTime > 5 * 60 * 1000) {
    _lastTtsWarningTime = now;
    textToSpeak = vocalNotice ? (vocalNotice + ' ' + originalText) : originalText;
  }
  _speakFallback(textToSpeak, cfg, onStart, onEnd);
}

function _speakFallback(text, config, onStart, onEnd) {
  if (onStart) onStart();

  // 1. Tenter le moteur neuronal gratuit Piper VITS (EvaCustomTTS)
  if (window.EvaCustomTTS && typeof window.EvaCustomTTS.speak === 'function') {
    try {
      window.EvaCustomTTS.speak(text, config,
        function() { if (onStart) onStart(); },
        function() {
          window._lastTtsEndTime = Date.now();
          if (onEnd) onEnd();
        }
      );
      return;
    } catch(e) {
      console.warn('[EVA TTS] Échec EvaCustomTTS fallback:', e);
    }
  }

  // 2. Tenter Web Speech API standard
  if (typeof speechSynthesis !== 'undefined') {
    try {
      var utt = new SpeechSynthesisUtterance(text);
      utt.lang = 'fr-FR';
      utt.rate = 0.95;
      utt.onend = function() {
        window._lastTtsEndTime = Date.now();
        if (onEnd) onEnd();
      };
      utt.onerror = function() {
        window._lastTtsEndTime = Date.now();
        if (onEnd) onEnd();
      };
      speechSynthesis.speak(utt);
      return;
    } catch(e) {}
  }

  // 3. Tenter SAPI Windows si disponible sur PC
  if (window.eva && window.eva.tts) {
    window.eva.tts.speak(text).then(function() {
      window._lastTtsEndTime = Date.now();
      if (onEnd) onEnd();
    }).catch(function() {
      window._lastTtsEndTime = Date.now();
      if (onEnd) onEnd();
    });
  } else {
    window._lastTtsEndTime = Date.now();
    if (onEnd) onEnd();
  }
}

/* ── Appel le bon engine selon la config (Respect absolu du provider choisi) ── */
function _getEngine(config) {
  var prov = (config && config.voiceProvider) ||
             (window.S && window.S.config && window.S.config.voiceProvider) ||
             (typeof localStorage !== 'undefined' ? localStorage.getItem('eva_voice_provider') : null) ||
             'elevenlabs';

  if (prov === 'eva-custom' || prov === 'piper-vits') {
    return window.EvaCustomTTS || null;
  }
  if (prov === 'kokoro' || prov === 'eva') {
    return window.KokoroTTS || window.EvaCustomTTS || null;
  }
  if (prov === 'piper') {
    return window.PiperTTS || window.EvaCustomTTS || null;
  }
  if (prov === 'sapi') {
    if (window.eva && window.eva.tts) {
      return {
        speak: function(text, cfg, onStart, onEnd) {
          if (onStart) onStart();
          window.eva.tts.speak(text).then(function() {
            window._lastTtsEndTime = Date.now();
            if (onEnd) onEnd();
          }).catch(function() {
            window._lastTtsEndTime = Date.now();
            if (onEnd) onEnd();
          });
        },
        stop: function() {
          window.eva.tts.stop();
          window._lastTtsEndTime = Date.now();
        },
        isReady: function() { return true; }
      };
    }
  }
  if (prov === 'elevenlabs') {
    /* Engine ElevenLabs inline — Haute fidélité audio */
    return {
      speak: function(text, cfg, onStart, onEnd) {
        var key = (cfg && cfg.elevenLabsApiKey) ||
                  (window.S && window.S.config && window.S.config.elevenLabsApiKey) ||
                  (typeof localStorage !== 'undefined' ? localStorage.getItem('eva_elevenlabs_key') : null);
        var voiceId = (cfg && cfg.elevenLabsVoiceId) ||
                      (window.S && window.S.config && window.S.config.elevenLabsVoiceId) ||
                      (typeof localStorage !== 'undefined' ? localStorage.getItem('eva_elevenlabs_voice') : null) ||
                      '21m00Tcm4TlvDq8ikWAM'; /* Rachel par défaut */

        if (!key) {
          console.warn('[EVA TTS] ElevenLabs : clé API manquante, bascule sur synthèse gratuite.');
          _notifyTtsFallback(
            "Clé ElevenLabs manquante — Voix gratuite active",
            "La clé ElevenLabs n'est pas configurée. Je bascule sur la voix gratuite.",
            text, cfg, onStart, onEnd
          );
          return;
        }

        if (onStart) onStart();

        fetch('https://api.elevenlabs.io/v1/text-to-speech/' + encodeURIComponent(voiceId) + '/stream', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'xi-api-key': key
          },
          body: JSON.stringify({
            text: text,
            model_id: 'eleven_multilingual_v2',
            voice_settings: { stability: 0.45, similarity_boost: 0.80 }
          })
        }).then(function(r) {
          if (r.status === 429) {
            throw new Error('QUOTA_EXCEEDED');
          }
          if (r.status === 401 || r.status === 403) {
            throw new Error('INVALID_KEY');
          }
          if (!r.ok) throw new Error('ElevenLabs HTTP ' + r.status);
          return r.blob();
        }).then(function(blob) {
          var url = URL.createObjectURL(blob);
          _elevenlabsAudio = new Audio(url);
          _elevenlabsAudio.onended = function() {
            try { URL.revokeObjectURL(url); } catch(e) {}
            _elevenlabsAudio = null;
            window._lastTtsEndTime = Date.now();
            if (onEnd) onEnd();
          };
          _elevenlabsAudio.onerror = function() {
            try { URL.revokeObjectURL(url); } catch(e) {}
            _elevenlabsAudio = null;
            window._lastTtsEndTime = Date.now();
            if (onEnd) onEnd();
          };
          _elevenlabsAudio.play().catch(function(e) {
            console.warn('[EVA TTS] Lecture audio ElevenLabs bloquée:', e);
            _elevenlabsAudio = null;
            window._lastTtsEndTime = Date.now();
            if (onEnd) onEnd();
          });
        }).catch(function(e) {
          console.error('[EVA TTS] ElevenLabs erreur:', e);
          _elevenlabsAudio = null;
          var msg = (e && e.message) ? e.message : String(e);
          if (msg.includes('QUOTA_EXCEEDED') || msg.includes('429') || msg.includes('quota') || msg.includes('credit')) {
            _notifyTtsFallback(
              "Quota vocal ElevenLabs atteint",
              "Votre quota ElevenLabs est épuisé. Je bascule sur la voix gratuite.",
              text, cfg, null, onEnd
            );
          } else if (msg.includes('INVALID_KEY') || msg.includes('401') || msg.includes('403')) {
            _notifyTtsFallback(
              "Clé ElevenLabs invalide",
              "Votre clé ElevenLabs est invalide. Je bascule sur la voix gratuite.",
              text, cfg, null, onEnd
            );
          } else {
            _notifyTtsFallback(
              "ElevenLabs indisponible — Voix gratuite active",
              "Le service ElevenLabs est indisponible. Je bascule sur la voix gratuite.",
              text, cfg, null, onEnd
            );
          }
        });
      },
      stop: function() {
        if (_elevenlabsAudio) {
          try { _elevenlabsAudio.pause(); } catch(e) {}
          _elevenlabsAudio = null;
        }
        window._lastTtsEndTime = Date.now();
      },
      isReady: function() { return true; }
    };
  }
  if (prov === 'openai') {
    return {
      speak: function(text, cfg, onStart, onEnd) {
        var key = (cfg && (cfg.openAITTSApiKey || cfg.openaiApiKey)) ||
                  (window.S && window.S.config && (window.S.config.openAITTSApiKey || window.S.config.openaiApiKey));
        var voice = (cfg && cfg.openAITTSVoice) ||
                    (window.S && window.S.config && window.S.config.openAITTSVoice) || 'nova';
        if (!key) {
          console.warn('[EVA TTS] OpenAI TTS : clé API manquante, fallback gratuit.');
          _notifyTtsFallback(
            "Clé OpenAI TTS manquante",
            "La clé OpenAI n'est pas configurée. Je bascule sur la voix gratuite.",
            text, cfg, onStart, onEnd
          );
          return;
        }
        if (onStart) onStart();
        fetch('https://api.openai.com/v1/audio/speech', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
          body: JSON.stringify({ model: 'tts-1', input: text, voice: voice, response_format: 'mp3' })
        }).then(function(r) {
          if (r.status === 429) throw new Error('QUOTA_EXCEEDED');
          if (r.status === 401 || r.status === 403) throw new Error('INVALID_KEY');
          if (!r.ok) throw new Error('OpenAI TTS HTTP ' + r.status);
          return r.blob();
        }).then(function(blob) {
          var url = URL.createObjectURL(blob);
          window._openaiAudio = new Audio(url);
          window._openaiAudio.onended = function() {
            try { URL.revokeObjectURL(url); } catch(e) {}
            window._openaiAudio = null;
            window._lastTtsEndTime = Date.now();
            if (onEnd) onEnd();
          };
          window._openaiAudio.onerror = function() {
            try { URL.revokeObjectURL(url); } catch(e) {}
            window._openaiAudio = null;
            window._lastTtsEndTime = Date.now();
            if (onEnd) onEnd();
          };
          window._openaiAudio.play().catch(function() {
            window._openaiAudio = null;
            window._lastTtsEndTime = Date.now();
            if (onEnd) onEnd();
          });
        }).catch(function(e) {
          console.error('[EVA TTS] OpenAI TTS erreur:', e);
          window._openaiAudio = null;
          var msg = (e && e.message) ? e.message : String(e);
          if (msg.includes('QUOTA_EXCEEDED') || msg.includes('429') || msg.includes('quota')) {
            _notifyTtsFallback(
              "Quota vocal OpenAI atteint",
              "Votre quota OpenAI est épuisé. Je bascule sur la voix gratuite.",
              text, cfg, null, onEnd
            );
          } else {
            _notifyTtsFallback(
              "OpenAI TTS indisponible",
              "Le service OpenAI TTS est indisponible. Je bascule sur la voix gratuite.",
              text, cfg, null, onEnd
            );
          }
        });
      },
      stop: function() {
        if (window._openaiAudio) {
          try { window._openaiAudio.pause(); } catch(e) {}
          window._openaiAudio = null;
        }
        window._lastTtsEndTime = Date.now();
      },
      isReady: function() { return true; }
    };
  }
  /* 'native' / fallback */
  return null; /* on utilisera Web Speech directement */
}

/* ── Fallback Web Speech — optimisé pour Electron (voix chargées en async) ── */
var _voicesReady = false;
var _voicesCache = null;

function _ensureVoices(cb) {
  if (_voicesReady && _voicesCache) { cb(_voicesCache); return; }
  if (typeof speechSynthesis === 'undefined') { cb([]); return; }

  var voices = speechSynthesis.getVoices();
  if (voices && voices.length > 0) {
    _voicesCache = voices; _voicesReady = true; cb(voices); return;
  }
  /* Electron / Chromium charge les voix de manière asynchrone */
  speechSynthesis.onvoiceschanged = function() {
    _voicesCache = speechSynthesis.getVoices() || [];
    _voicesReady = true;
    cb(_voicesCache);
  };
  /* Timeout de sécurité 2s */
  setTimeout(function() {
    if (!_voicesReady) {
      _voicesCache = speechSynthesis.getVoices() || [];
      _voicesReady = true;
      cb(_voicesCache);
    }
  }, 2000);
}

function _speakNative(text, config) {
  // === Sur l'app Electron Windows : utiliser PowerShell TTS (System.Speech) ===
  // C'est 100% fiable — ne dépend pas des voix Chromium ou de onvoiceschanged
  if (window.eva && window.eva.system && window.eva.system.exec) {
    _speakPowerShell(text, config);
    return;
  }
  // === Fallback Web Speech API (navigateur ou Electron sans exec) ===
  _speakWebSpeech(text, config);
}

// TTS via PowerShell Windows Speech API — fonctionne toujours sur Windows
function _speakPowerShell(text, config) {
  if (!window.eva || !window.eva.system || !window.eva.system.exec) return;
  // Échapper les guillemets simples pour PowerShell
  var safe = text.replace(/'/g, "''").replace(/[\r\n]+/g, ' ').substring(0, 800);
  var rate = parseFloat(config && config.speechRate);
  // Rate PowerShell: -10 (lent) à +10 (rapide), 0 = normal, 2 = légèrement plus rapide
  var psRate = (rate && rate !== 1.0) ? Math.round((rate - 1.0) * 5) : 1;
  var cmd = [
    'Add-Type -AssemblyName System.Speech;',
    '$s=New-Object System.Speech.Synthesis.SpeechSynthesizer;',
    'try { $s.SelectVoiceByHints([System.Speech.Synthesis.VoiceGender]::Female,[System.Speech.Synthesis.VoiceAge]::Adult,0,[System.Globalization.CultureInfo]::new("fr-FR")) } catch {};',
    '$s.Rate=' + psRate + ';',
    "$s.Speak('" + safe + "');"
  ].join(' ');

  _speaking = true;
  _updateSkipBtn();
  window.eva.system.exec('powershell -Command "' + cmd + '"')
    .then(function() { _speaking = false; _updateSkipBtn(); _onSpeakEnd(); })
    .catch(function(e) {
      console.warn('[EVA TTS] PowerShell TTS échoué:', e && e.message);
      // Fallback Web Speech API
      _speakWebSpeech(text, config);
    });
}

// TTS via Web Speech API (navigateur standard)
function _speakWebSpeech(text, config) {
  if (typeof speechSynthesis === 'undefined') { _speaking = false; return; }
  try { speechSynthesis.cancel(); } catch(e) {}

  _ensureVoices(function(voices) {
    var utt = new SpeechSynthesisUtterance(text);
    utt.lang = 'fr-FR';
    var rate = parseFloat(config && config.speechRate);
    utt.rate  = (rate && rate !== 1.0) ? Math.min(1.2, Math.max(0.75, rate)) : 0.92;
    utt.pitch = 1.15;
    utt.volume = 1.0;

    /* Chercher voix féminine française */
    try {
      var frVoices = voices.filter(function(v) { return v.lang && v.lang.startsWith('fr'); });
      var femKeys = ['Denise','Amelie','Amélie','Audrey','Marie','Virginie','Léa','Lea','Julie','Hortense','Zira'];
      var best = null;
      for (var i = 0; i < femKeys.length; i++) {
        var k = femKeys[i];
        best = frVoices.find(function(v) { return v.name && v.name.includes(k); });
        if (best) break;
      }
      if (!best && frVoices.length) best = frVoices[0];
      if (!best && voices.length) {
        best = voices.find(function(v) { return v.lang && v.lang.startsWith('fr'); }) || null;
      }
      if (best) { utt.voice = best; utt.lang = best.lang; }
    } catch(e) {}

    utt.onend   = function() { _speaking = false; _updateSkipBtn(); _onSpeakEnd(); };
    utt.onerror = function(err) {
      console.warn('[EVA TTS] SpeechSynthesis error:', err);
      _speaking = false; _updateSkipBtn(); _onSpeakEnd();
    };
    _speaking = true;
    _updateSkipBtn();
    try { speechSynthesis.speak(utt); } catch(e) { _speaking = false; _updateSkipBtn(); }
  });
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
  if (window._isJarvisActive && window.eva) {
    // Si une tâche CloudWorks est en cours d'exécution sur le PC, NE PAS lancer le follow-up maintenant !
    // Le follow-up sera déclenché après le compte-rendu vocal final de CloudWorks.
    if (window.S && window.S.cwRunning) {
      console.log('[Jarvis TTS] Tâche CloudWorks en cours sur le PC, report de la relance');
      return;
    }
    // Mode Jarvis interactif : déclencher le suivi UNIQUEMENT après la réponse vocale de l'assistant
    if (window._jarvisState === 'answering' && typeof window.handleJarvisFollowUp === 'function') {
      window.handleJarvisFollowUp();
    }
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
    if ((_muted && !window._isJarvisActive) || !text) return;
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
      try {
        engine.speak(clean, config,
          function onStart() { _speaking = true; _updateSkipBtn(); },
          function onEnd()   { _speaking = false; _updateSkipBtn(); _onSpeakEnd(); }
        );
      } catch(engineErr) {
        /* L'engine custom a planté (ex: modèle Piper absent) → fallback natif */
        console.warn('[EVA TTS] Engine custom error, fallback natif:', engineErr);
        _speaking = false;
        _speakNative(clean, config);
      }
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
    /* Stopper la voix native Windows SAPI si active */
    if (window.eva && window.eva.tts && typeof window.eva.tts.stop === 'function') {
      try { window.eva.tts.stop(); } catch(e) {}
    }
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
    if (window._openaiAudio) {
      try { window._openaiAudio.pause(); window._openaiAudio = null; } catch(e) {}
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
    if (_elevenlabsAudio && !_elevenlabsAudio.paused) return true;
    if (window._openaiAudio && !window._openaiAudio.paused) return true;
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
  // Sur Electron PC, préserver la voix en arrière-plan pour le Mode Jarvis
  if (window.eva) return;
  if (document.hidden && window.EVATTS) {
    try { window.EVATTS.stopTTS(); } catch(e) {}
  }
});

})();
