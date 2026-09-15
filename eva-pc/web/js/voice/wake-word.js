/* =============================================================
   WAKE-WORD.JS — Détecteur de Mot de Réveil E.V.A (PC & Web)
   - Moteur principal : Vosk WebAssembly local (100% offline & gratuit)
   - Support hybride : Premier plan (Chat) & Arrière-plan (Mode Jarvis Overlay)
   - Filtrage acoustique & VAD pour 0 charge CPU inutile
   - Prévention d'écho / auto-écoute pendant la parole TTS
   ============================================================= */

(function() {
'use strict';

var isActive = false;
var state = 'idle'; // 'idle' | 'triggered'
var wakeWords = ['eva', 'éva', 'hey eva', 'e.v.a', 'eh va', 'eva,', 'éva,'];
var onCommandCallback = null;
var onWakeCallback = null;
var triggerTimer = null;
var currentUtterance = '';
var _silenceTimer = null;

// Web Audio & Vosk
var _audioStream = null;
var _audioCtx = null;
var _scriptNode = null;
var _recognizer = null;
var _isStarting = false;

// Fallback Web Speech (utilisé seulement si Vosk est indisponible dans un navigateur standard)
var _webRecognition = null;
var _webRestartTimer = null;

/* ══════════════════════════════════════════════════════════
   INITIALISATION
   ══════════════════════════════════════════════════════════ */
function init(config) {
  config = config || {};
  if (config.wakeWords && config.wakeWords.length) {
    wakeWords = config.wakeWords.map(function(w) { return w.toLowerCase().trim(); });
  }
  if (config.onCommand) onCommandCallback = config.onCommand;
  if (config.onWake) onWakeCallback = config.onWake;
}

function isSupported() {
  return true;
}

function isRunning() {
  return isActive;
}

/* ══════════════════════════════════════════════════════════
   VÉRIFICATION PREMIER PLAN VS ARRIÈRE-PLAN
   ══════════════════════════════════════════════════════════ */
async function _isBackground() {
  if (window.eva) {
    if (window.eva.window && typeof window.eva.window.isVisible === 'function') {
      try {
        var vis = await window.eva.window.isVisible();
        return !vis;
      } catch(e) {}
    }
    if (typeof window.eva.isWindowVisible === 'function') {
      try {
        var vis2 = await window.eva.isWindowVisible();
        return !vis2;
      } catch(e) {}
    }
  }
  return document.hidden || !document.hasFocus();
}

/* ══════════════════════════════════════════════════════════
   ANALYSE DU TEXTE & DÉTECTION DU MOT-CLÉ
   ══════════════════════════════════════════════════════════ */
function hasWakeWord(transcript) {
  if (!transcript) return false;
  var t = transcript.toLowerCase().trim();
  return wakeWords.some(function(w) {
    return t === w || t.startsWith(w + ' ') || t.includes(' ' + w + ' ') || t.endsWith(' ' + w) || t.includes(w);
  });
}

function extractCommand(transcript) {
  if (!transcript) return null;
  var t = transcript.toLowerCase();
  var best = -1, bestLen = 0;
  for (var i = 0; i < wakeWords.length; i++) {
    var idx = t.indexOf(wakeWords[i]);
    if (idx !== -1 && wakeWords[i].length > bestLen) {
      best = idx;
      bestLen = wakeWords[i].length;
    }
  }
  if (best === -1) return null;
  var after = transcript.substring(best + bestLen).replace(/^[\s,\.!?]+/, '').trim();
  return after || null;
}

/* ══════════════════════════════════════════════════════════
   DISPATCH DE LA COMMANDE
   ══════════════════════════════════════════════════════════ */
async function _dispatchCommand(cmd) {
  if (!cmd || !cmd.trim()) return;
  var cleanCmd = cmd.trim();
  console.log('[WakeWord] Commande extraite :', cleanCmd);

  var inBackground = await _isBackground();
  if (inBackground) {
    // Mode Jarvis en arrière-plan : bulle overlay + exécution + TTS forcé
    if (typeof window.handleJarvisWakeWord === 'function') {
      window.handleJarvisWakeWord(cleanCmd, cleanCmd);
    } else if (typeof window.handleJarvisVoiceCommand === 'function') {
      window.handleJarvisVoiceCommand(cleanCmd);
    } else if (onCommandCallback) {
      onCommandCallback(cleanCmd);
    }
  } else {
    // Premier plan : affichage et envoi direct dans le chat
    if (window.setEvaStatusHeader) window.setEvaStatusHeader(null);
    if (onCommandCallback) {
      onCommandCallback(cleanCmd);
    } else if (typeof window.sendVoiceCommand === 'function') {
      window.sendVoiceCommand(cleanCmd);
    }
  }
}

/* ══════════════════════════════════════════════════════════
   TRAITEMENT DU FLUX RECONNU
   ══════════════════════════════════════════════════════════ */
function _handleTranscript(text, isFinal) {
  if (!isActive || !text || !text.trim()) return;

  // Anti-écho : ne pas écouter pendant qu'EVA parle ni dans les 800ms suivant l'arrêt de parole
  if (window.EVATTS && typeof window.EVATTS.isSpeaking === 'function' && window.EVATTS.isSpeaking()) {
    return;
  }
  if (window._lastTtsEndTime && (Date.now() - window._lastTtsEndTime < 800)) {
    return;
  }
  // Ne pas interférer avec l'enregistrement manuel au micro
  if (window.EVASTS && typeof window.EVASTS.getIsListening === 'function' && window.EVASTS.getIsListening()) {
    return;
  }

  // Hook prioritaire pour la boucle interactive du Mode Jarvis
  if (typeof window._jarvisListener === 'function') {
    try {
      var handled = window._jarvisListener(text, isFinal);
      if (handled) return;
    } catch(e) {
      console.warn('[WakeWord] Erreur listener Jarvis:', e);
    }
  }

  // Interruption vocale prioritaire d'une tâche CloudWorks en cours
  if (window.S && window.S.cwRunning) {
    var checkInterruption = text.toLowerCase().trim();
    if (/\b(stop|annule|annuler|arrête|arrete|interromps|interrompre|annule tout)\b/i.test(checkInterruption)) {
      console.log('[WakeWord] Interruption vocale CloudWorks détectée :', checkInterruption);
      if (typeof window.cancelCurrentCloudWorksTask === 'function') {
        window.cancelCurrentCloudWorksTask();
      }
      if (typeof window.stopGeneration === 'function') {
        window.stopGeneration();
      }
      if (window.eva && window.eva.overlay) {
        window.eva.overlay.setState('thinking', 'Tâche interrompue.');
      }
      if (window.EVATTS && typeof window.EVATTS.speakText === 'function') {
        window.EVATTS.speakText("J'ai interrompu la tâche CloudWorks.", window.S ? window.S.config : {});
      }
      return;
    }
  }

  function _dispatchFinalCommand(cmdText) {
    if (!cmdText || !cmdText.trim()) return;
    if (triggerTimer) { clearTimeout(triggerTimer); triggerTimer = null; }
    if (_silenceTimer) { clearTimeout(_silenceTimer); _silenceTimer = null; }
    var finalCmd = cmdText.trim();
    console.log('[WakeWord] Commande finalisée et validée :', finalCmd);
    state = 'idle';
    currentUtterance = '';
    _dispatchCommand(finalCmd);
  }

  function _resetTriggerTimeout(ms) {
    if (triggerTimer) clearTimeout(triggerTimer);
    triggerTimer = setTimeout(function() {
      if (state === 'triggered') {
        console.log('[WakeWord] Timeout attente commande -> retour en veille');
        state = 'idle';
        currentUtterance = '';
        if (_silenceTimer) { clearTimeout(_silenceTimer); _silenceTimer = null; }
        if (window.setEvaStatusHeader) window.setEvaStatusHeader(null);
        _isBackground().then(function(isBg) {
          if (isBg && window.eva && window.eva.overlay) {
            window.eva.overlay.hide();
          }
        });
      }
    }, ms || 8000);
  }

  var lower = text.toLowerCase().trim();

  if (state === 'idle') {
    if (hasWakeWord(lower)) {
      console.log('[WakeWord] Mot-clé détecté dans :', lower);
      var cmd = extractCommand(lower);

      state = 'triggered';
      currentUtterance = (cmd && cmd.trim()) ? cmd.trim() : '';
      if (onWakeCallback) onWakeCallback();

      _isBackground().then(function(isBg) {
        if (isBg) {
          if (currentUtterance) {
            if (typeof window.handleJarvisWakeWord === 'function') {
              window.handleJarvisWakeWord(text, null);
            }
            if (window.eva && window.eva.overlay) {
              window.eva.overlay.setState('listening', currentUtterance);
            }
          } else {
            if (typeof window.handleJarvisWakeWord === 'function') {
              window.handleJarvisWakeWord(text, null);
            } else if (window.eva && window.eva.overlay) {
              window.eva.overlay.setState('listening', 'Je vous écoute... Posez votre question.');
              window.eva.overlay.show();
            }
          }
        } else {
          if (window.setEvaStatusHeader) {
            window.setEvaStatusHeader('🎤 ' + (currentUtterance || 'PARLEZ MAINTENANT...'), 'listening');
          }
        }
      });

      // Si Vosk a déjà finalisé avec une consigne valide
      if (isFinal && currentUtterance && currentUtterance.length > 1) {
        _dispatchFinalCommand(currentUtterance);
        return;
      }

      // Si consigne déjà partiellement prononcée dans le premier flux
      if (currentUtterance && currentUtterance.length > 1) {
        if (_silenceTimer) clearTimeout(_silenceTimer);
        _silenceTimer = setTimeout(function() {
          if (state === 'triggered' && currentUtterance && currentUtterance.length > 1) {
            _dispatchFinalCommand(currentUtterance);
          }
        }, 1100);
      }

      _resetTriggerTimeout(8000);
    }
  } else if (state === 'triggered') {
    // Dans l'état triggered, toute parole suivante constitue la consigne
    var candidateCmd = extractCommand(lower) || lower;
    candidateCmd = candidateCmd.trim();

    if (candidateCmd.length > 1) {
      currentUtterance = candidateCmd;

      // 1. Retour visuel temps réel sur la bulle
      _isBackground().then(function(isBg) {
        if (isBg && window.eva && window.eva.overlay) {
          window.eva.overlay.setState('listening', currentUtterance);
        } else if (window.setEvaStatusHeader) {
          window.setEvaStatusHeader('🎤 ' + currentUtterance, 'listening');
        }
      });

      // 2. Repousser le timeout d'inactivité global car l'utilisateur parle
      _resetTriggerTimeout(8000);

      // 3. Détection de fin de parole :
      // A. Si Vosk donne isFinal -> dispatch immédiat
      if (isFinal) {
        _dispatchFinalCommand(currentUtterance);
        return;
      }

      // B. VAD silence : 1.1s de silence après la parole -> validation automatique
      if (_silenceTimer) clearTimeout(_silenceTimer);
      _silenceTimer = setTimeout(function() {
        if (state === 'triggered' && currentUtterance && currentUtterance.length > 1) {
          console.log('[WakeWord] Silence détecté (1.1s) -> validation commande :', currentUtterance);
          _dispatchFinalCommand(currentUtterance);
        }
      }, 1100);
    }
  }
}

/* ══════════════════════════════════════════════════════════
   MOTEUR VOSK WEBASSEMBLY (LOCAL)
   ══════════════════════════════════════════════════════════ */
async function _startVoskRecognizer() {
  try {
    if (!window.EVASTS || typeof window.EVASTS.createRecognizer !== 'function') {
      return false;
    }

    _recognizer = await window.EVASTS.createRecognizer(16000);
    if (!_recognizer) return false;

    var AudioContextClass = window.AudioContext || window.webkitAudioContext;
    _audioCtx = new AudioContextClass({ sampleRate: 16000 });

    _audioStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: 16000,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });

    _recognizer.on('result', function(msg) {
      var txt = msg && msg.result && msg.result.text;
      if (txt) _handleTranscript(txt, true);
    });

    _recognizer.on('partialresult', function(msg) {
      var part = msg && msg.result && msg.result.partial;
      if (part) _handleTranscript(part, false);
    });

    var source = _audioCtx.createMediaStreamSource(_audioStream);
    _scriptNode = _audioCtx.createScriptProcessor(4096, 1, 1);
    _scriptNode.onaudioprocess = function(ev) {
      if (!isActive || !_recognizer) return;
      if (window.EVATTS && typeof window.EVATTS.isSpeaking === 'function' && window.EVATTS.isSpeaking()) return;
      try {
        _recognizer.acceptWaveform(ev.inputBuffer);
      } catch(e) {}
    };

    source.connect(_scriptNode);
    _scriptNode.connect(_audioCtx.destination);
    console.log('[WakeWord] Écoute locale Vosk active ✓');
    return true;
  } catch(err) {
    console.warn('[WakeWord] Échec démarrage Vosk:', err);
    return false;
  }
}

