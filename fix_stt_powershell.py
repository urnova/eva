import sys, re
sys.stdout.reconfigure(encoding='utf-8')

# ═══════════════════════════════════════════════════════════
# FIX STT : PowerShell Windows Speech Recognition dans Electron
# Remplace webkitSpeechRecognition qui nécessite la clé API Google
# ═══════════════════════════════════════════════════════════

# ─── 1. main.ts : ajouter handlers IPC stt:start et stt:stop ───
with open(r'eva-pc/electron/main.ts', 'r', encoding='utf-8', errors='replace') as f:
    mt = f.read()

STT_IPC = """
// ─── IPC Handlers — STT (Speech-to-Text via PowerShell Windows SR) ───
// webkitSpeechRecognition ne fonctionne pas dans Electron (pas de clé API Google)
// → Utilise System.Speech.Recognition de Windows, 100% offline
let _sttProcess: any = null;

ipcMain.handle('stt:start', async (event) => {
  if (_sttProcess) return { success: true, alreadyRunning: true };

  // Script PowerShell : reconnaissance vocale continue en français
  const psLines = [
    "Add-Type -AssemblyName System.Speech",
    "try { $r = New-Object System.Speech.Recognition.SpeechRecognitionEngine([System.Globalization.CultureInfo]::GetCultureInfo('fr-FR')) } catch { $r = New-Object System.Speech.Recognition.SpeechRecognitionEngine }",
    "$grammar = New-Object System.Speech.Recognition.DictationGrammar",
    "$r.LoadGrammar($grammar)",
    "$r.SetInputToDefaultAudioDevice()",
    "Register-ObjectEvent -InputObject $r -EventName 'SpeechRecognized' -Action { param($s,$e); $txt=$e.Result.Text; [Console]::Out.WriteLine($txt); [Console]::Out.Flush() } | Out-Null",
    "$r.RecognizeAsync([System.Speech.Recognition.RecognizeMode]::Multiple)",
    "while($true) { Start-Sleep -Seconds 1 }"
  ];
  const psCmd = psLines.join('; ');

  try {
    const { spawn: _spawn } = require('child_process');
    _sttProcess = _spawn('powershell', ['-NoProfile', '-NonInteractive', '-Command', psCmd], {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true
    });

    _sttProcess.stdout.on('data', (data: Buffer) => {
      const text = data.toString().trim();
      if (text && mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('stt:result', { text });
      }
    });

    _sttProcess.stderr.on('data', (data: Buffer) => {
      const msg = data.toString().trim();
      if (msg) console.warn('[STT] PowerShell stderr:', msg);
    });

    _sttProcess.on('exit', (code: number) => {
      console.log('[STT] PowerShell exited, code:', code);
      _sttProcess = null;
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('stt:stopped', {});
      }
    });

    console.log('[STT] PowerShell Windows STT démarré');
    return { success: true };
  } catch(e) {
    console.error('[STT] Erreur spawn PowerShell:', e);
    return { success: false, error: String(e) };
  }
});

ipcMain.handle('stt:stop', async () => {
  if (_sttProcess) {
    try { _sttProcess.kill(); } catch(e) {}
    _sttProcess = null;
  }
  return { success: true };
});
"""

# Insérer après le handler screenshot
ANCHOR = "// ─── IPC Handlers — Filesystem ───"
if ANCHOR in mt:
    mt = mt.replace(ANCHOR, STT_IPC + '\n' + ANCHOR, 1)
    print('FIX main.ts: stt:start et stt:stop IPC handlers ajoutés')
else:
    print('WARN: Anchor not found in main.ts, appending at end before last line')
    # Fallback: append before the last closing brace
    mt = mt.rstrip() + '\n' + STT_IPC

with open(r'eva-pc/electron/main.ts', 'w', encoding='utf-8') as f:
    f.write(mt)
print('main.ts saved')


# ─── 2. preload.ts : exposer stt bridge ───
with open(r'eva-pc/electron/preload.ts', 'r', encoding='utf-8', errors='replace') as f:
    pre = f.read()

STT_BRIDGE = """
  // ── STT (Speech-to-Text — PowerShell Windows) ──
  stt: {
    start: () => ipcRenderer.invoke('stt:start'),
    stop: () => ipcRenderer.invoke('stt:stop'),
    onResult: (callback: (result: {text: string}) => void) => {
      ipcRenderer.removeAllListeners('stt:result');
      ipcRenderer.on('stt:result', (_: unknown, result: {text: string}) => callback(result));
    },
    onStopped: (callback: () => void) => {
      ipcRenderer.removeAllListeners('stt:stopped');
      ipcRenderer.on('stt:stopped', () => callback());
    },
    offAll: () => {
      ipcRenderer.removeAllListeners('stt:result');
      ipcRenderer.removeAllListeners('stt:stopped');
    }
  },
"""

# Insérer après le bloc cloudworks
ANCHOR2 = "  // ── LLM status"
if ANCHOR2 in pre:
    pre = pre.replace(ANCHOR2, STT_BRIDGE + '  // ── LLM status', 1)
    print('FIX preload.ts: stt bridge ajouté')
else:
    print('WARN: LLM status anchor not found in preload.ts')

with open(r'eva-pc/electron/preload.ts', 'w', encoding='utf-8') as f:
    f.write(pre)
print('preload.ts saved')


