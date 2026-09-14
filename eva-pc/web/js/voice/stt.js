/* =============================================================
   STT.JS — Moteur de Reconnaissance Vocale E.V.A (PC & Web)
   - Support Vosk WebAssembly local ultra-rapide (zéro dépendance)
   - Mode Web : webkitSpeechRecognition (Standard Chrome / Edge)
   - IPC natif optionnel
   - Maintien continu de l'écoute sans désactivation intempestive
   - 100% gratuit, fiable et robuste
   ============================================================= */

(function() {
'use strict';

var _onResultCallback = null;
var _onEndCallback = null;
var _isListening = false;
var _committed = '';

// Audio context & stream
var _mediaStream = null;
var _audioCtx = null;
var _scriptProcessor = null;

// Vosk WebAssembly
var _voskModel = null;
var _voskRecognizer = null;
var _voskLoading = false;

// Web Speech API
var _webRecognition = null;
var _shouldKeepListening = false;

/* ══════════════════════════════════════════════════════════
   DÉTECTION DU CONTEXTE
   ══════════════════════════════════════════════════════════ */
function _isElectron() {
  return !!(window.eva && window.eva.stt && typeof window.eva.stt.start === 'function');
}

function isSupported() {
  return true;
}

/* ══════════════════════════════════════════════════════════
   MOTEUR VOSK WEBASSEMBLY (LOCAL & GRATUIT)
   ══════════════════════════════════════════════════════════ */
async function _initVoskModel() {
  if (_voskModel) return _voskModel;
  if (_voskLoading) {
    while (_voskLoading) {
      await new Promise(function(r) { setTimeout(r, 100); });
    }
    return _voskModel;
  }

  if (typeof window.Vosk === 'undefined' || !window.Vosk.createModel) {
    return null;
  }

  try {
    _voskLoading = true;
    console.log('[STT Vosk] Chargement du modèle acoustique français...');
    var modelUrl = '/models/vosk-model-small-fr.tar.gz';
    _voskModel = await window.Vosk.createModel(modelUrl);
    console.log('[STT Vosk] Modèle chargé avec succès !');
    return _voskModel;
  } catch(e) {
    console.warn('[STT Vosk] Impossible de charger le modèle Vosk:', e);
    return null;
  } finally {
    _voskLoading = false;
  }
}

// Auto-warm Vosk model immédiatement en tâche de fond
setTimeout(function() {
  _initVoskModel().catch(function() {});
}, 300);

async function _startVoskSTT(stream, onResult) {
  try {
    var model = await _initVoskModel();
    if (!model) return false;

    var AudioContextClass = window.AudioContext || window.webkitAudioContext;
    _audioCtx = new AudioContextClass({ sampleRate: 16000 });
    _voskRecognizer = new model.KaldiRecognizer(16000);

    _voskRecognizer.on('result', function(message) {
      if (!_isListening) return;
      var text = message && message.result && message.result.text;
      if (text && text.trim()) {
        _committed += (_committed ? ' ' : '') + text.trim();
        if (_onResultCallback) _onResultCallback(_committed, true);
      }
    });

    _voskRecognizer.on('partialresult', function(message) {
      if (!_isListening) return;
      var partial = message && message.result && message.result.partial;
      if (partial && partial.trim()) {
        var currentDisplay = _committed + (_committed ? ' ' : '') + partial.trim();
        if (_onResultCallback) _onResultCallback(currentDisplay, false);
      }
    });

    var source = _audioCtx.createMediaStreamSource(stream);
    _scriptProcessor = _audioCtx.createScriptProcessor(4096, 1, 1);
    _scriptProcessor.onaudioprocess = function(event) {
      if (!_isListening || !_voskRecognizer) return;
      try {
        _voskRecognizer.acceptWaveform(event.inputBuffer);
      } catch(e) {}
    };

    source.connect(_scriptProcessor);
    _scriptProcessor.connect(_audioCtx.destination);
    console.log('[STT Vosk] Reconnaissance locale démarrée ✓');
    return true;
  } catch(err) {
    console.warn('[STT Vosk] Erreur démarrage:', err);
    return false;
  }
}

/* ══════════════════════════════════════════════════════════
   MODE WEB — webkitSpeechRecognition (Standard Chrome/Edge)
   ══════════════════════════════════════════════════════════ */
function _buildWebRecognition() {
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return null;
  try {
    var r = new SR();
    r.lang = 'fr-FR';
    r.continuous = true;
    r.interimResults = true;
    r.maxAlternatives = 1;

    r.onresult = function(event) {
      if (!_isListening) return;
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
      if (_isListening && _shouldKeepListening) {
        try { r.start(); } catch(e) {}
      }
    };

    r.onerror = function(e) {
      if (e.error === 'no-speech' && _shouldKeepListening) return;
      console.warn('[STT] Web Speech info:', e.error);
    };

    return r;
  } catch(e) {
    return null;
  }
}

/* ══════════════════════════════════════════════════════════
   API PUBLIQUE
   ══════════════════════════════════════════════════════════ */
async function startListening(onResult, onEnd) {
  if (_isListening) {
    stopListening();
    return true;
  }

  _onResultCallback = onResult || null;
  _onEndCallback = onEnd || null;
  _committed = '';
  _isListening = true;
  _shouldKeepListening = true;

  try {
    // 1. Capture microphone Web Audio standard (infaillible sous Electron)
    _mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: 16000,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });

    // 2. Démarrage de Vosk en priorité
    var voskStarted = await _startVoskSTT(_mediaStream, onResult);
    if (!voskStarted) {
      // 3. Fallback Web Speech Recognition
      if (!_webRecognition) _webRecognition = _buildWebRecognition();
      if (_webRecognition) {
        try { _webRecognition.start(); } catch(e) {}
      }

      // 4. Si IPC Electron disponible, écouter aussi en parallèle
      if (_isElectron()) {
        try {
          window.eva.stt.onResult(function(result) {
            if (!_isListening || !result || !result.text) return;
            if (result.isFinal) {
              _committed += (_committed ? ' ' : '') + result.text.trim();
              if (_onResultCallback) _onResultCallback(_committed, true);
            } else {
              var interim = _committed + (_committed ? ' ' : '') + result.text.trim();
              if (_onResultCallback) _onResultCallback(interim, false);
            }
          });
          window.eva.stt.start().catch(function() {});
        } catch(ipcErr) {}
      }
    }

    return true;
  } catch(err) {
    console.error('[STT] Impossible d\'accéder au microphone:', err);
    _isListening = false;
    _shouldKeepListening = false;
    if (typeof toast === 'function') toast('Erreur micro : ' + err.message, 'error');
    if (_onEndCallback) _onEndCallback();
    return false;
  }
}

