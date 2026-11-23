#!/usr/bin/env python3
# Chercher ce qui initialise S et le listener Firestore global dans cw-modal.js
import re

path_modal = r'f:\code\eva\evaprojectmultiplatforme\eva-pc\web\js\features\cw-modal.js'
with open(path_modal, encoding='utf-8') as f:
    modal = f.read()

# Chercher le listener global Firestore (commands collection) qui se lance au load
print('=== Listener global onSnapshot sur commands ===')
for m in re.finditer(r'commands.*?onSnapshot|onSnapshot.*?commands', modal, re.DOTALL):
    print(repr(modal[max(0,m.start()-100):m.end()+300]))
    print()

# Chercher firebase.auth().onAuthStateChanged ou evaAuthReady
print('=== evaAuthReady / onAuthStateChanged dans cw-modal.js ===')
for kw in ['evaAuthReady', 'onAuthStateChanged', 'authReady', 'addEventListener']:
    idx = modal.find(kw)
    if idx >= 0:
        print(f'{kw} pos {idx}:', repr(modal[idx:idx+400]))
        print()

# Chercher le listener global (en dehors des fonctions)
print('=== Listeners globaux (en dehors des fonctions) ===')
# Chercher des .collection('cloudworks') au niveau racine
for m in re.finditer(r"collection\('cloudworks'\)", modal):
    # Vérifier si c'est à la racine (pas dans une fonction)
    ctx = modal[max(0,m.start()-200):m.end()+500]
    print(f'pos {m.start()}:', repr(ctx))
    print()

# Chercher window.addEventListener('evaAuthReady')
path_msg = r'f:\code\eva\evaprojectmultiplatforme\eva-pc\web\js\app\core.js'
try:
    with open(path_msg, encoding='latin-1') as f:
        core = f.read()
    print('=== core.js : S initialisation ===')
    idx = core.find('var S ')
    if idx < 0:
        idx = core.find('window.S =')
    if idx < 0:
        idx = core.find('S = {')
    if idx >= 0:
        print(repr(core[idx:idx+300]))
    # sendBtn disabled initial
    for m in re.finditer(r'sendBtn', core):
        print(f'sendBtn pos {m.start()}:', repr(core[m.start():m.start()+200]))
        print()
except Exception as e:
    print('core.js erreur:', e)
