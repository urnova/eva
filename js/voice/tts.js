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

function getBestFrenchVoice() {
  var voices = speechSynthesis.getVoices();
  var preferred = ['Microsoft Denise', 'Google français', 'Amélie', 'Thomas', 'fr-FR'];
  for (var i = 0; i < preferred.length; i++) {
    var v = voices.find(function(v) { return v.name.includes(preferred[i]) || v.lang === preferred[i]; });
    if (v) return v;
  }
  return voices.find(function(v) { return v.lang && v.lang.startsWith('fr'); }) || null;
}

/* ─── Web Speech API fallback ───────────────────────────── */
function speakWebSpeech(text, config) {
  config = config || {};
  return new Promise(function(resolve) {
    if (typeof speechSynthesis === 'undefined') { resolve(); return; }
    speechSynthesis.cancel();
    var utterance = new SpeechSynthesisUtterance(text);
    var voice = getBestFrenchVoice();
    if (config.selectedVoice && config.selectedVoice !== 'auto') {
      var namedVoice = speechSynthesis.getVoices().find(function(v) { return v.name === config.selectedVoice; });
      if (namedVoice) voice = namedVoice;
    }
    if (voice) utterance.voice = voice;
    utterance.lang   = config.voiceLang   || 'fr-FR';
    utterance.rate   = config.speechRate  || 1.0;
    utterance.pitch  = config.speechPitch || 1.1;
    utterance.volume = 1.0;
    utterance.onstart = function() { setEvaSpeaking(true); };
    utterance.onend   = function() { setEvaSpeaking(false); resolve(); };
    utterance.onerror = function() { setEvaSpeaking(false); resolve(); };
    speechSynthesis.speak(utterance);
  });
}

/* ─── Puter TTS ─────────────────────────────────────────── */
async function speakWithPuter(text, config) {
  config = config || {};
  if (typeof puter === 'undefined') throw new Error('Puter not loaded');
  setEvaSpeaking(true);
  try {
    var voice = config.puterVoice || 'nova';
    var audio = await puter.ai.txt2speech(text, { provider: 'openai', model: 'tts-1', voice: voice });
    var blob = audio instanceof Blob ? audio : new Blob([audio], { type: 'audio/mpeg' });
    var url = URL.createObjectURL(blob);
    currentAudio = new Audio(url);
    currentAudio.onended = function() { setEvaSpeaking(false); URL.revokeObjectURL(url); };
    currentAudio.onerror = function() { setEvaSpeaking(false); URL.revokeObjectURL(url); };
    await currentAudio.play();
  } catch(e) {
    setEvaSpeaking(false);
    throw e;
  }
}

/* ─── Kokoro TTS (primary) ──────────────────────────────── */
async function speakWithKokoro(text) {
  return new Promise(function(resolve, reject) {
    window.KokoroVoice.speak(
      text,
      function() { setEvaSpeaking(true); },   // onStart: audio begins playing
      function() { setEvaSpeaking(false); resolve(); }  // onEnd
    );
  });
}

/* ─── Main speak entry point ────────────────────────────── */
async function speakText(text, config) {
  config = config || {};
  if (isMuted) return;

  try {
    /* 1. Kokoro — browser-native neural TTS (default) */
    if (window.KokoroVoice && config.voiceProvider !== 'puter') {
      await speakWithKokoro(text);
      return;
    }

    /* 2. Puter TTS — if explicitly selected */
    if (config.voiceProvider === 'puter' && typeof puter !== 'undefined') {
      await speakWithPuter(text, config);
      return;
    }

    /* 3. Web Speech API — final fallback */
    await speakWebSpeech(text, config);

  } catch(e) {
    console.warn('[TTS] Primary failed, falling back:', e.message);
    try { await speakWebSpeech(text, config); } catch(e2) {}
  }
}

/* ─── Stop all TTS ──────────────────────────────────────── */
function stopTTS() {
  if (typeof speechSynthesis !== 'undefined' && speechSynthesis.speaking) speechSynthesis.cancel();
  if (currentAudio) { currentAudio.pause(); currentAudio = null; }
  if (window.KokoroVoice) window.KokoroVoice.stop();
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

if (typeof window !== 'undefined') window.addEventListener('load', function() {
  initVoices();
  /* Start preloading Kokoro model in background after page loads */
  setTimeout(function() {
    if (window.KokoroVoice) {
      window.KokoroVoice.preload().catch(function() {});
    }
  }, 3000);
});

initVoices();
})();
