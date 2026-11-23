#!/usr/bin/env python3
files = [
    (r'f:\code\eva\evaprojectmultiplatforme\eva-pc\web\js\app\messages.js', 'latin-1', 'FIX v5.6.11'),
    (r'f:\code\eva\evaprojectmultiplatforme\eva-pc\web\js\app\file-gen.js', 'latin-1', 'async function executeEvaAction'),
    (r'f:\code\eva\evaprojectmultiplatforme\eva-pc\web\js\features\cw-tools.js', 'utf-8', 'pwa:detect'),
    (r'f:\code\eva\evaprojectmultiplatforme\eva-pc\electron\main.ts', 'utf-8', 'pwa:detect'),
    (r'f:\code\eva\evaprojectmultiplatforme\EVA_V4_fixed_v4\js\app\messages.js', 'utf-8', 'FIX v5.6.11'),
    (r'f:\code\eva\evaprojectmultiplatforme\EVA_V4_fixed_v4\js\app\file-gen.js', 'utf-8', 'async function executeEvaAction'),
]
all_ok = True
for path, enc, marker in files:
    try:
        with open(path, encoding=enc) as f:
            c = f.read()
        fname = path.split('\\')[-1]
        ok = marker in c
        status = 'OK' if ok else 'MANQUANT'
        print(fname + ' [' + enc + '] ' + marker + ' -> ' + status + ' len=' + str(len(c)))
        if not ok:
            all_ok = False
    except Exception as e:
        print('ERREUR ' + path + ': ' + str(e))
        all_ok = False

print('')
print('BILAN: ' + ('TOUS OK' if all_ok else 'ECHEC'))
