(function() {
'use strict';

var isActive = false;
var wakeWords = ['hey eva', 'eva', 'e.v.a'];
var onDetectedCallback = null;

function init(config) {
  config = config || {};
  if (config.wakeWords) wakeWords = config.wakeWords;
  if (config.onDetected) onDetectedCallback = config.onDetected;
}

function start() {
  if (isActive) return;
  if (!window.EVASTS || !window.EVASTS.isSupported()) return;
  isActive = true;
  window.EVASTS.startListening(
    function(transcript, isFinal) {
      if (!isFinal) return;
      var t = transcript.toLowerCase().trim();
      var hit = wakeWords.some(function(w) { return t.includes(w); });
      if (hit && onDetectedCallback) onDetectedCallback();
    },
    function() {
      if (isActive) setTimeout(start, 300);
    }
  );
}

function stop() {
  isActive = false;
  if (window.EVASTS) window.EVASTS.stopListening();
}

function isRunning() { return isActive; }

window.EVAWakeWord = { init, start, stop, isRunning };
})();
