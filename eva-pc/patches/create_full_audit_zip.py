# -*- coding: utf-8 -*-
import os
import shutil
import zipfile

root_repo = r'f:\code\eva\evaprojectmultiplatforme'
audit_dir = r'F:\temp\eva_audit_gpt'
downloads_dir = r'C:\Users\zozoo\Downloads'
zip_filename = 'EVA_AUDIT_ARCHITECTURE_GPT_6.2_SOL.zip'
final_zip_path = os.path.join(downloads_dir, zip_filename)
legacy_zip_path = os.path.join(downloads_dir, 'eva_debug_gpt.zip')

print("1. Copie des fichiers sources dans la structure d'audit...")

files_map = {
    # Documentation & Rapports
    '00_PROMPT_POUR_GPT_6.2_SOL.md': os.path.join(audit_dir, '00_PROMPT_POUR_GPT_6.2_SOL.md'),
    '01_RAPPORT_ARCHITECTURE_COMPLETE.md': os.path.join(audit_dir, '01_RAPPORT_ARCHITECTURE_COMPLETE.md'),
    '02_DIAGNOSTIC_PROBLEMES_RENCONTRES.md': os.path.join(audit_dir, '02_DIAGNOSTIC_PROBLEMES_RENCONTRES.md'),
    '03_SPECIFICATIONS_ET_REGLES_FIREBASE.md': os.path.join(audit_dir, '03_SPECIFICATIONS_ET_REGLES_FIREBASE.md'),
    
    # Electron Desktop
    'electron/main.ts': os.path.join(root_repo, 'eva-pc', 'electron', 'main.ts'),
    'electron/preload.ts': os.path.join(root_repo, 'eva-pc', 'electron', 'preload.ts'),
    'electron/package.json': os.path.join(root_repo, 'eva-pc', 'package.json'),
    'electron/deploy.js': os.path.join(root_repo, 'eva-pc', 'deploy.js'),
    
    # Moteur CloudWorks
    'cloudworks/cw-agent.js': os.path.join(root_repo, 'eva-pc', 'web', 'js', 'features', 'cw-agent.js'),
    'cloudworks/cw-tools.js': os.path.join(root_repo, 'eva-pc', 'web', 'js', 'features', 'cw-tools.js'),
    'cloudworks/cw-engine.js': os.path.join(root_repo, 'eva-pc', 'web', 'js', 'features', 'cw-engine.js'),
    'cloudworks/cw-firestore-adapter.js': os.path.join(root_repo, 'eva-pc', 'web', 'js', 'features', 'cw-firestore-adapter.js'),
    'cloudworks/cw-windows-adapter.js': os.path.join(root_repo, 'eva-pc', 'web', 'js', 'features', 'cw-windows-adapter.js'),
    'cloudworks/cw-modal.js': os.path.join(root_repo, 'eva-pc', 'web', 'js', 'features', 'cw-modal.js'),
    'cloudworks/cw-modal-enhanced.js': os.path.join(root_repo, 'eva-pc', 'web', 'js', 'features', 'cw-modal-enhanced.js'),
    'cloudworks/cloudworks.js': os.path.join(root_repo, 'eva-pc', 'web', 'js', 'features', 'cloudworks.js'),
    'cloudworks/pc-agent.js': os.path.join(root_repo, 'eva-pc', 'web', 'js', 'features', 'pc-agent.js'),
    
    # Chat, AI & System Bridge
    'chat_et_ai/messages.js': os.path.join(root_repo, 'eva-pc', 'web', 'js', 'app', 'messages.js'),
    'chat_et_ai/core.js': os.path.join(root_repo, 'eva-pc', 'web', 'js', 'app', 'core.js'),
    'chat_et_ai/chat-session.js': os.path.join(root_repo, 'eva-pc', 'web', 'js', 'app', 'chat-session.js'),
    'chat_et_ai/file-gen.js': os.path.join(root_repo, 'eva-pc', 'web', 'js', 'app', 'file-gen.js'),
    'chat_et_ai/chat-handler.js': os.path.join(root_repo, 'eva-pc', 'web', 'js', 'ai', 'chat-handler.js'),
    'chat_et_ai/providers.js': os.path.join(root_repo, 'eva-pc', 'web', 'js', 'ai', 'providers.js'),
    'chat_et_ai/memory.js': os.path.join(root_repo, 'eva-pc', 'web', 'js', 'app', 'memory.js'),
    'chat_et_ai/pc-bridge.js': os.path.join(root_repo, 'eva-pc', 'web', 'js', 'pc-bridge.js'),
    
    # Web Vercel & Firebase
    'web_et_firebase/firestore.rules': os.path.join(root_repo, 'EVA_V4_fixed_v4', 'firestore.rules'),
    'web_et_firebase/vercel.json': os.path.join(root_repo, 'EVA_V4_fixed_v4', 'vercel.json'),
    'web_et_firebase/chat.html': os.path.join(root_repo, 'EVA_V4_fixed_v4', 'chat.html'),
    'web_et_firebase/firebase-config.local.js': os.path.join(root_repo, 'EVA_V4_fixed_v4', 'js', 'core', 'firebase-config.local.js'),
    'web_et_firebase/firebase-config.pc.js': os.path.join(root_repo, 'eva-pc', 'web', 'js', 'core', 'firebase-config.js'),
    'web_et_firebase/web_cloudworks.js': os.path.join(root_repo, 'EVA_V4_fixed_v4', 'js', 'features', 'cloudworks.js'),
    
    # Mémoire du projet
    'memoire_projet/STATE.md': os.path.join(root_repo, '.ai-memory', 'STATE.md'),
}

staging_dir = os.path.join(audit_dir, 'package_staging')
if os.path.exists(staging_dir):
    shutil.rmtree(staging_dir)
os.makedirs(staging_dir, exist_ok=True)

copied_count = 0
for rel_target, src_path in files_map.items():
    if os.path.exists(src_path):
        dest_path = os.path.join(staging_dir, rel_target)
        os.makedirs(os.path.dirname(dest_path), exist_ok=True)
        shutil.copy2(src_path, dest_path)
        copied_count += 1
    else:
        print(f"Attention: fichier non trouvé : {src_path}")

print(f"{copied_count} fichiers copiés avec succès dans staging.")

print("2. Création de l'archive ZIP...")
with zipfile.ZipFile(final_zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
    for root, dirs, files in os.walk(staging_dir):
        for file in files:
            file_path = os.path.join(root, file)
            arcname = os.path.relpath(file_path, staging_dir)
            zipf.write(file_path, arcname)

# Créer aussi une copie en eva_debug_gpt.zip pour compatibilité
shutil.copy2(final_zip_path, legacy_zip_path)

zip_size_kb = os.path.getsize(final_zip_path) / 1024
print(f"Archive créée : {final_zip_path} ({zip_size_kb:.1f} Ko)")
print(f"Copie miroir créée : {legacy_zip_path}")
print("SUCCÈS TOTAL !")
