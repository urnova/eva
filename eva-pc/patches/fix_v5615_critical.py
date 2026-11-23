"""
EVA v5.6.15 — Fix critique 3 bugs :
  1. sendBtn toujours disabled dans l'app PC
  2. LLM local jamais utilisé dans cw-agent.js (Puter brulé à tort)
  3. Modèle LLM effacé par NSIS à chaque mise à jour
"""
import os, re

ROOT = r'f:\code\eva\evaprojectmultiplatforme'
PC_WEB = os.path.join(ROOT, 'eva-pc', 'web', 'js')
PC_DIST = os.path.join(ROOT, 'eva-pc', 'dist', 'js')
WEB_DIR = os.path.join(ROOT, 'EVA_V4_fixed_v4', 'js')
ERRORS = []

def patch_latin1(path, replacements, label=''):
    try:
        with open(path, 'rb') as f:
            raw = f.read()
        content = raw.decode('latin-1')
        orig = content
        for old, new, desc in replacements:
            if old in content:
                content = content.replace(old, new)
                print(f'  [OK] {desc}')
            else:
                print(f'  [SKIP] Non trouvé : {desc}')
        if content != orig:
            with open(path, 'wb') as f:
                f.write(content.encode('latin-1'))
            print(f'  Sauvegardé : {path}')
        else:
            print(f'  Aucun changement : {path}')
    except Exception as e:
        ERRORS.append(f'{label} {path}: {e}')
        print(f'  ERREUR : {e}')

def patch_utf8(path, replacements, label=''):
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
        ERRORS.append(f'{label} {path}: {e}')
        print(f'  ERREUR : {e}')

# ═══════════════════════════════════════════════════════════════
# FIX 1 : sendBtn — retirer disabled du HTML + toujours actif
# ═══════════════════════════════════════════════════════════════
print('\n=== FIX 1 : sendBtn disabled dans chat.html ===')
CHAT_HTML = os.path.join(ROOT, 'eva-pc', 'web', 'chat.html')
CHAT_HTML_DIST = os.path.join(ROOT, 'eva-pc', 'dist', 'chat.html')

FIX_BTN = [
    # Retirer disabled du HTML : le JS gère maintenant via handleSend directement
    (
        '<button class="input-btn send-btn" id="sendBtn" title="Envoyer" disabled>',
        '<button class="input-btn send-btn" id="sendBtn" title="Envoyer">',
        'sendBtn: suppression disabled initial dans HTML'
    ),
]
patch_utf8(CHAT_HTML, FIX_BTN)
patch_utf8(CHAT_HTML_DIST, FIX_BTN)

# Aussi corriger dans ui-setup.js : activer sendBtn dès setupUI()
print('\n=== FIX 1b : sendBtn activé dès setupUI() ===')
UI_SETUP_PC = os.path.join(PC_WEB, 'app', 'ui-setup.js')
UI_SETUP_DIST = os.path.join(PC_DIST, 'app', 'ui-setup.js')

# Trouver où handleSend est lié pour insérer l'activation
FIX_UISETUP = [
    (
        "document.getElementById('sendBtn').addEventListener('click', handleSend);",
        "document.getElementById('sendBtn').addEventListener('click', handleSend);\n  document.getElementById('sendBtn').disabled = false; /* FIX v5.6.15 : toujours actif */",
        'sendBtn: activé immédiatement dans setupUI()'
    ),
]
patch_latin1(UI_SETUP_PC, FIX_UISETUP)
patch_latin1(UI_SETUP_DIST, FIX_UISETUP)

# ═══════════════════════════════════════════════════════════════
# FIX 2 : _callLLM dans cw-agent.js — LLM local EN PREMIER
# ═══════════════════════════════════════════════════════════════
print('\n=== FIX 2 : _callLLM — LLM local prioritaire ===')
CW_AGENT_PC = os.path.join(PC_WEB, 'features', 'cw-agent.js')
CW_AGENT_DIST = os.path.join(PC_DIST, 'features', 'cw-agent.js')

