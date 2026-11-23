#!/usr/bin/env python3
import re, os

# Chercher EVAChatHandler dans tous les fichiers js PC
base = r'f:\code\eva\evaprojectmultiplatforme\eva-pc\web\js'
results = {}
for root, dirs, files in os.walk(base):
    dirs[:] = [d for d in dirs if d not in ['patches', 'lib']]
    for fname in files:
        if fname.endswith('.js'):
            path = os.path.join(root, fname)
            try:
                with open(path, encoding='latin-1') as f:
                    c = f.read()
                if 'EVAChatHandler' in c:
                    results[path] = c
            except: pass

for path, c in results.items():
    fname = path.split('\\')[-1]
    print(f'=== {fname} ===')
    for m in re.finditer('EVAChatHandler', c):
        ctx = c[max(0,m.start()-50):m.end()+150]
        print(f'  pos {m.start()}:', repr(ctx))
        print()
