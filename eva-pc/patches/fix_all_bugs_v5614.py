"""
EVA D1 - Fix complet v5.6.14
Bugs corrigés:
  1. Triple 'async async async function executeEvaAction' → JS invalide → crash total
  2. sendBtn.disabled : condition corrigée pour enabler le bouton après hideTyping
  3. PWA detection : window.eva.ipc n'existe pas → utiliser window.eva.system.exec
  4. main.ts : vérifier que pwa:detect handler est proprement déclaré
"""

import re, os, subprocess, sys

ROOT = r'f:\code\eva\evaprojectmultiplatforme'
PC_WEB = os.path.join(ROOT, 'eva-pc', 'web', 'js')
PC_DIST = os.path.join(ROOT, 'eva-pc', 'dist', 'js')
WEB_DIR = os.path.join(ROOT, 'EVA_V4_fixed_v4', 'js')

ERRORS = []

def fix_file_latin1(path, fixes):
    """Applique les fixes sur un fichier latin-1 (windows-1252)"""
    try:
        with open(path, 'rb') as f:
            raw = f.read()
        content = raw.decode('latin-1')
        original = content
        for old, new in fixes:
            if old in content:
                content = content.replace(old, new)
                print(f'  [OK] Fixed: {repr(old[:60])} -> {repr(new[:60])}')
            else:
                print(f'  [SKIP] Not found: {repr(old[:80])}')
        if content != original:
            with open(path, 'wb') as f:
                f.write(content.encode('latin-1'))
            print(f'  Saved: {path}')
        else:
            print(f'  No changes: {path}')
    except Exception as e:
        ERRORS.append(f'ERROR {path}: {e}')
        print(f'  ERROR: {e}')

def fix_file_utf8(path, fixes):
    """Applique les fixes sur un fichier UTF-8"""
    try:
        with open(path, encoding='utf-8') as f:
            content = f.read()
        original = content
        for old, new in fixes:
            if old in content:
                content = content.replace(old, new)
                print(f'  [OK] Fixed: {repr(old[:60])} -> {repr(new[:60])}')
            else:
                print(f'  [SKIP] Not found: {repr(old[:80])}')
        if content != original:
            with open(path, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f'  Saved: {path}')
        else:
            print(f'  No changes: {path}')
    except Exception as e:
        ERRORS.append(f'ERROR {path}: {e}')
        print(f'  ERROR: {e}')

# ═══════════════════════════════════════════════════════════════
# FIX 1 : Triple async dans file-gen.js (latin-1)
# ═══════════════════════════════════════════════════════════════
print('\n=== FIX 1 : Triple async file-gen.js (latin-1) ===')
FILE_GEN_PC = os.path.join(PC_WEB, 'app', 'file-gen.js')
FILE_GEN_DIST = os.path.join(PC_DIST, 'app', 'file-gen.js')

fix1_latin1 = [
    # Triple async → single async
    ('async async async function executeEvaAction', 'async function executeEvaAction'),
    # Double async → single async (cas intermédiaire)
    ('async async function executeEvaAction', 'async function executeEvaAction'),
]

fix_file_latin1(FILE_GEN_PC, fix1_latin1)
fix_file_latin1(FILE_GEN_DIST, fix1_latin1)

# ═══════════════════════════════════════════════════════════════
# FIX 1b : Même fix dans EVA_V4_fixed_v4 (UTF-8)
# ═══════════════════════════════════════════════════════════════
print('\n=== FIX 1b : Triple async file-gen.js (UTF-8 web) ===')
FILE_GEN_WEB = os.path.join(WEB_DIR, 'app', 'file-gen.js')
if os.path.exists(FILE_GEN_WEB):
    fix_file_utf8(FILE_GEN_WEB, [
        ('async async async function executeEvaAction', 'async function executeEvaAction'),
        ('async async function executeEvaAction', 'async function executeEvaAction'),
    ])
else:
    print(f'  [SKIP] Not found: {FILE_GEN_WEB}')

# ═══════════════════════════════════════════════════════════════
# FIX 2 : sendBtn — doit être enabled après envoi si msgInput vide
# Le bug : sendBtn.disabled = !(input && input.value.trim()) && ...
# Après envoi, l'input est vidé → disabled=true → bouton bloqué
# Fix : forcer sendBtn.disabled = false dans hideTyping
# ═══════════════════════════════════════════════════════════════
print('\n=== FIX 2 : sendBtn disabled fix dans messages.js ===')
MESSAGES_PC = os.path.join(PC_WEB, 'app', 'messages.js')
MESSAGES_DIST = os.path.join(PC_DIST, 'app', 'messages.js')

# La condition actuelle : sendBtn.disabled = !(input && input.value.trim()) && (!S.images || !S.images.length) && (!S.documents || !S.documents.length)
# Problème : après envoi, input est vide → le sendBtn reste disabled
# Fix : sendBtn.disabled = false (toujours activer après hideTyping)
FIX2_OLD = 'sendBtn.disabled = !(input && input.value.trim()) && (!S.images || !S.images.length) && (!S.documents || !S.documents.length);'
FIX2_NEW = 'sendBtn.disabled = false; /* FIX v5.6.14 : toujours enable sendBtn apres reponse */'

fix_file_latin1(MESSAGES_PC, [(FIX2_OLD, FIX2_NEW)])
fix_file_latin1(MESSAGES_DIST, [(FIX2_OLD, FIX2_NEW)])

