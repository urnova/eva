(function() {
'use strict';

/*
 * « Kokoro Neural » — VRAI modèle Kokoro-82M v1.0 + voix française féminine
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Architecture : StyleTextToSpeech2 (totalement différente de Piper VITS).
 * Modèle       : onnx-community/Kokoro-82M-v1.0-ONNX (q8 ~80 Mo)
 * Voix         : ff_siwis (Female French — Siwis dataset, voix féminine
 *                native française).
 * Sortie       : 24 000 Hz mono.
 *
 * Tour de force : la lib `kokoro-js` officielle dépend de `phonemizer`
 * (eSpeak NG côté nav) qui ne livre QUE les voix anglaises. On contourne
 * en :
 *   1) phonémisant le français via `@piper-plus/g2p` (G2P pur JS, sans
 *      eSpeak, ~50 Ko, MIT) — sortie IPA.
 *   2) re-mappant les PUA propres à piper-plus (E056-E058, E01E) vers
 *      l'IPA standard que le tokenizer Kokoro attend (ɛ̃, ɑ̃, ɔ̃, y).
 *   3) appelant directement `tts.generate_from_ids(...)` — qui ne valide
 *      pas le nom de voix et charge `ff_siwis.bin` depuis HuggingFace.
 *
 * Résultat : voix féminine française authentique, moteur réellement
 * différent de Piper VITS.
 */

var KOKORO_CDN     = 'https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/+esm';
var KOKORO_FB      = 'https://esm.sh/kokoro-js@1.2.1';
var G2P_FR_CDN     = 'https://cdn.jsdelivr.net/npm/@piper-plus/g2p@0.2.0/src/fr/index.js';
var G2P_FR_FB      = 'https://esm.sh/@piper-plus/g2p@0.2.0/fr';
var MODEL_ID       = 'onnx-community/Kokoro-82M-v1.0-ONNX';
var VOICE          = 'ff_siwis';

/* PUA piper-plus → IPA standard (compatible tokenizer Kokoro) */
var PUA_REMAP = {
  '\uE056': '\u025B\u0303',  /* nasal ɛ̃  : vin, pain        */
  '\uE057': '\u0251\u0303',  /* nasal ɑ̃  : dans, vent       */
  '\uE058': '\u0254\u0303',  /* nasal ɔ̃  : bon, mont        */
  '\uE01E': 'y',             /* voyelle y : lune, tu        */
};

/* ── État ── */
var _tts        = null;
var _g2p        = null;
var _loading    = null;
var _firstUse   = true;
var _audioCtx   = null;
var _currentSrc = null;
var _cancelled  = false;
var _lastError  = null;

function _log(msg)     { try { console.log('[Kokoro]', msg); } catch(_) {} }
function _warn(msg, e) { try { console.warn('[Kokoro]', msg, e || ''); } catch(_) {} }
function _err(msg, e)  {
  try { console.error('[Kokoro]', msg, e || ''); } catch(_) {}
  _lastError = msg + (e && e.message ? ' — ' + e.message : '');
}

function _checkEnvironment() {
  if (typeof window === 'undefined')      throw new Error('Pas de navigateur');
  if (!window.isSecureContext)            throw new Error('Contexte non sécurisé (HTTPS requis)');
  if (typeof WebAssembly === 'undefined') throw new Error('WebAssembly non supporté');
  if (!window.crossOriginIsolated) {
    _warn('crossOriginIsolated=false → SharedArrayBuffer indisponible. ' +
          'ONNX tournera en mono-thread (plus lent).');
  }
}

function _unlockCtx(injectedCtx) {
  try {
    if (injectedCtx && (!_audioCtx || _audioCtx.state === 'closed')) _audioCtx = injectedCtx;
    if (!_audioCtx || _audioCtx.state === 'closed') {
      _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (_audioCtx.state === 'suspended') _audioCtx.resume().catch(function(){});
  } catch(e) {}
}

async function _importWithFallback(primary, fallback, label) {
  try { return await import(primary); }
  catch(e) {
    _warn(label + ' : jsDelivr KO, repli esm.sh…', e && e.message);
    return await import(fallback);
  }
}

/* ── Phonémisation française ── */
function _remapPUA(s) {
  return s.replace(/[\uE056\uE057\uE058\uE01E]/g, function(c) {
    return PUA_REMAP[c] || '';
  });
}

async function _initG2P() {
  if (_g2p) return _g2p;
  _log('Chargement G2P français (@piper-plus/g2p)…');
  var mod = await _importWithFallback(G2P_FR_CDN, G2P_FR_FB, 'G2P');
  var FrenchG2P = mod.FrenchG2P || (mod.default && mod.default.FrenchG2P) || mod.default;
  if (typeof FrenchG2P !== 'function') {
    throw new Error('FrenchG2P introuvable — exports : ' + Object.keys(mod).join(', '));
  }
  var g = new FrenchG2P();
  if (typeof g.initialize === 'function') await g.initialize();
  _g2p = g;
  _log('✓ G2P français prêt');
  return _g2p;
}

function _phonemizeFr(text) {
  var out = _g2p.phonemize(text);
  /* L'API renvoie soit { tokens, prosody }, soit Array<string> */
  var tokens = (out && out.tokens) ? out.tokens : (Array.isArray(out) ? out : []);
  return _remapPUA(tokens.join(''));
}

/* ── Chargement Kokoro-82M ── */
async function _initEngine() {
  if (_tts) return _tts;
  if (_loading) return _loading;

  _loading = (async function() {
    _checkEnvironment();
    _log('Chargement kokoro-js…');
    var mod = await _importWithFallback(KOKORO_CDN, KOKORO_FB, 'kokoro-js');
    var KokoroTTS = mod.KokoroTTS || (mod.default && mod.default.KokoroTTS);
    var env       = mod.env       || (mod.default && mod.default.env);
    if (typeof KokoroTTS === 'undefined' || typeof KokoroTTS.from_pretrained !== 'function') {
      throw new Error('KokoroTTS introuvable — exports : ' + Object.keys(mod).join(', '));
    }

    /* G2P en parallèle (gain de temps au 1er chargement) */
    var g2pPromise = _initG2P();

    /* Mono-thread si COOP/COEP absents (évite warning wasm-factory) */
    if (env && env.wasmPaths === undefined) {
      /* env est un proxy {wasmPaths get/set} ; on ne touche pas */
    }

    _log('Chargement Kokoro-82M v1.0 (q8, ~80 Mo au 1er usage)…');
    _tts = await KokoroTTS.from_pretrained(MODEL_ID, {
      dtype: 'q8',
      progress_callback: function(p) {
        if (p && p.status === 'progress' && p.total) {
          _log('DL ' + (p.file || '') + ' ' + Math.round(p.loaded / p.total * 100) + '%');
        }
      }
    });
    await g2pPromise;
    _log('✓ Kokoro-82M chargé (voix française ' + VOICE + ')');
    return _tts;
  })();

  try {
    return await _loading;
  } catch(e) {
    _err('Échec chargement', e);
    _loading = null;
    throw e;
  }
}

/* ── Lecture PCM via Web Audio ── */
function _stopAll() {
  if (_currentSrc) { try { _currentSrc.stop(); } catch(e) {} _currentSrc = null; }
}

function _playPcm(audioData, sampleRate) {
  return new Promise(function(resolve, reject) {
    try {
      _unlockCtx();
      _stopAll();
      var data = audioData instanceof Float32Array ? audioData : new Float32Array(audioData);
      var buf  = _audioCtx.createBuffer(1, data.length, sampleRate || 24000);
      buf.copyToChannel(data, 0);
      var src = _audioCtx.createBufferSource();
      src.buffer = buf;
      src.connect(_audioCtx.destination);
      _currentSrc = src;
      src.onended = function() { if (_currentSrc === src) _currentSrc = null; resolve(); };
      src.start(0);
    } catch(e) { reject(e); }
  });
}

/* ═══════════════════════════════════════════════
   API publique
   ═══════════════════════════════════════════════ */
async function speakKokoro(text, config, onStart, onEnd) {
  _cancelled = false;
  _unlockCtx();   /* avant tout await — geste utilisateur encore actif */

  if (_firstUse && window.showEvaToast) {
    window.showEvaToast('⏳ Chargement Kokoro Neural (~80 Mo, 1er usage)…', 'info');
  }

  var tts;
  try {
    tts = await _initEngine();
  } catch(e) {
    throw new Error('Kokoro Neural indisponible : ' + (e && e.message));
  }

  if (_firstUse) {
    _firstUse = false;
    if (window.showEvaToast) {
      window.showEvaToast('✓ Kokoro Neural prêt (voix ff_siwis française)', 'success');
    }
  }
  if (_cancelled) { if (onEnd) onEnd(); return; }
  if (onStart) try { onStart(); } catch(e) {}

  try {
    /* 1) Phonémisation française (rule-based, pure JS) */
    var phonemes = _phonemizeFr(text);
    if (!phonemes || !phonemes.trim()) {
      throw new Error('Phonémisation vide pour : ' + text.slice(0, 40));
    }

    /* 2) Tokenisation Kokoro — un caractère = un token */
    var enc = tts.tokenizer(phonemes, { truncation: true });

    /* 3) Génération directe (saute le phonemizer anglais cassé de kokoro-js) */
    var audio = await tts.generate_from_ids(enc.input_ids, {
      voice: VOICE,
      speed: 1.0,
    });
    if (_cancelled) { if (onEnd) onEnd(); return; }

    /* audio = RawAudio { audio: Float32Array, sampling_rate: 24000 } */
    var pcm = audio.audio || audio.data || audio;
    var sr  = audio.sampling_rate || 24000;
    await _playPcm(pcm, sr);
  } finally {
    if (onEnd) try { onEnd(); } catch(e) {}
  }
}

function stopKokoro() {
  _cancelled = true;
  _stopAll();
}

function isKokoroPlaying() {
  return _currentSrc !== null;
}

function diagnose() {
  var report = {
    secureContext:        !!(typeof window !== 'undefined' && window.isSecureContext),
    crossOriginIsolated:  !!(typeof window !== 'undefined' && window.crossOriginIsolated),
    sharedArrayBuffer:    typeof SharedArrayBuffer !== 'undefined',
    webAssembly:          typeof WebAssembly !== 'undefined',
    opfs:                 !!(navigator.storage && typeof navigator.storage.getDirectory === 'function'),
    modelLoaded:          _tts !== null,
    g2pLoaded:            _g2p !== null,
    model:                MODEL_ID,
    voice:                VOICE,
    lastError:            _lastError,
  };
  console.table(report);
  return report;
}

window.KokoroTTS = {
  speak:     speakKokoro,
  stop:      stopKokoro,
  isPlaying: isKokoroPlaying,
  diagnose:  diagnose,
  modelName: function() { return _tts ? (MODEL_ID + ' / ' + VOICE) : (MODEL_ID + ' (non chargé)'); },
  engine:    'kokoro-82m-v1',
  voice:     VOICE,
  _setCtx:   function(ctx) {
    if (ctx && (!_audioCtx || _audioCtx.state === 'closed')) _audioCtx = ctx;
  },
};

})();
