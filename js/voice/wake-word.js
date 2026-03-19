(function() {
'use strict';

var recognition = null;
var isActive = false;
var wakeWords = ['hey eva', 'eva', 'e.v.a', 'éva', 'hé eva'];
var onDetectedCallback = null;
var restartTimer = null;
var COOLDOWN = false;

function init(config) {
  config = config || {};
  if (config.wakeWords && config.wakeWords.length) wakeWords = config.wakeWords;
  if (config.onDetected) onDetectedCallback = config.onDetected;
}

function buildRecognition() {
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return null;
  var r = new SR();
  r.lang = 'fr-FR';
  r.continuous = true;
  r.interimResults = true;
  r.maxAlternatives = 1;

  r.onresult = function(event) {
    if (COOLDOWN) return;
    for (var i = event.resultIndex; i < event.results.length; i++) {
      var transcript = event.results[i][0].transcript.toLowerCase().trim();
      var hit = wakeWords.some(function(w) { return transcript.includes(w); });
      if (hit) {
        COOLDOWN = true;
        setTimeout(function() { COOLDOWN = false; }, 2000);
        if (onDetectedCallback) onDetectedCallback();
        break;
      }
    }
  };

  r.onend = function() {
    if (!isActive) return;
    if (restartTimer) clearTimeout(restartTimer);
    restartTimer = setTimeout(function() {
      if (isActive && recognition) {
        try { recognition.start(); } catch(e) {}
      }
    }, 300);
  };

  r.onerror = function(e) {
    if (!isActive) return;
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
      console.warn('[WakeWord] Microphone non autorisé, wake word désactivé.');
      isActive = false;
      return;
    }
    if (restartTimer) clearTimeout(restartTimer);
    restartTimer = setTimeout(function() {
      if (isActive && recognition) {
        try { recognition.start(); } catch(e2) {}
      }
    }, 800);
  };

  return r;
}

function isSupported() {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

function start() {
  if (!isSupported()) {
    console.warn('[WakeWord] API SpeechRecognition non disponible.');
    return;
  }
  if (isActive) return;
  isActive = true;
  COOLDOWN = false;

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
  COOLDOWN = false;
  if (restartTimer) { clearTimeout(restartTimer); restartTimer = null; }
  if (recognition) {
    try { recognition.stop(); } catch(e) {}
    recognition = null;
  }
}

function isRunning() { return isActive; }

window.EVAWakeWord = { init: init, start: start, stop: stop, isRunning: isRunning, isSupported: isSupported };
})();
