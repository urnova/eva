#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Copie les patchs D1 vers EVA_V4 (version web) + fix messages.js web
"""
import os, shutil

# 1. cw-tools.js → même fichier dans EVA_V4
src_tools = r'f:\code\eva\evaprojectmultiplatforme\eva-pc\web\js\features\cw-tools.js'
dst_tools = r'f:\code\eva\evaprojectmultiplatforme\EVA_V4_fixed_v4\js\features\cw-tools.js'
if os.path.exists(src_tools):
    shutil.copy2(src_tools, dst_tools)
    print(f'cw-tools.js copié vers EVA_V4 OK')

# 2. messages.js web (EVA_V4) : même fix hideTyping en UTF-8
path_web_msg = r'f:\code\eva\evaprojectmultiplatforme\EVA_V4_fixed_v4\js\app\messages.js'
if not os.path.exists(path_web_msg):
    print('messages.js web non trouvé, skip')
else:
    with open(path_web_msg, encoding='utf-8') as f:
        web_msg = f.read()

    print(f'messages.js web: {len(web_msg)} chars, hideTyping: {web_msg.count("hideTyping")}')

    marker = 'Ne restaurer le bouton Envoyer'
    idx = web_msg.find(marker)
    if idx < 0:
        print('Marqueur non trouvé dans messages.js web')
    else:
        idx_if = web_msg.find('if (!S.cwRunning)', idx)
        if idx_if < 0:
            print('if (!S.cwRunning) non trouvé')
        else:
            bz = web_msg[idx_if:]
            depth, end = 0, -1
            for i, ch in enumerate(bz):
                if ch == '{': depth += 1
                elif ch == '}':
                    depth -= 1
                    if depth == 0:
                        end = i
                        break
            start_comment = web_msg.rfind('/*', 0, idx + 10)
            old_len = (idx_if + end + 1) - start_comment
            old = web_msg[start_comment : idx_if + end + 1]
            print(f'Bloc à remplacer ({len(old)} chars): {repr(old[:60])}...')

            new = (
                '/* FIX v5.6.11 : sendBtn restaure TOUJOURS meme si cwRunning=true */\n'
                '  S.busy = false;\n'
                "  var sendBtn = document.getElementById('sendBtn');\n"
                "  var stopBtn = document.getElementById('stopBtn');\n"
                '  if (sendBtn && stopBtn) {\n'
                "    stopBtn.style.display = 'none';\n"
                "    sendBtn.style.display = 'inline-flex';\n"
                "    var input = document.getElementById('msgInput');\n"
                "    sendBtn.disabled = !(input && input.value.trim()) && (!S.images || !S.images.length) && (!S.documents || !S.documents.length);\n"
                '  }'
            )
            web_msg = web_msg[:start_comment] + new + web_msg[idx_if + end + 1:]
            with open(path_web_msg, 'w', encoding='utf-8') as f:
                f.write(web_msg)
            print('messages.js web hideTyping fix OK')

# 3. file-gen.js web (EVA_V4) : executeEvaAction async
path_web_fg = r'f:\code\eva\evaprojectmultiplatforme\EVA_V4_fixed_v4\js\app\file-gen.js'
if os.path.exists(path_web_fg):
    with open(path_web_fg, encoding='utf-8') as f:
        web_fg = f.read()
    OLD = 'function executeEvaAction(action) {'
    NEW = 'async function executeEvaAction(action) {'
    if OLD in web_fg:
        web_fg = web_fg.replace(OLD, NEW, 1)
        with open(path_web_fg, 'w', encoding='utf-8') as f:
            f.write(web_fg)
        print('file-gen.js web async OK')
    else:
        print(f'file-gen.js web: signature déjà async ou absente')
else:
    print('file-gen.js web non trouvé')

print('Tous les patchs web appliqués')
