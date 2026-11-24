#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
EVA — Création ZIP source + prompt GPT
Destination : C:/Users/zozoo/Downloads/eva_debug_gpt.zip
"""

import os, zipfile, shutil, datetime

ROOT = r'f:\code\eva\evaprojectmultiplatforme'
EVAPC = os.path.join(ROOT, 'eva-pc')
OUT_ZIP = r'C:\Users\zozoo\Downloads\eva_debug_gpt.zip'

# ─── Fichiers à inclure ───────────────────────────────────────────────────────
FILES = [
    # Electron main process
    ('eva-pc/electron/main.ts',           'electron/main.ts'),
    ('eva-pc/electron/preload.ts',        'electron/preload.ts'),
    # Build / NSIS
    ('eva-pc/package.json',               'package.json'),
    ('eva-pc/build/installer.nsh',        'build/installer.nsh'),
    # Features CloudWorks
    ('eva-pc/web/js/features/cw-agent.js',              'web/js/features/cw-agent.js'),
    ('eva-pc/web/js/features/cloudworks.js',            'web/js/features/cloudworks.js'),
    ('eva-pc/web/js/features/pc-agent.js',              'web/js/features/pc-agent.js'),
    ('eva-pc/web/js/features/cw-tools.js',              'web/js/features/cw-tools.js'),
    ('eva-pc/web/js/features/cw-modal.js',              'web/js/features/cw-modal.js'),
    ('eva-pc/web/js/features/cw-modal-enhanced.js',     'web/js/features/cw-modal-enhanced.js'),
    ('eva-pc/web/js/features/cw-engine.js',             'web/js/features/cw-engine.js'),
    ('eva-pc/web/js/features/cw-windows-adapter.js',    'web/js/features/cw-windows-adapter.js'),
    ('eva-pc/web/js/features/cw-firestore-adapter.js',  'web/js/features/cw-firestore-adapter.js'),
    # App JS
    ('eva-pc/web/js/app/messages.js',       'web/js/app/messages.js'),
    ('eva-pc/web/js/app/file-gen.js',       'web/js/app/file-gen.js'),
    ('eva-pc/web/js/app/memory.js',         'web/js/app/memory.js'),
    ('eva-pc/web/js/app/ui-setup.js',       'web/js/app/ui-setup.js'),
    # HTML principal
    ('eva-pc/web/chat.html',                'web/chat.html'),
    # AI & Core
    ('eva-pc/web/js/ai/chat-handler.js',    'web/js/ai/chat-handler.js'),
    ('eva-pc/web/js/ai/providers.js',       'web/js/ai/providers.js'),
    ('eva-pc/web/js/core/firebase-config.js','web/js/core/firebase-config.js'),
    ('eva-pc/web/js/pc-bridge.js',          'web/js/pc-bridge.js'),
]

# ─── Prompt GPT ──────────────────────────────────────────────────────────────
PROMPT = """
# EVA Assistant — Audit & correction bugs CloudWorks + Chat

Tu es un expert en développement Electron/JavaScript. Je vais te donner le code source complet de mon application EVA Desktop (Electron + Firebase) avec tous ses bugs actuels. Je veux que tu analyses tout, identifies les causes racines, et me proposes un plan de correction complet avec le code fixé.

---

## 1. Contexte du projet

**EVA** est un assistant IA desktop (Electron) + web (Vercel/Firebase).

