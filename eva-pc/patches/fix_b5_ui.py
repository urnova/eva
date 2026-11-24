#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Fix B5 — UI cleanup cloudworks.js"""

paths = [
    r'f:\code\eva\evaprojectmultiplatforme\eva-pc\web\js\features\cloudworks.js',
    r'f:\code\eva\evaprojectmultiplatforme\eva-pc\dist\js\features\cloudworks.js',
]

OLD = (
    '  var result = await agent.run(prompt, _emit, statusEl);\n\n'
    '  if (result.success) {\n'
    "    if (header) header.textContent = 'T\u00e2che termin\u00e9e';\n"
    "    statusEl.className = 'cw-agentic-status done';\n"
    "    promptEl.value = '';\n"
    "    _addActivity('T\u00e2che IA: ' + prompt.substring(0, 50), 'done');\n"
    '  } else {\n'
    "    if (header) header.textContent = 'Erreur: ' + (result.error || 'Inconnue');\n"
    "    statusEl.className = 'cw-agentic-status error';\n"
    "    _addActivity('T\u00e2che IA erreur: ' + prompt.substring(0, 30), 'error');\n"
    '  }'
)

NEW = (
    '  var result;\n'
    '  try {\n'
    '    result = await agent.run(prompt, _emit, statusEl);\n'
    '  } finally {\n'
    '    // FIX v5.6.18 (B5): Nettoyage UI systematique apres fin ou erreur LLM\n'
    '    var _stopBtn = statusEl ? statusEl.querySelector(".cw-btn-danger") : null;\n'
    '    if (_stopBtn) _stopBtn.style.display = "none";\n'
    '    if (!result || !result.success) {\n'
    '      if (statusEl && (statusEl.className || "").includes("running")) {\n'
    '        statusEl.className = (statusEl.className || "").replace("running", "").trim();\n'
    '      }\n'
    '    }\n'
    '    window._activeAgent = null;\n'
    '  }\n\n'
    '  if (result && result.success) {\n'
    "    if (header) header.textContent = 'T\u00e2che termin\u00e9e';\n"
    "    statusEl.className = 'cw-agentic-status done';\n"
    "    promptEl.value = '';\n"
    "    _addActivity('T\u00e2che IA: ' + prompt.substring(0, 50), 'done');\n"
    '  } else if (result) {\n'
    "    if (header) header.textContent = 'Erreur: ' + (result.error || 'Inconnue');\n"
    "    statusEl.className = 'cw-agentic-status error';\n"
    "    _addActivity('T\u00e2che IA erreur: ' + prompt.substring(0, 30), 'error');\n"
    '  }'
)

for path in paths:
    try:
        c = open(path, encoding='utf-8').read()
        if OLD in c:
            c = c.replace(OLD, NEW)
            open(path, 'w', encoding='utf-8').write(c)
            print(f'[OK] B5 fix: {path}')
        elif 'FIX v5.6.18 (B5)' in c:
            print(f'[OK] B5 deja patche: {path}')
        else:
            print(f'[FAIL] pattern B5 non trouve dans {path}')
            idx = c.find('agent.run(prompt')
            print(f'  agent.run @ {idx}')
    except Exception as e:
        print(f'[FAIL] {path}: {e}')
