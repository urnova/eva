#!/usr/bin/env python3
# Diagnostic complet : qu'est-ce qui bloque le sendBtn au démarrage ?
import re

# 1. messages.js : comment S est initialisé et comment sendBtn est géré au load
path_msg = r'f:\code\eva\evaprojectmultiplatforme\eva-pc\web\js\app\messages.js'
with open(path_msg, encoding='latin-1') as f:
    msg = f.read()

print('=== 1. Initialisation de S (var S = ) ===')
idx = msg.find('var S =')
if idx < 0:
    idx = msg.find('var S={')
if idx >= 0:
    print(repr(msg[idx:idx+400]))
print()

print('=== 2. sendBtn disabled au load (DOMContentLoaded / window.onload) ===')
for kw in ['DOMContentLoaded', 'window.onload', 'sendBtn.disabled']:
    for m in re.finditer(kw, msg):
        print(f'  {kw} pos {m.start()}:', repr(msg[m.start():m.start()+200]))
        print()
        break

print('=== 3. S.busy = true au démarrage ===')
for m in re.finditer(r'S\.busy\s*=\s*true', msg):
    ctx = msg[max(0, m.start()-80):m.end()+80]
    print(f'  pos {m.start()}:', repr(ctx))
    print()

# 2. cw-modal.js : listener Firestore qui pourrait réactiver des tâches
path_modal = r'f:\code\eva\evaprojectmultiplatforme\eva-pc\web\js\features\cw-modal.js'
with open(path_modal, encoding='utf-8') as f:
    modal = f.read()

print('=== 4. cw-modal.js : onSnapshot / listener Firestore au load ===')
for m in re.finditer(r'onSnapshot|\.where\(|\.get\(\)', modal):
    print(f'  {m.group()} pos {m.start()}:', repr(modal[m.start():m.start()+200]))
    print()

print('=== 5. _blockInputForCW appelé au load ===')
for m in re.finditer(r'_blockInputForCW', modal):
    ctx = modal[max(0, m.start()-100):m.end()+150]
    print(f'  pos {m.start()}:', repr(ctx))
    print()
