(function() {
'use strict';

var isActive = false;
var state = 'idle';
var wakeWords = ['eva', 'éva', 'hey eva', 'e.v.a'];
var onCommandCallback = null;
var commandBuffer = '';

function init(config) {
  config = config || {};
  if (config.wakeWords && config.wakeWords.length) wakeWords = config.wakeWords;
  if (config.onCommand) onCommandCallback = config.onCommand;
}

function hasWakeWord(transcript) {
  var t = transcript.toLowerCase().trim();
  return wakeWords.some(function(w) { return t.includes(w); });
}

function extractCommand(transcript) {
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

function fireCommand(cmd) {
  if (!cmd || !cmd.trim()) return;
  if (onCommandCallback) onCommandCallback(cmd.trim());
}

/* ════════════════════════════════════════════════════════
   MODE ELECTRON : réutilise le STT PowerShell via stt.js
   (webkitSpeechRecognition ne fonctionne pas en Electron)
════════════════════════════════════════════════════════ */
function _isElectron() {
  return !!(window.eva && window.eva.stt && typeof window.eva.stt.start === 'function');
}

function _startElectronWakeWord() {
  window.eva.stt.onResult(function(result) {
    if (!isActive || !result || !result.text) return;
    var text = result.text;

    if (state === 'idle') {
      if (hasWakeWord(text)) {
        var cmd = extractCommand(text);
        if (cmd && cmd.length > 1) {
          fireCommand(cmd);
        } else {
          state = 'triggered';
          commandBuffer = '';
          if (window.setEvaStatusHeader) window.setEvaStatusHeader('🎤 PARLEZ...', 'listening');
        }
      }
    } else if (state === 'triggered') {
      commandBuffer = text;
      if (commandBuffer.trim().length > 1) {
        var finalCmd = commandBuffer.trim();
        state = 'idle';
        commandBuffer = '';
        if (window.setEvaStatusHeader) window.setEvaStatusHeader(null);
        fireCommand(finalCmd);
      }
    }
  });

  window.eva.stt.start().then(function(res) {
    if (res && res.success) {
      console.log('[WakeWord] PowerShell STT actif pour la wake word');
    } else {
      console.error('[WakeWord] Impossible de démarrer le STT PowerShell:', res && res.error);
      isActive = false;
    }
  }).catch(function(e) {
    console.error('[WakeWord] Erreur STT:', e);
    isActive = false;
  });
}

/* ════════════════════════════════════════════════════════
   MODE WEB : webkitSpeechRecognition (navigateur seulement)
════════════════════════════════════════════════════════ */
var recognition = null;
var restartTimer = null;

function buildRecognition() {
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return null;
  var r = new SR();
  r.lang = 'fr-FR';
  r.continuous = true;
  r.interimResults = true;
  r.maxAlternatives = 1;

  r.onresult = function(event) {
    for (var i = event.resultIndex; i < event.results.length; i++) {
      var result = event.results[i];
      var transcript = result[0].transcript;
      var isFinal = result.isFinal;

      if (state === 'idle') {
        if (hasWakeWord(transcript)) {
          if (isFinal) {
            var cmd = extractCommand(transcript);
            if (cmd && cmd.length > 1) {
              fireCommand(cmd);
            } else {
              state = 'triggered';
              commandBuffer = '';
              if (window.setEvaStatusHeader) window.setEvaStatusHeader('🎤 PARLEZ...', 'listening');
            }
          }
        }
      } else if (state === 'triggered') {
        commandBuffer = transcript;
        if (isFinal && commandBuffer.trim().length > 1) {
          var finalCmd = commandBuffer.trim();
          state = 'idle';
          commandBuffer = '';
          if (window.setEvaStatusHeader) window.setEvaStatusHeader(null);
          fireCommand(finalCmd);
        }
      }
    }
  };

  r.onend = function() {
    if (state === 'triggered' && commandBuffer.trim().length > 1) {
      var cmd = commandBuffer.trim();
      state = 'idle';
      commandBuffer = '';
      if (window.setEvaStatusHeader) window.setEvaStatusHeader(null);
      fireCommand(cmd);
      return;
    }
    state = 'idle';
    commandBuffer = '';
    if (!isActive) return;
    if (restartTimer) clearTimeout(restartTimer);
    restartTimer = setTimeout(function() {
      if (isActive && recognition) {
        try { recognition.start(); } catch(e) {}
      }
    }, 350);
  };

  r.onerror = function(e) {
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
      console.warn('[WakeWord] Microphone non autorisé.');
      isActive = false;
      state = 'idle';
      return;
    }
    if (e.error === 'network') {
      console.warn('[WakeWord] webkitSpeechRecognition: erreur réseau — clé API Google absente dans Electron.');
      isActive = false;
      return;
    }
    state = 'idle';
    commandBuffer = '';
    if (!isActive) return;
    if (restartTimer) clearTimeout(restartTimer);
    restartTimer = setTimeout(function() {
      if (isActive && recognition) {
        try { recognition.start(); } catch(e2) {}
      }
    }, 1000);
  };

  return r;
}

/* ════════════════════════════════════════════════════════
   API PUBLIQUE
════════════════════════════════════════════════════════ */
function isSupported() {
  return _isElectron() || !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

function start() {
  if (!isSupported()) { console.warn('[WakeWord] Non supporté.'); return; }
  if (isActive) return;
  isActive = true;
  state = 'idle';
  commandBuffer = '';

  if (_isElectron()) {
    _startElectronWakeWord();
    return;
  }

  // Mode web
  if (!recognition) recognition = buildRecognition();
  try {
    recognition.start();
  } catch(e) {
    if (restartTimer) clearTimeout(restartTimer);
    restartTimer = setTimeout(function() {
      if (isActive && recognition) {
        try { recognition.start(); } catch(e2) {}
      }
    }, 500);
  }
}

function stop() {
  isActive = false;
  state = 'idle';
  commandBuffer = '';
  if (restartTimer) { clearTimeout(restartTimer); restartTimer = null; }

  if (_isElectron()) {
    if (window.eva && window.eva.stt) {
      window.eva.stt.stop();
      window.eva.stt.offAll();
    }
  } else {
    if (recognition) {
      try { recognition.stop(); } catch(e) {}
      recognition = null;
    }
  }
  if (window.setEvaStatusHeader) window.setEvaStatusHeader(null);
}

function isRunning() { return isActive; }

window.EVAWakeWord = { init: init, start: start, stop: stop, isRunning: isRunning, isSupported: isSupported };
})();
