/**
 * Piper TTS — Synthèse vocale neuronale 100 % côté client (WebAssembly).
 *
 * Voix par défaut : fr_FR-siwis-medium — voix féminine française naturelle,
 * claire, classe (modèle SIWIS, licence CC0). Téléchargement unique du modèle
 * (~63 Mo) puis exécution intégralement dans le navigateur via ONNX Runtime
 * Web. Aucune clé API, aucun serveur — compatible Netlify (statique pur).
 *
 * Voix françaises disponibles (changeable via S.config.piperVoice) :
 *   - fr_FR-siwis-medium  (féminine, recommandée)
 *   - fr_FR-siwis-low     (féminine, plus rapide, plus légère)
 *   - fr_FR-upmc-medium   (féminine, autre timbre)
 *   - fr_FR-tom-medium    (masculine)
 *   - fr_FR-mls-medium    (multi-locuteurs)
 *   - fr_FR-gilles-low    (masculine)
 *
 * API publique :
 *   PiperTTS.warmup(config)             → précharge le moteur + le modèle
 *   PiperTTS.synthesize(text, config)   → renvoie un Blob WAV (ou null)
 *   PiperTTS.speak(text, config, onStart, onEnd)
 *                                       → synthétise et joue dans la foulée
 *   PiperTTS.playBlob(blob)             → joue un Blob WAV
 *   PiperTTS.stop()                     → coupe la lecture en cours
 *   PiperTTS.getDownloadProgress()      → 0..1 (ou null si terminé/inconnu)
 *   PiperTTS.diagnose()                 → renvoie un rapport de compatibilité
 *
 * IMPORTANT — Le moteur a besoin :
 *   1) d'un contexte sécurisé (HTTPS ou localhost)
 *   2) de COOP/COEP pour SharedArrayBuffer (multi-thread ONNX)
 *      → headers Cross-Origin-Opener-Policy: same-origin
 *               Cross-Origin-Embedder-Policy: credentialless (ou require-corp)
 *   3) de `navigator.storage.getDirectory()` (OPFS) pour le cache des modèles
 *
 * URL CDN : https://cdn.jsdelivr.net/npm/@diffusionstudio/vits-web@1.0.3/+esm
 *   ⚠️  La version 1.0.3 est la DERNIÈRE publiée sur npm — il n'existe ni
 *       1.0.4 ni 1.0.5. Le suffixe `/+esm` demande à jsDelivr de bundler
 *       le module ESM en résolvant les imports nus (`onnxruntime-web`,
 *       `./piper-DeOu3H9E.js`). Sans `/+esm` le navigateur lève une erreur
 *       « Failed to resolve module specifier "onnxruntime-web" » et le
 *       moteur ne se charge jamais.
 */
