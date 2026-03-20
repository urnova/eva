(function() {
'use strict';

/* ═══════════════════════════════════════════════════════════
   KOKORO TTS — Browser-native neural TTS via ONNX
   Model downloads once (~80 MB) and is cached by the browser.
   ═══════════════════════════════════════════════════════════ */

var CDN   = 'https://cdn.jsdelivr.net/npm/kokoro-js@1.1.2/dist/kokoro.web.js';
var MODEL = 'onnx-community/Kokoro-82M-ONNX';
var VOICE = 'af_bella';  // Warm, natural English-accented female voice
var DTYPE = 'q8';        // ~80 MB, best balance of size and quality

var _engine      = null;
var _loading     = false;
var _loadPromise = null;
var _audioCtx    = null;
var _source      = null;  // current playing AudioBufferSourceNode
var _cancelled   = false;

/* ─── Audio context (lazy) ─────────────────────────────── */
function ctx() {
  if (!_audioCtx || _audioCtx.state === 'closed') {
    _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return _audioCtx;
}

/* ─── Load model (once, then cached) ───────────────────── */
function load() {
  if (_engine)      return Promise.resolve(_engine);
  if (_loadPromise) return _loadPromise;

  _loading = true;
  _showLoadingToast();

  _loadPromise = import(CDN)
    .then(function(mod) {
      return mod.KokoroTTS.from_pretrained(MODEL, { dtype: DTYPE });
    })
    .then(function(engine) {
      _engine  = engine;
      _loading = false;
      _hideLoadingToast();
      console.log('[KokoroTTS] Ready — voice:', VOICE);
      return engine;
    })
    .catch(function(e) {
      _loading     = false;
      _loadPromise = null;
      _hideLoadingToast();
      console.error('[KokoroTTS] Load failed:', e);
      throw e;
    });

  return _loadPromise;
}

/* ─── Stop current playback ────────────────────────────── */
function stop() {
  _cancelled = true;
  if (_source) {
    try { _source.stop(); } catch(e) {}
    _source = null;
  }
}

/* ─── Speak ────────────────────────────────────────────── */
async function speak(text, onStart, onEnd) {
  if (!text || !text.trim()) { if (onEnd) onEnd(); return; }

  try {
    var engine = await load();
    _cancelled = false;

    /* Synthesis (runs off main thread in WASM) */
    var out = await engine.generate(text.slice(0, 600), { voice: VOICE });

    if (_cancelled) { if (onEnd) onEnd(); return; }

    /* Play via Web Audio API */
    var c = ctx();
    if (c.state === 'suspended') await c.resume();

    var buffer = c.createBuffer(1, out.audio.length, out.sampling_rate);
    buffer.getChannelData(0).set(out.audio);

    stop(); // cancel anything still playing
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
    console.error('[KokoroTTS] Speak error:', e);
    if (onEnd) onEnd();
    throw e;
  }
}

/* ─── Loading toast (shown while model downloads) ──────── */
var _toastEl = null;

function _showLoadingToast() {
  if (_toastEl) return;
  _toastEl = document.createElement('div');
  _toastEl.id = 'kokoroLoadingToast';
  _toastEl.style.cssText = [
    'position:fixed', 'bottom:80px', 'left:50%',
    'transform:translateX(-50%)',
    'background:rgba(0,212,255,0.12)',
    'border:1px solid rgba(0,212,255,0.3)',
    'color:rgba(0,212,255,0.9)',
    'font-family:Space Mono,monospace',
    'font-size:0.65em', 'letter-spacing:1.5px',
    'padding:8px 18px', 'border-radius:20px',
    'z-index:9999', 'pointer-events:none',
    'backdrop-filter:blur(6px)'
  ].join(';');
  _toastEl.textContent = '⬇  CHARGEMENT MOTEUR VOCAL — 1ère fois uniquement…';
  document.body.appendChild(_toastEl);
}

function _hideLoadingToast() {
  if (_toastEl) { _toastEl.remove(); _toastEl = null; }
}

/* ─── Public API ────────────────────────────────────────── */
window.KokoroVoice = {
  speak:     speak,
  stop:      stop,
  preload:   load,
  isReady:   function() { return !!_engine; },
  isLoading: function() { return _loading; },
  setVoice:  function(v) { VOICE = v; }
};

})();
