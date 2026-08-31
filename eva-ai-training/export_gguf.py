import os
import sys
import torch

# --- PATCH D'URGENCE PYTORCH 2.5 ---
if not hasattr(torch, "distributed"):
    import torch.distributed
if not hasattr(torch.distributed, "fsdp"):
    class DummyFSDP: pass
    torch.distributed.fsdp = DummyFSDP
    sys.modules["torch.distributed.fsdp"] = DummyFSDP
if not hasattr(torch.distributed.fsdp, "FSDPModule"):
    torch.distributed.fsdp.FSDPModule = type("FSDPModule", (object,), {})

try:
    import torch.distributed.tensor
    if not hasattr(torch.distributed.tensor, "DTensor"):
        torch.distributed.tensor.DTensor = type("DTensor", (object,), {})
except ImportError:
    pass
# -----------------------------------

from unsloth import FastLanguageModel

# On recharge le modèle de base avec l'adaptateur LoRA fraîchement entraîné
model_name = "eva_lora_model"

print("Chargement du modèle entraîné EVA...")
model, tokenizer = FastLanguageModel.from_pretrained(
    model_name = model_name,
    max_seq_length = 2048,
    dtype = None,
    load_in_4bit = True,
)

# Configuration de l'export
# q4_k_m est le meilleur compromis taille/qualité.
quantization_method = "q4_k_m"
output_gguf_name = "../eva-pc/resources/llm/eva-model.gguf"

print(f"Fusion de l'adaptateur et export en {quantization_method}...")
print(f"Le fichier sera sauvegardé directement dans {output_gguf_name}")

# Unsloth intègre la conversion directe en GGUF
model.save_pretrained_gguf(
    "eva_gguf_export", 
    tokenizer, 
    quantization_method = quantization_method
)

# Déplacer le fichier GGUF final vers le dossier de l'application
import shutil
import glob

# Trouver le fichier gguf généré
gguf_files = glob.glob("eva_gguf_export/*.gguf")
if gguf_files:
    source = gguf_files[0]
    os.makedirs(os.path.dirname(output_gguf_name), exist_ok=True)
    shutil.copy(source, output_gguf_name)
    print(f"✅ EXPORT RÉUSSI ! Modèle EVA-GGUF copié dans {output_gguf_name}")
else:
    print("❌ Erreur lors de l'export GGUF.")