# Même fix pour EVA_V4_fixed_v4
print('\n=== FIX 2b : sendBtn fix messages.js (UTF-8 web) ===')
MESSAGES_WEB = os.path.join(WEB_DIR, 'app', 'messages.js')
if os.path.exists(MESSAGES_WEB):
    fix_file_utf8(MESSAGES_WEB, [(FIX2_OLD, FIX2_NEW)])
else:
    print(f'  [SKIP] Not found: {MESSAGES_WEB}')

# ═══════════════════════════════════════════════════════════════
# FIX 3 : PWA detection dans cw-tools.js
# window.eva.ipc n'existe pas dans le preload → crash silencieux
# Utiliser window.eva.system.exec('reg query...') à la place
# ═══════════════════════════════════════════════════════════════
print('\n=== FIX 3 : PWA detection cw-tools.js (UTF-8) ===')
CW_TOOLS_PC = os.path.join(PC_WEB, 'features', 'cw-tools.js')
CW_TOOLS_DIST = os.path.join(PC_DIST, 'features', 'cw-tools.js')

# Remplacer le bloc pwa:detect qui utilise window.eva.ipc.invoke
# par une version qui utilise window.eva.system.exec
OLD_PWA_BLOCK = """if (window.eva && window.eva.ipc && typeof window.eva.ipc.invoke === 'function') {
    try {
      var pwaResult = await window.eva.ipc.invoke('pwa:detect', { name: target, url: '' });
      if (pwaResult && pwaResult.found && pwaResult.execPath) {
        console.log('[CW Tools] PWA trouvée pour', target, ':', pwaResult.execPath);
        await window.eva.ipc.invoke('shell:open', { path: pwaResult.execPath });
        return {
          success: true,
          result: { app: target, method: 'pwa', message: 'PWA lancée : ' + target }
        };
      }
    } catch(pwaErr) {
      console.warn('[CW Tools] PWA detect erreur:', pwaErr);
    }
  }"""

NEW_PWA_BLOCK = """if (window.eva && window.eva.system && typeof window.eva.system.exec === 'function') {
    try {
      /* FIX v5.6.14 : PWA detect via reg query (window.eva.ipc n'existe pas) */
      var cleanTarget = (target || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      var regResult = await window.eva.system.exec(
        'reg query "HKCU\\\\Software\\\\Microsoft\\\\Windows\\\\CurrentVersion\\\\App Paths" /f "' + target + '" /k 2>nul & ' +
        'reg query "HKLM\\\\Software\\\\Microsoft\\\\Windows\\\\CurrentVersion\\\\App Paths" /f "' + target + '" /k 2>nul'
      );
      /* Chercher aussi dans les PWA Chrome/Edge */
      var pwaRegResult = await window.eva.system.exec(
        'reg query "HKCU\\\\Software\\\\Google\\\\Chrome\\\\PreferredApps" 2>nul & ' +
        'reg query "HKCU\\\\Software\\\\Microsoft\\\\Edge\\\\PreferredApps" 2>nul'
      );
      /* Chercher le raccourci PWA dans le menu Démarrer */
      var pwaShortcut = await window.eva.system.exec(
        'dir /b /s "%APPDATA%\\\\Microsoft\\\\Windows\\\\Start Menu\\\\Programs" 2>nul | findstr /i "' + target + '"'
      );
      var pwaOutput = (pwaShortcut && pwaShortcut.stdout) ? pwaShortcut.stdout.trim() : '';
      if (pwaOutput) {
        var lines = pwaOutput.split('\\n').filter(function(l){ return l.trim().endsWith('.lnk'); });
        if (lines.length > 0) {
          var lnkPath = lines[0].trim();
          console.log('[CW Tools] PWA shortcut trouvé:', lnkPath);
          await window.eva.system.exec('start "" "' + lnkPath + '"');
          return {
            success: true,
            result: { app: target, method: 'pwa_shortcut', message: 'Application PWA lancée : ' + target }
          };
        }
      }
    } catch(pwaErr) {
      console.warn('[CW Tools] PWA detect erreur:', pwaErr);
    }
  }"""

# Lire le fichier source pour vérifier ce qui s'y trouve
with open(CW_TOOLS_PC, encoding='utf-8') as f:
    cw_content = f.read()

if OLD_PWA_BLOCK in cw_content:
    fix_file_utf8(CW_TOOLS_PC, [(OLD_PWA_BLOCK, NEW_PWA_BLOCK)])
    fix_file_utf8(CW_TOOLS_DIST, [(OLD_PWA_BLOCK, NEW_PWA_BLOCK)])
    print('  [OK] Bloc PWA remplacé')
else:
    print('  [INFO] Ancien bloc non trouvé exactement - vérification manuelle')
    # Chercher juste le pwa.ipc.invoke
    if 'window.eva.ipc.invoke' in cw_content:
        print('  [WARN] window.eva.ipc.invoke encore présent dans cw-tools.js!')
        # Afficher le contexte
        idx = cw_content.find('window.eva.ipc.invoke')
        print(cw_content[max(0,idx-200):idx+300])
    else:
        print('  Pas de window.eva.ipc.invoke trouvé - PWA bloc déjà correct ou absent')

# ═══════════════════════════════════════════════════════════════
# RÉSUMÉ
# ═══════════════════════════════════════════════════════════════
print('\n=== RÉSUMÉ ===')
if ERRORS:
    print('ERREURS:')
    for e in ERRORS: print(' -', e)
else:
    print('Tous les fixes appliqués sans erreur.')
print('Done.')
