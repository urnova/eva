import sys
sys.stdout.reconfigure(encoding='utf-8')

# ═══════════════════════════════════════════════════════════
# 1. pc-agent.js : ID par adresse MAC (stable, pas de doublon)
# ═══════════════════════════════════════════════════════════
with open(r'eva-pc/web/js/features/pc-agent.js', 'r', encoding='utf-8', errors='replace') as f:
    pa = f.read()

OLD_REGISTER_ID = """      // Récupérer un deviceId persistant ou en créer un
      deviceId = localStorage.getItem('cw_device_id');
      if (!deviceId) {
        deviceId = 'PC-' + Math.random().toString(36).substr(2, 9).toUpperCase();
        localStorage.setItem('cw_device_id', deviceId);
      }
      // Exposer globalement pour le system prompt
      window._cwDeviceId = deviceId;

      let osInfo = 'Windows';
      let localIP = '127.0.0.1';
      let hostname = 'EVA Desktop';

      if (window.eva && window.eva.system) {
        try {
          const info = await window.eva.system.info();
          if (info.success && info.os) {
            osInfo = info.os.distro || info.os.platform;
            hostname = info.os.hostname || 'EVA Desktop';
          }
          if (info.success && info.net) {
            const defaultNet = info.net.find(n => n.ip4 && !n.internal);
            if (defaultNet) localIP = defaultNet.ip4;
          }
        } catch(e){}
      }"""

NEW_REGISTER_ID = """      let osInfo = 'Windows';
      let localIP = '127.0.0.1';
      let hostname = 'EVA Desktop';
      let macAddress = null;

      // Récupérer les infos système (dont l'adresse MAC stable)
      if (window.eva && window.eva.system) {
        try {
          const info = await window.eva.system.info();
          if (info.success && info.os) {
            osInfo = info.os.distro || info.os.platform || 'Windows';
            hostname = info.os.hostname || 'EVA Desktop';
          }
          if (info.success && info.net) {
            // Chercher la première interface physique avec IP + MAC
            const physNet = info.net.find(n => n.ip4 && !n.internal && n.mac && n.mac !== '00:00:00:00:00:00');
            if (physNet) {
              localIP = physNet.ip4;
              macAddress = physNet.mac;
            }
          }
        } catch(e){}
      }

      // ID stable basé sur l'adresse MAC (évite les doublons à chaque reconnexion)
      // Si la MAC est disponible → utiliser MAC-XX-XX-XX-XX-XX-XX
      // Sinon → fallback sur l'ancien ID aléatoire stocké en localStorage
      if (macAddress) {
        deviceId = 'MAC-' + macAddress.replace(/:/g, '-').toUpperCase();
        localStorage.setItem('cw_device_id', deviceId); // Mettre à jour si changé
      } else {
        deviceId = localStorage.getItem('cw_device_id');
        if (!deviceId) {
          deviceId = 'PC-' + Math.random().toString(36).substr(2, 9).toUpperCase();
          localStorage.setItem('cw_device_id', deviceId);
        }
      }
      // Exposer globalement pour le system prompt
      window._cwDeviceId = deviceId;"""

if OLD_REGISTER_ID in pa:
    pa = pa.replace(OLD_REGISTER_ID, NEW_REGISTER_ID, 1)
    print('FIX pc-agent: ID basé sur MAC address')
else:
    print('WARN: registerDevice ID pattern not found in pc-agent.js')

# Ajouter macAddress dans le docRef.set
OLD_SET = """      await docRef.set({
        deviceId: deviceId,
        deviceName: hostname || 'EVA Desktop',
        deviceType: 'windows',
        localIP: localIP,
        osVersion: osInfo,
        online: true,
        lastSeen: ts,
        sessionId: (window.S && window.S.sessionId) ? window.S.sessionId : null,
        appVersion: (window.eva && window.eva.app) ? await window.eva.app.version().catch(()=>'?') : '?'
      }, { merge: true });"""

NEW_SET = """      await docRef.set({
        deviceId: deviceId,
        deviceName: hostname || 'EVA Desktop',
        deviceType: 'windows',
        localIP: localIP,
        macAddress: macAddress || null,
        osVersion: osInfo,
        online: true,
        lastSeen: ts,
        sessionId: (window.S && window.S.sessionId) ? window.S.sessionId : null,
        appVersion: (window.eva && window.eva.app) ? await window.eva.app.version().catch(()=>'?') : '?'
      }, { merge: true }); // merge:true = réutilise le document existant si même MAC"""

if OLD_SET in pa:
    pa = pa.replace(OLD_SET, NEW_SET, 1)
    print('FIX pc-agent: macAddress ajoutée dans Firestore')
else:
    print('WARN: docRef.set pattern not found')

with open(r'eva-pc/web/js/features/pc-agent.js', 'w', encoding='utf-8') as f:
    f.write(pa)
print('pc-agent.js saved')


# ═══════════════════════════════════════════════════════════
# 2. web cloudworks.js : MAX_LOG=4, meilleurs labels agentic_task
# ═══════════════════════════════════════════════════════════
with open(r'EVA_V4_fixed_v4/js/features/cloudworks.js', 'r', encoding='utf-8', errors='replace') as f:
    cw = f.read()

# Changer MAX_LOG de 20 à 4
cw = cw.replace('var MAX_LOG = 20;', 'var MAX_LOG = 4;', 1)
print('FIX web cw: MAX_LOG → 4')

