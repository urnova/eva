(function() {
'use strict';

var recognition  = null;
var isListening  = false;
var _shouldKeepListening = false;
var _committed   = '';
var onResultCallback = null;
var onEndCallback    = null;

function isSupported() {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

function initSTT() {
  if (!isSupported()) return false;
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SR();
  recognition.lang = 'fr-FR';
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;
  recognition.continuous = true;

  recognition.onresult = function(event) {
    var interim  = '';
    var newFinal = '';
    for (var i = event.resultIndex; i < event.results.length; i++) {
      var t = event.results[i][0].transcript;
      if (event.results[i].isFinal) { newFinal += t; }
      else                          { interim  += t; }
    }
    if (newFinal) {
      _committed += (_committed ? ' ' : '') + newFinal.trim();
    }
    var display = _committed + (interim ? (_committed ? ' ' : '') + interim : '');
    if (onResultCallback) onResultCallback(display, false);
  };

  recognition.onstart = function() { isListening = true; };

  recognition.onend = function() {
    isListening = false;
    if (_shouldKeepListening) {
      try { recognition.start(); isListening = true; }
      catch(e) {
        _shouldKeepListening = false;
        if (onEndCallback) onEndCallback();
      }
    } else {
      if (onEndCallback) onEndCallback();
    }
  };

  recognition.onerror = function(e) {
    if (e.error === 'no-speech' && _shouldKeepListening) return;
    isListening = false;
    console.warn('STT error:', e.error);
    if (!_shouldKeepListening && onEndCallback) onEndCallback();
  };

  return true;
}

function startListening(onResult, onEnd) {
  onResultCallback = onResult || null;
  onEndCallback    = onEnd   || null;
  _committed       = '';
  _shouldKeepListening = true;
  if (!recognition) initSTT();
  if (!recognition) return false;
  if (isListening) return true;
  try { recognition.start(); isListening = true; return true; }
  catch(e) { return false; }
}

function stopListening() {
  _shouldKeepListening = false;
  if (recognition && isListening) {
    try { recognition.stop(); } catch(e) {}
    isListening = false;
  }
  _committed = '';
}

function getIsListening()   { return isListening || _shouldKeepListening; }
function getCommitted()     { return _committed; }

async function requestMicPermission() {
  try {
    var s = await navigator.mediaDevices.getUserMedia({ audio: true });
    s.getTracks().forEach(function(t) { t.stop(); });
    return true;
  } catch(e) { return false; }
}

window.EVASTS = {
  isSupported, initSTT,
  startListening, stopListening,
  getIsListening, getCommitted,
  requestMicPermission
};
})();
