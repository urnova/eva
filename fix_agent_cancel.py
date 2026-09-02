import sys
sys.stdout.reconfigure(encoding='utf-8')

with open(r'eva-pc/web/js/features/pc-agent.js', 'r', encoding='utf-8', errors='replace') as f:
    pa = f.read()

# 1. Ajouter check cancelled au début de chaque itération de la boucle
LOOP_MARKER = "    // Boucle infinie — seul [REPORT] ou une erreur l'arrête\n    while (true) {\n      iteration++;\n      try {"
NEW_LOOP_MARKER = "    // Boucle infinie — seul [REPORT], une erreur, ou une annulation l'arrête\n    while (true) {\n      iteration++;\n\n      // Vérifier si la tâche a été annulée depuis l'UI (web ou PC)\n      try {\n        const snap = await cmdRef.get();\n        if (snap.exists && snap.data().status === 'cancelled') {\n          console.log('[Agent] Tâche annulée à l iteration', iteration);\n          return { error: 'Annulé par l utilisateur', steps, cancelled: true };\n        }\n      } catch(e) { /* ignore, continuer */ }\n\n      try {"

if LOOP_MARKER in pa:
    pa = pa.replace(LOOP_MARKER, NEW_LOOP_MARKER, 1)
    print('FIX: check cancelled ajouté dans la boucle')
else:
    print('WARN: loop marker not found')
    # Debug
    idx = pa.find('while (true)')
    if idx != -1:
        print('  while(true) found at char:', idx)
        print('  Context:', pa[idx-50:idx+100])

# 2. Ajouter lastCmd dans les updates de CMD
OLD_CMD = "            await cmdRef.update({ step: stepText, steps, updatedAt: new Date() });"
NEW_CMD = "            await cmdRef.update({ step: stepText, lastCmd: cmd.substring(0, 120), steps, updatedAt: new Date() });"

if OLD_CMD in pa:
    pa = pa.replace(OLD_CMD, NEW_CMD, 1)
    print('FIX: lastCmd ajouté dans update Firestore')
else:
    print('WARN: cmd update not found')

# 3. Gérer status 'cancelled' dans handleCommand
# Chercher la ligne qui assigne status basé sur result.error
for old, new in [
    ("status = result.error ? 'error' : 'done';", "status = result.cancelled ? 'cancelled' : (result.error ? 'error' : 'done');"),
    ("const status = result.error ? 'error' : 'done';", "const status = result.cancelled ? 'cancelled' : (result.error ? 'error' : 'done');"),
]:
    if old in pa:
        pa = pa.replace(old, new, 1)
        print('FIX: status cancelled géré')
        break
else:
    print('WARN: status assign not found')
    # Show context
    lines = pa.split('\n')
    for i, l in enumerate(lines):
        if 'error' in l and 'done' in l and 'status' in l:
            print(f'  Line {i+1}:', l.rstrip()[:120])

with open(r'eva-pc/web/js/features/pc-agent.js', 'w', encoding='utf-8') as f:
    f.write(pa)
print('pc-agent.js saved')
