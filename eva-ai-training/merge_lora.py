import os
os.environ["HF_HOME"] = "F:\\code\\eva\\evaprojectmultiplatforme\\.cache"

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel

base_model_id = "Qwen/Qwen2.5-1.5B-Instruct"
lora_dir = "eva_lora_model"

print("Chargement du modèle de base...")
base_model = AutoModelForCausalLM.from_pretrained(
    base_model_id,
    torch_dtype=torch.bfloat16,
    device_map="cpu", # On charge sur CPU pour fusionner la mémoire calmement
)

print("Chargement de l'adaptateur LoRA...")
model = PeftModel.from_pretrained(base_model, lora_dir)
tokenizer = AutoTokenizer.from_pretrained(base_model_id)

print("Fusion des poids...")
model = model.merge_and_unload()

print("Sauvegarde du modèle fusionné...")
model.save_pretrained("eva_merged_model", safe_serialization=True)
tokenizer.save_pretrained("eva_merged_model")

print("Le modèle fusionné est sauvegardé dans 'eva_merged_model'.")
