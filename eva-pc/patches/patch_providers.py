# -*- coding: utf-8 -*-
path = r'f:\code\eva\evaprojectmultiplatforme\eva-pc\web\js\ai\providers.js'

with open(path, 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

target = """        // Quota Puter dépassé
        if (msgLow.includes('quota') || msgLow.includes('limit') || msgLow.includes('rate')) {
          return {
            success: false,
            error: 'Quota Puter atteint pour aujourd\\'hui. Revenez demain ou changez de provider dans les Paramètres.'
          };
        }"""

replacement = """        // FIX v5.6.21: Fallback automatique et transparent sur Pollinations si Puter n'a plus de crédits
        if (msgLow.includes('quota') || msgLow.includes('limit') || msgLow.includes('rate') || msgLow.includes('credit') || msgLow.includes('balance') || msgLow.includes('billing')) {
          console.warn('[Puter] Crédits épuisés, bascule automatique sur Pollinations gratuit...');
          try {
            var polProv = new PollinationsProvider(this.config);
            await polProv.init();
            var polRes = await polProv.sendMessage(messages, systemPrompt);
            if (polRes && polRes.success) return polRes;
          } catch(polErr) {
            console.error('[Puter Fallback] Échec Pollinations:', polErr);
          }
          return {
            success: false,
            error: 'Crédits Puter épuisés. Basculez sur Pollinations (gratuit) dans Paramètres → IA.'
          };
        }"""

if target in content:
    content = content.replace(target, replacement)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("providers.js patched with automatic Pollinations fallback!")
else:
    print("Target not found in providers.js")
