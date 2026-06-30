# EVA Beta V3 — Correctif voix Kokoro & Piper TTS (client-side)

## Symptôme

Les deux moteurs « Kokoro Neural » et « Piper TTS » étaient sélectionnables
dans l'onboarding et dans les paramètres voix, mais à chaque tentative de
lecture l'app **basculait silencieusement sur la voix native du navigateur**
(`speechSynthesis`) — celle qu'on cherchait justement à éviter.

## Cause racine

Les deux fichiers `js/voice/kokoro-tts.js` et `js/voice/piper-tts.js`
chargent la même librairie WebAssembly `@diffusionstudio/vits-web`. Or :

### Bug n°1 — `piper-tts.js` chargeait une version qui n'existe pas
```
https://cdn.jsdelivr.net/npm/@diffusionstudio/vits-web@1.0.5/+esm
                                                       ^^^^^
```
La dernière version publiée sur npm est **1.0.3** (2024-09-09). Les versions
1.0.4 et 1.0.5 n'ont jamais été publiées — jsDelivr renvoyait donc une
**404**, l'import dynamique levait une exception et le fallback navigateur
prenait le relais.

### Bug n°2 — `kokoro-tts.js` chargeait le fichier brut `dist/vits-web.js`
```
https://cdn.jsdelivr.net/npm/@diffusionstudio/vits-web@1.0.3/dist/vits-web.js
```
Ce fichier contient deux **imports nus** que le navigateur ne sait pas
résoudre seul (sans bundler ni import map) :
```js
await import("onnxruntime-web");
await import("./piper-DeOu3H9E.js");
```
→ erreur immédiate `Failed to resolve module specifier "onnxruntime-web"`,
puis bascule sur la voix navigateur, comme pour Piper.

## Correctif appliqué

Les deux fichiers utilisent désormais **le bundle ESM auto-résolu de jsDelivr** :
```
https://cdn.jsdelivr.net/npm/@diffusionstudio/vits-web@1.0.3/+esm
```
Le suffixe `/+esm` demande à jsDelivr de re-bundler le module avec Rollup
en réécrivant les imports nus vers leurs équivalents CDN
(`onnxruntime-web` → `/npm/onnxruntime-web@1.18.0/+esm`, etc.).
Un repli secondaire vers `https://esm.sh/@diffusionstudio/vits-web@1.0.3`
est ajouté si jsDelivr est inaccessible.

### Améliorations supplémentaires

- **Précheck d'environnement** au chargement : on vérifie `isSecureContext`,
  `WebAssembly`, `navigator.storage.getDirectory` (OPFS pour le cache des
  modèles) et on prévient si `crossOriginIsolated` est faux (ONNX tournera
  alors en mono-thread, plus lent mais fonctionnel).
- **Méthode `diagnose()`** ajoutée à `window.PiperTTS` et `window.KokoroTTS`
  → tape `window.PiperTTS.diagnose()` dans la console pour voir d'un coup
  l'état complet (contexte, OPFS, dernière erreur, CDN utilisée…).
- **Repli automatique vers esm.sh** si jsDelivr échoue.
- **Logs explicites** `[Piper TTS]` / `[Kokoro]` à chaque étape pour
  faciliter le débogage si un nouveau souci apparaît.
- Le secours `transformers.js` de Kokoro pointe lui aussi désormais sur la
  variante `+esm` plus fiable (au lieu du bundle UMD `.min.js`).

## Pré-requis serveur (déjà présent dans `netlify.toml`)

Pour permettre le multi-thread WASM (recommandé, sinon Piper est ~3× plus
lent) il faut servir `chat.html` et `onboarding.html` avec :
```toml
Cross-Origin-Opener-Policy   = "same-origin"
Cross-Origin-Embedder-Policy = "credentialless"
```
✓ déjà présent dans le `netlify.toml` du projet — aucune action requise.

## Bug n°3 — Voix `*-low` incompatibles avec le phonémiseur

**Symptôme observé après le 1er correctif :** le moteur se charge bien,
le modèle se télécharge à 100 %, mais à la synthèse :
```
ort-wasm.js  [E:onnxruntime] Non-zero status code … Gather node
indices element out of data bounds, idx=141 must be within [-130, 129]
```

**Cause :** les voix françaises `*-low` du dépôt
`diffusionstudio/piper-voices` ont été entraînées avec un vocabulaire
réduit à **130 phonèmes** (`num_symbols: 130`). Or le phonémiseur intégré
`@diffusionstudio/piper-wasm@1.0.0` utilise le jeu de phonèmes **moderne**
(255 entrées) — pour le français il émet régulièrement des IDs jusqu'à
~158, hors du tableau d'embeddings du modèle → crash ONNX.

| Voix | num_symbols | Compatible ? |
|---|---|---|
| `fr_FR-siwis-medium` ⭐ | 256 | ✅ |
| `fr_FR-upmc-medium`  | 256 | ✅ |
| `fr_FR-mls-medium`   | 256 | ✅ |
| `fr_FR-tom-medium`   | 256 | ✅ |
| `fr_FR-siwis-low`    | 130 | ❌ retirée |
| `fr_FR-gilles-low`   | 130 | ❌ retirée |
| `fr_FR-mls_1840-low` | 130 | ❌ retirée |

