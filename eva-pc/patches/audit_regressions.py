"""
Audit complet des régressions depuis l'introduction du nouveau moteur CloudWorks v5.6
"""
import re, os

ROOT = r'f:\code\eva\evaprojectmultiplatforme'
PC_WEB = os.path.join(ROOT, 'eva-pc', 'web', 'js')
WEB_DIR = os.path.join(ROOT, 'EVA_V4_fixed_v4', 'js')

print("=" * 70)
print("AUDIT RÉGRESSIONS EVA D1 — CloudWorks v5.6")
print("=" * 70)

# ── 1. Triple async (déjà fixé, vérification)
print("\n[1] Triple async dans file-gen.js")
for label, path, enc in [
    ("PC web", os.path.join(PC_WEB, 'app', 'file-gen.js'), 'latin-1'),
    ("Web EVA_V4", os.path.join(WEB_DIR, 'app', 'file-gen.js'), 'utf-8'),
]:
    with open(path, encoding=enc, errors='replace') as f:
        c = f.read()
    triple = 'async async' in c
    single = 'async function executeEvaAction' in c
    print(f"  {label}: triple={'PRESENT ⚠' if triple else 'OK'}, single={'OK' if single else 'MANQUANT ⚠'}")

# ── 2. sendBtn fix
print("\n[2] sendBtn disabled fix dans messages.js")
for label, path, enc in [
    ("PC web", os.path.join(PC_WEB, 'app', 'messages.js'), 'latin-1'),
    ("Web EVA_V4", os.path.join(WEB_DIR, 'app', 'messages.js'), 'utf-8'),
]:
    with open(path, encoding=enc, errors='replace') as f:
        c = f.read()
    fix_v14 = 'FIX v5.6.14' in c
    fix_v11 = 'FIX v5.6.11' in c
    print(f"  {label}: v5.6.14={'OK' if fix_v14 else 'MANQUANT ⚠'}, v5.6.11={'OK' if fix_v11 else 'manquant'}")

# ── 3. PWA detection
print("\n[3] PWA detection (window.eva.ipc supprimé)")
for label, path in [
    ("PC web", os.path.join(PC_WEB, 'features', 'cw-tools.js')),
    ("PC dist", os.path.join(ROOT, 'eva-pc', 'dist', 'js', 'features', 'cw-tools.js')),
]:
    with open(path, encoding='utf-8', errors='replace') as f:
        c = f.read()
    ipc_count = len(re.findall(r'window\.eva\.ipc\.invoke', c))
    print(f"  {label}: window.eva.ipc.invoke x{ipc_count} {'⚠ PRÉSENT' if ipc_count > 0 else 'OK'}")

# ── 4. cwConfirmAndExecute disponible
print("\n[4] cwConfirmAndExecute dans cw-modal.js")
path = os.path.join(PC_WEB, 'features', 'cw-modal.js')
with open(path, encoding='utf-8', errors='replace') as f:
    c = f.read()
found = 'window.cwConfirmAndExecute' in c
print(f"  Défini: {'OK' if found else 'MANQUANT ⚠'}")

# ── 5. chat.html scripts CW
print("\n[5] Scripts CW dans chat.html")
path = os.path.join(ROOT, 'eva-pc', 'web', 'chat.html')
with open(path, encoding='utf-8', errors='replace') as f:
    c = f.read()
for script in ['cw-modal.js', 'cw-modal-enhanced.js', 'cw-tools.js', 'cw-agent.js', 'cw-engine.js', 'pc-bridge.js']:
    present = script in c
    print(f"  {script}: {'OK' if present else 'MANQUANT ⚠'}")

# ── 6. EVA_V4 scripts CW
print("\n[6] Scripts CW dans EVA_V4/chat.html")
path = os.path.join(ROOT, 'EVA_V4_fixed_v4', 'chat.html')
with open(path, encoding='utf-8', errors='replace') as f:
    c = f.read()
for script in ['cw-modal.js', 'cw-modal-enhanced.js', 'cw-tools.js', 'cw-agent.js', 'cw-engine.js']:
    present = script in c
    print(f"  {script}: {'OK' if present else 'manquant (normal pour web?)'}")

# ── 7. LLM model path dans main.ts
print("\n[7] LLM model path dans main.ts")
path = os.path.join(ROOT, 'eva-pc', 'electron', 'main.ts')
with open(path, encoding='utf-8') as f:
    c = f.read()
has_userdata = "app.getPath('userData')" in c and 'models' in c
print(f"  userData/models chemin: {'OK' if has_userdata else 'MANQUANT ⚠'}")
# Chercher si le check status affiche 'Non téléchargé' alors que le modèle existe
idx_status = c.find('Non t')
if idx_status >= 0:
    print(f"  Status 'Non telecharge': trouvé à {idx_status}")
    print(f"  {repr(c[idx_status:idx_status+200])}")

# ── 8. Vérifier que cwConfirmAndExecute appelle bien runWithEngine
print("\n[8] cwConfirmAndExecute → runWithEngine flow")
path = os.path.join(PC_WEB, 'features', 'cw-modal.js')
with open(path, encoding='utf-8', errors='replace') as f:
    c = f.read()
idx = c.find('window.cwConfirmAndExecute')
if idx >= 0:
    block = c[idx:idx+800]
    print(block[:500])

print("\n" + "=" * 70)
print("AUDIT TERMINÉ")
