# E.V.A V3 - Evolutionary Virtual Assistant

## Project Overview
An AI-powered intelligent virtual assistant web app with a Grok-like chat interface. Supports voice interaction (TTS/STT), image analysis, and personal productivity tools.

## Tech Stack
- **Frontend:** Vanilla HTML5, CSS3, ES6+ JavaScript modules (no build step)
- **Backend/Database:** Firebase (Auth + Firestore)
- **AI Providers:** WebLLM (Qwen 3), LM Studio, Ollama, Puter, OpenAI (GPT-4o), Claude
- **Voice:** Web Speech API, Puter TTS
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
