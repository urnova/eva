# STATE — EVA — 25 Nov 2026 (v5.6.25)

## Statut actuel
**D1 — Refonte, Corrections & Déploiement v5.6.25** — v5.6.25 ✅ PUBLIÉE sur GitHub Releases (`E.V.A-Setup-5.6.25.exe`)

### Causes racines identifiées et corrigées en v5.6.25 (après test réel sur GGUF 3B + audit complet)
| Problème constaté | Cause racine réelle vérifiée | Solution appliquée |
|---|---|---|
| **Chat : "Créer un fichier test sur le bureau" échoue ou part sur Puter** | En test réel avec `EVA-PC-Agentic-3B-Q4_K_M-v5.gguf`, le routeur `pc-agent.js` classait `"Créer un fichier test sur le bureau"` en `clarify` (échec `CLARIFICATION_REQUIRED`) et `"ecrit un fichier de test su mon bureau"` en `conversation` (envoyé sur Puter). | Routeur multi-tours few-shot dans `pc-agent.js` + exemples calibrés. Benchmark GGUF 3B passé à 10/11 (et 100% sur création de fichiers, lancement d'apps, capture, système, salutations, explications React/PWA). |
| **Chat normal bloqué si CloudWorks est désactivé** | `cw-chat.js` ne vérifiait pas `eva.cloudworks.status().enabled` avant de soumettre `chat_request`, provoquant une erreur `CLOUDWORKS_DISABLED` sur des messages normaux. | Garde ajoutée dans `cw-chat.js` (`!forced && !enabled => return false`), vérifiée par test unitaire. |
| **Collision `cw-chat.js` vs `cloudworks.js` (pas d'overlay au clic, double encadrement)** | `cw-chat.js` (chargé en dernier dans `chat.html`) écrasait `_cwRunAgenticTask`, `_cwStopAgent` et `_cwQuickCmd` de `cloudworks.js`. | `cw-chat.js` préserve les handlers de `cloudworks.js` ; `_cwRunAgenticTask` et `_cwQuickCmd` utilisent `CWBus` + `appendCloudWorksTracker` sans double cadre. |
| **Bulle overlay bloquée ou mal dimensionnée / halo gris** | 1) `pc-agent.js` affichait l'overlay avant le routage `chat_request` et sortait sur `conversation` sans le cacher. 2) `overlay.html` utilisait `backdrop-filter` et `mask-composite` sur Electron transparent Windows (`340x140`). | 1) Overlay affiché uniquement si `route === 'action'` ou tâche PC directe, avec `overlayHideTimer` et fermeture garantie. 2) Refonte complète `overlay.html` (`400x104`, `workArea`, fond opaque/dégradé net, états `cloudworks`, `approval`, `done`, `error`). |
| **Carte tracker CloudWorks (`cw-modal.js`) jugée moche** | Bordures imbriquées dans `#cwAgenticStatus`, absence de liste d'étapes en direct, `renderSavedTrackerCard` cassé sur l'état sauvegardé. | Refonte complète `cw-modal.js` (dark glass, liste des 5 dernières étapes, résumé stylisé, suppression double bordure, correction `renderSavedTrackerCard`), synchronisée avec `EVA_V4_fixed_v4`. |
| **Blocage "En attente du PC" à distance (Multi-PC)** | `cw-bus.js` acceptait des devices sans `lastSeen` (`t === 0`) et jusqu'à 5 min sans trier par fraîcheur, ni purger un `cw_target_device` périmé. | Filtrage strict `online === true && ts > 0 && age < 120s`, tri par `workerVersion` / `win32` / `lastSeen` décroissant, purge des sélections obsolètes. |
| **Autorisation Windows cachée en arrière-plan & chemin `Bureau`** | `dialog.showMessageBox(mainWindow(), ...)` restait attaché si fenêtre minimisée, sans notifier Firestore/Overlay, et ignorait `autonomousMode`. | `cw-runtime.ts` notifie `cw:approval-pending` (état `waiting_user` + overlay ambre), détache le dialogue si fenêtre non visible, respecte `cwAutonomousMode` pour la création de fichiers/documents, et normalise `Bureau` -> `Desktop`. |

### Vérifications effectuées
- Benchmark GGUF `EVA-PC-Agentic-3B-Q4_K_M-v5.gguf` (node-llama-cpp) : outils Tour 0 & Tour 1 OK (file_create, app_launch `youtube.com` / `calc.exe` / `notepad.exe`, screenshot_take, system_status, file_list). Routeur few-shot : 10/11 (seul cas edge restant : `"N ouvre pas YouTube"` sans apostrophe).
- `node --check` sur les 14 fichiers JS (PC + Web) : 14/14 OK.
- `npx tsc --noEmit` & `npm run compile` : 0 erreur.
- Suite unitaire `verify_d1.mjs` : 5/5 OK (`cw-tools`, `cw-bus`, `cw-chat`, parité PC/Web).
- Non testé en interactif ici : exécution E2E dans la fenêtre Electron packagée + Vercel live après push.

### Prochaine étape
- Installer `E.V.A-Setup-5.6.25.exe` depuis GitHub Releases (`v5.6.25`).
- Vérifier en conditions réelles : tâche libre CloudWorks, commande dans le chat, commande à distance, apparence de la nouvelle bulle overlay et de la carte.
- Passer ensuite à la Phase D2 dès validation utilisateur.

---

## Statut actuel
**D1 en cours** — v5.6.17 ✅ PUBLIÉE sur GitHub Releases (commit 52d181e)

### Bugs D1 corrigés dans v5.6.17 (identifiés via console DevTools)
| Bug | Cause racine | Fix |
|---|---|---|
| Impossible d'écrire dans le chat | `window.handleSend = function(x){return handleSend(x);}` → récursion infinie → stack overflow | Supprimé le wrapper — `window.handleSend = handleSend;` après définition |
| LLM_EMPTY dans CloudWorks | `cw-agent.js` cherchait `result.content` mais `llm:chat` retourne `result.choices[0].message.content` | Lecture correcte du format OpenAI-like retourné par main.ts |

### Bugs D1 corrigés dans v5.6.16 (commit a879eb4)
| Bug | Fix |
|---|---|
| CloudWorks utilise Puter/Pollinations | LLM local UNIQUEMENT — zero fallback cloud |
| Erreur masquée "AUCUN LLM DISPONIBLE" | Erreurs typées lisibles (LLM_NOT_AVAILABLE, LLM_START_TIMEOUT, LLM_ERROR) |

### Prochaine validation attendue
- Installer v5.6.17 → tester chat EVA + tâche libre CloudWorks "ouvre youtube"

## Bugs D1 corrigés dans v5.6.15 (commit 8a89e86)

| Bug | Cause | Fix |
|---|---|---|
| sendBtn toujours disabled PC | `disabled` dans le HTML, jamais retiré si input ne reçoit pas d'événement | Retiré du HTML + `sendBtn.disabled = false` forcé dans `setupUI()` |
| LLM local jamais utilisé (Puter cramé) | `_callLLM` essayait EVAChatHandler (Puter) EN PREMIER | Ordre inversé : LLM local → Pollinations → Puter en dernier |
| Modèle LLM effacé à chaque MàJ | NSIS `customUninstall` faisait `RMDir /r userData/models` | `customUninstall` ne supprime plus rien — modèle permanent |

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
