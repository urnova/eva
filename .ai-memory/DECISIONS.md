# DECISIONS — EVA — Projet D1/D2

## Décisions techniques validées

### Encodage fichiers
- `eva-pc/web/js/app/*.js` → **Windows-1252 (latin-1)** → patcher UNIQUEMENT via Python avec `encoding='latin-1'`
- `eva-pc/web/js/features/*.js` → UTF-8
- `EVA_V4_fixed_v4/js/` → UTF-8 partout
- Jamais utiliser `edit_file` directement sur les fichiers latin-1

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

## Décisions UI/UX pour D2 (pas encore commencé)

- Redesign complet : palette #0d0d14 / #00d4ff / #8b5cf6, typo Inter + Orbitron
- Refaire la bulle de conversation + bulle CloudWorks (différentes selon agent)
- Refaire la fenêtre de réflexion + animations
- Refaire l'affichage PDF, Excel, etc.
- Gestion appareils : permettre révocation de session (liste avec "Cette session" vs dernière activité)
- TTS inchangeable : SAPI Windows, ElevenLabs, Piper, eva-custom
