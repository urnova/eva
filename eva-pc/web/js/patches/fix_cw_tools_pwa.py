#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Patch cw-tools.js : détection PWA dans tool_app_launch et tool_web_browse
FIX v5.6.11
"""

path = r'f:\code\eva\evaprojectmultiplatforme\eva-pc\web\js\features\cw-tools.js'
with open(path, encoding='utf-8', errors='replace') as f:
    c = f.read()

print(f'Lu {len(c)} chars')

if 'pwa:detect' in c:
    print('PWA detect déjà présent, skip')
else:
    # Trouver le début de tool_app_launch et insérer la vérif PWA
    # Après : var normT = _normalizeAppName(target);
    MARKER = "  var normT = _normalizeAppName(target);\n"
    idx = c.find(MARKER, c.find('async function tool_app_launch'))
    if idx < 0:
        print('ERREUR: marqueur non trouvé dans tool_app_launch')
    else:
        PWA_CHECK = (
            "\n"
            "  // FIX v5.6.11 : vérifier si une PWA Chrome/Edge est installée avant d'ouvrir le navigateur\n"
            "  if (window.eva && window.eva.ipc && typeof window.eva.ipc.invoke === 'function') {\n"
            "    try {\n"
            "      var pwaResult = await window.eva.ipc.invoke('pwa:detect', { name: target, url: '' });\n"
            "      if (pwaResult && pwaResult.found && pwaResult.execPath) {\n"
            "        console.log('[CW Tools] PWA trouvée pour', target, ':', pwaResult.execPath);\n"
            "        await window.eva.ipc.invoke('shell:open', { path: pwaResult.execPath });\n"
            "        return {\n"
            "          success: true,\n"
            "          result: { app: target, method: 'pwa', message: 'PWA lancée : ' + target }\n"
            "        };\n"
            "      }\n"
            "    } catch(pwaErr) {\n"
            "      console.warn('[CW Tools] PWA detect erreur:', pwaErr);\n"
            "    }\n"
            "  }\n"
        )
        insert_pos = idx + len(MARKER)
        c = c[:insert_pos] + PWA_CHECK + c[insert_pos:]
        print('PWA check dans tool_app_launch OK')

    # Aussi dans tool_web_browse : si l'URL correspond à un domaine PWA connu,
    # on vérifie d'abord si une PWA est installée
    WB_MARKER = "  try {\n    var cleanUrl = targetUrl.replace"
    idx_wb = c.find(WB_MARKER)
    if idx_wb >= 0:
        PWA_WEB_CHECK = (
            "  // FIX v5.6.11 : si une PWA est installée pour ce domaine, la préférer au navigateur\n"
            "  if (args.preferPWA !== false && window.eva && window.eva.ipc && typeof window.eva.ipc.invoke === 'function') {\n"
            "    try {\n"
            "      var domain = targetUrl.replace(/^https?:\\/\\//, '').split('/')[0].replace(/^www\\./, '');\n"
            "      var pwaCheck = await window.eva.ipc.invoke('pwa:detect', { name: domain, url: targetUrl });\n"
            "      if (pwaCheck && pwaCheck.found && pwaCheck.execPath) {\n"
            "        console.log('[CW Tools] PWA web trouvée pour', domain);\n"
            "        await window.eva.ipc.invoke('shell:open', { path: pwaCheck.execPath });\n"
            "        return { success: true, result: { url: targetUrl, method: 'pwa', message: 'PWA lancée pour ' + domain } };\n"
            "      }\n"
            "    } catch(_pwaE) {}\n"
            "  }\n\n"
        )
        c = c[:idx_wb] + PWA_WEB_CHECK + c[idx_wb:]
        print('PWA check dans tool_web_browse OK')
    else:
        print('WARN: marqueur tool_web_browse try non trouvé')

with open(path, 'w', encoding='utf-8') as f:
    f.write(c)
print(f'cw-tools.js sauvegardé ({len(c)} chars)')
