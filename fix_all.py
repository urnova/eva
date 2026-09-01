import sys, re
sys.stdout.reconfigure(encoding='utf-8')

# ═══ FIX 1: S.cwDevices dans web cloudworks.js ═══
with open(r'EVA_V4_fixed_v4/js/features/cloudworks.js', 'r', encoding='utf-8') as f:
    wc = f.read()

# Find renderDevices function and add S.cwDevices population
OLD_CW = "function renderDevices(snap) {\n  var list = document.getElementById('cwDeviceList');\n  if (!list) return;\n  if (snap.empty) {\n    list.innerHTML = '<div class=\"cw-empty\"><div class=\"cw-empty-icon\">\\uD83D\\uDCBB</div><div class=\"cw-empty-title\">AUCUN APPAREIL CONNECTÉ</div>Installez EVA Desktop sur votre PC pour qu\\'il apparaisse ici automatiquement.</div>';\n    _setStats(0, 0, 0);\n    return;\n  }"
idx = wc.find('function renderDevices(snap)')
if idx >= 0:
    end = wc.find('\n  var totalCount', idx)
    old_seg = wc[idx:end]
    new_seg = old_seg + """
  /* ── Populate S.cwDevices for EVA system prompt ── */
  var devicesArr = [];
  snap.forEach(function(doc) {
    var d = Object.assign({id: doc.id}, doc.data());
    var online = d.online === true;
    if (online && d.lastSeen && d.lastSeen.toDate) {
      if (Date.now() - d.lastSeen.toDate().getTime() > 120000) online = false;
    }
    devicesArr.push(Object.assign({}, d, { online: online }));
  });
  if (window.S) window.S.cwDevices = devicesArr;
  window._cwDevicesCache = devicesArr;
"""
    wc = wc.replace(old_seg, new_seg, 1)
    print('FIX 1: S.cwDevices population added in web cloudworks.js')
else:
    # Try simpler approach - add after the snap.forEach
    idx2 = wc.find('snap.forEach(function(doc)')
    print(f'FIX 1: renderDevices not found directly, snap.forEach at {idx2}')

with open(r'EVA_V4_fixed_v4/js/features/cloudworks.js', 'w', encoding='utf-8') as f:
    f.write(wc)

print('Done')
