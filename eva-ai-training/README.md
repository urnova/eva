# Entraînement Local du Modèle EVA-GGUF

Ce dossier contient les scripts pour créer, fine-tuner et exporter votre modèle propriétaire "EVA-GGUF" en utilisant votre carte graphique RTX 3060 Ti.

## Prérequis
1. Vous devez avoir Python installé (version 3.10 ou supérieure).
2. Installez PyTorch avec le support CUDA (NVIDIA).

## Instructions

### 1. Installation des dépendances
Ouvrez un terminal dans ce dossier (`eva-ai-training`) et installez Unsloth et les autres librairies requises :
```bash
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
pip install "unsloth[colab-new] @ git+https://github.com/unslothai/unsloth.git"
pip install --no-deps trl peft accelerate bitsandbytes
```

### 2. Entraînement de la personnalité
Lancez le script d'entraînement. Le modèle de base (Qwen2.5-1.5B) sera téléchargé et fine-tuné sur les données de `dataset.json`. 
*Note : Cela prendra quelques minutes sur votre RTX 3060 Ti.*
```bash
python train_eva.py
```

### 3. Export en GGUF
Une fois l'entraînement terminé, lancez le script d'exportation.
```bash
python export_gguf.py
```
Le modèle `eva-model.gguf` sera automatiquement créé, optimisé, et placé dans le dossier `eva-pc/resources/llm/` de l'application !
Vous n'aurez plus qu'à relancer l'application pour que le modèle agentique se charge.
