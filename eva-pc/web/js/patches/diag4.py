#!/usr/bin/env python3
import re

# Chercher handleSend et ce qui pourrait le bloquer
path_msg = r'f:\code\eva\evaprojectmultiplatforme\eva-pc\web\js\app\messages.js'
with open(path_msg, encoding='latin-1') as f:
    msg = f.read()

# 1. handleSend définition
idx = msg.find('function handleSend')
if idx < 0:
    idx = msg.find('handleSend = function')
print('=== handleSend définition ===')
print(repr(msg[idx:idx+600]))
print()

# 2. Chercher S.busy guard dans handleSend
print('=== Guards S.busy dans handleSend ===')
zone = msg[idx:idx+600]
for kw in ['S.busy', 'cwRunning', 'return', 'disabled']:
    for m in re.finditer(kw, zone):
        print(f'  {kw} pos {m.start()}:', repr(zone[m.start():m.start()+100]))
        print()

# 3. ui-setup.js : comment le msgInput listener gère le sendBtn disabled
path_ui = r'f:\code\eva\evaprojectmultiplatforme\eva-pc\web\js\app\ui-setup.js'
with open(path_ui, encoding='latin-1') as f:
    ui = f.read()

print('=== ui-setup.js msgInput listener complet ===')
idx2 = ui.find('msgInput')
while idx2 >= 0:
    ctx = ui[max(0,idx2-20):idx2+300]
    print(f'pos {idx2}:', repr(ctx))
    print()
    idx2 = ui.find('msgInput', idx2+1)
    if idx2 > 2000: break  # limiter

# 4. Chercher parseEvaActions : est-ce qu'elle peut lancer une erreur ?
print('=== parseEvaActions début ===')
idx3 = msg.find('function parseEvaActions')
print(repr(msg[idx3:idx3+300]))
