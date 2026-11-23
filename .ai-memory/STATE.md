# STATE — EVA — 23 Nov 2026 (mise à jour 22h38)

## Statut actuel
**D1 en cours** — Patches v5.6.14 appliqués, build en cours

## Cause racine des bugs D1 (TROUVÉE)

Le commit `13093fb` (nouveau moteur CloudWorks v5.6) a appliqué le patch `async function executeEvaAction` MAIS le script de patch a été exécuté **3 fois** sur le même fichier → `async async async function executeEvaAction` → **JavaScript invalide → crash silencieux de file-gen.js → rien ne fonctionnait.**

Conséquence en cascade :
- `executeEvaAction` ne s'exécutait jamais → pas de création `cmdRef` Firestore → pas de tracker CloudWorks dans le chat
- `cwConfirmAndExecute` → fallback sur `executeEvaAction` → crash silencieux
- Modal CW tracker jamais affiché
- Bouton "Arrêter" zombie (S.cwRunning jamais remis à false car jamais mis à true)

## Bugs D1 corrigés dans v5.6.14

| Bug | Cause | Fix |
|---|---|---|
| sendBtn bloqué après envoi | `sendBtn.disabled = !(input && input.value.trim()) && ...` → après envoi input vide → reste disabled | `sendBtn.disabled = false` inconditionnellement dans hideTyping |
| Tracker CW absent / dispatch ne marche pas | **Triple async** `async async async function executeEvaAction` → JS invalide → crash total | Remplacé par `async function executeEvaAction` (1 seul async) |
| Modal CW jamais créée | Dépend du fix ci-dessus | Résolu |
| Bouton Arrêter zombie | Dépend du fix ci-dessus | Résolu |
| YouTube Music ouvre navigateur | `window.eva.ipc.invoke('pwa:detect')` → `window.eva.ipc` n'existe PAS dans le preload | Remplacé par `window.eva.system.exec('dir /b /s Start Menu | findstr ...')` |

## Fichiers modifiés en v5.6.14

```
eva-pc/web/js/app/file-gen.js        ← triple async → single async (latin-1)
eva-pc/web/js/app/messages.js        ← sendBtn.disabled = false (latin-1)
eva-pc/web/js/features/cw-tools.js  ← PWA detect window.eva.system.exec (utf-8)
eva-pc/dist/js/app/file-gen.js       ← même fix (dist)
eva-pc/dist/js/app/messages.js       ← même fix (dist)
eva-pc/dist/js/features/cw-tools.js  ← même fix (dist)
EVA_V4_fixed_v4/js/app/file-gen.js   ← double async → single (utf-8)
EVA_V4_fixed_v4/js/app/messages.js   ← sendBtn.disabled = false (utf-8)
```

## Scripts de patch créés (répertoire eva-pc/patches/)

```
eva-pc/patches/fix_all_bugs_v5614.py    ← fix principal triple async + sendBtn + PWA
eva-pc/patches/fix_pwa_webbrowse.py     ← draft (non utilisé)
eva-pc/patches/fix_pwa_webbrowse_v2.py  ← fix 2ème bloc PWA web_browse
eva-pc/patches/audit_regressions.py     ← audit de tous les bugs
eva-pc/patches/check_chathtml.py        ← vérification scripts chat.html
```

## Analyse architecturale (ce qui a été cassé avec v5.6)

### Ancien moteur CW
- `cw-modal.js` : définit `window.cwConfirmAndExecute` + tracker dans le chat
- `file-gen.js` : `executeEvaAction` (non async) → crée cmd Firestore
- Flow: LLM → `[ACTION:{type:"agentic_task"}]` → `file-gen.js` → `cwConfirmAndExecute` → `executeEvaAction`

### Nouveau moteur CW (v5.6)
- `cw-engine.js` : moteur d'état (10 états), validation catalogue
- `cw-firestore-adapter.js` : sync Firebase, heartbeat
- `cw-windows-adapter.js` : catalogue actions Windows, timeout IPC 30s
- `cw-modal-enhanced.js` : expose `window.CWModal` (UI 10 états) — MAIS PAS `window.cwConfirmAndExecute`
- `cw-agent.js` : expose `window.CWAgent`, `window.CWAgentStop`, `window.CWAgentRun`
- `cw-tools.js` : outils PWA, web_browse, app_launch
- `cloudworks.js` : section CloudWorks dans l'app PC

### Ce qui a été maintenu correctement
- `cw-modal.js` (ancien) est TOUJOURS chargé → `window.cwConfirmAndExecute` toujours disponible
- `window.appendCloudWorksTracker` défini dans `cw-modal.js`
- `file-gen.js` → `cwConfirmAndExecute` → `executeEvaAction` → Firestore → `appendCloudWorksTracker`

### Ce qui était cassé (maintenant corrigé)
- Triple async dans file-gen.js → tout le flow cassé
- `window.eva.ipc.invoke` inexistant → PWA detect plantait silencieusement

## État des patches vérifiés (audit_regressions.py)

```
[1] Triple async file-gen.js       → OK (web + EVA_V4)
[2] sendBtn disabled fix            → OK (web + EVA_V4)
[3] window.eva.ipc.invoke x0        → OK (web + dist)
[4] cwConfirmAndExecute défini      → OK
[5] Scripts CW dans chat.html       → OK (tous)
[6] Scripts CW dans EVA_V4          → cw-tools.js et cw-agent.js manquants (normal, PC only)
[7] LLM model path userData/models  → OK
```

## Prochaine étape
- Validation v5.6.14 par l'utilisateur (GitHub Releases)
- Si OK → démarrer D2
- Si bug persistant → audit approfondi du LLM status (modèle qui se perd)

## Commits récents
- `daa2bb0` : v5.6.9 fix LLM userData path
- `4540061` : fix(D1) sendBtn + executeEvaAction async + PWA detection (triple async introduit ici)
- `604d303` : **v5.6.14 FIX triple async + sendBtn + PWA via system.exec** ✅ PUBLIÉ
