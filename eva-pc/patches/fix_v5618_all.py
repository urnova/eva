#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
EVA v5.6.18 — Patch complet D1
Bugs corrigés:
  B1 - Boucle démarrage post-update (double launch NSIS + electron-updater)
  B2 - LLM_EMPTY au 2ème tour (max_tokens + terminaison intelligente)
  B3 - Pas de bulle CloudWorks en tâche libre
  B5 - UI restée en état d'erreur après échec LLM
  B6 - Mémoire Évolutive utilise Puter (crédits épuisés) → Pollinations en priorité
"""

import os, sys, re

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
EVAPC = os.path.join(ROOT, 'eva-pc')

results = []

def ok(msg): results.append(('OK', msg)); print(f'  [OK] {msg}')
def fail(msg): results.append(('FAIL', msg)); print(f'  [FAIL] {msg}')
def info(msg): print(f'  [INFO] {msg}')

# ══════════════════════════════════════════════════════════════
# B1 — main.ts : quitAndInstall(false, true) → (true, false)
# ══════════════════════════════════════════════════════════════
print('\n=== B1 : Fix quitAndInstall (double launch post-update) ===')

main_ts = os.path.join(EVAPC, 'electron', 'main.ts')
OLD_B1 = 'autoUpdater.quitAndInstall(false, true);'
NEW_B1 = 'autoUpdater.quitAndInstall(true, false); // FIX v5.6.18: silent=true + forceRunAfter=false → NSIS seul gère le redémarrage'

try:
    c = open(main_ts, encoding='utf-8').read()
    if OLD_B1 in c:
        c = c.replace(OLD_B1, NEW_B1)
        open(main_ts, 'w', encoding='utf-8').write(c)
        ok('main.ts quitAndInstall(false,true) → (true,false)')
    elif NEW_B1 in c:
        ok('main.ts déjà patché (B1)')
    else:
        fail(f'main.ts : pattern B1 non trouvé')
except Exception as e:
    fail(f'main.ts B1 : {e}')

# ══════════════════════════════════════════════════════════════
# B2 — cw-agent.js : max_tokens + terminaison intelligente
# ══════════════════════════════════════════════════════════════
print('\n=== B2 : Fix LLM_EMPTY (max_tokens + terminaison intelligente) ===')

for cw_agent in [
    os.path.join(EVAPC, 'web', 'js', 'features', 'cw-agent.js'),
    os.path.join(EVAPC, 'dist', 'js', 'features', 'cw-agent.js'),
]:
    label = os.path.basename(os.path.dirname(cw_agent)) + '/' + os.path.basename(cw_agent)
    try:
        c = open(cw_agent, encoding='utf-8').read()
        changed = False

        # 2a. max_tokens 1200 → 2048
        OLD_MT = 'max_tokens: 1200,'
        NEW_MT = 'max_tokens: 2048, // FIX v5.6.18: était 1200, trop court pour historique multi-tours'
        if OLD_MT in c:
            c = c.replace(OLD_MT, NEW_MT)
            changed = True
            info(f'{label}: max_tokens 1200→2048')
        elif 'max_tokens: 2048' in c:
            info(f'{label}: max_tokens déjà 2048')
        else:
            fail(f'{label}: max_tokens pattern non trouvé')

        # 2b. Terminaison intelligente: si visibleText non vide et pas de tool_call → retourner
        OLD_LOOP = (
            "        // L'agent parle ma"
        )
        # Chercher le bloc exact à remplacer
        # Pattern: après "if (response.includes('[TACHE_TERMINEE]'))" block, le "continue" loop
        OLD_CONT = (
            "        // Detection de fin de tache\n"
            "        if (response.includes('[TACHE_TERMINEE]')) {\n"
            "          return { success: true, response: visibleText };\n"
            "        }\n"
            "\n"
            "        // L'agent parle mais n'agit pas et ne termine pas ->"
        )
        NEW_CONT = (
            "        // Detection de fin de tache\n"
            "        if (response.includes('[TACHE_TERMINEE]')) {\n"
            "          return { success: true, response: visibleText };\n"
            "        }\n"
            "\n"
            "        // FIX v5.6.18: Si le modele a repondu avec du texte visible sans outil\n"
            "        // → la tache est consideree terminee. Evite LLM_EMPTY au tour suivant.\n"
            "        // L'agent parle mais n'agit pas et ne termine pas ->"
        )

        # Cherche le bloc "messages.push Continue" pour le remplacer par return
        OLD_PUSH = (
            "        // L'agent parle mais n'agit pas et ne termine pas -> on le relance\n"
            "        messages.push({ role: 'assistant', content: response });\n"
            "        messages.push({ role: 'user', content: 'Continue. Si la tache est terminee, ecris [TACHE_TERMINEE].' });\n"
            "        continue;"
        )
        NEW_PUSH = (
            "        // FIX v5.6.18: Reponse prose sans outil = tache terminee\n"
            "        // Evite la boucle infinie et LLM_EMPTY au 2eme tour\n"
            "        return { success: !!(visibleText || response), response: visibleText || response };"
        )

        if OLD_PUSH in c:
            c = c.replace(OLD_PUSH, NEW_PUSH)
            changed = True
            info(f'{label}: terminaison intelligente ajoutée')
        elif 'FIX v5.6.18: Reponse prose sans outil' in c:
            info(f'{label}: terminaison déjà patchée')
        else:
            # Essai avec variantes d'encodage
            OLD_PUSH2 = (
                "        // L\u2019agent parle mais n\u2019agit pas et ne termine pas -> on le relance\n"
                "        messages.push({ role: 'assistant', content: response });\n"
                "        messages.push({ role: 'user', content: 'Continue. Si la tache est terminee, ecris [TACHE_TERMINEE].' });\n"
                "        continue;"
            )
            if OLD_PUSH2 in c:
                c = c.replace(OLD_PUSH2, NEW_PUSH)
                changed = True
                info(f'{label}: terminaison intelligente ajoutée (variante)')
            else:
                fail(f'{label}: pattern terminaison non trouvé — recherche partielle...')
                # Debug
                idx = c.find("messages.push({ role: 'user', content: 'Continue.")
                if idx >= 0:
                    print(f'    Contexte: {repr(c[idx-200:idx+200])}')

        if changed:
            open(cw_agent, 'w', encoding='utf-8').write(c)
            ok(f'{label} sauvegardé')
    except Exception as e:
        fail(f'{label} B2 : {e}')

# ══════════════════════════════════════════════════════════════
# B3 + B5 — cloudworks.js : bulle + finally UI cleanup
# ══════════════════════════════════════════════════════════════
print('\n=== B3+B5 : Fix bulle tâche libre + UI cleanup ===')

for cw_js in [
    os.path.join(EVAPC, 'web', 'js', 'features', 'cloudworks.js'),
    os.path.join(EVAPC, 'dist', 'js', 'features', 'cloudworks.js'),
]:
    label = os.path.basename(os.path.dirname(cw_js)) + '/' + os.path.basename(cw_js)
    try:
        c = open(cw_js, encoding='utf-8').read()
        changed = False

        # B3 — Ajouter appendCloudWorksTracker après "window._activeAgent = agent;"
        OLD_AGENT = '  window._activeAgent = agent;\n\n  var header'
        NEW_AGENT = (
            '  window._activeAgent = agent;\n\n'
            '  // FIX v5.6.18 (B3): Afficher la bulle CloudWorks dans le chat\n'
            '  if (window.appendCloudWorksTracker) {\n'
            '    window.appendCloudWorksTracker(taskId, prompt);\n'
            '  }\n\n'
            '  var header'
        )
        if OLD_AGENT in c:
            c = c.replace(OLD_AGENT, NEW_AGENT)
            changed = True
            info(f'{label}: appendCloudWorksTracker ajouté (B3)')
        elif 'appendCloudWorksTracker(taskId' in c:
            info(f'{label}: bulle déjà présente (B3)')
        else:
            fail(f'{label}: pattern B3 non trouvé')

        # B5 — Ajouter finally pour cleanup UI
        # Chercher la fin du bloc try/catch de _cwRunAgenticTask
        # La fonction se termine typiquement avec le résultat de agent.run()
        OLD_RUN = (
            "  var result = await agent.run(prompt, function(text, status, isThought) {\n"
            "    _emit(text, status, isThought);\n"
            "  });"
        )
        NEW_RUN = (
            "  var result;\n"
            "  try {\n"
            "    result = await agent.run(prompt, function(text, status, isThought) {\n"
            "      _emit(text, status, isThought);\n"
            "    });\n"
            "  } finally {\n"
            "    // FIX v5.6.18 (B5): Nettoyage UI systématique après fin ou erreur\n"
            "    if (statusEl) {\n"
            "      statusEl.className = (statusEl.className || '').replace('running', '').trim();\n"
            "      var stopBtn = statusEl.querySelector('.cw-btn-danger');\n"
            "      if (stopBtn) stopBtn.style.display = 'none';\n"
            "    }\n"
            "    window._activeAgent = null;\n"
            "  }"
        )
        if OLD_RUN in c:
            c = c.replace(OLD_RUN, NEW_RUN)
            changed = True
            info(f'{label}: finally UI cleanup ajouté (B5)')
        elif 'FIX v5.6.18 (B5)' in c:
            info(f'{label}: finally déjà présent (B5)')
        else:
            # Chercher variante
            idx = c.find('agent.run(prompt,')
            if idx >= 0:
                print(f'  [DEBUG] agent.run trouvé à {idx}: {repr(c[idx-50:idx+200])}')
            fail(f'{label}: pattern B5 non trouvé')

        if changed:
            open(cw_js, 'w', encoding='utf-8').write(c)
            ok(f'{label} sauvegardé')
    except Exception as e:
        fail(f'{label} B3+B5 : {e}')

# ══════════════════════════════════════════════════════════════
# B6 — memory.js : Pollinations avant Puter
# ══════════════════════════════════════════════════════════════
print('\n=== B6 : Fix memory.js — Pollinations avant Puter ===')

for mem_js in [
    os.path.join(EVAPC, 'web', 'js', 'app', 'memory.js'),
    os.path.join(EVAPC, 'dist', 'js', 'app', 'memory.js'),
]:
    label = os.path.basename(os.path.dirname(mem_js)) + '/' + os.path.basename(mem_js)
    if not os.path.exists(mem_js):
        info(f'{label}: non trouvé, skip')
        continue
    try:
        enc = 'latin-1' if 'web/js' in mem_js.replace('\\','/') or 'web\\js' in mem_js else 'latin-1'
        c = open(mem_js, encoding=enc).read()
        changed = False

        # Chercher le bloc Puter en premier et EVAChatHandler en second
        # Pattern typique dans memory.js
        OLD_MEM = (
            "    /* Tentative 1 : Puter AI */\n"
            "    if (window.puter && S.config && S.config.puterUsername) {"
        )
        if OLD_MEM not in c:
            # Essai avec variation encoding
            OLD_MEM = "    /* Tentative 1 : Puter AI */\r\n    if (window.puter && S.config && S.config.puterUsername) {"
        
        # Lire les 2 blocs complets pour les swapper
        # Chercher par index
        idx_puter = c.find('/* Tentative 1 : Puter AI */')
        idx_eva = c.find('/* Tentative 2 :')
        if idx_eva < 0:
            idx_eva = c.find('/* Tentative 2:')
        
        if idx_puter >= 0 and idx_eva >= 0 and idx_puter < idx_eva:
            # Extraire les deux blocs
            bloc1 = c[idx_puter:idx_eva]  # Puter
            # Chercher la fin du bloc EVAChatHandler
            idx_end = c.find('\n    }', idx_eva + 10)
            if idx_end < 0:
                idx_end = c.find('\n  }', idx_eva + 10)
            # Chercher le suivant vraiment (fin du if EVAChatHandler)
            # Compter les accolades
            depth = 0
            pos = idx_eva
            while pos < len(c):
                if c[pos] == '{': depth += 1
                elif c[pos] == '}':
                    depth -= 1
                    if depth == 0:
                        idx_end = pos + 1
                        break
                pos += 1
            
            bloc2 = c[idx_eva:idx_end]  # EVAChatHandler
            
            # Swapper : EVAChatHandler en premier, Puter en second
            new_bloc1 = bloc2.replace('/* Tentative 2 :', '/* FIX v5.6.18 (B6) - Tentative 1 (priorité) :').replace('Tentative 2:', 'FIX v5.6.18 (B6) - Tentative 1 :')
            new_bloc2 = bloc1.replace('/* Tentative 1 : Puter AI */', '/* FIX v5.6.18 (B6) - Tentative 2 (fallback) : Puter AI */')
            
            # Ajuster les numéros si nécessaire
            c = c[:idx_puter] + new_bloc1 + '\n    ' + new_bloc2 + c[idx_end:]
            changed = True
            info(f'{label}: providers réordonnés (EVAChatHandler → Puter)')
        elif 'FIX v5.6.18 (B6)' in c:
            info(f'{label}: déjà patché (B6)')
        else:
            fail(f'{label}: patterns mémoire non trouvés (idx_puter={idx_puter}, idx_eva={idx_eva})')

        if changed:
            open(mem_js, 'w', encoding=enc).write(c)
            ok(f'{label} sauvegardé')
    except Exception as e:
        fail(f'{label} B6 : {e}')

# ══════════════════════════════════════════════════════════════
# Résumé
# ══════════════════════════════════════════════════════════════
print('\n' + '='*60)
print('RÉSUMÉ v5.6.18')
print('='*60)
ok_count = sum(1 for r in results if r[0] == 'OK')
fail_count = sum(1 for r in results if r[0] == 'FAIL')
print(f'  OK   : {ok_count}')
print(f'  FAIL : {fail_count}')
if fail_count > 0:
    print('\nÉchecs:')
    for r in results:
        if r[0] == 'FAIL':
            print(f'  - {r[1]}')
    sys.exit(1)
else:
    print('\nTous les patches v5.6.18 appliqués sans erreur.')