# Améliorer les labels dans cwCmd (au moment de la demande, on a le payload)
OLD_LABELS_CMD = """    var labels = {
      screenshot: '📸 Capture demandée…',
      sysinfo: '📊 Infos système demandées…',
      lock: '🔒 Verrouillage…',
      sleep: '💤 Mise en veille…',
      shutdown: '⏻ Extinction…',
      run_script: '⚡ Script envoyé…',
      open_ide_file: '💻 Ouverture dans l\\'IDE…'
    };
    if (window.toast) window.toast(labels[type] || 'Commande envoyée', 'success');
    _addLogEntry({type: type, deviceId: deviceId, status: 'pending', createdAt: new Date(), cmdId: ref.id});"""

NEW_LABELS_CMD = """    var labels = {
      screenshot: '📸 Capture demandée…',
      sysinfo: '📊 Infos système demandées…',
      lock: '🔒 Verrouillage…',
      sleep: '💤 Mise en veille…',
      shutdown: '⏻ Extinction…',
      run_script: '⚡ Script envoyé…',
      open_ide_file: '💻 Ouverture dans l\\'IDE…',
      agentic_task: '🤖 Tâche IA…'
    };
    // Pour agentic_task : afficher le début du prompt dans le label
    var entryLabel = labels[type] || type;
    if (type === 'agentic_task' && payload && payload.prompt) {
      var shortPrompt = payload.prompt.trim().replace(/\\s+/g, ' ');
      entryLabel = '🤖 ' + (shortPrompt.length > 48 ? shortPrompt.substring(0, 48) + '…' : shortPrompt);
    } else if (type === 'run_script' && payload && payload.command) {
      entryLabel = '⚡ ' + (payload.command.length > 42 ? payload.command.substring(0, 42) + '…' : payload.command);
    }
    if (window.toast) window.toast(labels[type] || 'Commande envoyée', 'success');
    _addLogEntry({type: type, deviceId: deviceId, status: 'pending', label: entryLabel, createdAt: new Date(), cmdId: ref.id});"""

if OLD_LABELS_CMD in cw:
    cw = cw.replace(OLD_LABELS_CMD, NEW_LABELS_CMD, 1)
    print('FIX web cw: labels cwCmd améliorés (prompt visible)')
else:
    print('WARN: labels cwCmd pattern not found')

# Améliorer _updateLogEntry pour préserver le label original si défini
OLD_UPDATE_ENTRY = """  var entry = {
    type: data.type,
    deviceId: data.deviceId,
    status: data.status,
    label: typeLabels[data.type] || data.type,
    createdAt: data.updatedAt && data.updatedAt.toDate ? data.updatedAt.toDate() : new Date()
  };"""

NEW_UPDATE_ENTRY = """  // Pour agentic_task : afficher le début du prompt si disponible
  var entryLabel = typeLabels[data.type] || data.type;
  if (data.type === 'agentic_task' && data.payload && data.payload.prompt) {
    var p = data.payload.prompt.trim().replace(/\\s+/g, ' ');
    entryLabel = '🤖 ' + (p.length > 48 ? p.substring(0, 48) + '…' : p);
  } else if (data.type === 'run_script' && data.payload && data.payload.command) {
    entryLabel = '⚡ ' + (data.payload.command.length > 42 ? data.payload.command.substring(0, 42) + '…' : data.payload.command);
  }
  var entry = {
    type: data.type,
    deviceId: data.deviceId,
    status: data.status,
    label: entryLabel,
    createdAt: data.updatedAt && data.updatedAt.toDate ? data.updatedAt.toDate() : new Date()
  };"""

if OLD_UPDATE_ENTRY in cw:
    cw = cw.replace(OLD_UPDATE_ENTRY, NEW_UPDATE_ENTRY, 1)
    print('FIX web cw: _updateLogEntry affiche le prompt de la tâche')
else:
    print('WARN: _updateLogEntry entry pattern not found')

# Ajouter agentic_task dans les typeLabels de _updateLogEntry
OLD_TYPE_LABELS = """  var typeLabels = {
    screenshot: '📸 Capture',
    sysinfo: '📊 Infos système',
    lock: '🔒 Verrouillage',
    sleep: '💤 Veille',
    shutdown: '⏻ Extinction',
    run_script: '⚡ Script',
    open_ide_file: '💻 IDE'
  };"""

NEW_TYPE_LABELS = """  var typeLabels = {
    screenshot: '📸 Capture',
    sysinfo: '📊 Infos système',
    lock: '🔒 Verrouillage',
    sleep: '💤 Veille',
    shutdown: '⏻ Extinction',
    run_script: '⚡ Script',
    open_ide_file: '💻 IDE',
    agentic_task: '🤖 Tâche IA'
  };"""

if OLD_TYPE_LABELS in cw:
    cw = cw.replace(OLD_TYPE_LABELS, NEW_TYPE_LABELS, 1)
    print('FIX web cw: agentic_task ajouté dans typeLabels')
else:
    print('WARN: typeLabels pattern not found')

# Afficher aussi l'adresse MAC dans la carte d'appareil
OLD_CARD_SUB = "'\u003cdiv class=\"cw-card-sub\"\u003e' + typeLabel + ' · ' + esc(d.deviceId || d.id) + '\u003c/div\u003e' +"
NEW_CARD_SUB = "'\u003cdiv class=\"cw-card-sub\"\u003e' + typeLabel + (d.macAddress ? ' · ' + esc(d.macAddress) : ' · ' + esc(d.deviceId || d.id)) + '\u003c/div\u003e' +"

if OLD_CARD_SUB in cw:
    cw = cw.replace(OLD_CARD_SUB, NEW_CARD_SUB, 1)
    print('FIX web cw: carte appareil affiche MAC à la place du deviceId random')
else:
    print('WARN: card sub pattern not found')

with open(r'EVA_V4_fixed_v4/js/features/cloudworks.js', 'w', encoding='utf-8') as f:
    f.write(cw)
print('web cloudworks.js saved')
print('\nTous les FIX appliqués.')
