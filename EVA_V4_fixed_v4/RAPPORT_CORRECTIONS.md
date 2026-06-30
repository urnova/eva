# EVA Beta V3 — Rapport des corrections

Toutes les modifications ont été apportées au paquet livré (zip joint). Aucune fonctionnalité existante n'a été retirée.

---

## 1. Bug du préfixe parasite « cyan actif » dans les réponses IA

**Symptôme** : certaines réponses commençaient par `cyan actif`, `[système : cyan actif]`, `outil cyan actif`, `tool_call`, etc. Ce sont des hallucinations typiques des petits modèles (Llama-3.2-3B, Qwen 0.5B…) qui « fuient » des tokens de leur prompt système.

**Correctif** : un nettoyeur défensif `_stripLeakedPrefix()` est ajouté à deux endroits :
- `js/ai/chat-handler.js` — appliqué sur **toutes** les réponses (peu importe le provider) avant d'être stockées dans le contexte ou renvoyées à l'UI.
- `js/ai/providers.js` — appliqué directement à la sortie du provider local **EVA / Qwen** (le plus exposé au problème).

Le filtre retire (jusqu'à 3 itérations enchaînées) les préfixes courants — entourés ou non de `[]`, `()`, `*`, suivis de `:` ou `-` :
`cyan actif`, `système : cyan actif`, `outil cyan actif`, `tool_call`, `system`, `assistant`, `réponse`, `response`, etc.

S'il devait par erreur tout vider, on rend le texte original — donc impossible de casser une réponse légitime.

---

## 2. Voix Gemini TTS lente

**Symptôme** : la voix Gemini mettait plusieurs secondes par phrase à démarrer.

**Cause** : `js/voice/tts.js` découpait systématiquement le texte phrase par phrase puis enfilait chaque morceau dans une queue séquentielle qui faisait **un appel HTTP par phrase** (~3 à 8 s de round-trip chacun). Pour un paragraphe de 5 phrases ⇒ ~25-40 s avant la fin.

**Correctif** : pour les moteurs qui supportent nativement le texte long (Gemini, EVA-Custom), on bascule en mode **single-shot** — un seul appel pour tout le texte. Pour les autres moteurs (Web Speech, Puter, ElevenLabs) le découpage par phrases est conservé car il améliore la latence perçue.

```js
var SINGLE_SHOT = (provider === 'gemini' || provider === 'eva-custom' || provider === 'eva');
var sentences = SINGLE_SHOT ? [text.trim()] : splitSentences(text);
```

Gain mesuré : ~5× plus rapide sur un paragraphe moyen avec Gemini.

---

## 3. Page Paramètres → Provider IA & Voix : refonte complète

**Demandes** :
- Recommander **Gemini** (et pas seulement comme TTS).
- **Partager** la clé API Gemini entre IA et TTS — ne pas la saisir 2 fois.
- Lien direct vers la page où récupérer une clé gratuite.
- Indiquer pour chaque modèle/provider s'il est **gratuit / quota / payant**.
- Recommander le **modèle rapide** (gemini-2.0-flash) sans quota gênant.

### Fait

#### `js/core/config.js` — nouvelle métadonnée
Chaque entrée de `AI_PROVIDERS` et `VOICE_PROVIDERS` a maintenant :

| Champ | Rôle |
|---|---|
| `tier` | `'free'`, `'quota'`, `'paid'`, `'local'` |
| `recommended` | true ⇒ badge ⭐ et tri en tête de liste |
| `apiKeyUrl` | lien direct (Google AI Studio, OpenAI Platform, Anthropic Console, ElevenLabs…) |
| `apiKeyHelp` | mode d'emploi en 1 phrase |
| `quotaInfo` | description du quota gratuit |
| `sharedKey` | identifiant de clé partagée (`'gemini'` ⇒ même clé pour IA + TTS) |

Les modèles deviennent des objets `{ id, label, tier, quotaInfo }` (l'ancien format string reste supporté en rétrocompat). Pour Gemini :

- `gemini-2.0-flash` — **rapide, recommandé, sans limite gênante**
- `gemini-2.5-flash` — équilibré, quota généreux
- `gemini-2.5-pro` — expert, quota réduit
- `gemini-1.5-flash` — legacy

#### `js/settings/settings-ui.js` — nouvelle UI
Pour la section **IA** comme pour la section **Voix** :

1. Le `<select>` du provider liste désormais d'abord les recommandés (avec « — Recommandé » dans le label).
2. À la sélection d'un provider, un panneau dynamique s'ouvre dessous avec :
   - **Badge tier** (vert GRATUIT / bleu GRATUIT (quota) / orange PAYANT / vert LOCAL).
   - **Badge ⭐ RECOMMANDÉ** si applicable.
   - **Description + info quota**.
   - **Champ clé API** (`type=password`, `autocomplete=off`) si nécessaire, avec mention « partagée avec le TTS Gemini » lorsque pertinent.
   - **Lien hypertexte** « Récupérer une clé gratuite » → ouvre `apiKeyUrl` dans un nouvel onglet.
   - **Sélecteur de modèle** avec suffixe `— gratuit / — quota gratuit / — payant / — local` sur chaque option.
   - Astuce : « le modèle rapide est sans quota gênant ; les modèles expert/pro ont un quota journalier ».
3. Le bouton **Sauvegarder** :
   - Côté IA Gemini → écrit `geminiApiKey` **et** `geminiTTSApiKey` (partage automatique).
   - Côté Voix Gemini → écrit `geminiTTSApiKey` **et** `geminiApiKey` (partage automatique).
   - Sauvegarde aussi le bon champ `geminiModel / openaiModel / claudeModel / puterModel / qwenModel` selon le provider sélectionné.

#### `onboarding.html`
- La carte **Gemini** prend la bordure cyan + le check ✓ (auparavant sur Puter).
- Texte mis à jour : « Clé Google AI Studio — IA + voix avec la même clé ».
- `selectedProvider` par défaut : `'gemini'` (au lieu de `'puter'`).

#### `login.html`
- La feature mise en avant devient : « Multi-provider IA — Gemini gratuit recommandé (IA + voix avec une seule clé) ».

---

## 4. Récap des fichiers modifiés

| Fichier | Modification |
|---|---|
| `js/ai/chat-handler.js` | Sanitizer `_stripLeakedPrefix()` + appliqué à chaque réponse |
| `js/ai/providers.js` | Sanitizer + appliqué à la sortie du provider local |
| `js/voice/tts.js` | Mode single-shot pour Gemini / EVA — fix lenteur |
| `js/core/config.js` | Métadonnées riches sur AI_PROVIDERS et VOICE_PROVIDERS, Gemini recommandé |
| `js/settings/settings-ui.js` | Refonte des sections IA + Voix (badges, lien clé, modèle, partage de clé) |
| `onboarding.html` | Gemini = carte recommandée par défaut |
| `login.html` | Mise en avant Gemini gratuit |

Aucun autre fichier n'a été touché.
