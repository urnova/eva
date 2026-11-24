# -*- coding: latin-1 -*-
path = r'f:\code\eva\evaprojectmultiplatforme\eva-pc\web\js\app\memory.js'

with open(path, 'r', encoding='latin-1') as f:
    content = f.read()

target = """    /* FIX v5.6.18 (B6) - Tentative 2 (fallback) : Puter AI */
    if (window.puter && S.config && S.config.puterUsername) {"""

replacement = """    /* FIX v5.6.21: Pollinations gratuit en priorite pour la memoire (zero credit consomme) */
    if (!newMemoryText) {
      try {
        var polUrl = 'https://text.pollinations.ai/' + encodeURIComponent(extractPrompt) + '?model=openai-fast&json=true';
        var polResp = await fetch(polUrl);
        if (polResp.ok) {
          var polTxt = await polResp.text();
          if (polTxt && polTxt.includes('{')) {
            newMemoryText = polTxt.trim();
            usedProvider = 'Pollinations (Gratuit)';
          }
        }
      } catch(pe) { console.warn('[Memoire] Pollinations fallback:', pe); }
    }

    /* Tentative 2 (fallback) : Puter AI si pas deja resolu */
    if (!newMemoryText && window.puter && S.config && S.config.puterUsername) {"""

if target in content:
    content = content.replace(target, replacement)
    with open(path, 'w', encoding='latin-1') as f:
        f.write(content)
    print("memory.js patched in latin-1 successfully!")
else:
    print("Target not found in memory.js")
