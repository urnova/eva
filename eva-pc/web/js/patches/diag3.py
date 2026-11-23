#!/usr/bin/env python3
import re

# 1. chat.html : état initial de sendBtn
path_html = r'f:\code\eva\evaprojectmultiplatforme\eva-pc\web\chat.html'
with open(path_html, encoding='latin-1') as f:
    html = f.read()

idx = html.find('sendBtn')
while idx >= 0:
    print(f'sendBtn pos {idx}:', repr(html[max(0,idx-30):idx+150]))
    print()
    idx = html.find('sendBtn', idx+1)

# 2. ui-setup.js : où le sendBtn est initialisé
path_ui = r'f:\code\eva\evaprojectmultiplatforme\eva-pc\web\js\app\ui-setup.js'
with open(path_ui, encoding='latin-1') as f:
    ui = f.read()

print('=== ui-setup.js sendBtn ===')
for m in re.finditer('sendBtn', ui):
    print(f'  pos {m.start()}:', repr(ui[m.start():m.start()+200]))
    print()

# 3. Chercher setIsGenerating appelé au démarrage
print('=== setIsGenerating au démarrage ===')
for path, enc in [
    (r'f:\code\eva\evaprojectmultiplatforme\eva-pc\web\js\features\cloudworks.js', 'utf-8'),
    (r'f:\code\eva\evaprojectmultiplatforme\eva-pc\web\js\features\cw-firestore-adapter.js', 'utf-8'),
]:
    try:
        with open(path, encoding=enc) as f:
            c = f.read()
        fname = path.split('\\')[-1]
        for kw in ['setIsGenerating', '_blockInputForCW', 'cwRunning = true', 'busy = true']:
            for m2 in re.finditer(kw.replace('.',r'\.'), c):
                print(f'  [{fname}] {kw} pos {m2.start()}:', repr(c[max(0,m2.start()-50):m2.end()+150]))
                print()
    except Exception as e:
        print('erreur:', e)
