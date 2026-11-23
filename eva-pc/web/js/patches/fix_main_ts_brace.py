#!/usr/bin/env python3
# Fix: ligne 2108 de main.ts doit être '});\n' et non '}\n'
path = r'f:\code\eva\evaprojectmultiplatforme\eva-pc\electron\main.ts'
with open(path, encoding='utf-8') as f:
    lines = f.readlines()

print(f'Ligne 2107 (index 2107): {repr(lines[2107])}')
print(f'Ligne 2108 (index 2108): {repr(lines[2108])}')
print(f'Ligne 2109 (index 2109): {repr(lines[2109])}')

# La ligne 2108 (index 2107, 0-based) devrait être });\n
if lines[2107].strip() == '}':
    lines[2107] = '});\n'
    print('Corrigé ligne 2108: } -> });')
elif lines[2107].strip() == '});':
    print('Déjà correct: });')
else:
    print('INATTENDU:', repr(lines[2107]))

with open(path, 'w', encoding='utf-8') as f:
    f.writelines(lines)
print('OK')
