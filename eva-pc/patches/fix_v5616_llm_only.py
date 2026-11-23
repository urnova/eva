"""
EVA v5.6.16 — CloudWorks = LLM local UNIQUEMENT
  - _callLLM : supprime tous les fallbacks Pollinations/Puter
  - _cwRunAgenticTask : bloque si LLM non dispo, propose le téléchargement
  - Messages clairs à l'utilisateur si LLM absent
"""
import os, re

ROOT = r'f:\code\eva\evaprojectmultiplatforme'
PC_WEB = os.path.join(ROOT, 'eva-pc', 'web', 'js')
PC_DIST = os.path.join(ROOT, 'eva-pc', 'dist', 'js')
ERRORS = []

def patch_utf8(path, replacements):
    try:
        with open(path, encoding='utf-8') as f:
            content = f.read()
        orig = content
        for old, new, desc in replacements:
            if old in content:
                content = content.replace(old, new)
                print(f'  [OK] {desc}')
            else:
                print(f'  [SKIP] Non trouvé : {desc}')
        if content != orig:
            with open(path, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f'  Sauvegardé : {path}')
        else:
            print(f'  Aucun changement : {path}')
    except Exception as e:
        ERRORS.append(str(e))
        print(f'  ERREUR : {e}')

# ═══════════════════════════════════════════════════════════════
# FIX 1 : _callLLM — LLM local UNIQUEMENT, zéro fallback
# ═══════════════════════════════════════════════════════════════
print('\n=== FIX 1 : _callLLM — LLM local only ===')
CW_AGENT_PC = os.path.join(PC_WEB, 'features', 'cw-agent.js')
CW_AGENT_DIST = os.path.join(PC_DIST, 'features', 'cw-agent.js')

OLD_CALLLM = """async function _callLLM(messages) {
  /* FIX v5.6.15 : LLM LOCAL EN PREMIER — ne jamais bruler le quota Puter pour les taches libres */

  // === PRIORITE 1 : LLM local via IPC Electron (node-llama-cpp) ===
  if (window.eva && window.eva.system && typeof window.eva.system.llmChat === 'function') {
    try {
      var llmStatus = await window.eva.system.llmStatus();
      if (llmStatus && llmStatus.running) {
        console.log('[CWAgent] Utilisation du LLM local (node-llama-cpp)');
        var localRes = await window.eva.system.llmChat(messages, {
          max_tokens: 1200,
          temperature: 0.3
        });
        if (localRes && localRes.content) return localRes.content;
        if (typeof localRes === 'string' && localRes.trim()) return localRes;
      } else {
        console.warn('[CWAgent] LLM local non démarré — tentative de démarrage...');
        try {
          await window.eva.system.llmStart();
          // Attendre 3s que le moteur soit prêt
          await new Promise(function(r){ setTimeout(r, 3000); });
          var localRes2 = await window.eva.system.llmChat(messages, { max_tokens: 1200, temperature: 0.3 });
          if (localRes2 && localRes2.content) return localRes2.content;
          if (typeof localRes2 === 'string' && localRes2.trim()) return localRes2;
        } catch(startErr) {
          console.warn('[CWAgent] Démarrage LLM local échoué:', startErr.message);
        }
      }
    } catch(localErr) {
      console.warn('[CWAgent] LLM local erreur:', localErr.message, '— fallback Pollinations');
    }
  }

  // === PRIORITE 2 : Pollinations (quota gratuit, pas Puter) ===
  console.log('[CWAgent] Fallback Pollinations (LLM local indisponible)');
  try {
    var body = {
      model: 'openai-fast',
      messages: messages,
      max_tokens: 1000,
      temperature: 0.3
    };
    var resp = await fetch('https://text.pollinations.ai/openai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000)
    });
    if (resp.ok) {
      var data = await resp.json();
      var polContent = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
      if (polContent) return polContent;
    }
  } catch(polErr) {
    console.warn('[CWAgent] Pollinations erreur:', polErr.message);
  }

  // === PRIORITE 3 : EVAChatHandler (Puter) — dernier recours ===
  console.warn('[CWAgent] Fallback EVAChatHandler (Puter) — dernier recours');
  if (window.EVAChatHandler && typeof window.EVAChatHandler.sendMessage === 'function') {
    var contextPrompt = messages.slice(1).map(function(m) {
      if (m.role === 'system') return '';
      if (m.role === 'user') return 'USER: ' + m.content;
      if (m.role === 'assistant') return 'ASSISTANT: ' + m.content;
      return m.content;
    }).filter(Boolean).join('\\n\\n');
    var sysPrompt = messages[0] && messages[0].role === 'system' ? messages[0].content : _buildSystemPrompt();
    var origSys = window.EVA_SYSTEM_PROMPT;
    window.EVA_SYSTEM_PROMPT = sysPrompt;
    try {
      var res = await window.EVAChatHandler.sendMessage(contextPrompt, { skipHistory: true });
      if (res && res.success && res.content) return res.content;
    } finally {
      window.EVA_SYSTEM_PROMPT = origSys;
    }
  }

  throw new Error('Aucun LLM disponible (local, Pollinations et EVAChatHandler ont échoué)');
}"""