**Correctif :** les trois voix `*-low` sont retirées des sélecteurs de
`chat.html` et `onboarding.html`. `piper-tts.js` ajoute une garde de
sécurité : si une vieille préférence pointant sur une voix cassée
remonte du `localStorage`, on bascule automatiquement sur l'équivalent
`-medium` et on prévient en console.

## Bug n°4 — « Kokoro » et « Piper » utilisaient le MÊME moteur

**Symptôme :** quel que soit le moteur sélectionné dans les réglages
voix, le rendu sonore était strictement identique.

**Cause :** dans la version précédente, `kokoro-tts.js` chargeait
`@diffusionstudio/vits-web` exactement comme `piper-tts.js`, avec la
même voix `fr_FR-siwis-medium`. Les deux options « Kokoro Neural » et
« Piper TTS » étaient donc deux noms pour le même moteur Piper VITS.

**Tentative n°1 — `phonemizer@1.2.1` (échouée) :** on a d'abord essayé
de brancher le modèle authentique `onnx-community/Kokoro-82M-v1.0-ONNX`
avec la voix `ff_siwis` via `kokoro-js@1.2.1`. Le modèle se charge
parfaitement (~80 Mo) mais la phonémisation française casse :
`phonemizer@1.2.1` (Xenova) ne livre QUE les données eSpeak NG
**anglaises** côté navigateur — l'appel `phonemize(text, 'fr-fr')`
renvoie *« Invalid language identifier: "fr-fr". Should be one of: en,
en-029, en-gb,… »*. Aucun moyen raisonnable d'injecter les données
françaises d'eSpeak NG sans rebuilder le wasm.

**Tentative n°2 — `Xenova/mms-tts-fra` (échouée) :** repli sur le
modèle multilingue MMS-TTS-fra de Meta, branché via
`@huggingface/transformers@3.5.1`. Marche techniquement, MAIS le seul
locuteur entraîné est un homme — voix masculine, inacceptable pour EVA.

**Correctif définitif — vrai Kokoro-82M + G2P alternatif :**

- Modèle : `onnx-community/Kokoro-82M-v1.0-ONNX` (q8, ~80 Mo)
- Voix : **`ff_siwis`** (Female French — dataset Siwis, voix féminine
  française authentique)
- Architecture **StyleTextToSpeech2** — totalement différente de Piper
  VITS ⇒ timbre clairement distinct
- Phonémisation française : **`@piper-plus/g2p`** (G2P pur JS,
  rule-based, ~50 Ko, MIT, sans eSpeak NG) — produit de l'IPA standard
- Re-mapping des PUA propres à piper-plus (E056-E058, E01E) vers l'IPA
  standard que le tokenizer Kokoro attend (`ɛ̃`, `ɑ̃`, `ɔ̃`, `y`)
- Appel direct de `tts.generate_from_ids(...)` — qui ne valide pas le
  nom de voix et charge `ff_siwis.bin` depuis HuggingFace (contournement
  de la validation hard-codée en-us/en-gb dans kokoro-js)

Résultat : « Kokoro Neural » et « Piper TTS » utilisent des moteurs
neuronaux radicalement différents, tous deux féminins français, et
fonctionnent intégralement côté navigateur sans clé d'API.

## Bug n°5 — Voix masculines indésirables sur Piper

L'utilisatrice ne voulait que des voix féminines (EVA est une fille).
Retiré : `fr_FR-tom-medium` (masculine) et `fr_FR-mls-medium`
(multi-locuteurs au timbre incertain). Les 2 voix retenues sont :

| Voix | Profil |
|---|---|
| `fr_FR-siwis-medium` ⭐ | Féminine claire, classique |
| `fr_FR-upmc-medium`    | Féminine, autre timbre |

## Fichiers modifiés

| Fichier | Modification |
|---|---|
| `js/voice/piper-tts.js` | Pin sur 1.0.3, URL `/+esm`, repli esm.sh, précheck, `diagnose()`, voix non féminines auto-remappées sur siwis-medium |
| `js/voice/kokoro-tts.js` | **Réécrit** — vrai Kokoro-82M v1.0 + phonémiseur fr-fr, fallback MMS-TTS-fra |
| `chat.html`              | Sélecteur Piper réduit aux 2 voix féminines |
| `onboarding.html`        | Sélecteur Piper réduit aux 2 voix féminines |

Aucun autre fichier n'a été touché. Le `netlify.toml`, `tts.js`, etc.
restent inchangés.

## Vérifier que ça marche

1. Déployer sur Netlify (purge du cache CDN si besoin).
2. Ouvrir `/chat`, ouvrir la console du navigateur.
3. Sélectionner « Piper TTS » ou « Kokoro Neural » dans les paramètres voix.
4. Envoyer un message court à EVA.
5. Premier usage → téléchargement du modèle (~63 Mo, mis en cache OPFS),
   logs `[Piper TTS] Chargement…` puis `[Piper TTS] Voix prête`.
6. Usages suivants → voix neurale française instantanée.

Si rien ne se passe, taper dans la console :
```js
window.PiperTTS.diagnose()
```
→ le rapport indique exactement ce qui manque (HTTPS, OPFS, crossOriginIsolated…).
