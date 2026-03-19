(function() {
'use strict';

var recognition = null;
var isListening = false;
var onResultCallback = null;
var onEndCallback = null;

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
  recognition.continuous = false;
  recognition.onresult = function(event) {
    var transcript = '';
    var isFinal = false;
    for (var i = event.resultIndex; i < event.results.length; i++) {
      transcript += event.results[i][0].transcript;
      if (event.results[i].isFinal) isFinal = true;
    }
    if (onResultCallback) onResultCallback(transcript, isFinal);
  };
  recognition.onstart = function() { isListening = true; };
  recognition.onend = function() {
    isListening = false;
    if (onEndCallback) onEndCallback();
  };
  recognition.onerror = function(e) {
    isListening = false;
    console.warn('STT error:', e.error);
    if (onEndCallback) onEndCallback();
  };
  return true;
}

function startListening(onResult, onEnd) {
  onResultCallback = onResult || null;
  onEndCallback = onEnd || null;
  if (!recognition) initSTT();
  if (!recognition) return false;
  if (isListening) return true;
  try { recognition.start(); isListening = true; return true; }
  catch(e) { return false; }
}

function stopListening() {
  if (recognition && isListening) { recognition.stop(); isListening = false; }
}

function getIsListening() { return isListening; }

async function requestMicPermission() {
  try {
    var s = await navigator.mediaDevices.getUserMedia({ audio: true });
    s.getTracks().forEach(function(t) { t.stop(); });
    return true;
  } catch(e) { return false; }
}

window.EVASTS = { isSupported, initSTT, startListening, stopListening, getIsListening, requestMicPermission };
})();
