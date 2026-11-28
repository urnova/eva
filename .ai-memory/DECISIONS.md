# DECISIONS — EVA — Projet D1/D2

## Décisions techniques validées

### Encodage fichiers
- Tous les fichiers `eva-pc/web/` et `EVA_V4_fixed_v4/` (HTML, CSS, JS) ont été normalisés en **UTF-8 propre sans BOM** (y compris `messages.js`, `memory.js` et `app-signup.html`)
- Jamais de caractères de contrôle C1 (`\u0080-\u009f`) — toujours encoder en UTF-8 valide (`\u2026`, `\u2014`, accents UTF-8)

### API IPC Electron
- `window.eva` exposé par `preload.ts` via `contextBridge.exposeInMainWorld`
- **`window.eva.ipc` N'EXISTE PAS** → utiliser les APIs exposées :
  - `window.eva.system.exec(cmd)` pour exécuter des commandes système
  - `window.eva.system.llmCheck()`, `llmStatus()`, `llmStart()`, `llmStop()`
  - `window.eva.fs.*` pour le système de fichiers
  - `window.eva.openExternal(url)` pour ouvrir des URLs externes
  - `window.eva.tts.speak(text)` pour TTS

### Scripts Python de patch
- Toujours passer par des fichiers `.py` dans `eva-pc/patches/`
- Ne JAMAIS utiliser `python -c "..."` avec `&&`, `||`, `{}` → PowerShell les interprète
- Vérifier le résultat avec `audit_regressions.py`

### Build pipeline
- `node deploy.js` depuis `eva-pc/` → auto-incrémente version → compile → publie GitHub Releases
- Ne PAS pré-incrémenter manuellement la version
- Node PATH : `F:\donnee_app\dev_tool\node`
- TEMP/TMP : `F:\temp`

### Modèle LLM
- Téléchargé dans `userData/models/EVA-PC-Agentic-3B-Q4_K_M-v5.gguf`
- Survit aux mises à jour (userData ≠ dossier app)
- `llm:check` cherche d'abord userData, puis resourcesPath/models, puis resourcesPath/llm (legacy)

### CloudWorks architecture (v5.6)
- `window.cwConfirmAndExecute` → défini dans `cw-modal.js` (ancien, maintenu)
- `window.CWModal` → défini dans `cw-modal-enhanced.js` (nouveau)
- `window.CWAgent` → défini dans `cw-agent.js`
- Flow dispatch depuis chat : LLM → `file-gen.js` → `cwConfirmAndExecute` → `executeEvaAction` → Firestore → `appendCloudWorksTracker`
- **Ne PAS supprimer `cw-modal.js`** même avec le nouveau moteur

### Contraintes NSIS
- Jamais de `$_` dans installer.nsh
- Kill ciblé `%EVA Assistant%` uniquement (pas `%EVA%` trop générique)

### Dossiers interdits
- `E:\eva\` → INTERDIT en écriture (installation production)
- Lire uniquement pour debug si nécessaire

## Décisions UI/UX & Architecture D2 (implémentées)

- Redesign complet PC + Web : palette `#0d0d14 / #13131f / #1a1a2e`, dégradé `#00d4ff -> #8b5cf6`, polices auto-hébergées `/assets/styles/fonts.css` (`Inter` + `Orbitron`) sans requêtes Google Fonts externes
- Suppression complète du panneau/personnage 3D `EvaCharacter`
- Barre de saisie arrondie unifiée avec sélecteur de modèle, Recherche approfondie (`deepSearchBtn`), Mode Live (`liveModeBtn`), micro Antigravity, chips de fichiers compactes
- Séparation des conversations textuelles (`Chats`) et vocales (`isVoiceSession: true` -> onglet `🎙️ Vocal`)
- Connecteurs Dual MCP + Codemod + Natifs mutuellement exclusifs par service (`js/features/connectors.js`) avec persistance Firestore sur `/users/{uid}.connectors` (compatible `firestore.rules`)
- Providers `GeminiProvider` + `EVAQuotas` + délai configurable (`1500 ms` par défaut) + cascade fallback strictement opt-in (`autoFallback: false` par défaut) + génération média (`EVAMedia`) désactivée par défaut
- Sessions & appareils unifiés avec empreinte déterministe `UUID`/`MAC`/`WEB` et révocation bidirectionnelle Compte ↔ CloudWorks
- Moteurs TTS inchangés : SAPI Windows, ElevenLabs, Piper, eva-custom
