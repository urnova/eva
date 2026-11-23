#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Patch messages.js (latin-1) :
1. hideTyping : restaure toujours le sendBtn (supprimer la condition cwRunning)
2. Safety timer CW : réduire de 60s à 15s
"""
import re

path = r'f:\code\eva\evaprojectmultiplatforme\eva-pc\web\js\app\messages.js'

with open(path, encoding='latin-1') as f:
    msg = f.read()

print(f'Lu {len(msg)} chars, hideTyping:{msg.count("hideTyping")}, cwRunning:{msg.count("cwRunning")}')

# ─── 1. hideTyping sendBtn fix ───────────────────────────────────────────────
# La chaîne exacte (en latin-1 : \xe2 = â dans "tâche")
OLD_BLOCK = (
    "  /* Ne restaurer le bouton Envoyer QUE si aucune t\xe2che CloudWorks n'est en cours */\n"
    "  if (!S.cwRunning) {\n"
    "    var sendBtn = document.getElementById('sendBtn');\n"
    "    var stopBtn = document.getElementById('stopBtn');\n"
    "    if (sendBtn && stopBtn) {\n"
    "      stopBtn.style.display = 'none';\n"
    "      sendBtn.style.display = 'inline-flex';\n"
    "      var input = document.getElementById('msgInput');\n"
    "      sendBtn.disabled = !(input && input.value.trim()) && (!S.images || !S.images.length) && (!S.documents || !S.documents.length);\n"
    "    }\n"
    "  }"
)
NEW_BLOCK = (
    "  /* FIX v5.6.11 : restaurer TOUJOURS le sendBtn meme si cwRunning=true */\n"
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

if OLD_BLOCK in msg:
    msg = msg.replace(OLD_BLOCK, NEW_BLOCK, 1)
    print('hideTyping sendBtn fix OK')
else:
    # Debug: afficher ce qu'on trouve autour du marqueur
    idx = msg.find("Ne restaurer le bouton Envoyer")
    if idx >= 0:
        print(f'WARN: marqueur trouvé pos {idx} mais OLD_BLOCK non exact')
        print('extrait:', repr(msg[idx:idx+400]))
    else:
        print('ERREUR: marqueur introuvable dans messages.js')

# ─── 2. Safety timer 60s → 15s ──────────────────────────────────────────────
# Chercher le setTimeout spécifique au safety timer CW
OLD_TIMER = (
    "    setTimeout(function() {\n"
    "      if (S.cwRunning) {\n"
    "        S.cwRunning = false;\n"
)
# Ce bloc existe avec 60000 à la fin
c60 = msg.count("60000")
c90 = msg.count("90000")
print(f'60000 occurrences: {c60}, 90000 occurrences: {c90}')

if c60 > 0:
    msg = msg.replace("}, 60000);", "}, 15000);")
    print('Safety timer 60000 -> 15000 OK')
else:
    # Chercher d'autres valeurs autour du safety timer
    idx2 = msg.find("Safety timer")
    if idx2 >= 0:
        print('Safety timer trouvé pos', idx2, ':', repr(msg[idx2:idx2+150]))
    else:
        print('Safety timer non trouvé dans le fichier')

# ─── 3. Vérifier que cwRunning=false est bien mis APRES completion CW ───────
# Dans la zone où appendCloudWorksTracker est appelé, s'assurer que
# cwRunning est reset quand la tâche se termine côté tracker
# (ce fix est dans cw-modal.js, pas messages.js)

with open(path, 'w', encoding='latin-1') as f:
    f.write(msg)
print(f'Sauvegarde OK ({len(msg)} chars)')
