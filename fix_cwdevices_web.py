import sys
sys.stdout.reconfigure(encoding='utf-8')

# ═══════════════════════════════════════════════════════
# FIX 1: S.cwDevices population dans web cloudworks.js
# ═══════════════════════════════════════════════════════
with open(r'EVA_V4_fixed_v4/js/features/cloudworks.js', 'r', encoding='utf-8') as f:
    wc = f.read()

# Inject S.cwDevices population right before _setStats in renderDevices
OLD = """  var totalCount = 0, onlineCount = 0;
  list.innerHTML = '';

  snap.forEach(function(doc) {"""

NEW = """  var totalCount = 0, onlineCount = 0;
  list.innerHTML = '';
  var _cwDevArr = []; /* peuple S.cwDevices pour le system prompt EVA */

  snap.forEach(function(doc) {"""

if OLD in wc:
    wc = wc.replace(OLD, NEW, 1)
    print('FIX 1a: Added _cwDevArr to renderDevices')
else:
    print('WARN FIX 1a: pattern not found')

# Find the end of snap.forEach to populate S.cwDevices
OLD2 = """  _setStats(totalCount, onlineCount, totalCount - onlineCount);
}"""

# Check if we can find the stat setting
idx2 = wc.find('_setStats(totalCount, onlineCount,')
if idx2 >= 0:
    # Find the closing } after _setStats
    end = wc.find('\n}', idx2)
    old_seg = wc[idx2:end+2]
    new_seg = """  /* Mettre à jour S.cwDevices pour le system prompt EVA */
  if (window.S) window.S.cwDevices = _cwDevArr;
  window._cwDevicesCache = _cwDevArr;
  _setStats(totalCount, onlineCount, totalCount - onlineCount);
}"""
    wc = wc.replace(old_seg, new_seg, 1)
    print('FIX 1b: S.cwDevices assignment added after _setStats')
else:
    print('WARN FIX 1b: _setStats pattern not found')

# Also push device data into _cwDevArr inside snap.forEach
# Find where d.online is computed
OLD3 = """    totalCount++;
    if (online) onlineCount++;"""
if OLD3 in wc:
    wc = wc.replace(OLD3, """    totalCount++;
    if (online) onlineCount++;
    _cwDevArr.push(Object.assign({}, d, { online: online }));""", 1)
    print('FIX 1c: _cwDevArr.push added')
else:
    # Try to find the totalCount++ and add after
    idx3 = wc.find('totalCount++;')
    if idx3 >= 0:
        print('WARN FIX 1c: totalCount at', idx3, repr(wc[idx3:idx3+60]))

with open(r'EVA_V4_fixed_v4/js/features/cloudworks.js', 'w', encoding='utf-8') as f:
    f.write(wc)
print('Web cloudworks.js saved')
