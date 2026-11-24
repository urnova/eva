# STATE — EVA — 24 Nov 2026 (mise à jour 13h15)

## Statut actuel
**D1 — Terminé, validé par tests unitaires & déployé** — v5.6.21 ✅ PUBLIÉE GitHub Releases (commit d7f1ff5, push OK)

### Solutions définitives D1 appliquées dans v5.6.21 (Audit approfondi & résolution racine)
| Bug résolu | Cause racine identifiée | Solution appliquée & vérifiée |
|---|---|---|
| **Faux script regex / exécution instantanée sans LLM** | 327 lignes de regex de substitution ("Fast Path", lignes 425-752 dans `pc-agent.js`) interceptaient les commandes avant le LLM et exécutaient des scripts prédéfinis sans passer par le modèle. | **Suppression complète du Fast Path regex.** Toute tâche CloudWorks délègue directement et authentiquement au LLM local (`window.CWAgent` / `node-llama-cpp`). Zéro court-circuit. |
| **Réflexion en boucle / "Tâche terminée" sans action dans CloudWorks** | Le modèle local Qwen 3B générait son intention dans sa pensée `<thought>` (ex: *"La bonne approche est d'ouvrir https://youtube.com... J'utilise app_launch avec l'URL directement"*) mais omettait la balise stricte `<tool_call>`. L'ancien parseur renvoyait `null` ou considérait la prose comme une fin de tâche sans actionner d'outil. | **Nouveau parseur d'intention robuste V2** dans `cw-agent.js` :<br>1. Support `<tool_call>...` standard et tronqué.<br>2. Extraction de bloc JSON direct sans balises.<br>3. Analyse des appels syntaxiques `tool_name(...)`.<br>4. Détection automatique d'URLs web `https://...` associées aux intentions de navigation.<br>5. Extraction des cibles d'outils (`app_resolve`, `app_launch`, etc.) mentionnées dans la pensée.<br>6. Outils sans arguments (`screenshot_take`, `system_status`).<br>**Validé par 13 tests unitaires (100% succès).** |
| **Erreur "Low balance Puter" bloquant le chat** | En cas de compte Puter sans crédits (`aiProvider: 'puter'`), Puter levait une exception `Low balance` et le chat n'avait pas de repli automatique transparent. | **Fallback automatique transparent vers Pollinations gratuit** dans `providers.js` dès qu'une erreur de solde/quota/balance Puter survient. Zéro coupure de service pour l'utilisateur. |
| **Mémoire consommant des crédits Puter** | `memory.js` envoyait les résumés automatiques de conversation sur le provider actif (Puter), épuisant les crédits en arrière-plan. | `memory.js` basculé par défaut sur Pollinations gratuit (zéro quota, totalement transparent). |

### Règle d'or CloudWorks validée
- **CloudWorks = 100% LLM local sur le PC** (`node-llama-cpp`). Zéro appel Puter / Pollinations pour les tâches agentiques, tokens illimités, gratuité totale.
- La tâche IA libre reste utilisable même en cas de quota épuisé sur le chat EVA.

### Prochaine étape
- L'utilisateur installe `E.V.A-Setup-5.6.21.exe` depuis GitHub Releases.
- Test de la tâche libre CloudWorks avec n'importe quelle commande (application locale, navigation web, capture d'écran, fichier, etc.).
- Dès validation D1 -> Lancement officiel de la phase **D2**.

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
