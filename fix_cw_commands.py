import sys, re
sys.stdout.reconfigure(encoding='utf-8')

with open(r'eva-pc/web/js/features/pc-agent.js', 'r', encoding='utf-8', errors='replace') as f:
    pa = f.read()

# ═══ FIX 1 : sanitize undefined values avant Firestore ═══
# Et ajouter un helper + try/catch sur le cmdRef.update final
OLD_FINAL = """    // Mettre à jour Firebase avec le résultat final
    await cmdRef.update({
      status: status,
      result: resultData,
      updatedAt: typeof window.timestamp === 'function' ? window.timestamp() : new Date()
    });

    // Notifier le chat de la fin
    window.dispatchEvent(new CustomEvent('cw:task-done', {
      detail: { cmdId, status, result: resultData, type: data.type }
    }));

    // Cacher l'overlay après 2 secondes
    setTimeout(() => {
      if (window.eva && window.eva.overlay) window.eva.overlay.hide();
    }, 2000);
  }"""

NEW_FINAL = """    // Sanitiser les undefined pour Firestore (rejette undefined silencieusement)
    function _sanitize(obj) {
      if (obj === null || obj === undefined) return null;
      if (typeof obj !== 'object') return obj;
      var out = {};
      Object.keys(obj).forEach(function(k) {
        var v = obj[k];
        if (v === undefined) out[k] = null;
        else if (v !== null && typeof v === 'object' && !Array.isArray(v)) out[k] = _sanitize(v);
        else out[k] = v;
      });
      return out;
    }

    // Mettre à jour Firebase avec le résultat final
    try {
      await cmdRef.update({
        status: status,
        result: _sanitize(resultData),
        updatedAt: typeof window.timestamp === 'function' ? window.timestamp() : new Date()
      });
      console.log('[CloudWorks] Commande terminée:', data.type, '→', status);
    } catch(updateErr) {
      console.error('[CloudWorks] ERREUR mise à jour Firestore:', updateErr.message, '| status:', status, '| result size:', JSON.stringify(resultData || {}).length);
      // Fallback : stocker seulement le statut sans le résultat (évite les 1MB+ errors)
      try {
        await cmdRef.update({
          status: status,
          result: { error: 'Résultat trop volumineux pour Firestore: ' + updateErr.message },
          updatedAt: new Date()
        });
      } catch(e2) {
        console.error('[CloudWorks] DOUBLE ERREUR Firestore:', e2.message);
      }
    }

    // Notifier le chat de la fin
    window.dispatchEvent(new CustomEvent('cw:task-done', {
      detail: { cmdId, status, result: resultData, type: data.type }
    }));

    // Cacher l'overlay après 2 secondes
    setTimeout(() => {
      if (window.eva && window.eva.overlay) window.eva.overlay.hide();
    }, 2000);
  }"""

if OLD_FINAL in pa:
    pa = pa.replace(OLD_FINAL, NEW_FINAL, 1)
    print('FIX 1: sanitize + try/catch autour cmdRef.update final')
else:
    print('WARN: cmdRef.update final not found')

# ═══ FIX 2 : sysinfo — remplacer undefined par null/default ═══
OLD_SYSINFO = """        if (res.success) {
          resultData = {
            os: res.os.distro,
            hostname: res.os.hostname,
            uptime: Math.floor(res.os.uptime / 3600) + 'h',
            cpu: res.cpu.brand,
            ramTotal: Math.floor(res.mem.total / 1e9) + ' GB',
            ramFree: Math.floor(res.mem.free / 1e9) + ' GB',
            localIP: res.net[0]?.ip4 || '127.0.0.1'
          };
          await _updateStep(cmdRef, 'Infos récupérées ✓');
        } else throw new Error(res.error);"""

NEW_SYSINFO = """        if (res.success) {
          var osInfo = res.os || {};
          var cpuInfo = res.cpu || {};
          var memInfo = res.mem || {};
          var netInfo = (res.net && res.net.length) ? res.net[0] : {};
          var diskInfo = (res.disk && res.disk.length) ? res.disk[0] : {};
          resultData = {
            os: osInfo.distro || osInfo.platform || osInfo.release || 'Windows',
            hostname: osInfo.hostname || 'EVA Desktop',
            uptime: osInfo.uptime ? Math.floor(osInfo.uptime / 3600) + 'h' : '—',
            cpu: cpuInfo.brand || cpuInfo.manufacturer || 'CPU inconnu',
            cpuUsage: null,
            ramTotal: memInfo.total ? Math.floor(memInfo.total / 1e9) + ' GB' : '—',
            ramFree: memInfo.free ? Math.floor(memInfo.free / 1e9) + ' GB' : '—',
            ramUsage: (memInfo.total && memInfo.used) ? Math.round(memInfo.used / memInfo.total * 100) : null,
            diskTotal: diskInfo.size ? Math.floor(diskInfo.size / 1e9) + ' GB' : '—',
            diskFree: diskInfo.available ? Math.floor(diskInfo.available / 1e9) + ' GB' : '—',
            diskUsage: (diskInfo.size && diskInfo.used) ? Math.round(diskInfo.used / diskInfo.size * 100) : null,
            localIP: netInfo.ip4 || '127.0.0.1',
            publicIP: '—'
          };
          await _updateStep(cmdRef, 'Infos récupérées ✓');
        } else throw new Error(res.error || 'sysinfo failed');"""