NEW_CALLLM = """async function _callLLM(messages) {
  /* FIX v5.6.16 : CloudWorks = LLM LOCAL UNIQUEMENT
     Pas de fallback Pollinations ni Puter.
     CloudWorks tourne entièrement en local, gratuitement et sans limite.
     Si le LLM n'est pas disponible, on lève une erreur claire. */

  if (!window.eva || !window.eva.system || typeof window.eva.system.llmChat !== 'function') {
    throw new Error('LLM_NOT_AVAILABLE: Le moteur LLM local n\\'est pas accessible. Téléchargez le modèle dans la section CloudWorks.');
  }

  // Vérifier si le LLM est actif
  var status = null;
  try { status = await window.eva.system.llmStatus(); } catch(_) {}

  if (!status || !status.running) {
    // Tenter de démarrer le LLM automatiquement
    console.log('[CWAgent] LLM local arrêté — démarrage automatique...');
    try {
      await window.eva.system.llmStart();
      // Attendre jusqu'à 15s que le moteur soit prêt
      for (var i = 0; i < 15; i++) {
        await new Promise(function(r){ setTimeout(r, 1000); });
        var s2 = null;
        try { s2 = await window.eva.system.llmStatus(); } catch(_) {}
        if (s2 && s2.running) {
          console.log('[CWAgent] LLM local démarré après', i + 1, 'secondes');
          break;
        }
        if (i === 14) {
          throw new Error('LLM_START_TIMEOUT: Le LLM local n\\'a pas démarré dans les temps. Vérifiez la section CloudWorks.');
        }
      }
    } catch(startErr) {
      if (startErr.message.startsWith('LLM_')) throw startErr;
      throw new Error('LLM_START_FAILED: Impossible de démarrer le LLM local : ' + startErr.message);
    }
  }

  // Appel LLM local
  console.log('[CWAgent] Appel LLM local (node-llama-cpp)');
  var result = await window.eva.system.llmChat(messages, {
    max_tokens: 1200,
    temperature: 0.3
  });

  if (result && result.content) return result.content;
  if (typeof result === 'string' && result.trim()) return result;
  throw new Error('LLM_EMPTY: Le LLM local a renvoyé une réponse vide.');
}"""

FIX_AGENT = [(OLD_CALLLM, NEW_CALLLM, '_callLLM : LLM local UNIQUEMENT')]
patch_utf8(CW_AGENT_PC, FIX_AGENT)
patch_utf8(CW_AGENT_DIST, FIX_AGENT)

# ═══════════════════════════════════════════════════════════════
# FIX 2 : _cwRunAgenticTask — vérifier LLM AVANT d'exécuter
# ═══════════════════════════════════════════════════════════════
print('\n=== FIX 2 : _cwRunAgenticTask — guard LLM obligatoire ===')
CW_JS_PC = os.path.join(PC_WEB, 'features', 'cloudworks.js')
CW_JS_DIST = os.path.join(PC_DIST, 'features', 'cloudworks.js')

OLD_GUARD = """  if (!window.CWAgent || !window.CWTools) {
    if (window.toast) window.toast('Module CWAgent non chargé. Rechargez l\\'application.', 'error');
    return;
  }"""

