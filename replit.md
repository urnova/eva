# E.V.A V3 - Evolutionary Virtual Assistant

## Project Overview
An AI-powered intelligent virtual assistant web app with a Grok-like chat interface. Supports voice interaction (TTS/STT), image analysis, and personal productivity tools.

## Tech Stack
- **Frontend:** Vanilla HTML5, CSS3, ES6+ JavaScript modules (no build step)
- **Backend/Database:** Firebase (Auth + Firestore)
- **AI Providers:** WebLLM (Qwen 3), LM Studio, Ollama, Puter, OpenAI (GPT-4o), Claude
- **Voice (TTS):** Web Speech API natif (voix française du navigateur/OS) → Puter TTS (si voiceProvider=puter)
- **Voice (STT):** Web Speech API
- **Runtime:** Node.js 20 (for serving static files via `serve`)

## Project Structure
```
/
├── index.html          # Landing page
├── login.html          # Authentication page
├── onboarding.html     # User profile setup
├── chat.html           # Main chat interface
├── assets/
│   ├── images/         # SVG logos and icons
│   ├── sounds/         # Alarm/notification audio
│   └── styles/         # Modular CSS files
├── js/
│   ├── core/           # Firebase config, auth, utilities
│   ├── ai/             # AI provider integrations
│   ├── voice/          # TTS, STT, wake-word
│   ├── ui/             # Interface management
│   ├── features/       # Alarms, notes, calendar, conversations
│   ├── settings/       # Settings UI, profile management
│   └── app.js          # Main entry point
└── docs/               # Technical guides
```

## Running the App
- **Workflow:** "Start application" — runs `npx serve -s . -l 5000`
- **Port:** 5000 (webview)
- **No build step required** — static files served directly

## Deployment
- Configured as a **static** deployment with `publicDir: "."`
- Originally configured for Netlify; adapted for Replit static hosting

## Firebase Setup
- Firebase is initialized via CDN imports in the HTML files
- Configuration is in `js/core/firebase-config.js`
- Requires Firebase project credentials to be set up for Auth and Firestore to work

