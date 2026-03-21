(function() {
'use strict';

var currentAudio = null;
var isMuted      = false;

/* ─── Toast helper ──────────────────────────────────────── */
function showToast(msg, type) {
  if (window.showEvaToast) window.showEvaToast(msg, type || 'error');
  else console.warn('[TTS]', msg);
}

/* ═══════════════════════════════════════════════════════════
   INIT — preload voices list
   ═══════════════════════════════════════════════════════════ */
function initVoices() {
  if (typeof speechSynthesis === 'undefined') return;
  speechSynthesis.getVoices();
  if (speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = function() { speechSynthesis.getVoices(); };
  }
}

/* ═══════════════════════════════════════════════════════════
   1. WEB SPEECH API
   ═══════════════════════════════════════════════════════════ */
function getBestFrenchVoice() {
  if (typeof speechSynthesis === 'undefined') return null;
  var voices = speechSynthesis.getVoices();
  if (!voices || !voices.length) return null;
  var priority = [
    'Microsoft Denise', 'Amélie', 'Google français',
    'Thomas', 'Audrey', 'Marie', 'Virginie'
  ];
  for (var i = 0; i < priority.length; i++) {
    var v = voices.find(function(v) { return v.name.includes(priority[i]); });
    if (v) return v;
  }
  return voices.find(function(v) { return v.lang && v.lang.startsWith('fr'); }) || null;
}

function speakWebSpeech(text, config) {
  config = config || {};
  return new Promise(function(resolve) {
    if (typeof speechSynthesis === 'undefined') { resolve(); return; }
    speechSynthesis.cancel();
    var utterance = new SpeechSynthesisUtterance(text);
    var best = getBestFrenchVoice();
    if (config.selectedVoice && config.selectedVoice !== 'auto') {
      var named = speechSynthesis.getVoices().find(function(v) { return v.name === config.selectedVoice; });
      if (named) best = named;
    }
    if (best) utterance.voice = best;
    utterance.lang   = (best && best.lang) || config.voiceLang || 'fr-FR';
    utterance.rate   = config.speechRate  || 1.0;
    utterance.pitch  = config.speechPitch || 1.05;
    utterance.volume = 1.0;
    utterance.onstart = function() { setEvaSpeaking(true); };
    utterance.onend   = function() { setEvaSpeaking(false); resolve(); };
    utterance.onerror = function() { setEvaSpeaking(false); resolve(); };
    speechSynthesis.speak(utterance);
  });
}

/* ═══════════════════════════════════════════════════════════
   2. PUTER TTS
   ═══════════════════════════════════════════════════════════ */
async function speakWithPuter(text, config) {
  config = config || {};
  if (typeof puter === 'undefined' || !puter.auth) throw new Error('Puter non chargé');
  setEvaSpeaking(true);
  try {
    var voice = config.puterVoice || 'nova';
    var audio = await puter.ai.txt2speech(text, { provider: 'openai', model: 'tts-1', voice: voice });
    var blob  = audio instanceof Blob ? audio : new Blob([audio], { type: 'audio/mpeg' });
    var url   = URL.createObjectURL(blob);
    stopCurrentAudio();
    currentAudio = new Audio(url);
    await new Promise(function(resolve) {
      currentAudio.onended = function() { setEvaSpeaking(false); URL.revokeObjectURL(url); resolve(); };
      currentAudio.onerror = function() { setEvaSpeaking(false); URL.revokeObjectURL(url); resolve(); };
      currentAudio.play().catch(resolve);
    });
  } catch(e) {
    setEvaSpeaking(false);
    throw e;
  }
}

/* ═══════════════════════════════════════════════════════════
   3. ELEVENLABS TTS
   ═══════════════════════════════════════════════════════════ */
async function speakWithElevenLabs(text, config) {
  config = config || {};
  var apiKey  = (config.elevenLabsApiKey || '').trim();
  var voiceId = (config.elevenLabsVoiceId || '').trim() || '21m00Tcm4TlvDq8ikWAM';
  if (!apiKey) throw new Error('Clé API ElevenLabs manquante — ajoutez-la dans les paramètres Voix');

  var resp = await fetch('https://api.elevenlabs.io/v1/text-to-speech/' + voiceId, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      'Accept': 'audio/mpeg'
    },
    body: JSON.stringify({
      text: text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: { stability: 0.50, similarity_boost: 0.75, style: 0.0 }
    })
  });

  if (!resp.ok) {
    var errBody = await resp.text().catch(function(){ return ''; });
    if (resp.status === 401) throw new Error('Clé API ElevenLabs invalide ou expirée');
    if (resp.status === 404) throw new Error('Voice ID introuvable — vérifiez l\'ID de voix dans Paramètres → Voix');
    if (resp.status === 422) throw new Error('Texte invalide ou paramètres incorrects');
    throw new Error('ElevenLabs erreur ' + resp.status + (errBody ? ' : ' + errBody.slice(0, 100) : ''));
  }

  var blob = await resp.blob();
  var url  = URL.createObjectURL(blob);
  stopCurrentAudio();
  currentAudio = new Audio(url);
  setEvaSpeaking(true);
  return new Promise(function(resolve, reject) {
    currentAudio.onended = function() { setEvaSpeaking(false); URL.revokeObjectURL(url); resolve(); };
    currentAudio.onerror = function(e) { setEvaSpeaking(false); URL.revokeObjectURL(url); reject(new Error('Lecture audio échouée')); };
    currentAudio.play().catch(function(e) { setEvaSpeaking(false); reject(e); });
  });
}

