#!/usr/bin/env python3
# Supprimer le ); orphelin à la ligne 2161 de main.ts
path = r'f:\code\eva\evaprojectmultiplatforme\eva-pc\electron\main.ts'
with open(path, encoding='utf-8') as f:
    lines = f.readlines()

# La ligne 2161 (index 2160) doit être ");\n" orpheline après les handlers PWA
print(f'Ligne 2160: {repr(lines[2160])}')
print(f'Ligne 2159: {repr(lines[2159])}')
print(f'Ligne 2161: {repr(lines[2161])}')

# Supprimer la ligne orpheline si c'est bien ");"
if lines[2160].strip() == ');':
    lines.pop(2160)
    print('Ligne orpheline ); supprimée OK')
elif lines[2160].strip() == ')':
    lines.pop(2160)
    print('Ligne orpheline ) supprimée OK')
else:
    print('WARN: ligne 2160 pas ); :', repr(lines[2160]))

with open(path, 'w', encoding='utf-8') as f:
    f.writelines(lines)
print('main.ts sauvegardé')
