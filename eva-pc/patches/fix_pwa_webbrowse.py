"""
EVA D1 - Fix PWA web_browse bloc (window.eva.ipc → window.eva.system.exec)
"""
import os

CW_TOOLS_PC = r'f:\code\eva\evaprojectmultiplatforme\eva-pc\web\js\features\cw-tools.js'
CW_TOOLS_DIST = r'f:\code\eva\evaprojectmultiplatforme\eva-pc\dist\js\features\cw-tools.js'

OLD_WEB_PWA = """if (args.preferPWA !== false && window.eva && window.eva.ipc && typeof window.eva.ipc.invoke === 'function') {
    try {
      var domain = targetUrl.replace(/^https?:\\/\\//, '').split('/')[0].replace(/^www\\./, '');
      var pwaCheck = await window.eva.ipc.invoke('pwa:detect', { name: domain, url: targetUrl });
      if (pwaCheck && pwaCheck.found && pwaCheck.execPath) {
        console.log('[CW Tools] PWA web trouvée pour', domain);
        await window.eva.ipc.invoke('shell:open', { path: pwaCheck.execPath });
        return { success: true, result: { url: targetUrl, method: 'pwa', message: 'PWA lancé"""

# Lire le fichier complet pour trouver le vrai bloc
with open(CW_TOOLS_PC, encoding='utf-8') as f:
    content = f.read()

idx = content.find("if (args.preferPWA !== false && window.eva && window.eva.ipc")
if idx < 0:
    print("Bloc non trouvé exactement - cherche variante")
    idx = content.find("window.eva.ipc.invoke('pwa:detect'")
    print(f"Position pwa:detect:", idx)
    # Afficher plus de contexte
    print(content[max(0,idx-300):idx+600])
else:
    # Trouver la fin du bloc
    end_idx = content.find('\n    } catch', idx)
    end_close = content.find('\n  }', end_idx)
    block = content[idx:end_close+4]
    print("=== Bloc trouvé ===")
    print(repr(block[:200]))
    print("...")
    print("Longueur:", len(block))
