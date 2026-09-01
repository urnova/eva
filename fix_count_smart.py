import sys
sys.stdout.reconfigure(encoding='utf-8')

# ═══ FIX 4: Device count includes this PC ═══
with open(r'eva-pc/web/js/features/cloudworks.js', 'r', encoding='utf-8') as f:
    pc = f.read()

# In _renderDevices, this PC is filtered out but not counted
# Add this PC to the online count before the forEach
OLD_RENDER = """function _renderDevices(snap) {
  var list = document.getElementById('cwDeviceListInner');
  var statOnline = document.getElementById('cwStatOnline');
  var statOffline = document.getElementById('cwStatOffline');
  if (!list) return;
  if (snap.empty) {
    list.innerHTML = '<div class="cw-empty">Aucun autre appareil enregistré</div>';
    if (statOnline) statOnline.textContent = '0';
    if (statOffline) statOffline.textContent = '0';
    return;
  }

  var onlineCount = 0, offlineCount = 0;
  var html = '';
  var myId = window._cwDeviceId || localStorage.getItem('cw_device_id');"""

NEW_RENDER = """function _renderDevices(snap) {
  var list = document.getElementById('cwDeviceListInner');
  var statOnline = document.getElementById('cwStatOnline');
  var statOffline = document.getElementById('cwStatOffline');
  if (!list) return;

  var myId = window._cwDeviceId || localStorage.getItem('cw_device_id');

  if (snap.empty) {
    list.innerHTML = '<div class="cw-empty">Aucun autre appareil enregistré</div>';
    // Ce PC est toujours en ligne (on est dessus)
    if (statOnline) statOnline.textContent = myId ? '1' : '0';
    if (statOffline) statOffline.textContent = '0';
    return;
  }

  // Ce PC compte comme 1 en ligne (on l'exclut de la liste mais pas du total)
  var onlineCount = myId ? 1 : 0, offlineCount = 0;
  var html = '';"""

if OLD_RENDER in pc:
    pc = pc.replace(OLD_RENDER, NEW_RENDER, 1)
    print('FIX 4: device count includes this PC')
else:
    print('WARN FIX 4: pattern not found')
    idx = pc.find('function _renderDevices')
    print('Found at:', idx)
    print(pc[idx:idx+400])

with open(r'eva-pc/web/js/features/cloudworks.js', 'w', encoding='utf-8') as f:
    f.write(pc)
print('PC cloudworks.js saved')


# ═══ FIX 7: Smart CloudWorks detection in system prompt (PC) ═══
with open(r'eva-pc/web/js/app/messages.js', 'r', encoding='utf-8') as f:
    msgspc = f.read()

INJECT_SMART = """
    userCtx += '\\nDÉTECTION AUTOMATIQUE CLOUDWORKS :\\n';
    userCtx += 'Si l\\'utilisateur mentionne un chemin EXPLICITE sur son système (sur mon Bureau, dans mes Documents, dans C:\\\\\\\\, dans /home/, sur le disque dur, dans le dossier X, etc.) → c\\'est une tâche CloudWorks, PAS un fichier dans le chat.\\n';
    userCtx += 'Si la demande est générique sans chemin (ex: crée-moi un document sur les tomates) → crée le fichier dans le chat.\\n';
    userCtx += 'Si tu as un doute raisonnable sur l\\'intention → demande : "Veux-tu que je crée ce fichier sur ton PC (via CloudWorks) ou directement ici dans le chat ?"\\n';
"""

# Insert right before the final "return" of buildSystemPrompt or before the cwDevices block
INSERT_BEFORE = "  if (window.S) window.S.cwDevices = devicesArr;"
if INSERT_BEFORE in msgspc:
    print('WARN: wrong file context for smart CW')

# Actually insert at end of PC note block
PC_END = "    userCtx += '- Si CloudWorks est désactivé"
idx = msgspc.find(PC_END)
if idx >= 0:
    # Find end of that line
    eol = msgspc.find('\\n', idx) + 2  # skip \\n and '
    eol2 = msgspc.find('\n', eol)
    # Insert the smart detection block after the CloudWorks disabled note
    insert_at = msgspc.find('\n', msgspc.find("'- Identifie-toi comme étant sur ce PC précis", idx)) + 1
    if insert_at > 1:
        msgspc = msgspc[:insert_at] + INJECT_SMART + msgspc[insert_at:]
        print('FIX 7 PC: smart CW detection added')
    else:
        print('WARN FIX 7 PC: insert point not found')
else:
    print('WARN FIX 7 PC: PC_END not found')

with open(r'eva-pc/web/js/app/messages.js', 'w', encoding='utf-8') as f:
    f.write(msgspc)


# Same for web messages.js
with open(r'EVA_V4_fixed_v4/js/app/messages.js', 'r', encoding='utf-8') as f:
    msgsweb = f.read()

WEB_DETECT = """
    userCtx += '\\nDÉTECTION AUTOMATIQUE CLOUDWORKS :\\n';
    userCtx += 'Si la demande mentionne un chemin système explicite (Bureau, Documents, C:\\\\\\\\, /home/, dossier X, disque dur, etc.) → tâche CloudWorks sur le PC en ligne.\\n';
    userCtx += 'Si générique sans chemin → crée dans le chat. Si doute → demande confirmation.\\n';
"""

# Insert near the end of the web CW block
WEB_INSERT_BEFORE = "    if (offlinePCs.length > 0) {"
idx_w = msgsweb.rfind(WEB_INSERT_BEFORE)
if idx_w >= 0:
    msgsweb = msgsweb[:idx_w] + WEB_DETECT + '\n    ' + msgsweb[idx_w:]
    print('FIX 7 Web: smart CW detection added')
else:
    print('WARN FIX 7 Web: insert point not found')

with open(r'EVA_V4_fixed_v4/js/app/messages.js', 'w', encoding='utf-8') as f:
    f.write(msgsweb)

print('All done')
