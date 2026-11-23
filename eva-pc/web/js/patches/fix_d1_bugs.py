#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Patch D1 bugs EVA v5.6.11
- file-gen.js  : executeEvaAction() non-async → async (await ignoré sinon)
- messages.js  : hideTyping() toujours restaure sendBtn + safety timer 15s
- cw-windows-adapter.js : détection PWA avant ouverture navigateur
"""

import re

# ═══════════════════════════════════════════
# 1. file-gen.js — executeEvaAction async
# ═══════════════════════════════════════════
path_fg = r'f:\code\eva\evaprojectmultiplatforme\eva-pc\web\js\app\file-gen.js'
with open(path_fg, encoding='latin-1') as f:
    fg = f.read()

old_def = 'function executeEvaAction(action) {'
new_def = 'async function executeEvaAction(action) {'
if old_def in fg:
    fg = fg.replace(old_def, new_def, 1)
    print('[file-gen.js] executeEvaAction → async ✓')
else:
    print('[file-gen.js] WARN: executeEvaAction déjà async ou signature différente')

with open(path_fg, 'w', encoding='latin-1') as f:
    f.write(fg)

# ═══════════════════════════════════════════
# 2. messages.js — hideTyping fix + safety timer 15s
# ═══════════════════════════════════════════
path_msg = r'f:\code\eva\evaprojectmultiplatforme\eva-pc\web\js\app\messages.js'
with open(path_msg, encoding='latin-1') as f:
    msg = f.read()

# 2a. hideTyping : supprimer la condition if (!S.cwRunning) sur la restauration du bouton
old_hide = (
    "function hideTyping() {\n"
    "  if (!S.cwRunning) {\n"
    "    S.busy = false;\n"
    "  }\n"
    "  if (_thinkTimer) { clearInterval(_thinkTimer); _thinkTimer = null; }\n"
    "  var el = document.getElementById('typingInd');\n"
    "  if (el) el.remove();\n"
    "  setEvaStatus(null);\n"
    "  if (window.EvaCharacter && typeof window.EvaCharacter.setIdle === 'function') {\n"
    "    try { window.EvaCharacter.setIdle(); } catch(_) {}\n"
    "  }\n"
    "  /* Ne restaurer le bouton Envoyer QUE si aucune t\xe2che CloudWorks n'est en cours */"
)
# On ne cherche que le début pour trouver la position exacte
idx_hide = msg.find('function hideTyping()')
if idx_hide < 0:
    print('[messages.js] ERREUR: hideTyping() introuvable')
else:
    # Trouver la fin du bloc if (!S.cwRunning) { sendBtn... }
    # On remplace toute la fonction hideTyping jusqu'à la prochaine }
    # En fait on cherche le bloc "if (!S.cwRunning) {" qui contient sendBtn
    # et on le remplace par un bloc sans condition
    zone = msg[idx_hide:idx_hide+1200]
    
    # Identifier le bloc "/* Ne restaurer... */ if (!S.cwRunning) { var sendBtn..."
    comment_marker = "/* Ne restaurer le bouton Envoyer QUE si"
    idx_comment = zone.find(comment_marker)
    if idx_comment < 0:
        print('[messages.js] WARN: commentaire hideTyping non trouvé, essai alternative')
        comment_marker = "/* Ne restaurer"
        idx_comment = zone.find(comment_marker)
    
    if idx_comment >= 0:
        # Trouver la fin du if block — chercher le "}" fermant après sendBtn.disabled
        after_comment = zone[idx_comment:]
        # Le bloc est : /* ... */ \n  if (!S.cwRunning) { ... \n  }
        # On cherche la fin du if block
        idx_if = after_comment.find('if (!S.cwRunning)')
        if idx_if < 0:
            idx_if = after_comment.find('if(!S.cwRunning)')
        
        if idx_if >= 0:
            # Trouver le } fermant du if block (en comptant les accolades)
            brace_zone = after_comment[idx_if:]
            depth = 0
            end_brace = -1
            for i, ch in enumerate(brace_zone):
                if ch == '{': depth += 1
                elif ch == '}':
                    depth -= 1
                    if depth == 0:
                        end_brace = i
                        break
            
            if end_brace >= 0:
                old_block = after_comment[idx_comment:idx_if + end_brace + 1]
                new_block = (
                    "/* FIX v5.6.11: restaurer TOUJOURS le sendBtn — cwRunning ne doit pas bloquer l'UI */\n"
                    "  S.busy = false;\n"
                    "  var sendBtn = document.getElementById('sendBtn');\n"
                    "  var stopBtn = document.getElementById('stopBtn');\n"
                    "  if (sendBtn && stopBtn) {\n"
                    "    stopBtn.style.display = 'none';\n"
                    "    sendBtn.style.display = 'inline-flex';\n"
                    "    var input = document.getElementById('msgInput');\n"
                    "    sendBtn.disabled = !(input && input.value.trim()) && (!S.images || !S.images.length);\n"
                    "  }"
                )
                abs_start = idx_hide + idx_comment
                abs_end   = idx_hide + idx_comment + len(old_block)
                msg = msg[:abs_start] + new_block + msg[abs_end:]
                print('[messages.js] hideTyping sendBtn fix appliqué ✓')
            else:
                print('[messages.js] WARN: accolade fermante non trouvée')
        else:
            print('[messages.js] WARN: if (!S.cwRunning) non trouvé dans hideTyping')
    else:
        print('[messages.js] WARN: commentaire non trouvé dans hideTyping')

# 2b. Safety timer : 60s → 15s
old_timer = "}, 60000);"
new_timer = "}, 15000);"
count = msg.count(old_timer)
if count > 0:
    msg = msg.replace(old_timer, new_timer)
    print(f'[messages.js] safety timer 60s→15s ({count} occurrence(s)) ✓')
else:
    print('[messages.js] WARN: safety timer 60000 non trouvé')

with open(path_msg, 'w', encoding='latin-1') as f:
    f.write(msg)

# ═══════════════════════════════════════════
# 3. cw-windows-adapter.js — détection PWA
# ═══════════════════════════════════════════
path_cwa = r'f:\code\eva\evaprojectmultiplatforme\eva-pc\web\js\features\cw-windows-adapter.js'
with open(path_cwa, encoding='utf-8') as f:
    cwa = f.read()

# Chercher la fonction web_browse ou open_url
pwa_helper = '''
/* ═══════════════════════════════════════════════════════════
   PWA DETECTION — FIX v5.6.11
   Avant d'ouvrir un URL dans le navigateur, vérifie si une
   PWA est installée pour ce domaine via le registre Windows.
   ═══════════════════════════════════════════════════════════ */
async function detectPWA(targetName, url) {
  // On demande à Electron via IPC si une PWA correspond
  if (window.eva && window.eva.ipc && typeof window.eva.ipc.invoke === 'function') {
    try {
      var result = await window.eva.ipc.invoke('pwa:detect', { name: targetName, url: url });
      return result; // { found: bool, execPath: string|null }
    } catch(e) {
      console.warn('[CW-PWA] ipc pwa:detect erreur:', e);
    }
  }
  return { found: false, execPath: null };
}

window.CWWindowsAdapter = window.CWWindowsAdapter || {};
var _origOpenTool = window.CWWindowsAdapter.executeTool;

window.CWWindowsAdapter.executeTool = async function(tool, args) {
  // Interception de web_browse et app_launch pour vérifier PWA d'abord
  if (tool === 'web_browse' || tool === 'app_launch') {
    var targetName = (args && (args.target || args.app || '')) || '';
    var targetUrl  = (args && (args.url  || '')) || '';
    
    if (targetName || targetUrl) {
      var pwa = await detectPWA(targetName, targetUrl);
      if (pwa && pwa.found && pwa.execPath) {
        console.log('[CW-PWA] PWA trouvée pour', targetName || targetUrl, '→', pwa.execPath);
        // Lancer la PWA directement plutôt que le navigateur
        if (window.eva && window.eva.ipc) {
          await window.eva.ipc.invoke('shell:open', { path: pwa.execPath });
          return { success: true, message: 'PWA lancée : ' + (targetName || targetUrl) };
        }
      } else if (pwa && !pwa.found && tool === 'app_launch') {
        // L'utilisateur demande l'application explicitement mais pas de PWA → erreur
        var isExplicitApp = args && args.requirePWA;
        if (isExplicitApp) {
          return { success: false, message: 'Application PWA non trouvée pour : ' + targetName };
        }
      }
    }
  }
  // Comportement original
  if (typeof _origOpenTool === 'function') {
    return _origOpenTool.call(window.CWWindowsAdapter, tool, args);
  }
};
'''

# Insérer à la fin du fichier (avant le dernier })
if 'detectPWA' not in cwa:
    # Trouver la fin du module IIFE ou du fichier
    cwa = cwa.rstrip()
    # Si le fichier se termine par })(); ou })
    if cwa.endswith('})();') or cwa.endswith('})()'):
        insert_pos = len(cwa) - len('})();') if cwa.endswith('})();') else len(cwa) - len('})();')
        cwa = cwa[:insert_pos] + '\n' + pwa_helper + '\n' + cwa[insert_pos:]
    else:
        cwa += '\n' + pwa_helper
    print('[cw-windows-adapter.js] PWA detection ajoutée ✓')
else:
    print('[cw-windows-adapter.js] PWA detection déjà présente')

with open(path_cwa, 'w', encoding='utf-8') as f:
    f.write(cwa)

print()
print('=== PATCH TERMINÉ ===')
