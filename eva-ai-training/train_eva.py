import os
os.environ["HF_HOME"] = "F:\\code\\eva\\evaprojectmultiplatforme\\.cache"

import torch
from datasets import load_dataset
from trl import SFTTrainer, SFTConfig
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training

model_id = "Qwen/Qwen2.5-1.5B-Instruct"

tokenizer = AutoTokenizer.from_pretrained(model_id)
if tokenizer.pad_token is None:
    tokenizer.pad_token = tokenizer.eos_token

# Configuration 4-bit (bitsandbytes)
bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_compute_dtype=torch.bfloat16,
    bnb_4bit_use_double_quant=True,
)

print("Chargement du modèle de base Qwen2.5-1.5B-Instruct...")
model = AutoModelForCausalLM.from_pretrained(
    model_id,
    quantization_config=bnb_config,
    device_map="auto"
)

# Configuration LoRA
lora_config = LoraConfig(
    r=16,
    lora_alpha=16,
    target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
    lora_dropout=0,
    bias="none",
    task_type="CAUSAL_LM"
)

model = prepare_model_for_kbit_training(model)
model = get_peft_model(model, lora_config)

print("Chargement des données de personnalité EVA (dataset.json)...")
dataset = load_dataset("json", data_files="dataset.json", split="train")

# Formater au format ChatML pour Qwen2.5
def format_prompt(examples):
    texts = []
    for instruction, input_text, output in zip(examples["instruction"], examples["input"], examples["output"]):
        text = f"<|im_start|>system\n{instruction}<|im_end|>\n<|im_start|>user\n{input_text}<|im_end|>\n<|im_start|>assistant\n{output}<|im_end|>"
        texts.append(text)
    return {"text": texts}
dataset = dataset.map(format_prompt, batched=True)

print("Début de l'entraînement...")
trainer = SFTTrainer(
    model = model,
    processing_class = tokenizer,
    train_dataset = dataset,
    args = SFTConfig(
        dataset_text_field = "text",
        max_length = 2048,
        per_device_train_batch_size = 2,
        gradient_accumulation_steps = 4,
        warmup_steps = 5,
        max_steps = 60,
        learning_rate = 2e-4,
        fp16 = False,
        bf16 = True,
        logging_steps = 1,
        optim = "adamw_8bit",
        weight_decay = 0.01,
        lr_scheduler_type = "linear",
        seed = 3407,
        output_dir = "outputs",
    ),
)
trainer.train()

print("Sauvegarde de l'adaptateur LoRA...")
model.save_pretrained("eva_lora_model")
tokenizer.save_pretrained("eva_lora_model")
print("Entraînement terminé !")
