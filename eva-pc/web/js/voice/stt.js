(function() {
'use strict';

var isListening  = false;
var _shouldKeepListening = false;
var _committed   = '';
var onResultCallback = null;
var onEndCallback    = null;

var audioContext = null;
var mediaStream = null;
var sourceNode = null;
var processorNode = null;
var voskModel = null;
var recognizer = null;

function isSupported() {
  return true; // Supported via Vosk WASM
}

async function initSTT() {
  if (voskModel) return true;
  if (!window.Vosk) {
    console.error('[STT] Vosk non chargé.');
    return false;
  }
  try {
    voskModel = await window.Vosk.createModel('/models/vosk-model-small-fr.tar.gz');
    return true;
  } catch (err) {
    console.error('[STT] Erreur chargement modèle Vosk:', err);
    return false;
  }
}

async function startListening(onResult, onEnd) {
  onResultCallback = onResult || null;
  onEndCallback    = onEnd   || null;
  _committed       = '';
  _shouldKeepListening = true;
  
  if (!voskModel) await initSTT();
  if (!voskModel) return false;
  
  if (isListening) return true;

  try {
      if (!recognizer) {
          recognizer = new voskModel.KaldiRecognizer(16000);
          recognizer.setWords(true);
      } else {
          recognizer.reset();
      }

      mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1, sampleRate: 16000 }
      });
      
      audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      sourceNode = audioContext.createMediaStreamSource(mediaStream);
      processorNode = audioContext.createScriptProcessor(4096, 1, 1);
      
      sourceNode.connect(processorNode);
      processorNode.connect(audioContext.destination);
      
      isListening = true;

      processorNode.onaudioprocess = function(e) {
          if (!isListening) return;
          var data = e.inputBuffer.getChannelData(0);
          var isFinal = recognizer.acceptWaveform(data);
          
          if (isFinal) {
              var finalRes = recognizer.result().text || '';
              if (finalRes) {
                  _committed += (_committed ? ' ' : '') + finalRes.trim();
              }
              if (onResultCallback) onResultCallback(_committed, false);
          } else {
              var interimRes = recognizer.partialResult().partial || '';
              var display = _committed + (interimRes ? (_committed ? ' ' : '') + interimRes : '');
              if (onResultCallback) onResultCallback(display, false);
          }
      };
      
      return true;
  } catch(e) {
      console.error('[STT] Erreur microphone:', e);
      isListening = false;
      return false;
  }
}

function stopListening() {
  _shouldKeepListening = false;
  isListening = false;
  
  if (processorNode) {
      processorNode.disconnect();
      processorNode = null;
  }
  if (sourceNode) {
      sourceNode.disconnect();
      sourceNode = null;
  }
  if (mediaStream) {
      mediaStream.getTracks().forEach(function(t) { t.stop(); });
      mediaStream = null;
  }
  if (audioContext) {
      audioContext.close();
      audioContext = null;
  }
  
  // Renvoyer le texte final si on vient de couper
  if (recognizer) {
      var finalRes = recognizer.finalResult().text || '';
      if (finalRes) {
          _committed += (_committed ? ' ' : '') + finalRes.trim();
      }
      if (onResultCallback) onResultCallback(_committed, true); // true = done
  }
  
  if (onEndCallback) {
      onEndCallback();
      onEndCallback = null;
  }
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
