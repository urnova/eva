#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Patch messages.js (latin-1) par position exacte — pas de décodage ambigu
"""

path = r'f:\code\eva\evaprojectmultiplatforme\eva-pc\web\js\app\messages.js'

with open(path, encoding='latin-1') as f:
    msg = f.read()

print(f'Lu {len(msg)} chars')

# ─── 1. hideTyping sendBtn fix ───────────────────────────────────────────────
# Trouver le bloc par ancres fiables
marker_start = "/* Ne restaurer le bouton Envoyer QUE si"
marker_if     = "if (!S.cwRunning) {"

idx_comment = msg.find(marker_start, 17000, 18500)   # zone connue
if idx_comment < 0:
    print('ERREUR: marqueur start non trouvé')
    exit(1)

idx_if = msg.find(marker_if, idx_comment, idx_comment + 300)
if idx_if < 0:
    print('ERREUR: if (!S.cwRunning) non trouvé après commentaire')
    exit(1)

# Trouver la } fermante du if en comptant les accolades
bz = msg[idx_if:]
depth = 0
end_rel = -1
for i, ch in enumerate(bz):
    if ch == '{': depth += 1
    elif ch == '}':
        depth -= 1
        if depth == 0:
            end_rel = i
            break

if end_rel < 0:
    print('ERREUR: accolade fermante non trouvée')
    exit(1)

bloc_start = idx_comment
bloc_end   = idx_if + end_rel + 1

old_bloc = msg[bloc_start:bloc_end]
print('OLD bloc (len {}):'.format(len(old_bloc)))
print(repr(old_bloc))

new_bloc = (
    "/* FIX v5.6.11 : sendBtn restaure TOUJOURS meme si cwRunning=true */\n"
    "  S.busy = false;\n"
    "  var sendBtn = document.getElementById('sendBtn');\n"
    "  var stopBtn = document.getElementById('stopBtn');\n"
    "  if (sendBtn && stopBtn) {\n"
    "    stopBtn.style.display = 'none';\n"
    "    sendBtn.style.display = 'inline-flex';\n"
    "    var input = document.getElementById('msgInput');\n"
    "    sendBtn.disabled = !(input && input.value.trim()) && (!S.images || !S.images.length) && (!S.documents || !S.documents.length);\n"
    "  }"
)

msg = msg[:bloc_start] + new_bloc + msg[bloc_end:]
print('hideTyping sendBtn fix OK')

# ─── 2. Safety timer : chercher le setTimeout cwRunning ─────────────────────
# Chercher le pattern "if (S.cwRunning) {\n        S.cwRunning = false;" + timer
import re
# Le timer est dans un setTimeout, chercher le }, NNNNNs);
# On cherche la zone Safety timer (autour de hasCW)
safety_zone = msg[49000:51000]   # zone connue (hasCW ~49500)
m_timer = re.search(r'Safety timer[^\n]*\n.*?\}, (\d+)\)', safety_zone, re.DOTALL)
if m_timer:
    old_val = m_timer.group(1)
    print(f'Safety timer trouvé: {old_val}ms')
    if old_val != '15000':
        safety_old = '}, ' + old_val + ');'
        safety_new = '}, 15000);'
        # Remplacer UNIQUEMENT dans la zone safety (pour ne pas toucher d'autres setTimeout)
        new_zone = safety_zone.replace(safety_old, safety_new, 1)
        msg = msg[:49000] + new_zone + msg[51000:]
        print(f'Safety timer {old_val} -> 15000 OK')
else:
    # Chercher plus large
    idx_cw_running_reset = msg.find("S.cwRunning = false;\n        console.warn('[EVA-CW] Safety timer")
    if idx_cw_running_reset >= 0:
        # Trouver le }, NNNNN); après
        end_zone = msg[idx_cw_running_reset:idx_cw_running_reset+200]
        m2 = re.search(r'\}, (\d+)\)', end_zone)
        if m2:
            old_val2 = m2.group(1)
            print(f'Safety timer (alt) trouve: {old_val2}ms')
            msg = msg[:idx_cw_running_reset] + end_zone.replace(f'}}, {old_val2})', '}, 15000)', 1) + msg[idx_cw_running_reset+200:]
        else:
            print('WARN: valeur timer non trouvée')
    else:
        print('WARN: Safety timer cwRunning reset non trouvé dans messages.js')

# ─── Vérification finale ──────────────────────────────────────────────────────
assert 'FIX v5.6.11' in msg, 'FIX absent après patch!'
print('Vérif OK: FIX v5.6.11 présent')

with open(path, 'w', encoding='latin-1') as f:
    f.write(msg)
print(f'messages.js sauvegardé ({len(msg)} chars)')
