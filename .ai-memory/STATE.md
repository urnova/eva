# STATE — E.V.A Multiplateforme

- **Phase actuelle** : D1 implémentée, vérifiée en E2E réel et publiée (`eva-pc` v5.6.27 sur GitHub Releases + Web sur `main` / Vercel).
- **Correctifs v5.6.27** :
  - `cw-runtime.ts` : `app_launch` étend `$env:USERPROFILE` / `%USERPROFILE%` / `~` / `Bureau` et ouvre les fichiers non exécutables (`.html`, `.txt`, `.md`, `.pdf`, etc.) via `shell.openPath()`.
  - `cw-agent.js` : planificateur structuré par étapes avec verrouillage par outil (`schemaForTool`), garde-fou contre l’écrasement d’un fichier précédent, et rédaction de contenu riche HTML/doc via le provider IA actif (fallback 3B local hors ligne).
  - `overlay.html` : design glassmorphique d’origine à double anneau rotatif + boutons `[✓ Autoriser]` / `[✗ Refuser]`.
  - `messages.js`, `cw-chat.js`, `cw-modal.js` : vidage immédiat de la barre d’envoi sans gel, réponse d’EVA avant le lancement et bilan d’EVA après la fin d’une tâche CloudWorks.
- **En attente** : Retour utilisateur sur `v5.6.27` + vocal avant de démarrer D2 ([D2_BACKLOG.md](file:///f:/code/eva/evaprojectmultiplatforme/.ai-memory/D2_BACKLOG.md)).
