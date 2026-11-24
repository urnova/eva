#!/usr/bin/env python3
import os
checks = [
    ('f:/code/eva/evaprojectmultiplatforme/eva-pc/electron/main.ts', 'utf-8',
     ['quitAndInstall(true, false)'], ['quitAndInstall(false, true)']),
    ('f:/code/eva/evaprojectmultiplatforme/eva-pc/web/js/features/cw-agent.js', 'utf-8',
     ['max_tokens: 2048', 'FIX v5.6.18: Reponse prose sans outil'],
     ['max_tokens: 1200']),
    ('f:/code/eva/evaprojectmultiplatforme/eva-pc/web/js/features/cloudworks.js', 'utf-8',
     ['appendCloudWorksTracker(taskId', 'FIX v5.6.18 (B5)'], []),
    ('f:/code/eva/evaprojectmultiplatforme/eva-pc/web/js/app/memory.js', 'latin-1',
     ['FIX v5.6.18 (B6)'], []),
]
all_ok = True
for path, enc, must_have, must_not in checks:
    name = os.path.basename(path)
    c = open(path, encoding=enc).read()
    for s in must_have:
        if s in c: print(f'  [OK] {name}: "{s[:50]}"')
        else: print(f'  [FAIL] {name}: "{s[:50]}" ABSENT'); all_ok = False
    for s in must_not:
        if s not in c: print(f'  [OK] {name}: "{s[:50]}" absent')
        else: print(f'  [FAIL] {name}: "{s[:50]}" encore present!'); all_ok = False
print()
print('VERIFICATION:', 'TOUT OK' if all_ok else 'ECHECS')
