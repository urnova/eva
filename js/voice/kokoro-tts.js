(function() {
'use strict';

/* ═══════════════════════════════════════════════════════════
   EVA VOICE — MMS-TTS French (Meta / HuggingFace)
   100% browser-native via ONNX + transformers.js.
   Model ~50 MB, downloaded once and cached by the browser.
   ═══════════════════════════════════════════════════════════ */

var TRANSFORMERS_CDN = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3/dist/transformers.min.js';
var MODEL_ID         = 'Xenova/mms-tts-fra'; // French MMS-TTS (Meta)

var _pipe        = null;
var _loading     = false;
var _loadPromise = null;
var _audioCtx    = null;
var _source      = null;
var _cancelled   = false;

/* ─── Audio context ─────────────────────────────────────── */
function getCtx() {
  if (!_audioCtx || _audioCtx.state === 'closed') {
    _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return _audioCtx;
}

/* ─── Load model (once, cached in IndexedDB by browser) ─── */
function load() {
  if (_pipe)        return Promise.resolve(_pipe);
  if (_loadPromise) return _loadPromise;

  _loading = true;
  _showToast('⬇  CHARGEMENT VOIX FRANÇAISE — 1ère fois uniquement…');

  _loadPromise = import(TRANSFORMERS_CDN)
    .then(function(mod) {
      var env = mod.env;
      if (env) { env.allowLocalModels = false; }
      return mod.pipeline('text-to-speech', MODEL_ID);
    })
    .then(function(pipe) {
      _pipe    = pipe;
      _loading = false;
      _hideToast();
      console.log('[EvaVoice] Voix française prête ✓');
      return pipe;
    })
    .catch(function(e) {
      _loading     = false;
      _loadPromise = null;
      _hideToast();
      console.error('[EvaVoice] Chargement échoué:', e);
      throw e;
    });

  return _loadPromise;
}

/* ─── Stop current playback ─────────────────────────────── */
function stop() {
  _cancelled = true;
  if (_source) {
    try { _source.stop(); } catch(e) {}
    _source = null;
  }
}

/* ─── Speak ─────────────────────────────────────────────── */
async function speak(text, onStart, onEnd) {
  if (!text || !text.trim()) { if (onEnd) onEnd(); return; }

  try {
    var pipe = await load();
    _cancelled = false;

    /* Synthesis via ONNX (WASM, non-blocking) */
    var out = await pipe(text.slice(0, 600));

    if (_cancelled) { if (onEnd) onEnd(); return; }

    /* Play via Web Audio API */
    var c = getCtx();
    if (c.state === 'suspended') await c.resume();

    var audio     = out.audio instanceof Float32Array ? out.audio : new Float32Array(out.audio);
    var sampleRate = out.sampling_rate || 16000;

    var buffer = c.createBuffer(1, audio.length, sampleRate);
    buffer.getChannelData(0).set(audio);

    stop();
    _cancelled = false;

    var src = c.createBufferSource();
    src.buffer = buffer;
    src.connect(c.destination);
    _source = src;

    src.onended = function() {
      _source = null;
      if (onEnd) onEnd();
    };

    if (onStart) onStart();
    src.start();

  } catch(e) {
    console.error('[EvaVoice] Erreur:', e);
    if (onEnd) onEnd();
    throw e;
  }
}

/* ─── Toast UI ───────────────────────────────────────────── */
var _toastEl = null;

function _showToast(msg) {
  if (_toastEl) return;
  _toastEl = document.createElement('div');
  _toastEl.style.cssText = [
    'position:fixed', 'bottom:80px', 'left:50%',
    'transform:translateX(-50%)',
    'background:rgba(0,212,255,0.10)',
    'border:1px solid rgba(0,212,255,0.30)',
    'color:rgba(0,212,255,0.90)',
    'font-family:Space Mono,monospace',
    'font-size:0.62em', 'letter-spacing:1.4px',
    'padding:7px 18px', 'border-radius:20px',
    'z-index:9999', 'pointer-events:none',
    'backdrop-filter:blur(6px)',
    'white-space:nowrap'
  ].join(';');
  _toastEl.textContent = msg;
  document.body.appendChild(_toastEl);
}

function _hideToast() {
  if (_toastEl) { _toastEl.remove(); _toastEl = null; }
}

/* ─── Public API (same interface as before) ─────────────── */
window.KokoroVoice = {
  speak:     speak,
  stop:      stop,
  preload:   load,
  isReady:   function() { return !!_pipe; },
  isLoading: function() { return _loading; }
};

})();