### Architecture globale
```
EVA DESKTOP (Electron)
├── electron/main.ts        → Processus principal Node.js
│   ├── Handler IPC llm:chat  → Appel node-llama-cpp (LLM local 1.8GB)
│   ├── Handler IPC system:*  → exec, screenshot, info système
│   └── autoUpdater          → electron-updater + GitHub Releases
├── electron/preload.ts     → Bridge contextBridge → window.eva.system.*
└── web/                    → Interface HTML/JS (chargée dans BrowserWindow)
    ├── chat.html           → Page principale (chat + CloudWorks)
    ├── js/app/             → Encodage Windows-1252 (latin-1) OBLIGATOIRE
    │   ├── messages.js     → handleSend, envoi messages chat
    │   ├── file-gen.js     → Parsing réponses EVA + dispatch actions
    │   └── memory.js       → Mémoire évolutive (extraction JSON)
    └── js/features/        → Encodage UTF-8
        ├── cloudworks.js   → Section CloudWorks UI + _cwRunAgenticTask()
        ├── cw-agent.js     → CWAgent : boucle ReAct LLM local
        ├── cw-tools.js     → Outils exécutables (app_launch, web_browse, etc.)
        ├── cw-modal.js     → Tracker bulle CloudWorks dans le chat
        ├── pc-agent.js     → Écoute Firestore + runAgenticLoop()
        └── cw-windows-adapter.js → Catalogue outils Windows

FIREBASE (Firestore)
├── users/{uid}/            → Profil, settings, mémoire
└── cloudworks/{uid}/
    ├── devices/{deviceId}  → Appareils enregistrés (heartbeat)
    └── commands/{cmdId}    → Commandes {type, payload, status, result}

FLUX CHAT → CLOUDWORKS (depuis le chat EVA):
1. User tape "ouvre YouTube" dans le chat
2. Cloud provider (Pollinations/Puter) génère [ACTION:{type:"agentic_task", prompt:"Ouvrir YouTube"}]
3. file-gen.js détecte l'action → cwConfirmAndExecute() → executeEvaAction()
4. executeEvaAction() crée un doc Firestore: cloudworks/{uid}/commands/{id}
5. appendCloudWorksTracker(cmdId, prompt) → affiche bulle tracker dans le chat
6. pc-agent.js écoute Firestore (onSnapshot) → runAgenticLoop(prompt)
7. runAgenticLoop() : d'abord heuristiques regex, sinon CWAgent + LLM local
8. Résultat écrit dans Firestore → bulle mise à jour

FLUX TÂCHE LIBRE (depuis section CloudWorks):
1. User tape dans le textarea + clique "Exécuter avec le LLM"
2. _cwRunAgenticTask() dans cloudworks.js
3. Crée un CWAgent et appelle agent.run(prompt)
4. CWAgent appelle window.eva.system.llmChat() → main.ts handler llm:chat
5. main.ts utilise node-llama-cpp pour générer une réponse
6. CWAgent parse la réponse: <thought>...</thought> + <tool_call>{...}</tool_call>
7. CWAgent exécute le tool via CWTools.executeTool()
8. Boucle jusqu'à [TACHE_TERMINEE] ou MAX_TURNS
```

### API window.eva (preload.ts → main.ts)
```javascript
window.eva.system.llmChat(messages, {max_tokens, temperature}) 
  → retourne: { choices: [{ message: { role: 'assistant', content: string } }] }
  
window.eva.system.llmStatus()  → { running: boolean }
window.eva.system.llmStart()   → démarre le LLM
window.eva.system.llmCheck()   → { exists: boolean }
window.eva.system.exec(cmd)    → { success, stdout, stderr }
window.eva.openExternal(url)   → ouvre URL dans navigateur système
```

### Règle architecturale (OBLIGATOIRE)
- **CloudWorks = LLM local UNIQUEMENT** (node-llama-cpp). Zéro fallback réseau.
- **Chat EVA** = cloud providers (Pollinations en priorité, Puter en fallback)
- Si LLM absent → CloudWorks bloqué + message pour télécharger

---

## 2. Bugs actuels (v5.6.18)

### BUG CRITIQUE A — Tâche libre: LLM pense mais n'exécute pas l'outil
**Symptôme**: Le LLM affiche sa pensée (`<thought>...</thought>`) dans l'UI mais
n'exécute jamais le `<tool_call>`. La tâche se termine avec succès sans rien faire.

**Cause probable**: Dans cw-agent.js, la boucle ReAct retourne immédiatement
si visibleText est vide (tout était dans les balises thought), sans laisser le LLM
émettre son tool_call. Ou le LLM génère thought + tool_call mais le parsing rate
parce que les tokens sont coupés avant la fin du tool_call.

**Ce qu'on voit dans la console**:
```
[CWAgent] Appel LLM local (node-llama-cpp)
// Pensée affichée dans l'UI mais aucun tool exécuté
// TÂCHE TERMINÉE affiché sans action réelle
```

### BUG B — Pas de bulle CloudWorks dans le chat (tâche libre)
**Symptôme**: Quand on exécute une tâche depuis la section CloudWorks (tâche libre),
aucune bulle tracker n'apparaît dans le chat.

**Cause**: _cwRunAgenticTask() crée l'agent localement sans créer de commande
Firestore et sans appeler appendCloudWorksTracker().

