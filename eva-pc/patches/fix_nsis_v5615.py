import re

with open(r'f:\code\eva\evaprojectmultiplatforme\eva-pc\build\installer.nsh', encoding='utf-8', errors='replace') as f:
    content = f.read()

# Remplacer tout le bloc customUninstall
old_block = '!macro customUninstall\n  ; \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n  ; Nettoyage du mod\xe8le LLM stock\xe9 dans AppData \xe0 la d\xe9sinstallation\n  ; Le mod\xe8le est dans %APPDATA%\\\\eva-assistant-pc\\\\models\\\\\n  ; \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n  ReadEnvStr $R1 APPDATA\n  ; IfFileExists est la syntaxe NSIS native correcte (pas ${If} ${DirExists})\n  IfFileExists "$R1\\\\eva-assistant-pc\\\\models\\\\*.*" 0 +2\n    RMDir /r "$R1\\\\eva-assistant-pc\\\\models"\n!macroend'

new_block = '''!macro customUninstall
  ; ═══════════════════════════════════════════════════════
  ; FIX v5.6.15 : NE PAS supprimer userData/models
  ; Le modele LLM (2 Go) persiste apres desinstallation ET mises a jour.
  ; L'utilisateur peut le supprimer manuellement si besoin.
  ; ═══════════════════════════════════════════════════════
  ; (aucune suppression -- le modele est conserve intentionnellement)
!macroend'''

if old_block in content:
    content = content.replace(old_block, new_block)
    with open(r'f:\code\eva\evaprojectmultiplatforme\eva-pc\build\installer.nsh', 'w', encoding='utf-8') as f:
        f.write(content)
    print('[OK] customUninstall patche - modele LLM preservé')
else:
    # Utiliser regex pour trouver le bloc
    import re
    pattern = r'!macro customUninstall.*?!macroend'
    match = re.search(pattern, content, re.DOTALL)
    if match:
        print('Bloc trouvé par regex:', repr(match.group(0)[:200]))
        content = content[:match.start()] + new_block + content[match.end():]
        with open(r'f:\code\eva\evaprojectmultiplatforme\eva-pc\build\installer.nsh', 'w', encoding='utf-8') as f:
            f.write(content)
        print('[OK] customUninstall patche via regex')
    else:
        print('[FAIL] Bloc introuvable')

# Vérification
with open(r'f:\code\eva\evaprojectmultiplatforme\eva-pc\build\installer.nsh', encoding='utf-8', errors='replace') as f:
    verify = f.read()
print('RMDir encore présent:', 'RMDir /r "$R1' in verify)
print('Fix présent:', 'FIX v5.6.15' in verify)
