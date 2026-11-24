# -*- coding: latin-1 -*-
path = r'f:\code\eva\evaprojectmultiplatforme\eva-pc\web\js\app\messages.js'

with open(path, 'r', encoding='latin-1') as f:
    lines = f.readlines()

found = False
for i, line in enumerate(lines):
    if 'var cwRegex =' in line:
        print('Found line:', i+1)
        # Remplacer la regex
        lines[i] = '  var cwRegex = /(crÃ©e|cree|crÃ©er|creer|crÃ©ez|ecris|Ã©cris|Ã©crire|supprime|supprimer|efface|ouvre|ouvrir|lance|lancer|dÃ©place|deplace|copie|copier|mets|mettre|gÃ©nÃ¨re|genere|gÃ©nÃ©rer|generer|tÃ©lÃ©charge|telecharge|cherche|recherche)\\b[\\s\\S]*?(fichier|dossier|bureau|desktop|document|documents|edge|chrome|navigateur|pc|windows|powershell|pdf|script|application|youtube|yt|spotify|discord|vlc|steam|netflix|twitch|calc|calculatrice|notepad|bloc-notes|cmd)/i;\n'
        found = True
        break

if found:
    with open(path, 'w', encoding='latin-1') as f:
        f.writelines(lines)
    print('messages.js patched successfully!')
else:
    print('cwRegex line not found')
