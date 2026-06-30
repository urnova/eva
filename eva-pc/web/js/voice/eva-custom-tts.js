/**
 * EVA Voice — Moteur Piper TTS dans le navigateur
 *
 * Objectif : voix française féminine de qualité, IDENTIQUE sur tous
 * les navigateurs (Chrome, Edge, Firefox, Safari) — pas de Web Speech API
 * dont la voix change selon le système.
 *
 * Stack :
 *   – @mintplex-labs/piper-tts-web (ONNX WASM dans le navigateur)
 *   – Modèle : fr_FR-siwis-medium (~63 Mo, voix féminine claire)
 *   – Téléchargé une seule fois, puis mis en cache navigateur (IndexedDB)
 *   – Aucune clé API, aucun serveur, 100% statique → Netlify-ready
 *
 * Fallback : si le moteur Piper échoue (réseau, navigateur trop ancien),
 * on bascule sur Web Speech avec un profil féminin français — au moins
 * EVA reste audible.
 */
(function() {
'use strict';

/* ─── Configuration Piper ─── */
/* @diffusionstudio/vits-web — moteur Piper VITS dans le navigateur (ONNX/WASM) */
var PIPER_CDN     = 'https://cdn.jsdelivr.net/npm/@diffusionstudio/vits-web@1.0.3/dist/vits-web.js';
var PIPER_VOICE   = 'fr_FR-siwis-medium';   /* Voix féminine française, naturelle (~63 Mo) */

/* ─── État interne ─── */
var _piperModule = null;     /* Le module vits-web une fois importé */
var _loading     = false;
var _loadError   = null;
var _firstUse    = true;     /* Affiche un toast au 1er téléchargement du modèle */
var _cancelled   = false;
var _currentAudio = null;
var _currentUrl  = null;

/* ─── Profil vocal pour le fallback Web Speech ─── */
var EVA_VOICE_PROFILE = {
  defaultRate:  0.92,
  defaultPitch: 1.20,
};

/* ═══════════════════════════════════════════════
   PIPER — Chargement du module (lazy, 1 fois)
   ═══════════════════════════════════════════════ */
async function _loadPiper() {
  if (_piperModule) return _piperModule;
  if (_loadError) throw _loadError;
  if (_loading) {
    while (_loading) { await new Promise(function(r) { setTimeout(r, 200); }); }
    if (_loadError) throw _loadError;
    return _piperModule;
  }
  _loading = true;

  try {
    console.log('[EVA-Voice] Import de Piper VITS web…');
    var mod = await import(PIPER_CDN);
    if (!mod || typeof mod.predict !== 'function') {
      throw new Error('predict() introuvable dans le module Piper');
    }
    _piperModule = mod;
    console.log('[EVA-Voice] ✓ Module Piper chargé');
    _loadError = null;
  } catch(e) {
    _loadError = e;
    _loading   = false;
    console.error('[EVA-Voice] Échec chargement Piper:', e && e.message);
    throw e;
  }
  _loading = false;
  return _piperModule;
}

/* ═══════════════════════════════════════════════
   PIPER — Synthèse + lecture
   ═══════════════════════════════════════════════ */
async function _speakPiper(text) {
  var mod = await _loadPiper();
  if (_cancelled) return;

  if (_firstUse && window.showEvaToast) {
    window.showEvaToast('⏳ Téléchargement voix EVA (~60 Mo, 1er usage)…', 'info');
  }

  /* predict({ text, voiceId }, progressCb) → Blob audio/wav */
  var wavBlob = await mod.predict(
    { text: text, voiceId: PIPER_VOICE },
    function(p) {
      if (p && p.loaded && p.total) {
        console.log('[EVA-Voice] DL', Math.round(p.loaded / p.total * 100) + '%');
      }
    }
  );
  if (_firstUse) {
    _firstUse = false;
    if (window.showEvaToast) window.showEvaToast('✓ Voix EVA prête', 'success');
  }
  if (_cancelled) return;
  if (!wavBlob) throw new Error('Piper n\'a renvoyé aucun audio');

  /* Lecture du WAV */
  _stopAudio();
  _currentUrl  = URL.createObjectURL(wavBlob);
  _currentAudio = new Audio(_currentUrl);
  _currentAudio.volume = 1.0;

  return new Promise(function(resolve, reject) {
    _currentAudio.onended = function() {
      _cleanupAudio();
      resolve();
    };
    _currentAudio.onerror = function() {
      _cleanupAudio();
      reject(new Error('Lecture audio Piper échouée'));
    };
    _currentAudio.play().catch(function(err) {
      _cleanupAudio();
      reject(err);
    });
  });
}

function _stopAudio() {
  if (_currentAudio) {
    try { _currentAudio.pause(); } catch(e) {}
  }
}

function _cleanupAudio() {
  if (_currentUrl) {
    try { URL.revokeObjectURL(_currentUrl); } catch(e) {}
    _currentUrl = null;
  }
  _currentAudio = null;
}

/* ═══════════════════════════════════════════════
   FALLBACK — Web Speech API (profil féminin FR)
   ═══════════════════════════════════════════════ */
function _pickFrenchFemale() {
  if (typeof speechSynthesis === 'undefined') return null;
  var voices = speechSynthesis.getVoices();
  if (!voices || !voices.length) return null;
  var femPriority = [
    'Microsoft Denise', 'Amélie', 'Audrey', 'Marie', 'Virginie',
    'Google français', 'Hortense', 'Julie', 'Léa', 'Céline'
  ];
  for (var i = 0; i < femPriority.length; i++) {
    var fp = femPriority[i];
    var found = voices.find(function(v) { return v.name && v.name.includes(fp); });
    if (found) return found;
  }
  return voices.find(function(v) { return v.lang && v.lang.startsWith('fr'); }) || null;
}

async function _waitForVoices() {
  if (typeof speechSynthesis === 'undefined') return;
  if (speechSynthesis.getVoices && speechSynthesis.getVoices().length) return;
  await new Promise(function(resolve) {
    if (typeof speechSynthesis.onvoiceschanged !== 'undefined') {
      speechSynthesis.onvoiceschanged = function() { resolve(); };
    }
    setTimeout(resolve, 1500);
  });
}

function _speakWebSpeech(text, config) {
  return new Promise(function(resolve) {
    if (typeof speechSynthesis === 'undefined') { resolve(); return; }
    try { speechSynthesis.cancel(); } catch(e) {}

    var utterance = new SpeechSynthesisUtterance(text);
    var best = _pickFrenchFemale();
    if (best) utterance.voice = best;
    utterance.lang   = (best && best.lang) || 'fr-FR';
    var userRate = parseFloat(config && config.speechRate);
    utterance.rate   = (userRate && userRate !== 1.0)
      ? Math.min(1.1, Math.max(0.75, userRate))
      : EVA_VOICE_PROFILE.defaultRate;
    utterance.pitch  = EVA_VOICE_PROFILE.defaultPitch;
    utterance.volume = 1.0;

    var resolved = false;
    function done() { if (resolved) return; resolved = true; resolve(); }
    utterance.onend   = done;
    utterance.onerror = done;
    try { speechSynthesis.speak(utterance); } catch(e) { done(); }
  });
}

/* ═══════════════════════════════════════════════
   API publique
   ═══════════════════════════════════════════════ */
async function speakEvaCustom(text, config, onStart, onEnd) {
  _cancelled = false;
  config = config || {};

  if (onStart) try { onStart(); } catch(e) {}

  /* ── Priorité 1 : Piper TTS (qualité + cross-browser) ── */
  try {
    await _speakPiper(text);
    if (onEnd) try { onEnd(); } catch(e) {}
    return;
  } catch(e) {
    console.warn('[EVA-Voice] Piper échoué, fallback Web Speech:', e && e.message);
  }

  /* ── Priorité 2 : Web Speech API (fallback) ── */
  await _waitForVoices();
  if (_cancelled) { if (onEnd) onEnd(); return; }
  try {
    await _speakWebSpeech(text, config);
  } catch(e) {
    console.warn('[EVA-Voice] Web Speech aussi échoué:', e && e.message);
  }

  if (onEnd) try { onEnd(); } catch(e) {}
}

function stopEvaCustom() {
  _cancelled = true;
  _stopAudio();
  _cleanupAudio();
  if (typeof speechSynthesis !== 'undefined') {
    try { speechSynthesis.cancel(); } catch(e) {}
  }
}

function isEvaCustomPlaying() {
  if (_currentAudio && !_currentAudio.paused) return true;
  return typeof speechSynthesis !== 'undefined'
      && (speechSynthesis.speaking || speechSynthesis.pending);
}

/* ── API publique ── */
window.EvaCustomTTS = {
  speak:     speakEvaCustom,
  stop:      stopEvaCustom,
  isPlaying: isEvaCustomPlaying,
  voiceId:   PIPER_VOICE,
  engine:    'piper',
  profile:   EVA_VOICE_PROFILE,
};

})();
