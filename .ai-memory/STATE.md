# STATE — E.V.A Multiplateforme

- **Phase actuelle** : D1 finalisée et publiée (`eva-pc` v5.6.28 sur GitHub Releases + Web sur `main` / Vercel).
- **Correctifs v5.6.28** :
  - `overlay.html`, `main.ts`, `pc-bridge.js` : zone `-webkit-app-region: drag` déplacée sur `.drag-zone` (hors `.btn-action` et `#approvalBar`), bouton Power/Annuler stoppe immédiatement TTS/Jarvis/CloudWorks et garde l'overlay masqué (`_overlayCancelledUntil`).
  - `cw-chat.js`, `messages.js` : coupe-circuit conversationnel à 0 ms pour les salutations/questions pures sans mots-clés PC/fichier/app ; suppression complète des bulles `#typingInd, .typing-bubble` lors du basculement ou après réponse (`Génère...` ne reste plus figé).
  - `providers.js`, `messages.js` : détection explicite `PUTER_QUOTA_EXCEEDED` (solde/quota/402) avec annonce vocale dédiée et boutons pour changer de compte Puter ou de fournisseur IA.
  - `pc-bridge.js`, `messages.js` : watchdog Jarvis relevé à 25 s (effacé dès réponse/erreur IA), attente réelle de `startJarvisConversation()` avant envoi, sauvegarde des réponses/erreurs vocales en base, et suppression automatique des sessions vocales restées vides à la fermeture.
- **Correctifs v5.6.27** :
  - `cw-runtime.ts` : `app_launch` étend `$env:USERPROFILE` / `%USERPROFILE%` / `~` / `Bureau` et ouvre les fichiers non exécutables (`.html`, `.txt`, `.md`, `.pdf`, etc.) via `shell.openPath()`.
  - `cw-agent.js` : planificateur structuré par étapes avec verrouillage par outil (`schemaForTool`), garde-fou contre l’écrasement d’un fichier précédent, et rédaction de contenu riche HTML/doc via le provider IA actif (fallback 3B local hors ligne).
  - `overlay.html` : design glassmorphique d’origine à double anneau rotatif + boutons `[✓ Autoriser]` / `[✗ Refuser]`.
- **En attente** : Retour utilisateur sur `v5.6.28` + vocal/CloudWorks avant de démarrer D2 ([D2_BACKLOG.md](file:///f:/code/eva/evaprojectmultiplatforme/.ai-memory/D2_BACKLOG.md)).
