(function() {
'use strict';

var isActive = false;
var state = 'idle'; // idle | triggered
var wakeWords = ['eva', 'éva', 'hey eva', 'e.v.a'];
var onCommandCallback = null;

var audioContext = null;
var mediaStream = null;
var sourceNode = null;
var processorNode = null;
var voskModel = null;
var recognizer = null;

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

function isSupported() {
  return true; // We use Vosk WebAssembly now, supported everywhere!
}

async function loadVoskModel() {
  if (voskModel) return voskModel;
  if (!window.Vosk) {
    console.error('[WakeWord] Vosk non chargé.');
    return null;
  }
  try {
    // Si l'utilisateur a changé le chemin du modèle, on peut l'ajuster
    voskModel = await window.Vosk.createModel('/models/vosk-model-small-fr.tar.gz');
    return voskModel;
  } catch (err) {
    console.error('[WakeWord] Erreur chargement modèle Vosk:', err);
    return null;
  }
}

async function start() {
  if (isActive) return;
  isActive = true;
  state = 'idle';
  commandBuffer = '';
  
  if (window.setEvaStatusHeader) window.setEvaStatusHeader('⏳ CHARGEMENT VOSK...', 'action');
  
  var model = await loadVoskModel();
  if (!model) {
      if (window.toast) window.toast("Erreur : Modèle vocal introuvable.", "error");
      isActive = false;
      return;
  }
  
  if (!recognizer) {
      recognizer = new model.KaldiRecognizer(16000);
      recognizer.setWords(true);
  }

  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1, sampleRate: 16000 }
    });
    audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
    sourceNode = audioContext.createMediaStreamSource(mediaStream);
    processorNode = audioContext.createScriptProcessor(4096, 1, 1);
    
    sourceNode.connect(processorNode);
    processorNode.connect(audioContext.destination);
    
    if (window.setEvaStatusHeader) window.setEvaStatusHeader(null);

    processorNode.onaudioprocess = function(e) {
      if (!isActive) return;
      var data = e.inputBuffer.getChannelData(0);
      var res = recognizer.acceptWaveform(data);
      
      var transcript = '';
      if (res) {
          transcript = recognizer.result().text || '';
      } else {
          transcript = recognizer.partialResult().partial || '';
      }
      
      if (!transcript) return;

      if (state === 'idle') {
        if (hasWakeWord(transcript)) {
          var cmd = extractCommand(transcript);
          // Si on a la commande en même temps
          if (cmd && cmd.length > 1 && res) {
            fireCommand(cmd);
            recognizer.reset(); // Reset pour nettoyer
          } else {
            // Wake word détecté, on passe en attente de commande
            state = 'triggered';
            commandBuffer = '';
            if (window.setEvaStatusHeader) window.setEvaStatusHeader('🎤 PARLEZ...', 'listening');
            if (window.eva && window.eva.overlay) window.eva.overlay.show('listening');
          }
        }
      } else if (state === 'triggered') {
        commandBuffer = transcript;
        // Si c'est un résultat final (silence détecté)
        if (res && commandBuffer.trim().length > 1) {
          var finalCmd = commandBuffer.trim();
          state = 'idle';
          commandBuffer = '';
          if (window.setEvaStatusHeader) window.setEvaStatusHeader(null);
          if (window.eva && window.eva.overlay) window.eva.overlay.hide();
          fireCommand(finalCmd);
        }
      }
    };
  } catch (err) {
    console.error('[WakeWord] Erreur microphone:', err);
    isActive = false;
    if (window.setEvaStatusHeader) window.setEvaStatusHeader(null);
  }
}

function stop() {
  isActive = false;
  state = 'idle';
  commandBuffer = '';
  
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
  
  if (window.setEvaStatusHeader) window.setEvaStatusHeader(null);
  if (window.eva && window.eva.overlay) window.eva.overlay.hide();
}

function isRunning() { return isActive; }

window.EVAWakeWord = { init: init, start: start, stop: stop, isRunning: isRunning, isSupported: isSupported };
})();