/* ══════════════════════════════════════════════════════════
   FALLBACK WEB SPEECH (POUR NAVIGATEURS CHROME/EDGE PURS)
   ══════════════════════════════════════════════════════════ */
function _startWebFallback() {
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return;

  try {
    if (!_webRecognition) {
      _webRecognition = new SR();
      _webRecognition.lang = 'fr-FR';
      _webRecognition.continuous = true;
      _webRecognition.interimResults = true;

      _webRecognition.onresult = function(ev) {
        for (var i = ev.resultIndex; i < ev.results.length; i++) {
          var item = ev.results[i];
          var t = item[0].transcript;
          _handleTranscript(t, item.isFinal);
        }
      };

      _webRecognition.onend = function() {
        if (isActive) {
          if (_webRestartTimer) clearTimeout(_webRestartTimer);
          _webRestartTimer = setTimeout(function() {
            if (isActive && _webRecognition) {
              try { _webRecognition.start(); } catch(e) {}
            }
          }, 400);
        }
      };

      _webRecognition.onerror = function(e) {
        if (e.error === 'network') {
          console.warn('[WakeWord] Fallback Web Speech indisponible en environnement Electron.');
          return;
        }
        if (isActive) {
          if (_webRestartTimer) clearTimeout(_webRestartTimer);
          _webRestartTimer = setTimeout(function() {
            if (isActive && _webRecognition) {
              try { _webRecognition.start(); } catch(e2) {}
            }
          }, 1000);
        }
      };
    }

    _webRecognition.start();
  } catch(e) {}
}