/* ═══════════════════════════════════════════════════════════
   4. OPENAI TTS
   ═══════════════════════════════════════════════════════════ */
async function speakWithOpenAI(text, config) {
  config = config || {};
  var apiKey = (config.openAITTSApiKey || config.openaiApiKey || '').trim();
  var voice  = config.openAITTSVoice || 'nova';
  if (!apiKey) throw new Error('Clé API OpenAI manquante');

  var resp = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ model: 'tts-1', input: text, voice: voice })
  });

  if (!resp.ok) {
    var msg = await resp.text().catch(function(){ return ''; });
    throw new Error('OpenAI TTS HTTP ' + resp.status + (msg ? ' — ' + msg.slice(0, 80) : ''));
  }

  var blob = await resp.blob();
  var url  = URL.createObjectURL(blob);
  stopCurrentAudio();
  currentAudio = new Audio(url);
  setEvaSpeaking(true);
  return new Promise(function(resolve, reject) {
    currentAudio.onended = function() { setEvaSpeaking(false); URL.revokeObjectURL(url); resolve(); };
    currentAudio.onerror = function(e) { setEvaSpeaking(false); URL.revokeObjectURL(url); reject(new Error('Lecture audio échouée')); };
    currentAudio.play().catch(function(e) { setEvaSpeaking(false); reject(e); });
  });
}

/* ═══════════════════════════════════════════════════════════
   SENTENCE QUEUE — streaming TTS pipeline
   Découpe le texte en phrases, parle phrase par phrase
   en pré-chargeant la suivante pendant que la courante joue
   ═══════════════════════════════════════════════════════════ */
var _q = { queue: [], running: false, prefetched: null };