NEW_GUARD = """  // FIX v5.6.16 : CloudWorks = LLM local obligatoire — pas de fallback cloud
  if (!window.CWAgent || !window.CWTools) {
    if (window.toast) window.toast('Module CWAgent non chargé. Rechargez l\\'application.', 'error');
    return;
  }

  // Vérifier que le modèle LLM est téléchargé
  if (window.eva && window.eva.system && window.eva.system.llmCheck) {
    try {
      var llmChk = await window.eva.system.llmCheck();
      if (!llmChk || !llmChk.exists) {
        if (window.toast) window.toast(
          '⚠️ Modèle LLM non téléchargé. CloudWorks nécessite le LLM local pour fonctionner. Téléchargez-le ci-dessus.',
          'warning'
        );
        // Scroll vers le bouton de téléchargement
        var dlBtn = document.getElementById('cwDownloadLLMBtn');
        if (dlBtn) dlBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
    } catch(chkErr) {}
  }"""

FIX_CW = [(OLD_GUARD, NEW_GUARD, '_cwRunAgenticTask : guard LLM obligatoire')]
patch_utf8(CW_JS_PC, FIX_CW)
patch_utf8(CW_JS_DIST, FIX_CW)

# ═══════════════════════════════════════════════════════════════
# FIX 3 : Erreurs LLM dans run() — message utilisateur clair
# ═══════════════════════════════════════════════════════════════
print('\n=== FIX 3 : Erreurs LLM dans CWAgent.run() ===')

OLD_ERR = """      response = await _callLLM(messages);
      } catch(e) {
        _emit('Erreur LLM: ' + e.message, 'error');
        return { success: false, error: e.message };
      }"""

NEW_ERR = """      response = await _callLLM(messages);
      } catch(e) {
        var errMsg = e.message || 'Erreur inconnue';
        // Erreurs LLM spécifiques — message lisible pour l'utilisateur
        if (errMsg.startsWith('LLM_NOT_AVAILABLE')) {
          _emit('⚠️ Modèle LLM non téléchargé. Allez dans CloudWorks > LLM Local pour le télécharger (2 Go).', 'error');
          if (window.toast) window.toast('Téléchargez le LLM dans la section CloudWorks pour utiliser les tâches libres.', 'warning');
        } else if (errMsg.startsWith('LLM_START_TIMEOUT') || errMsg.startsWith('LLM_START_FAILED')) {
          _emit('⚠️ Le LLM local n\\'a pas pu démarrer. Essayez de le redémarrer dans la section CloudWorks.', 'error');
          if (window.toast) window.toast('LLM local indisponible — redémarrez-le depuis CloudWorks.', 'error');
        } else if (errMsg.startsWith('LLM_EMPTY')) {
          _emit('Le LLM n\\'a pas répondu. Réessayez.', 'error');
        } else {
          _emit('Erreur LLM: ' + errMsg, 'error');
        }
        return { success: false, error: errMsg };
      }"""

FIX_ERR = [(OLD_ERR, NEW_ERR, 'CWAgent.run() : messages erreur LLM clairs')]
patch_utf8(CW_AGENT_PC, FIX_ERR)
patch_utf8(CW_AGENT_DIST, FIX_ERR)

# ═══════════════════════════════════════════════════════════════
# RÉSUMÉ
# ═══════════════════════════════════════════════════════════════
print('\n' + '='*60)
if ERRORS:
    print('ERREURS:')
    for e in ERRORS: print(f'  - {e}')
else:
    print('Tous les fixes v5.6.16 appliqués sans erreur.')

# Vérification rapide
print('\n=== Vérification ===')
for label, path in [('cw-agent.js PC', CW_AGENT_PC), ('cloudworks.js PC', CW_JS_PC)]:
    with open(path, encoding='utf-8', errors='replace') as f:
        c = f.read()
    checks = {
        'cw-agent.js PC': [
            ('FIX v5.6.16', True),
            ('Pollinations', False),  # plus de fallback Pollinations
            ('EVAChatHandler', False), # plus de fallback Puter
            ('LLM_NOT_AVAILABLE', True),
        ],
        'cloudworks.js PC': [
            ('FIX v5.6.16', True),
            ('llmChk', True),
        ],
    }
    for needle, should in checks.get(label, []):
        found = needle in c
        ok = found == should
        print(f'  [{"OK" if ok else "FAIL"}] {label}: "{needle}" {"présent" if should else "absent"}')