### BUG C — Depuis le chat "ouvre YouTube": EVA dit "je m'en occupe" mais ne lance pas CloudWorks
**Symptôme**: Le provider cloud génère une réponse textuelle ("Je m'en occupe")
mais ne génère pas de [ACTION:{type:"agentic_task"}]. Ou le genère mais
cwConfirmAndExecute n'est pas appelé.

### BUG D — Version navigateur: CloudWorks déclenché mais rien ne s'ouvre
**Symptôme**: Sur le site web (sans Electron), CloudWorks est déclenché (bulle apparaît),
mais aucune action n'est exécutée car window.eva n'existe pas (pas d'Electron).

### BUG E — Boucle au démarrage après mise à jour (peut-être corrigé en v5.6.18)
**Symptôme**: Après installation, l'app boucle sur l'écran de démarrage.
Fix tenté: quitAndInstall(true, false) dans main.ts.

---

## 3. Ce que je veux que tu fasses

1. **Analyse complète** du code source fourni (tous les fichiers joints)
2. **Identifie les causes racines exactes** de chaque bug (A, B, C, D)
3. **Propose un plan de correction** avec le code complet corrigé pour chaque fichier
4. **Priorise**: Le bug A (tâche libre ne fait rien) est le plus critique

### Contraintes importantes
- Les fichiers `eva-pc/web/js/app/*.js` sont en **Windows-1252** (latin-1). Toujours lire/écrire avec cet encodage.
- Les fichiers `eva-pc/web/js/features/*.js` sont en **UTF-8**.
- Ne jamais modifier la structure Firestore (schéma des documents).
- Le LLM retourne `{ choices: [{ message: { role, content } }] }` — format OpenAI-like.
- `window.eva.ipc` N'EXISTE PAS. Utiliser uniquement `window.eva.system.*`.
- MAX_TURNS = 12 dans cw-agent.js (limite de tours de réflexion de l'agent).

### Format de réponse attendu
Pour chaque bug, donne-moi:
```
## Bug X — [Nom]
### Cause racine
[Explication précise]

### Fix — [nom du fichier]
```diff
[diff du code à changer]
```
```

Les fichiers source sont joints en ZIP. Commence par lire cw-agent.js, cloudworks.js,
pc-agent.js et main.ts pour comprendre le flux complet.
""".strip()

# ─── Création du ZIP ──────────────────────────────────────────────────────────
print(f'Création du ZIP: {OUT_ZIP}')
with zipfile.ZipFile(OUT_ZIP, 'w', zipfile.ZIP_DEFLATED) as zf:
    # Ajouter le prompt en premier
    zf.writestr('PROMPT_POUR_GPT.txt', PROMPT)
    
    # Ajouter chaque fichier source
    missing = []
    for rel_src, arc_name in FILES:
        full = os.path.join(ROOT, rel_src)
        if os.path.exists(full):
            zf.write(full, arc_name)
            print(f'  + {arc_name}')
        else:
            missing.append(rel_src)
            print(f'  [MANQUANT] {rel_src}')
    
    # Ajouter un README
    readme = f"""EVA Debug Package — {datetime.datetime.now().strftime('%Y-%m-%d %H:%M')}

CONTENU:
- PROMPT_POUR_GPT.txt  → Prompt à copier-coller dans GPT avec tous les fichiers
- electron/            → Processus Electron (main.ts, preload.ts)
- web/js/features/     → Modules CloudWorks (UTF-8)
- web/js/app/          → Modules chat (Windows-1252/latin-1 !)
- web/chat.html        → Page principale

UTILISATION:
1. Ouvrir GPT-4o ou o3
2. Uploader tous les fichiers .js/.ts/.html
3. Coller le contenu de PROMPT_POUR_GPT.txt
4. Demander les corrections

BUGS PRIORITAIRES:
A - Tâche libre: LLM pense mais n'exécute pas l'outil (CRITIQUE)
B - Pas de bulle CloudWorks en tâche libre
C - Chat: EVA répond sans déclencher CloudWorks
D - Version web: CloudWorks sans Electron = rien ne s'exécute
"""
    zf.writestr('README.txt', readme)

size = os.path.getsize(OUT_ZIP) / 1024
print(f'\nZIP créé: {OUT_ZIP}')
print(f'Taille: {size:.0f} KB')
if missing:
    print(f'Fichiers manquants: {missing}')
else:
    print('Tous les fichiers inclus.')