/* Découpe le texte en phrases naturelles */
function splitSentences(text) {
  if (!text) return [];
  /* Nettoyage markdown basique */
  var clean = text
    .replace(/#{1,6}\s/g, '')
    .replace(/\*\*/g, '').replace(/\*/g, '')
    .replace(/`[^`]*`/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, ' ')
    .trim();

  var result = [];
  var buf = '';
  for (var i = 0; i < clean.length; i++) {
    buf += clean[i];
    var isEnd = (clean[i] === '.' || clean[i] === '!' || clean[i] === '?');
    var nextIsSpace = (i === clean.length - 1) || clean[i + 1] === ' ' || clean[i + 1] === '\n';
    if (isEnd && buf.length >= 30 && nextIsSpace) {
      result.push(buf.trim());
      buf = '';
      if (clean[i + 1] === ' ') i++;
    }
  }
  if (buf.trim().length > 1) result.push(buf.trim());
  return result.filter(function(s) { return s.trim().length > 1; });
}

/* Pré-charge un clip audio pour ElevenLabs ou OpenAI */
async function _prefetchAudio(text, config) {
  var provider = (config.voiceProvider || 'native').toLowerCase();
  try {
    var blob = null;
    if (provider === 'elevenlabs') {
      var apiKey = (config.elevenLabsApiKey || '').trim();
      var voiceId = (config.elevenLabsVoiceId || '').trim() || '21m00Tcm4TlvDq8ikWAM';
      if (!apiKey) return null;
      var resp = await fetch('https://api.elevenlabs.io/v1/text-to-speech/' + voiceId, {
        method: 'POST',
        headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg' },
        body: JSON.stringify({ text: text, model_id: 'eleven_multilingual_v2', voice_settings: { stability: 0.50, similarity_boost: 0.75, style: 0.0 } })
      });
      if (!resp.ok) return null;
      blob = await resp.blob();
    } else if (provider === 'openai') {
      var apiKey2 = (config.openAITTSApiKey || config.openaiApiKey || '').trim();
      var voice = config.openAITTSVoice || 'nova';
      if (!apiKey2) return null;
      var resp2 = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + apiKey2, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'tts-1', input: text, voice: voice })
      });
      if (!resp2.ok) return null;
      blob = await resp2.blob();
    } else {
      return null;
    }
    if (!blob) return null;
    var url = URL.createObjectURL(blob);
    var audio = new Audio(url);
    audio.preload = 'auto';
    return { audio: audio, url: url };
  } catch(e) {
    return null;
  }
}

/* Joue un clip pré-chargé */
function _playPreloaded(preloaded) {
  return new Promise(function(resolve, reject) {
    stopCurrentAudio();
    currentAudio = preloaded.audio;
    currentAudio.onended = function() { URL.revokeObjectURL(preloaded.url); resolve(); };
    currentAudio.onerror = function() { URL.revokeObjectURL(preloaded.url); reject(new Error('Lecture audio échouée')); };
    currentAudio.play().catch(reject);
  });
}

/* Traitement de la file : joue la phrase courante, pré-charge la suivante */
async function _processQueue() {
  if (_q.queue.length === 0) {
    _q.running = false;
    setEvaSpeaking(false);
    _q.prefetched = null;
    return;
  }
  _q.running = true;
  setEvaSpeaking(true);

  var item = _q.queue.shift();
  var text = item.text;
  var config = item.config;
  var provider = (config.voiceProvider || 'native').toLowerCase();

  /* Pré-charger la phrase suivante pendant que la courante joue */
  var prefetchPromise = null;
  if (_q.queue.length > 0 && (provider === 'elevenlabs' || provider === 'openai')) {
    var nextItem = _q.queue[0];
    prefetchPromise = _prefetchAudio(nextItem.text, nextItem.config);
  }

  try {
    var preloaded = _q.prefetched;
    _q.prefetched = null;

    if (preloaded) {
      /* Utiliser le clip déjà pré-chargé pour cette phrase */
      await _playPreloaded(preloaded);
    } else if (provider === 'native') {
      await speakWebSpeech(text, config);
    } else if (provider === 'puter') {
      await speakWithPuter(text, config);
    } else if (provider === 'elevenlabs') {
      await speakWithElevenLabs(text, config);
    } else if (provider === 'openai') {
      await speakWithOpenAI(text, config);
    } else {
      await speakWebSpeech(text, config);
    }
  } catch(e) {
    console.warn('[TTS queue] phrase ignorée :', e.message || e);
  }

  /* Récupérer le clip pré-chargé pour la prochaine itération */
  if (prefetchPromise) {
    var pf = await prefetchPromise;
    if (pf && _q.running) _q.prefetched = pf;
    else if (pf) URL.revokeObjectURL(pf.url);
  }

  /* Récursion pour la phrase suivante */
  await _processQueue();
}

/* ═══════════════════════════════════════════════════════════
   PUBLIC — speakTextStreaming : point d'entrée principal
   Découpe en phrases et joue en pipeline pour tous les providers
   ═══════════════════════════════════════════════════════════ */
function speakTextStreaming(text, config) {
  config = config || {};
  if (isMuted) return;
  if (!text || !text.trim()) return;

  /* Arrêter tout ce qui est en cours */
  _q.queue = [];
  _q.running = false;
  _q.prefetched = null;
  if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
  stopCurrentAudio();

  var sentences = splitSentences(text);
  if (!sentences.length) {
    /* Fallback : parler le texte brut si pas de phrases détectées */
    sentences = [text.trim()];
  }

  console.log('[TTS] streaming', sentences.length, 'phrases —', (config.voiceProvider || 'native'));
  sentences.forEach(function(s) { _q.queue.push({ text: s, config: config }); });
  _processQueue();
}

/* ═══════════════════════════════════════════════════════════
   DISPATCH — point d'entrée simple (une seule phrase)
   ═══════════════════════════════════════════════════════════ */
async function speakText(text, config) {
  config = config || {};
  if (isMuted) return;
  if (!text || !text.trim()) return;
  var provider = (config.voiceProvider || 'native').toLowerCase();

  console.log('[TTS] speakText — provider:', provider);

  try {
    if (provider === 'puter') {
      await speakWithPuter(text, config);
    } else if (provider === 'elevenlabs') {
      await speakWithElevenLabs(text, config);
    } else if (provider === 'openai') {
      await speakWithOpenAI(text, config);
    } else {
      await speakWebSpeech(text, config);
    }
  } catch(e) {
    var errMsg = e && e.message ? e.message : 'Erreur inconnue';
    console.error('[TTS]', provider, 'a échoué :', errMsg);

    if (provider === 'native') {
      /* Voix navigateur — erreur silencieuse */
    } else {
      showToast('⚠ ' + provider + ' : ' + errMsg + ' — voix navigateur utilisée', 'error');
      try { await speakWebSpeech(text, config); } catch(e2) {}
    }
  }
}

/* ═══════════════════════════════════════════════════════════
   STOP / MUTE
   ═══════════════════════════════════════════════════════════ */
function stopCurrentAudio() {
  if (currentAudio) { try { currentAudio.pause(); } catch(e) {} currentAudio = null; }
}

function stopTTS() {
  /* Vider la file de phrases */
  _q.queue = [];
  _q.running = false;
  if (_q.prefetched) { try { URL.revokeObjectURL(_q.prefetched.url); } catch(e) {} _q.prefetched = null; }
  if (typeof speechSynthesis !== 'undefined' && speechSynthesis.speaking) {
    speechSynthesis.cancel();
  }
  stopCurrentAudio();
  setEvaSpeaking(false);
}

function setMuted(val)  { isMuted = val; if (val) stopTTS(); }
function getMuted()     { return isMuted; }
function toggleMuted()  { isMuted = !isMuted; if (isMuted) stopTTS(); return isMuted; }

/* ═══════════════════════════════════════════════════════════
   EVA STATE
   ═══════════════════════════════════════════════════════════ */
function setEvaSpeaking(speaking) {
  /* Si on essaie d'arrêter mais que la file tourne encore, on attend */
  if (!speaking && _q.running) return;
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

/* ═══════════════════════════════════════════════════════════
   PUBLIC API
   ═══════════════════════════════════════════════════════════ */
window.EVATTS = {
  initVoices,
  speakText,
  speakTextStreaming,
  splitSentences,
  stopTTS,
  skipTTS,
  speakWithPuter,
  speakWithElevenLabs,
  speakWithOpenAI,
  setMuted, getMuted, toggleMuted, getBestFrenchVoice
};
window.skipTTS = skipTTS;

if (typeof window !== 'undefined') {
  window.addEventListener('load', initVoices);
}

initVoices();
})();
