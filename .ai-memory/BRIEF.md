# EVA — BRIEF PROJET

## Objectif
EVA (Evolutionary Virtual Assistant) — assistante IA conversationnelle avec TTS, wake word, mémoire adaptative.
Créée par Astral Technologie (fondée par Enzo).

## Deux codebases indépendantes

### App PC (Electron)
- Dossier : `eva-pc/`
- Sources web : `eva-pc/web/` (JS/HTML statique)
- Build : `eva-pc/dist/` (généré par `npm run compile` = `tsc + vite + xcopy web→dist`)
- Deploy : `node deploy.js` depuis `eva-pc/` → auto-incrémente version → GitHub Releases → installeur NSIS
- Version actuelle : voir `eva-pc/package.json`
- **INTERDIT : ne jamais éditer `E:\eva\`** (installation production) — travailler uniquement dans `f:\code\eva\evaprojectmultiplatforme\eva-pc`

### Web navigateur (Vercel)
- Dossier : `EVA_V4_fixed_v4/`
- Deploy : push git main → Vercel redéploie automatiquement
- Firebase config : servie par `/api/config` (Vercel function), pas de fichier statique

## Contraintes techniques
- Node PATH : `F:\donnee_app\dev_tool\node`
- TEMP/TMP : `F:\temp`
- Git remote : `https://github.com/urnova/eva.git` branch `main`
- Firebase project : `eva-assistant-a4fdf`, SDK 9.22.0 compat
- TTS moteurs : SAPI Windows (PC), ElevenLabs, Piper, eva-custom — NE JAMAIS CASSER

## Providers IA
- **Pollinations** (défaut) : `text.pollinations.ai/openai`, modèle `openai-fast` (GPT-OSS 20B, tier anonymous)
- **Puter** (fallback) : `puter.ai.chat()`, modèle `gpt-4o-mini`
- OpenAI, Claude, LMStudio, Ollama : avec clé API

## Architecture wake word
### PC (eva-pc/web/js/voice/wake-word.js)
- Vosk WebAssembly (local offline) + fallback Web Speech
- En premier plan : `_dispatchCommand` → `window.sendVoiceCommand(cmd)` directement
- En arrière-plan (bulle overlay) : `handleJarvisWakeWord` → Jarvis mode
- Init dans auth.js : juste les `wakeWords`, PAS de `onCommand` (dispatch géré par wake-word.js)

### Web navigateur (EVA_V4_fixed_v4/js/voice/wake-word.js)
- Web Speech API uniquement (pas Vosk)
- `onCommand` dans auth.js → arrêt STT si actif → `sendVoiceCommand(cmd)`
- `sendVoiceCommand` → `handleSend(cmd)` avec arg direct
