/* =============================================================
   STT.JS — Moteur de Reconnaissance Vocale Cloud (100% Gratuit)
   Architecture : MediaRecorder + Puter.ai (OpenAI Whisper Cloud)
   - Zéro charge CPU/GPU locale
   - Détection d'activité vocale (VAD) et de silence automatique
   - Précision maximale en français avec ponctuation et chiffres
   ============================================================= */

(function() {
'use strict';

var _onResultCallback = null;
var _onEndCallback = null;
var _isListening = false;
var _committed = '';

var _audioStream = null;
var _mediaRecorder = null;
var _audioChunks = [];
var _audioContext = null;
var _analyser = null;
var _silenceTimer = null;
var _maxTimer = null;
var _vadInterval = null;
var _hasSpoken = false;

/* ══════════════════════════════════════════════════════════
   DÉTECTION DU SUPPORT
   ══════════════════════════════════════════════════════════ */
function isSupported() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
}

function initSTT() {
  return isSupported();
}

async function requestMicPermission() {
  try {
    var stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });
    stream.getTracks().forEach(function(t) { t.stop(); });
    return true;
  } catch(e) {
    console.warn('[STT] Accès micro refusé ou indisponible:', e);
    return false;
  }
}

/* ══════════════════════════════════════════════════════════
   CHOIX DU FORMAT AUDIO SUPPORTÉ PAR LE NAVIGATEUR
   ══════════════════════════════════════════════════════════ */
function _getSupportedMimeType() {
  var types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/ogg',
    'audio/mp4',
    'audio/wav'
  ];
  for (var i = 0; i < types.length; i++) {
    if (window.MediaRecorder && MediaRecorder.isTypeSupported(types[i])) {
      return types[i];
    }
  }
  return '';
}

/* ══════════════════════════════════════════════════════════
   DÉTECTION DE SILENCE (VAD - Voice Activity Detection)
   ══════════════════════════════════════════════════════════ */