/* ══════════════════════════════════════════════════════════
   CONTRÔLE MARCHE / ARRÊT
   ══════════════════════════════════════════════════════════ */
async function start() {
  if (isActive || _isStarting) return;
  _isStarting = true;
  isActive = true;
  state = 'idle';
  currentUtterance = '';

  try {
    var voskOk = await _startVoskRecognizer();
    if (!voskOk) {
      _startWebFallback();
    }
  } finally {
    _isStarting = false;
  }
}

function stop() {
  isActive = false;
  state = 'idle';
  currentUtterance = '';

  if (triggerTimer) { clearTimeout(triggerTimer); triggerTimer = null; }
  if (_webRestartTimer) { clearTimeout(_webRestartTimer); _webRestartTimer = null; }

  // Arrêt Audio & Vosk
  if (_scriptNode) {
    try { _scriptNode.disconnect(); } catch(e) {}
    _scriptNode = null;
  }
  if (_audioCtx) {
    try { _audioCtx.close(); } catch(e) {}
    _audioCtx = null;
  }
  if (_recognizer) {
    try { _recognizer.remove(); } catch(e) {}
    _recognizer = null;
  }
  if (_audioStream) {
    try {
      _audioStream.getTracks().forEach(function(t) { t.stop(); });
    } catch(e) {}
    _audioStream = null;
  }

  // Arrêt Web Speech
  if (_webRecognition) {
    try { _webRecognition.stop(); } catch(e) {}
    _webRecognition = null;
  }

  if (window.setEvaStatusHeader) window.setEvaStatusHeader(null);
  console.log('[WakeWord] Veille vocale arrêtée.');
}

window.EVAWakeWord = {
  init: init,
  start: start,
  stop: stop,
  isRunning: isRunning,
  isSupported: isSupported
};

})();