## Roles & Permissions
- **creator** (#ffd700 gold) — Enzo, PDG Astral Technologie — full access
- **developer** (#00d4ff cyan) — Dev team — full access
- **creator_wife** (#ff69b4 pink) — special access
- **user** — standard access
- Roles stored in Firestore `users.role`, activated via dev keys (`dev_keys_valid` collection)

## Reports System (chat.html)
- **Floating button** "SIGNALER" — visible to all authenticated users
- **Report modal** — 4 types: bug-conversation (auto-fills last 10 messages), bug-général, suggestion, autre; priority selector for bugs; screenshot upload (base64, max 2 Mo)
- **Reports stored** in Firestore `reports` collection — fields: userId, userName, userEmail, userRole, type, priority, description, conversationExcerpt, screenshot, status, createdAt, updatedAt, adminNotes, resolvedAt
- **Gold sidebar section "Admin"** — visible only to creator/developer roles
- **Reports dashboard** (viewReports) — stats bar (total/pending/in-progress/resolved), filters by type/status, expandable cards, status selector (pending/in-progress/resolved/rejected), admin notes, delete

## Reminders System (2025-03)
- **Rappels view** — new sidebar nav item + full view panel (viewReminders) in `chat.html`
- **CRUD:** Create (with date/time), complete (checkbox), delete — all synced to Firestore `users/{uid}/reminders`
- **Reminder checker** — `checkRemindersTime()` runs every 60s; fires toast + browser/SW notification when time is reached
- **EVA can create reminders** — added `[ACTION:{"type":"reminder",...}]` to system prompt + action parser

## Push Notifications (2025-03)
- **Service Worker** — `service-worker.js` at root; handles alarm + reminder notifications with action buttons
- **Alarm notifications:** Stop (dismiss) + Snooze (+5 min) action buttons; SW re-triggers after 5 min on snooze
- **Alarm overlay:** Full-screen overlay in `chat.html` with looping audio (2 min max), Stop/Snooze buttons
- **Permission flow:** Asked in onboarding step 5 + manageable in Settings > Notifications
- **Settings section "Notifications"** — shows permission state, activate/deactivate button, tips for denied state

## Live2D Character (EVA Panel)
- Character panel in `chat.html` uses **Live2D** via `pixi-live2d-display` + PixiJS 6
- Model: Shizuku (Cubism 2) loaded from jsDelivr CDN
- CDN scripts loaded in `chat.html` before `eva-character.js`:
  - `live2dcubismcore.min.js` (cubism.live2d.com)
  - `pixi.js@6` (jsDelivr)
  - `pixi-live2d-display` (jsDelivr)
- Character module: `js/eva-character.js` — exposes `window.EvaCharacter` API
  - `create(containerId)` — initializes PIXI app and loads Live2D model
  - `setIdle()`, `setTalking()`, `setListening()`, `setThinking()`, `setHappy()` — trigger motions
- Mouse tracking: model head follows cursor via parameter injection
- Loading spinner shown while model downloads from CDN (~3-5 seconds)

## TTS Architecture
- **native:** Web Speech API (`SpeechSynthesisUtterance`) — défaut, voix française du navigateur/OS
- **puter:** Puter TTS (`puter.ai.txt2speech`) — requiert Puter connecté
- **elevenlabs:** ElevenLabs REST API (`eleven_multilingual_v2`, needs `config.elevenLabsApiKey` + `config.elevenLabsVoiceId`)
- **openai:** OpenAI TTS (`tts-1`, needs `config.openAITTSApiKey` + `config.openAITTSVoice`)
- Dispatch centralisé dans `speakText()` via `config.voiceProvider`; repli auto sur Web Speech API si provider échoue
- `js/voice/kokoro-tts.js` — stub vide (désactivé, ne définit pas `window.KokoroVoice`)
- Orchestrated in `js/voice/tts.js` — `window.EVATTS` (speakText, stopTTS, etc.)
- Settings panel (chat.html): provider selector (Navigateur / Puter / ElevenLabs / OpenAI TTS) with contextual sub-options per provider (lang, voice, API keys); speech rate slider; TTS on/off toggle; wake word toggle
- Onboarding step 3: voice selector + TTS provider dropdown (saves `voiceProvider` to Firestore preferences)
- `testVoice()` uses the currently selected provider in the settings panel

## Eva Character Animation
- **Idle:** Live2D motions drive everything — no param overrides
- **Thinking:** Slow head tilt oscillation (upper-left) + raised brow
- **Talking:** Head movement + syllable-based lip sync (`ParamMouthOpenY` 0–0.98)
- **Listening:** Static attentive pose
- Natural blinking every 3–7 seconds; states managed in `js/eva-character.js`

## Architecture Notes
- `chat.html` is monolithic (~5100 lines) — all chat logic is inline; `js/ui/chat-ui.js` and `js/app.js` are NOT imported by chat.html
- `js/settings/settings-ui.js` is a module used by the module-based app system only — NOT by chat.html
- Settings in chat.html use `S` (global state object) and `saveCfg()`/`loadCfg()` (localStorage)

## API Keys / Provider Settings — Firebase Sync (2025-03)
- All API keys (OpenAI, Claude, ElevenLabs, OpenAI TTS, Ollama, LM Studio, etc.) and provider prefs are saved to Firebase `users/{uid}/preferences` on every "Appliquer" / "Sauvegarder" action
- On login, `loadProfile()` merges Firebase preferences into `S.config` — keys are restored automatically across devices
- `saveCfg()` still writes to localStorage as local cache; Firebase is the cross-device source of truth
- `saveAISettings()` and `saveVoiceSettings()` are both `async` to support Firebase writes

## Provider Definitions — Changes (2025-03)
- **Puter:** Removed Claude 3.5 Sonnet (broken) — only GPT-4o Mini and GPT-4o remain
- **Claude:** Removed Claude 3.5 Sonnet — only Haiku and Opus available
- **Qwen:** Description updated with disclaimer "Assistant uniquement — ne convient pas pour le code"

## Apply Button UX (2025-03)
- Clicking "Appliquer" in AI settings: button immediately changes to "⏳ Application...", then "✓ Appliqué" (green) on success
- Settings panel auto-closes after 1.5s
- Toast notification confirms the new provider name in plain language
- Same pattern for all providers (Puter, OpenAI, Claude, Qwen, LM Studio, Ollama)

## Qwen Local — Download Progress Modal (2025-03)
- Qwen initialization is now lazy — model is NOT downloaded when clicking "Appliquer"
- Download triggers on the FIRST message sent in the conversation
- Progress modal (`.qwen-dl-overlay`) appears with: animated icon, model name, progress bar (0→100%), percentage, and hint text
- `window.showQwenDownloadModal(modelName)`, `window.updateQwenDownloadProgress(progress)`, `window.hideQwenDownloadModal()` — global controls
- `js/ai/providers.js` QwenProvider uses `_doDownload()` which calls WebLLM with `initProgressCallback` → updates modal
- Modal auto-closes 1.2s after download completes with "✓ MODÈLE PRÊT" confirmation

## Qwen Role Fix (2025-03)
- System prompt for Qwen gets an appended reinforcement: `[RAPPEL CRITIQUE — modèle local Qwen]` reminding it that it is EVA (the AI) not the user, and that it is an assistant-only model (no code)

## Vision / Image Analysis — Provider-Aware (2025-03)
- `analyzeImage()` in chat.html now routes based on `S.config.aiProvider`:
  - **openai** → OpenAI Vision API (gpt-4o) using `openaiApiKey`
  - **claude** → Anthropic API with base64 image using `claudeApiKey`
  - **lmstudio** → LM Studio `/v1/chat/completions` with image_url
  - **ollama** → Ollama `/api/generate` with llava model and base64 images
  - **qwen** → Returns informative message (vision not supported locally)
  - **puter** → Default, uses Puter GPT-4o (fallback for all others without keys)
