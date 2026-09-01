import sys
sys.stdout.reconfigure(encoding='utf-8')

# Update PC messages.js to teach EVA to prefer run_script over agentic_task for simple tasks
with open(r'eva-pc/web/js/app/messages.js', 'r', encoding='utf-8', errors='replace') as f:
    msgspc = f.read()

# Find and improve the CloudWorks tool section
OLD_CW_TOOLS = "    userCtx += '- Tâche PC → [ACTION:{\"type\":\"agentic_task\",\"prompt\":\"...\"}]\\n' +"

NEW_CW_TOOLS = """    userCtx += '- Commande simple/directe (ex: créer fichier, liste dossier, info système) → [ACTION:{"type":"run_script","command":"PowerShell: ta_commande_ps1"}]\\n' +
      '- Tâche complexe multi-étapes nécessitant raisonnement → [ACTION:{"type":"agentic_task","prompt":"Instructions complètes"}]\\n' +"""

if OLD_CW_TOOLS in msgspc:
    msgspc = msgspc.replace(OLD_CW_TOOLS, NEW_CW_TOOLS, 1)
    print('FIX: PC messages.js - prefer run_script for simple tasks')
else:
    print('WARN: OLD_CW_TOOLS not found')
    idx = msgspc.find('agentic_task')
    print(msgspc[idx-100:idx+200])

with open(r'eva-pc/web/js/app/messages.js', 'w', encoding='utf-8') as f:
    f.write(msgspc)

# Same for web messages.js
with open(r'EVA_V4_fixed_v4/js/app/messages.js', 'r', encoding='utf-8', errors='replace') as f:
    msgsweb = f.read()

OLD_WEB = "    userCtx += 'Tâche PC (long) → [ACTION:{\"type\":\"agentic_task\",\"prompt\":\"...\"}]';"
if OLD_WEB in msgsweb:
    msgsweb = msgsweb.replace(OLD_WEB,
        "    userCtx += 'Commande directe (simple) → [ACTION:{\"type\":\"run_script\",\"command\":\"PowerShell: ...\"}]\\n';\n" +
        "    userCtx += 'Tâche complexe → [ACTION:{\"type\":\"agentic_task\",\"prompt\":\"...\"}]';", 1)
    print('FIX: Web messages.js - prefer run_script for simple tasks')
else:
    print('WARN: OLD_WEB not found in web messages.js')

with open(r'EVA_V4_fixed_v4/js/app/messages.js', 'w', encoding='utf-8') as f:
    f.write(msgsweb)

print('Done')