function stopListening() {
  if (!_isListening) return;
  _isListening = false;
  _shouldKeepListening = false;

  // Nettoyage Vosk
  if (_scriptProcessor) {
    try { _scriptProcessor.disconnect(); } catch(e) {}
    _scriptProcessor = null;
  }
  if (_audioCtx) {
    try { _audioCtx.close(); } catch(e) {}
    _audioCtx = null;
  }
  if (_voskRecognizer) {
    try { _voskRecognizer.remove(); } catch(e) {}
    _voskRecognizer = null;
  }

  // Nettoyage Web Speech
  if (_webRecognition) {
    try { _webRecognition.stop(); } catch(e) {}
  }

  // Nettoyage flux micro
  if (_mediaStream) {
    try {
      _mediaStream.getTracks().forEach(function(t) { t.stop(); });
    } catch(e) {}
    _mediaStream = null;
  }

  // Nettoyage Electron IPC
  if (_isElectron()) {
    try { window.eva.stt.stop(); } catch(e) {}
  }

  // Notifier le callback de fin une fois arrêté
  if (_onEndCallback) {
    var cb = _onEndCallback;
    _onEndCallback = null;
    cb();
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

function initSTT() { return true; }

window.EVASTS = {
  isSupported: isSupported,
  initSTT: initSTT,
  startListening: startListening,
  stopListening: stopListening,
  getIsListening: getIsListening,
  getCommitted: getCommitted,
  requestMicPermission: requestMicPermission,
  initVosk: _initVoskModel,
  getModel: function() { return _voskModel; },
  createRecognizer: async function(sr) {
    var m = await _initVoskModel();
    return m ? new m.KaldiRecognizer(sr || 16000) : null;
  }
};

})();
