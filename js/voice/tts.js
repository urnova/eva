(function() {
'use strict';

var currentAudio = null;
var isMuted = false;

function initVoices() {
  if (typeof speechSynthesis === 'undefined') return;
  speechSynthesis.getVoices();
  if (speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = function() { speechSynthesis.getVoices(); };
  }
}

/* ─── Pick best available French voice ─────────────────── */
function getBestFrenchVoice() {
  if (typeof speechSynthesis === 'undefined') return null;
  var voices = speechSynthesis.getVoices();
  if (!voices || !voices.length) return null;

  var priority = [
    'Microsoft Denise',   // Windows Edge — très naturelle
    'Amélie',             // macOS
    'Google français',    // Chrome
    'Thomas',             // macOS/iOS
    'Audrey',
    'HéloÏse',
    'Marie',
    'Virginie',
  ];

  for (var i = 0; i < priority.length; i++) {
    var v = voices.find(function(v) { return v.name.includes(priority[i]); });
    if (v) return v;
  }
  return voices.find(function(v) { return v.lang && v.lang.startsWith('fr'); }) || null;
}

/* ─── Web Speech API (primary) ──────────────────────────── */
function speakWebSpeech(text, config) {
  config = config || {};
  return new Promise(function(resolve) {
    if (typeof speechSynthesis === 'undefined') { resolve(); return; }
    speechSynthesis.cancel();

    var utterance  = new SpeechSynthesisUtterance(text);
    var bestVoice  = getBestFrenchVoice();

    if (config.selectedVoice && config.selectedVoice !== 'auto') {
      var named = speechSynthesis.getVoices().find(function(v) { return v.name === config.selectedVoice; });
      if (named) bestVoice = named;
    }

    if (bestVoice) utterance.voice = bestVoice;
    utterance.lang   = (bestVoice && bestVoice.lang) || config.voiceLang || 'fr-FR';
    utterance.rate   = config.speechRate  || 1.0;
    utterance.pitch  = config.speechPitch || 1.05;
    utterance.volume = 1.0;

    utterance.onstart = function() { setEvaSpeaking(true); };
    utterance.onend   = function() { setEvaSpeaking(false); resolve(); };
    utterance.onerror = function() { setEvaSpeaking(false); resolve(); };

    speechSynthesis.speak(utterance);
  });
}

/* ─── Puter TTS (optional override) ────────────────────── */
async function speakWithPuter(text, config) {
  config = config || {};
  if (typeof puter === 'undefined') throw new Error('Puter not loaded');
  setEvaSpeaking(true);
  try {
    var voice = config.puterVoice || 'nova';
    var audio = await puter.ai.txt2speech(text, { provider: 'openai', model: 'tts-1', voice: voice });
    var blob = audio instanceof Blob ? audio : new Blob([audio], { type: 'audio/mpeg' });
    var url  = URL.createObjectURL(blob);
    currentAudio = new Audio(url);
    currentAudio.onended = function() { setEvaSpeaking(false); URL.revokeObjectURL(url); };
    currentAudio.onerror = function() { setEvaSpeaking(false); URL.revokeObjectURL(url); };
    await currentAudio.play();
  } catch(e) {
    setEvaSpeaking(false);
    throw e;
  }
}

/* ─── Main speak entry point ────────────────────────────── */
async function speakText(text, config) {
  config = config || {};
  if (isMuted) return;

  try {
    /* Puter TTS — only if user explicitly selected it */
    if (config.voiceProvider === 'puter' && typeof puter !== 'undefined') {
      await speakWithPuter(text, config);
      return;
    }

    /* Web Speech API — primary for all other cases */
    await speakWebSpeech(text, config);

  } catch(e) {
    console.warn('[TTS] Erreur:', e.message);
    try { await speakWebSpeech(text, config); } catch(e2) {}
  }
}

/* ─── Stop all TTS ──────────────────────────────────────── */
function stopTTS() {
  if (typeof speechSynthesis !== 'undefined' && speechSynthesis.speaking) {
    speechSynthesis.cancel();
  }
  if (currentAudio) { currentAudio.pause(); currentAudio = null; }
  setEvaSpeaking(false);
}

function setMuted(val)  { isMuted = val; if (val) stopTTS(); }
function getMuted()     { return isMuted; }
function toggleMuted()  { isMuted = !isMuted; if (isMuted) stopTTS(); return isMuted; }

function setEvaSpeaking(speaking) {
  if (window.EvaCharacter) {
    if (speaking) window.EvaCharacter.startTalking();
    else          window.EvaCharacter.stopTalking();
  }
  if (window.setEvaStatusHeader) {
    if (speaking) window.setEvaStatusHeader('EVA PARLE...', 'speaking');
    else          window.setEvaStatusHeader(null);
  }
}

function skipTTS() { stopTTS(); }

window.EVATTS = {
  initVoices, speakText, speakWithPuter, stopTTS, skipTTS,
  setMuted, getMuted, toggleMuted, getBestFrenchVoice
};
window.skipTTS = skipTTS;

if (typeof window !== 'undefined') {
  window.addEventListener('load', initVoices);
}

initVoices();
})();
