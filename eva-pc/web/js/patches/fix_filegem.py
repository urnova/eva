#!/usr/bin/env python3
# fix file-gen.js : executeEvaAction → async + reset cwRunning apres tâche
path = r'f:\code\eva\evaprojectmultiplatforme\eva-pc\web\js\app\file-gen.js'
with open(path, encoding='latin-1') as f:
    c = f.read()

# 1. async
OLD = 'function executeEvaAction(action) {'
NEW = 'async function executeEvaAction(action) {'
if OLD in c:
    c = c.replace(OLD, NEW, 1)
    print('async OK')
else:
    print('WARN: signature non trouvee')

# 2. Après appendCloudWorksTracker, reset cwRunning quand TERMINÉ
# Le tracker Firestore dans cw-modal.js s'occupe du reset côté UI
# Mais on doit s'assurer que cwRunning est mis à false quand la commande est done
# → ça se fait dans cw-modal.js, pas file-gen.js
# On vérifie juste que window.S.cwRunning est bien mis à false dans cw-modal.js

with open(path, 'w', encoding='latin-1') as f:
    f.write(c)
print('file-gen.js sauvegarde OK')