OLD_CALLLM = """async function _callLLM(messages) {
  // Essai avec EVAChatHandler (provider principal d'EVA)
  if (window.EVAChatHandler && typeof window.EVAChatHandler.sendMessage === 'function') {
    // Convertir l'historique en un seul prompt contextualisé
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

  // Fallback direct sur Pollinations
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
  if (!resp.ok) throw new Error('LLM HTTP ' + resp.status);
  var data = await resp.json();
  var content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  if (!content) throw new Error('Reponse LLM vide');
  return content;
}"""

NEW_CALLLM = """async function _callLLM(messages) {
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

FIX_AGENT = [(OLD_CALLLM, NEW_CALLLM, '_callLLM : LLM local prioritaire')]
patch_utf8(CW_AGENT_PC, FIX_AGENT)
patch_utf8(CW_AGENT_DIST, FIX_AGENT)

# ═══════════════════════════════════════════════════════════════
# FIX 3 : NSIS installer.nsh — NE PAS supprimer models à la MàJ
# ═══════════════════════════════════════════════════════════════
print('\n=== FIX 3 : NSIS customUninstall — conserver userData/models ===')
NSIS_PATH = os.path.join(ROOT, 'eva-pc', 'build', 'installer.nsh')

# Lire le fichier nsh
with open(NSIS_PATH, encoding='utf-8', errors='replace') as f:
    nsis_content = f.read()

# Remplacer le customUninstall qui efface les models
OLD_UNINSTALL = """!macro customUninstall
  ; ══════════════════════════════════════════════════════════════════
  ; Nettoyage du modèle LLM stocké dans AppData à la désinstallation
  ; Le modèle est dans %APPDATA%\\eva-assistant-pc\\models\\
  ; ══════════════════════════════════════════════════════════════════
  ReadEnvStr $R1 APPDATA
  ; IfFileExists est la syntaxe NSIS native correcte (pas ${If} ${DirExists})
  IfFileExists "$R1\\eva-assistant-pc\\models\\*.*" 0 +2
    RMDir /r "$R1\\eva-assistant-pc\\models"
!macroend"""

NEW_UNINSTALL = """!macro customUninstall
  ; ══════════════════════════════════════════════════════════════════
  ; FIX v5.6.15 : NE PAS supprimer userData/models à la désinstallation
  ; Le modèle LLM (2 Go) est précieux — l'utilisateur l'a téléchargé.
  ; Il restera dans AppData\\Roaming\\eva-assistant-pc\\models\\ et survivra
  ; aux mises à jour ET aux réinstallations.
  ; La suppression manuelle est toujours possible via l'Explorateur.
  ; ══════════════════════════════════════════════════════════════════
  ; (aucune suppression du modèle ici — il persiste intentionnellement)
!macroend"""

if OLD_UNINSTALL in nsis_content:
    nsis_content = nsis_content.replace(OLD_UNINSTALL, NEW_UNINSTALL)
    with open(NSIS_PATH, 'w', encoding='utf-8') as f:
        f.write(nsis_content)
    print('  [OK] customUninstall : suppression des models désactivée')
    print(f'  Sauvegardé : {NSIS_PATH}')
else:
    # Chercher une variante
    idx = nsis_content.find('RMDir /r "$R1\\\\eva-assistant-pc\\\\models"')
    if idx < 0:
        idx = nsis_content.find('RMDir /r')
    print(f'  [WARN] Bloc exact non trouvé. RMDir à pos: {idx}')
    if idx >= 0:
        print('  Contexte:', repr(nsis_content[max(0,idx-100):idx+200]))

# ═══════════════════════════════════════════════════════════════
# RÉSUMÉ
# ═══════════════════════════════════════════════════════════════
print('\n' + '='*60)
print('RÉSUMÉ v5.6.15')
print('='*60)
if ERRORS:
    print('ERREURS:')
    for e in ERRORS:
        print(f'  - {e}')
else:
    print('Tous les fixes appliqués sans erreur.')