(function() {
'use strict';

var DEFAULT_VOICE = 'fr_FR-siwis-medium';
/* Pin sur 1.0.3 (dernière version publique) + bundle ESM jsDelivr qui résout
   les imports nus de la lib (onnxruntime-web, piper-DeOu3H9E.js). */
var CDN_URL       = 'https://cdn.jsdelivr.net/npm/@diffusionstudio/vits-web@1.0.3/+esm';
/* Repli si jsDelivr est inaccessible : esm.sh fournit le même service. */
var CDN_FALLBACK  = 'https://esm.sh/@diffusionstudio/vits-web@1.0.3';

/* ─── Voix françaises FONCTIONNELLES ──────────────────────
   Liste blanche : seules ces voix ont un vocabulaire (num_symbols=256)
   compatible avec les sorties du phonémiseur piper-phonemize@1.0.0.
   Les voix *-low / *-x_low ont été entraînées avec un vocabulaire réduit
   à 130 phonèmes — elles produisent une erreur ONNX
   "indices element out of data bounds" à la synthèse et ne doivent pas
   être utilisées via cette librairie. */
/* Voix exposées dans l'UI (féminines uniquement, EVA est une fille). */
var SUPPORTED_VOICES = {
  'fr_FR-siwis-medium': true,
  'fr_FR-upmc-medium':  true,
};
/* Anciennes voix qu'on remappe automatiquement si elles remontent du
   localStorage d'un utilisateur ayant utilisé une version précédente. */
var BROKEN_VOICES = {
  'fr_FR-siwis-low':    'siwis-medium',
  'fr_FR-gilles-low':   'siwis-medium',
  'fr_FR-mls_1840-low': 'siwis-medium',
  'fr_FR-tom-medium':   'siwis-medium',  /* masculine retirée */
  'fr_FR-mls-medium':   'siwis-medium',  /* multi-locuteurs retirée */
};

var _engine        = null;     // module vits-web une fois chargé
var _engineLoading = null;     // promesse de chargement du module
var _voiceLoading  = {};       // { voiceId: Promise } modèles en cours de DL
var _voiceReady    = {};       // { voiceId: true } modèles déjà téléchargés
var _progress      = null;     // 0..1 pendant le téléchargement, sinon null
var _currentAudio  = null;
var _cancelled     = false;
var _lastError     = null;     // dernier message d'erreur (pour diagnose())

function _log(msg)        { try { console.log('[Piper TTS]', msg); } catch(_) {} }
function _warn(msg, e)    { try { console.warn('[Piper TTS]', msg, e || ''); } catch(_) {} }
function _err(msg, e)     { try { console.error('[Piper TTS]', msg, e || ''); } catch(_) {} _lastError = msg + (e && e.message ? ' — ' + e.message : ''); }

function _voiceIdFromConfig(config) {
  config = config || {};
  var v = config.piperVoice || DEFAULT_VOICE;
  /* Si l'utilisateur a une vieille préférence stockée pour une voix cassée,
     on la remplace silencieusement par l'équivalent fonctionnel et on prévient. */
  if (BROKEN_VOICES[v]) {
    var newer = 'fr_FR-' + BROKEN_VOICES[v];
    _warn('Voix « ' + v + ' » incompatible (vocab 130 trop petit pour le ' +
          'phonémiseur). Bascule automatique sur « ' + newer + ' ».');
    v = newer;
  }
  if (!SUPPORTED_VOICES[v]) {
    _warn('Voix « ' + v + ' » non vérifiée — utilisez de préférence : ' +
          Object.keys(SUPPORTED_VOICES).join(', '));
  }
  return v;
}

/* ─── Précheck du contexte navigateur ─────────────────────
   Lève une erreur explicite si le moteur ne pourra pas démarrer. */
function _checkEnvironment() {
  if (typeof window === 'undefined') {
    throw new Error('Pas de navigateur (window indisponible)');
  }
  if (!window.isSecureContext) {
    throw new Error('Contexte non sécurisé — Piper TTS exige HTTPS (ou localhost)');
  }
  if (typeof WebAssembly === 'undefined') {
    throw new Error('WebAssembly non supporté par ce navigateur');
  }
  if (!window.crossOriginIsolated) {
    /* Pas bloquant pour ONNX (il retombera en mono-thread) mais on prévient. */
    _warn('crossOriginIsolated=false → SharedArrayBuffer indisponible. ' +
          'Ajoutez les headers Cross-Origin-Opener-Policy: same-origin ' +
          'et Cross-Origin-Embedder-Policy: credentialless pour activer ' +
          'le multi-thread ONNX (Piper sera plus lent sans).');
  }
  if (!navigator.storage || typeof navigator.storage.getDirectory !== 'function') {
    /* OPFS absent → la lib échouera au cache du modèle. Mode privé Firefox p.ex. */
    throw new Error('OPFS indisponible — désactivez le mode privé du navigateur ' +
                    '(Piper a besoin de navigator.storage.getDirectory pour mettre ' +
                    'en cache le modèle de voix).');
  }
}

/* ─── Chargement du moteur (1 seule fois) ───────────────── */
function _loadEngine() {
  if (_engine) return Promise.resolve(_engine);
  if (_engineLoading) return _engineLoading;

  _checkEnvironment();
  _log('Chargement du moteur WebAssembly… (' + CDN_URL + ')');

  _engineLoading = import(/* @vite-ignore */ CDN_URL)
    .catch(function(e) {
      _warn('jsDelivr indisponible, tentative esm.sh…', e && e.message);
      return import(/* @vite-ignore */ CDN_FALLBACK);
    })
    .then(function(mod) {
      // vits-web exporte tout en namespace ; certaines versions exposent
      // aussi un default. On normalise.
      _engine = (mod && typeof mod.predict === 'function') ? mod
              : (mod && mod.default && typeof mod.default.predict === 'function') ? mod.default
              : mod;
      if (!_engine || typeof _engine.predict !== 'function') {
        throw new Error('Moteur Piper invalide (predict manquant) — ' +
                        'export reçu : ' + Object.keys(mod || {}).join(', '));
      }
      _log('Moteur prêt');
      return _engine;
    })
    .catch(function(e) {
      _engineLoading = null; // permet une nouvelle tentative
      _err('Échec chargement moteur', e);
      throw e;
    });
  return _engineLoading;
}

/* ─── Téléchargement (et cache navigateur) du modèle de voix ─ */
function _ensureVoice(voiceId) {
  if (_voiceReady[voiceId]) return Promise.resolve();
  if (_voiceLoading[voiceId]) return _voiceLoading[voiceId];

  _voiceLoading[voiceId] = _loadEngine()
    .then(function(engine) {
      // Si la voix est déjà en cache (OPFS), la fonction renvoie vite.
      _log('Téléchargement / vérification de la voix : ' + voiceId);
      _progress = 0;
      return engine.download(voiceId, function(p) {
        if (p && typeof p.loaded === 'number' && typeof p.total === 'number' && p.total > 0) {
          _progress = p.loaded / p.total;
        }
      });
    })
    .then(function() {
      _voiceReady[voiceId] = true;
      _progress = null;
      _log('Voix prête : ' + voiceId);
    })
    .catch(function(e) {
      delete _voiceLoading[voiceId];
      _progress = null;
      _err('Échec téléchargement voix ' + voiceId, e);
      throw e;
    });

  return _voiceLoading[voiceId];
}

/* ─── Synthèse ─────────────────────────────────────────── */
async function synthesize(text, config) {
  if (!text || !text.trim()) return null;
  var voiceId = _voiceIdFromConfig(config);
  try {
    var engine = await _loadEngine();
    await _ensureVoice(voiceId);
    var wav = await engine.predict({ text: text, voiceId: voiceId });
    return wav || null;     // Blob WAV
  } catch(e) {
    _err('Synthèse échouée', e);
    return null;
  }
}

/* ─── Lecture d'un Blob WAV ─────────────────────────────── */
function playBlob(blob) {
  return new Promise(function(resolve, reject) {
    if (!blob) { resolve(); return; }
    stop();
    var url = URL.createObjectURL(blob);
    var audio = new Audio(url);
    _currentAudio = audio;
    _cancelled = false;
    audio.onended = function() {
      URL.revokeObjectURL(url);
      if (_currentAudio === audio) _currentAudio = null;
      resolve();
    };
    audio.onerror = function() {
      URL.revokeObjectURL(url);
      if (_currentAudio === audio) _currentAudio = null;
      reject(new Error('Lecture audio Piper échouée'));
    };
    audio.play().catch(function(err) {
      URL.revokeObjectURL(url);
      if (_currentAudio === audio) _currentAudio = null;
      reject(err);
    });
  });
}

/* ─── Synthèse + lecture immédiate ─────────────────────── */
async function speak(text, config, onStart, onEnd) {
  if (!text || !text.trim()) return;
  try {
    if (typeof onStart === 'function') onStart();
    var blob = await synthesize(text, config);
    if (_cancelled) return;
    if (!blob) {
      throw new Error(_lastError || 'Synthèse Piper vide (voir console pour le détail)');
    }
    await playBlob(blob);
  } finally {
    if (typeof onEnd === 'function') onEnd();
  }
}

/* ─── Préchauffage (chargement moteur + modèle au repos) ─ */
async function warmup(config) {
  try {
    var voiceId = _voiceIdFromConfig(config);
    await _loadEngine();
    await _ensureVoice(voiceId);
    return true;
  } catch(e) {
    return false;
  }
}

/* ─── Stop ──────────────────────────────────────────────── */
function stop() {
  _cancelled = true;
  if (_currentAudio) {
    try { _currentAudio.pause(); _currentAudio.src = ''; } catch(_) {}
    _currentAudio = null;
  }
}

function getDownloadProgress() { return _progress; }

/* ─── Diagnostic ──────────────────────────────────────────
   À appeler depuis la console : window.PiperTTS.diagnose() */
function diagnose() {
  var report = {
    secureContext:        !!(typeof window !== 'undefined' && window.isSecureContext),
    crossOriginIsolated:  !!(typeof window !== 'undefined' && window.crossOriginIsolated),
    sharedArrayBuffer:    typeof SharedArrayBuffer !== 'undefined',
    webAssembly:          typeof WebAssembly !== 'undefined',
    opfs:                 !!(navigator.storage && typeof navigator.storage.getDirectory === 'function'),
    engineLoaded:         _engine !== null,
    voicesReady:          Object.keys(_voiceReady),
    lastError:            _lastError,
    cdn:                  CDN_URL
  };
  console.table(report);
  return report;
}

window.PiperTTS = {
  speak:               speak,
  synthesize:          synthesize,
  playBlob:            playBlob,
  warmup:              warmup,
  stop:                stop,
  getDownloadProgress: getDownloadProgress,
  diagnose:            diagnose,
  DEFAULT_VOICE:       DEFAULT_VOICE
};

})();