# ─── 3. stt.js : réécrire pour utiliser PowerShell dans Electron ───
NEW_STT_JS = r"""(function() {
'use strict';

var _onResultCallback = null;
var _onEndCallback = null;
var _isListening = false;
var _useElectronSTT = false;

/* ── Détection Electron ── */
function _isElectron() {
  return !!(window.eva && window.eva.stt && typeof window.eva.stt.start === 'function');
}

function isSupported() {
  return _isElectron() || !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

/* ════════════════════════════════════════════════════════
   MODE ELECTRON : PowerShell Windows Speech Recognition
   ← 100% offline, ne nécessite pas la clé API Google
════════════════════════════════════════════════════════ */
function _startElectronSTT() {
  window.eva.stt.onResult(function(result) {
    if (!_isListening) return;
    if (result && result.text && _onResultCallback) {
      _onResultCallback(result.text, true); // final=true
    }
  });

  window.eva.stt.onStopped(function() {
    _isListening = false;
    _useElectronSTT = false;
    if (_onEndCallback) _onEndCallback();
  });

  window.eva.stt.start().then(function(res) {
    if (res && res.success) {
      _isListening = true;
      _useElectronSTT = true;
      console.log('[STT] PowerShell Windows STT démarré');
    } else {
      console.error('[STT] Erreur démarrage:', res && res.error);
      if (_onEndCallback) _onEndCallback();
    }
  }).catch(function(e) {
    console.error('[STT] Échec démarrage:', e);
    if (_onEndCallback) _onEndCallback();
  });
}

function _stopElectronSTT() {
  _isListening = false;
  _useElectronSTT = false;
  if (window.eva && window.eva.stt) {
    window.eva.stt.stop();
    window.eva.stt.offAll();
  }
}

/* ════════════════════════════════════════════════════════
   MODE WEB : webkitSpeechRecognition (navigateur seulement)
════════════════════════════════════════════════════════ */
var _webRecognition = null;
var _shouldKeepListening = false;
var _committed = '';

function _buildWebRecognition() {
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return null;
  var r = new SR();
  r.lang = 'fr-FR';
  r.continuous = true;
  r.interimResults = true;
  r.maxAlternatives = 1;

  r.onresult = function(event) {
    var interim = '', newFinal = '';
    for (var i = event.resultIndex; i < event.results.length; i++) {
      var t = event.results[i][0].transcript;
      if (event.results[i].isFinal) { newFinal += t; }
      else { interim += t; }
    }
    if (newFinal) _committed += (_committed ? ' ' : '') + newFinal.trim();
    var display = _committed + (interim ? (_committed ? ' ' : '') + interim : '');
    if (_onResultCallback) _onResultCallback(display, false);
  };

  r.onstart = function() { _isListening = true; };

  r.onend = function() {
    _isListening = false;
    if (_shouldKeepListening) {
      try { r.start(); _isListening = true; }
      catch(e) { _shouldKeepListening = false; if (_onEndCallback) _onEndCallback(); }
    } else {
      if (_onEndCallback) _onEndCallback();
    }
  };

  r.onerror = function(e) {
    if (e.error === 'no-speech' && _shouldKeepListening) return;
    if (e.error === 'network') {
      console.warn('[STT] webkitSpeechRecognition: erreur réseau — clé API Google absente dans Electron');
      _isListening = false;
      _shouldKeepListening = false;
      if (_onEndCallback) _onEndCallback();
      return;
    }
    console.warn('[STT] Erreur:', e.error);
    _isListening = false;
    if (!_shouldKeepListening && _onEndCallback) _onEndCallback();
  };

  return r;
}

/* ════════════════════════════════════════════════════════
   API PUBLIQUE
════════════════════════════════════════════════════════ */
function startListening(onResult, onEnd) {
  _onResultCallback = onResult || null;
  _onEndCallback    = onEnd   || null;
  _committed        = '';

  if (_isElectron()) {
    _startElectronSTT();
    return true;
  }

  // Fallback navigateur
  _shouldKeepListening = true;
  if (!_webRecognition) _webRecognition = _buildWebRecognition();
  if (!_webRecognition) { console.error('[STT] Aucun moteur disponible'); return false; }
  if (_isListening) return true;
  try { _webRecognition.start(); _isListening = true; return true; }
  catch(e) { console.error('[STT] Erreur start:', e); return false; }
}

function stopListening() {
  if (_useElectronSTT) {
    _stopElectronSTT();
    if (_onEndCallback) _onEndCallback();
    return;
  }
  _shouldKeepListening = false;
  if (_webRecognition && _isListening) {
    try { _webRecognition.stop(); } catch(e) {}
    _isListening = false;
  }
}

function getIsListening() { return _isListening; }

/* Exposer l'API globale */
window.EVAVoice = window.EVAVoice || {};
window.EVAVoice.startListening = startListening;
window.EVAVoice.stopListening  = stopListening;
window.EVAVoice.isListening    = getIsListening;
window.EVAVoice.isSupported    = isSupported;
window.EVAVoice.startSTT       = startListening;
window.EVAVoice.stopSTT        = stopListening;

})();
"""

with open(r'eva-pc/web/js/voice/stt.js', 'w', encoding='utf-8') as f:
    f.write(NEW_STT_JS)
print('FIX stt.js: réécrit pour PowerShell Windows STT (offline)')

print('\nTous les FIX STT appliqués.')
