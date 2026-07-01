# EVA.ia — Notice d'installation des modèles locaux
## Astral Technologie — Beta V3

---

## 📥 Téléchargement des modèles officiels EVA (Google Drive)

| Modèle | Lien Google Drive |
|--------|------------------|
| **⚡ EVA Rapide** (LLM 1B) | [Télécharger](https://drive.google.com/file/d/1S5PIWb7ehEr5rSoSGZ8BkLeHfJLPokT_/view?usp=drive_link) |
| **🧠 EVA Expert** (LLM 3B) | [Télécharger](https://drive.google.com/file/d/1-zgEshLjZ4v8Y5wM75TPeLpc3Mvl0l8j/view?usp=drive_link) |
| **💻 EVA Codeur** (LLM 1.5B) | [Télécharger](https://drive.google.com/file/d/12uEifm03SX_c8Z_2V5PhlqTPL430wtdm/view?usp=drive_link) |
| **🎙️ EVA Voice** (TTS) | [Télécharger](https://drive.google.com/file/d/1MgN6ZaJQF60qSNLfgAMa7cJAQuAXdT_U/view?usp=drive_link) |

---

## Vue d'ensemble

EVA dispose de 3 modèles IA locaux qui tournent **directement dans le navigateur** grâce à WebLLM (WebGPU). Ces modèles doivent être placés manuellement dans le dossier du projet car leur taille (700 MB à 2.2 GB chacun) les rend impossibles à distribuer via Git ou un dépôt standard.

> **Aucun serveur requis.** Les modèles s'exécutent 100% localement sur la machine de l'utilisateur — zéro données envoyées à un tiers.

---

## Les 3 modèles EVA + 1 modèle TTS

| Modèle | Taille | Cas d'usage | Architecture de base |
|--------|--------|-------------|---------------------|
| **EVA Rapide** | ~700 MB | Réponses ultra-rapides, tâches simples | LLaMA 1B (MLC) |
| **EVA Expert** | ~2.2 GB | Meilleure qualité, raisonnement, analyse | Phi-3.5 Mini (MLC) |
| **EVA Codeur** | ~1 GB | Code, debug, architecture logicielle | Qwen2.5-Coder 1.5B (MLC) |

---

## Structure des fichiers requise

Placez les modèles dans le dossier `public/` de l'application :

```
public/
└── models/
    └── eva/
        ├── eva-rapide/
        │   ├── mlc-chat-config.json      ← Config du modèle
        │   ├── tokenizer.model           ← Tokenizer SentencePiece
        │   ├── tokenizer.json            ← Config tokenizer
        │   ├── tokenizer_config.json     ← Paramètres tokenizer
        │   ├── params_shard_0.bin        ← Poids du modèle (shard 0)
        │   └── eva-rapide-webgpu.wasm    ← Bibliothèque WebGPU compilée
        │
        ├── eva-expert/
        │   ├── mlc-chat-config.json
        │   ├── tokenizer.model
        │   ├── tokenizer.json
        │   ├── tokenizer_config.json
        │   ├── params_shard_0.bin        ← Peut être découpé en plusieurs shards
        │   ├── params_shard_1.bin        ← (selon le modèle)
        │   └── eva-expert-webgpu.wasm
        │
        └── eva-codeur/
            ├── mlc-chat-config.json
            ├── tokenizer.model
            ├── tokenizer.json
            ├── tokenizer_config.json
            ├── params_shard_0.bin
            └── eva-codeur-webgpu.wasm
```

---

## Comment générer les fichiers modèles (MLC format)

Les fichiers au format MLC sont générés à partir des modèles Hugging Face via l'outil `mlc-llm`.

### Prérequis
```bash
pip install mlc-llm
# ou avec conda :
conda install mlc-ai mlc-chat -c mlc-ai -c conda-forge
```

### Commandes de compilation (exemple pour EVA Rapide — Llama 1B)

```bash
# 1. Convertir les poids du modèle
mlc_llm convert_weight \
  path/to/Llama-3.2-1B-Instruct \
  --quantization q4f16_1 \
  --output eva-rapide/

# 2. Générer la config
mlc_llm gen_config \
  path/to/Llama-3.2-1B-Instruct \
  --quantization q4f16_1 \
  --conv-template chatml \
  --output eva-rapide/

# 3. Compiler pour WebGPU (cible navigateur)
mlc_llm compile \
  eva-rapide/mlc-chat-config.json \
  --device webgpu \
  --output eva-rapide/eva-rapide-webgpu.wasm
```

### Modèles de base recommandés (Hugging Face)

| EVA | Modèle Hugging Face |
|-----|---------------------|
| EVA Rapide | `meta-llama/Llama-3.2-1B-Instruct` |
| EVA Expert | `microsoft/Phi-3.5-mini-instruct` |
| EVA Codeur | `Qwen/Qwen2.5-Coder-1.5B-Instruct` |

---

## Vérification du déploiement

Une fois les fichiers en place, vérifiez que les chemins sont accessibles :

```
https://votre-domaine.com/models/eva/eva-rapide/mlc-chat-config.json
https://votre-domaine.com/models/eva/eva-expert/mlc-chat-config.json
https://votre-domaine.com/models/eva/eva-codeur/mlc-chat-config.json
```

Si ces URLs renvoient un JSON valide, l'intégration est prête.

---

## Configuration Netlify

Ajoutez ces en-têtes dans `netlify.toml` pour les fichiers `.wasm` et `.bin` :

```toml
[[headers]]
  for = "/models/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

[[headers]]
  for = "/*.wasm"
  [headers.values]
    Content-Type = "application/wasm"
```

---

## Notes importantes

- **WebGPU requis** : Les modèles nécessitent un navigateur avec WebGPU activé (Chrome 113+, Edge 113+). Firefox et Safari ont un support partiel.
- **RAM requise** : EVA Rapide ~1.5 GB RAM, EVA Expert ~4 GB RAM, EVA Codeur ~2 GB RAM.
- **Premier chargement** : Les modèles sont mis en cache par le navigateur — les chargements suivants sont instantanés.
- **Taille de déploiement** : Ces fichiers sont trop volumineux pour Git LFS standard. Utilisez un CDN, un bucket S3, ou hébergez-les séparément.

---

*EVA Beta V3 — Astral Technologie*
