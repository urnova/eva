# STATE — E.V.A Multiplateforme

- **Phase actuelle** : D1 implémentée, compilée, testée et publiée (`eva-pc` v5.6.26 sur GitHub Releases + Web sur `main` / Vercel).
- **En attente** : Validation utilisateur en conditions réelles sur `v5.6.26` et Web avant d'ouvrir le chantier D2 (`D2_BACKLOG.md`).
- **Commandes vérifiées** :
  - `eva-pc`: `npm run compile` (`tsc && vite build && xcopy`)
  - `eva-pc`: `node deploy.js` (incrément v5.6.26, build NSIS `E.V.A-Setup-5.6.26.exe`, publication GitHub Releases)
  - `EVA_V4_fixed_v4`: `npm install`, `node --check api/tts.js`, test live handler `/api/tts` (`200`, `audio/mpeg`)