function _setupVAD(stream) {
  try {
    var AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    _audioContext = new AudioCtx();
    var source = _audioContext.createMediaStreamSource(stream);
    _analyser = _audioContext.createAnalyser();
    _analyser.fftSize = 512;
    _analyser.smoothingTimeConstant = 0.3;
    source.connect(_analyser);

    var dataArray = new Uint8Array(_analyser.frequencyBinCount);
    var silenceStart = null;
    _hasSpoken = false;

    _vadInterval = setInterval(function() {
      if (!_isListening || !_analyser) return;
      _analyser.getByteFrequencyData(dataArray);

      // Calcul du volume moyen RMS
      var sum = 0;
      for (var i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      var avgVolume = sum / dataArray.length;

      // Seuil d'activation de la voix
      if (avgVolume > 14) {
        _hasSpoken = true;
        silenceStart = null;
      } else if (_hasSpoken) {
        // La personne a parlé puis s'est arrêtée
        if (!silenceStart) {
          silenceStart = Date.now();
        } else if (Date.now() - silenceStart > 1300) {
          // 1.3 seconde de silence après la parole -> fin automatique d'enregistrement
          console.log('[STT] Fin de parole détectée (silence 1.3s)');
          stopListening();
        }
      }
    }, 100);
  } catch(e) {
    console.warn('[STT] VAD Web Audio non disponible:', e);
  }
}

function _cleanupVAD() {
  if (_vadInterval) { clearInterval(_vadInterval); _vadInterval = null; }
  if (_silenceTimer) { clearTimeout(_silenceTimer); _silenceTimer = null; }
  if (_maxTimer) { clearTimeout(_maxTimer); _maxTimer = null; }
  if (_audioContext) {
    try { _audioContext.close(); } catch(e) {}
    _audioContext = null;
  }
  _analyser = null;
  _hasSpoken = false;
}

/* ══════════════════════════════════════════════════════════
   ENREGISTREMENT & TRANSCRIPTION CLOUD WHISPER
   ══════════════════════════════════════════════════════════ */
async function startListening(onResult, onEnd) {
  if (_isListening) {
    stopListening();
    return true;
  }

  _onResultCallback = onResult || null;
  _onEndCallback = onEnd || null;
  _committed = '';
  _audioChunks = [];

  try {
    _audioStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });

    var mimeType = _getSupportedMimeType();
    var options = mimeType ? { mimeType: mimeType } : {};
    _mediaRecorder = new MediaRecorder(_audioStream, options);

    _mediaRecorder.ondataavailable = function(e) {
      if (e.data && e.data.size > 0) {
        _audioChunks.push(e.data);
      }
    };

    _mediaRecorder.onstop = async function() {
      _isListening = false;
      _cleanupVAD();

      // Nettoyer les pistes du microphone
      if (_audioStream) {
        _audioStream.getTracks().forEach(function(t) { t.stop(); });
        _audioStream = null;
      }

      if (_audioChunks.length === 0) {
        if (_onEndCallback) _onEndCallback();
        return;
      }

      var recordedBlob = new Blob(_audioChunks, { type: mimeType || 'audio/webm' });
      _audioChunks = [];

      // Si l'enregistrement est trop court (< 0.3s) ou vide
      if (recordedBlob.size < 1200) {
        console.log('[STT] Audio trop court ou vide ignoré');
        if (_onEndCallback) _onEndCallback();
        return;
      }

      // Indiquer visuellement que la transcription est en cours
      if (window.setEvaStatusHeader) {
        window.setEvaStatusHeader('🧠 TRANSCRIPTION...', 'thinking');
      }

      try {
        var textResult = '';

        // Priorité 1 : Puter.js Whisper Cloud (100% gratuit, précis, avec ponctuation)
        if (typeof puter !== 'undefined' && puter.ai && typeof puter.ai.speech2txt === 'function') {
          console.log('[STT] Envoi vers Puter Whisper Cloud...');
          var resp = await puter.ai.speech2txt(recordedBlob, { language: 'fr' });
          if (typeof resp === 'string') {
            textResult = resp;
          } else if (resp && typeof resp.text === 'string') {
            textResult = resp.text;
          } else if (resp && resp.result) {
            textResult = String(resp.result);
          }
        } else {
          console.warn('[STT] Puter.ai non disponible pour la transcription');
        }

        if (textResult && textResult.trim()) {
          var cleanText = textResult.trim();
          // Supprimer les artefacts de ponctuation seuls ou hallucinations silencieuses
          if (cleanText === '.' || cleanText === '...' || cleanText === 'Merci.' || cleanText === 'Sous-titres réalisés par') {
            cleanText = '';
          }

          if (cleanText) {
            _committed = cleanText;
            console.log('[STT] Transcription réussie :', _committed);
            if (_onResultCallback) _onResultCallback(_committed, true);
          }
        }
      } catch(sttErr) {
        console.error('[STT] Erreur de transcription cloud:', sttErr);
        if (typeof toast === 'function') toast('Erreur de transcription audio cloud', 'error');
      } finally {
        if (window.setEvaStatusHeader) window.setEvaStatusHeader(null);
        if (_onEndCallback) _onEndCallback();
      }
    };

    // Démarrer l'enregistrement
    _mediaRecorder.start(250); // tranches de 250ms
    _isListening = true;
    _setupVAD(_audioStream);

    // Arrêt maximal de sécurité après 35 secondes
    _maxTimer = setTimeout(function() {
      if (_isListening) {
        console.log('[STT] Limite max d\'enregistrement atteinte (35s)');
        stopListening();
      }
    }, 35000);

    return true;

  } catch(err) {
    console.error('[STT] Impossible d\'initialiser le micro:', err);
    _isListening = false;
    _cleanupVAD();
    if (typeof toast === 'function') toast('Impossible d\'accéder au micro : ' + err.message, 'error');
    if (onEnd) onEnd();
    return false;
  }
}

function stopListening() {
  if (!_isListening) return;
  _isListening = false;
  _cleanupVAD();

  if (_mediaRecorder && _mediaRecorder.state !== 'inactive') {
    try {
      _mediaRecorder.stop();
    } catch(e) {
      console.warn('[STT] Erreur arrêt mediaRecorder:', e);
      if (_onEndCallback) _onEndCallback();
    }
  } else {
    if (_onEndCallback) _onEndCallback();
  }
}

function getIsListening() { return _isListening; }
function getCommitted() { return _committed; }

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
