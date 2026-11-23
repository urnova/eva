"""
EVA D1 — Fix PWA web_browse bloc (2ème bloc — tool_web_browse)
Remplace window.eva.ipc.invoke par window.eva.system.exec
"""
import os, re

ROOT = r'f:\code\eva\evaprojectmultiplatforme'
CW_TOOLS_PC = os.path.join(ROOT, 'eva-pc', 'web', 'js', 'features', 'cw-tools.js')
CW_TOOLS_DIST = os.path.join(ROOT, 'eva-pc', 'dist', 'js', 'features', 'cw-tools.js')

ERRORS = []

def fix_file(path):
    with open(path, encoding='utf-8') as f:
        content = f.read()
    
    original = content
    
    # Trouver le bloc PWA dans tool_web_browse (autour pos 20500)
    # Le bloc exact commence par cette ligne
    OLD_BLOCK = """  // FIX v5.6.11 : si une PWA est installée pour ce domaine, la préférer au navigateur
  if (args.preferPWA !== false && window.eva && window.eva.ipc && typeof window.eva.ipc.invoke === 'function') {
    try {
      var domain = targetUrl.replace(/^https?:\\/\\//, '').split('/')[0].replace(/^www\\./, '');
      var pwaCheck = await window.eva.ipc.invoke('pwa:detect', { name: domain, url: targetUrl });
      if (pwaCheck && pwaCheck.found && pwaCheck.execPath) {
        console.log('[CW Tools] PWA web trouvée pour', domain);
        await window.eva.ipc.invoke('shell:open', { path: pwaCheck.execPath });
        return { success: true, result: { url: targetUrl, method: 'pwa', message: 'PWA lancée pour ' + domain } };
      }
    } catch(_pwaE) {}
  }"""

    NEW_BLOCK = """  // FIX v5.6.14 : PWA detect via reg query (window.eva.ipc n'existe pas dans le preload)
  if (args.preferPWA !== false && window.eva && window.eva.system && typeof window.eva.system.exec === 'function') {
    try {
      var domain = targetUrl.replace(/^https?:\\/\\//, '').split('/')[0].replace(/^www\\./, '');
      /* Chercher le raccourci PWA dans le menu Démarrer */
      var pwaShortcut = await window.eva.system.exec(
        'dir /b /s "%APPDATA%\\\\Microsoft\\\\Windows\\\\Start Menu\\\\Programs" 2>nul | findstr /i "' + domain + '"'
      );
      var pwaOutput = (pwaShortcut && pwaShortcut.stdout) ? pwaShortcut.stdout.trim() : '';
      if (pwaOutput) {
        var lines = pwaOutput.split('\\n').filter(function(l){ return l.trim().endsWith('.lnk'); });
        if (lines.length > 0) {
          var lnkPath = lines[0].trim();
          console.log('[CW Tools] PWA web shortcut trouvé:', lnkPath);
          await window.eva.system.exec('start "" "' + lnkPath + '"');
          return { success: true, result: { url: targetUrl, method: 'pwa_shortcut', message: 'Application PWA lancée pour ' + domain } };
        }
      }
    } catch(_pwaE) {}
  }"""

    if OLD_BLOCK in content:
        content = content.replace(OLD_BLOCK, NEW_BLOCK)
        print(f'  [OK] Bloc PWA web_browse remplacé dans {path}')
    else:
        # Essayer de trouver et remplacer les lignes individuelles
        print(f'  [WARN] Bloc exact non trouvé dans {path}')
        # Compter les occurrences restantes
        count = content.count('window.eva.ipc.invoke')
        print(f'  window.eva.ipc.invoke encore présent: {count} fois')
        
        # Remplacement ligne par ligne comme fallback
        # Remplacer le check de condition
        content = content.replace(
            "window.eva.ipc && typeof window.eva.ipc.invoke === 'function'",
            "window.eva.system && typeof window.eva.system.exec === 'function'"
        )
        # Remplacer les invocations restantes - pwa:detect
        content = re.sub(
            r"await window\.eva\.ipc\.invoke\('pwa:detect',\s*\{[^}]+\}\)",
            "null /* pwa:detect non disponible -- window.eva.ipc n'existe pas */",
            content
        )
        # Remplacer shell:open
        content = re.sub(
            r"await window\.eva\.ipc\.invoke\('shell:open',\s*\{[^}]+\}\)",
            "null /* shell:open non disponible -- window.eva.ipc n'existe pas */",
            content
        )
        
        remaining = content.count('window.eva.ipc.invoke')
        print(f'  Après fallback fix: {remaining} occurrences restantes')
    
    if content != original:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f'  Sauvegardé: {path}')
    
    # Vérification finale
    final_count = content.count('window.eva.ipc.invoke')
    print(f'  FINAL: window.eva.ipc.invoke x{final_count} {"OK" if final_count == 0 else "⚠ ENCORE PRÉSENT"}')

print('=== Fix PWA web_browse ===')
fix_file(CW_TOOLS_PC)
print()
fix_file(CW_TOOLS_DIST)
