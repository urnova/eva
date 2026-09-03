(function() {
'use strict';

var _onResultCallback = null;
var _onEndCallback = null;
var _isListening = false;
var _useElectronSTT = false;
var _committed = '';

/* ══════════════════════════════════════════════════════════
   DÉTECTION DU CONTEXTE
══════════════════════════════════════════════════════════ */
function _isElectron() {
  return !!(window.eva && window.eva.stt && typeof window.eva.stt.start === 'function');
}

function isSupported() {
  return _isElectron() || !!(window.SpeechRecognition || window.webkitSpeechRecognition) || !!(window.Vosk);
}

/* ══════════════════════════════════════════════════════════
   MODE ELECTRON — Windows SAPI (System.Speech, offline)
   ↳ Priorité maximale sur l'app PC
══════════════════════════════════════════════════════════ */
function _startElectronSTT(onResult, onEnd) {
  _onResultCallback = onResult || null;
  _onEndCallback = onEnd || null;
  _committed = '';

  // Écoute les résultats de la reconnaissance
  window.eva.stt.onResult(function(result) {
    if (!_isListening) return;
    if (result && result.text) {
      _committed += (_committed ? ' ' : '') + result.text.trim();
      if (_onResultCallback) _onResultCallback(_committed, false);
    }
  });

  window.eva.stt.onStopped(function() {
    _isListening = false;
    _useElectronSTT = false;
    if (_onEndCallback) _onEndCallback();
  });

  window.eva.stt.start().then(function(res) {
    if (res && res.success) {
      _isListening = true;
      _useElectronSTT = true;
      console.log('[STT] Windows SAPI (offline) démarré');
    } else {
      console.warn('[STT] SAPI indisponible, fallback navigateur');
      _useElectronSTT = false;
      _startWebSTT(onResult, onEnd);
    }
  }).catch(function(e) {
    console.warn('[STT] Erreur SAPI, fallback navigateur:', e);
    _useElectronSTT = false;
    _startWebSTT(onResult, onEnd);
  });
}

function _stopElectronSTT() {
  _isListening = false;
  _useElectronSTT = false;
  if (window.eva && window.eva.stt) {
    try { window.eva.stt.stop(); } catch(e) {}
    try { window.eva.stt.offAll(); } catch(e) {}
  }
}

/* ══════════════════════════════════════════════════════════
   MODE WEB — webkitSpeechRecognition (Chrome/Chromium)
   ↳ Fallback si SAPI indisponible
══════════════════════════════════════════════════════════ */
var _webRecognition = null;
var _shouldKeepListening = false;

function _buildWebRecognition() {
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return null;
  var r = new SR();
  r.lang = 'fr-FR';
  r.continuous = true;
  r.interimResults = true;
  r.maxAlternatives = 1;

  r.onresult = function(event) {
    var interim = '', newFinal = '';
    for (var i = event.resultIndex; i < event.results.length; i++) {
      var t = event.results[i][0].transcript;
      if (event.results[i].isFinal) { newFinal += t; }
      else { interim += t; }
    }
    if (newFinal) _committed += (_committed ? ' ' : '') + newFinal.trim();
    var display = _committed + (interim ? (_committed ? ' ' : '') + interim : '');
    if (_onResultCallback) _onResultCallback(display, false);
  };

  r.onstart = function() { _isListening = true; };

  r.onend = function() {
    _isListening = false;
    if (_shouldKeepListening) {
      try { r.start(); _isListening = true; }
      catch(e) { _shouldKeepListening = false; if (_onEndCallback) _onEndCallback(); }
    } else {
      if (_onEndCallback) _onEndCallback();
    }
  };

  r.onerror = function(e) {
    if (e.error === 'no-speech' && _shouldKeepListening) return;
    console.warn('[STT] webkitSpeechRecognition erreur:', e.error);
    _isListening = false;
    if (!_shouldKeepListening && _onEndCallback) _onEndCallback();
  };

  return r;
}

function _startWebSTT(onResult, onEnd) {
  _onResultCallback = onResult || null;
  _onEndCallback = onEnd || null;
  _committed = '';
  _shouldKeepListening = true;
  if (!_webRecognition) _webRecognition = _buildWebRecognition();
  if (!_webRecognition) {
    console.error('[STT] Aucun moteur STT disponible');
    if (onEnd) onEnd();
    return false;
  }
  if (_isListening) return true;
  try { _webRecognition.start(); _isListening = true; return true; }
  catch(e) { console.error('[STT] start error:', e); return false; }
}

/* ══════════════════════════════════════════════════════════
   API PUBLIQUE
══════════════════════════════════════════════════════════ */
function startListening(onResult, onEnd) {
  _committed = '';
  if (_isElectron()) {
    _startElectronSTT(onResult, onEnd);
    return true;
  }
  return _startWebSTT(onResult, onEnd);
}

function stopListening() {
  _shouldKeepListening = false;
  if (_useElectronSTT) {
    _stopElectronSTT();
    if (_onEndCallback) _onEndCallback();
    return;
  }
  if (_webRecognition && _isListening) {
    try { _webRecognition.stop(); } catch(e) {}
    _isListening = false;
  }
}

function getIsListening() { return _isListening; }
function getCommitted() { return _committed; }

async function requestMicPermission() {
  try {
    var s = await navigator.mediaDevices.getUserMedia({
      audio: { autoGainControl: false, echoCancellation: true, noiseSuppression: false }
    });
    s.getTracks().forEach(function(t) { t.stop(); });
    return true;
  } catch(e) { return false; }
}

function initSTT() { return isSupported(); }

window.EVASTS = {
  isSupported: isSupported,
  initSTT: initSTT,
  startListening: startListening,
  stopListening: stopListening,
  getIsListening: getIsListening,
  getCommitted: getCommitted,
  requestMicPermission: requestMicPermission
};
})();