if OLD_SYSINFO in pa:
    pa = pa.replace(OLD_SYSINFO, NEW_SYSINFO, 1)
    print('FIX 2: sysinfo — tous les champs safeguardés, plus de undefined')
else:
    print('WARN: sysinfo pattern not found')

with open(r'eva-pc/web/js/features/pc-agent.js', 'w', encoding='utf-8') as f:
    f.write(pa)
print('pc-agent.js saved')


# ═══ FIX 3 : Supprimer l'isInitialLoad inutile dans web cloudworks.js ═══
with open(r'EVA_V4_fixed_v4/js/features/cloudworks.js', 'r', encoding='utf-8', errors='replace') as f:
    cw = f.read()

OLD_IS = "function _handleResultsSnap(snap) {\n    if (isInitialLoad) return;"
NEW_IS = "function _handleResultsSnap(snap) {\n  // Traite tous les changements (added + modified) de statut done/error"
if OLD_IS in cw:
    cw = cw.replace(OLD_IS, NEW_IS, 1)
    print('FIX 3: isInitialLoad guard removed from _handleResultsSnap')
else:
    print('WARN: isInitialLoad pattern not found')

# ═══ FIX 4 : ajouter listener de fond pour les résultats (pas uniquement devices) ═══
OLD_BG_END = """// Se branche sur l'auth Firebase dès que possible
function _hookAuthForDeviceListener() {
  var maxRetry = 30, attempt = 0;
  var check = setInterval(function() {
    attempt++;
    if (attempt > maxRetry) { clearInterval(check); return; }
    if (window.firebase && window.firebase.auth) {
      clearInterval(check);
      window.firebase.auth().onAuthStateChanged(function(user) {
        if (user) {
          _startBackgroundDeviceListener(user.uid);
        } else {
          // Déconnexion → reset
          if (_bgDeviceUnsub) { _bgDeviceUnsub(); _bgDeviceUnsub = null; }
          if (window.S) window.S.cwDevices = [];
        }
      });
    } else if (window.S && window.S.user) {
      clearInterval(check);
      _startBackgroundDeviceListener(window.S.user.uid);
    }
  }, 500);
}
_hookAuthForDeviceListener();"""

NEW_BG_END = """// Se branche sur l'auth Firebase dès que possible
function _hookAuthForDeviceListener() {
  var maxRetry = 30, attempt = 0;
  var check = setInterval(function() {
    attempt++;
    if (attempt > maxRetry) { clearInterval(check); return; }
    if (window.firebase && window.firebase.auth) {
      clearInterval(check);
      window.firebase.auth().onAuthStateChanged(function(user) {
        if (user) {
          _startBackgroundDeviceListener(user.uid);
        } else {
          // Déconnexion → reset
          if (_bgDeviceUnsub) { _bgDeviceUnsub(); _bgDeviceUnsub = null; }
          if (window.S) window.S.cwDevices = [];
        }
      });
    } else if (window.S && window.S.user) {
      clearInterval(check);
      _startBackgroundDeviceListener(window.S.user.uid);
    }
  }, 500);
}
_hookAuthForDeviceListener();

// Listener de fond pour les RÉSULTATS — s'active dès l'auth, même si panneau CW fermé
var _bgResultsUnsub = null;
function _startBackgroundResultsListener(uid) {
  if (_bgResultsUnsub) return;
  if (!window.db) return;
  try {
    _bgResultsUnsub = window.db.collection('cloudworks').doc(uid).collection('commands')
      .orderBy('updatedAt', 'desc').limit(20)
      .onSnapshot(function(snap) {
        _handleResultsSnap(snap);
      }, function(err) {
        console.warn('[CW] Listener résultats fond erreur:', err);
      });
  } catch(e) {}
}
// Déclencher ce listener en même temps que le listener d'appareils
var _origHook = _startBackgroundDeviceListener;
_startBackgroundDeviceListener = function(uid) {
  _origHook(uid);
  _startBackgroundResultsListener(uid);
};"""

if OLD_BG_END in cw:
    cw = cw.replace(OLD_BG_END, NEW_BG_END, 1)
    print('FIX 4: background results listener ajouté, se déclenche à l\'auth')
else:
    print('WARN: bg auth hook not found for results listener extension')

with open(r'EVA_V4_fixed_v4/js/features/cloudworks.js', 'w', encoding='utf-8') as f:
    f.write(cw)
print('web cloudworks.js saved')
