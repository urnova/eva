import sys
sys.stdout.reconfigure(encoding='utf-8')

path = r'f:\code\eva\evaprojectmultiplatforme\eva-pc\electron\main.ts'
with open(path, 'r', encoding='utf-8') as f:
    c = f.read()

# Fix double-encoded French strings in splash status messages
FIXES = [
    ('VÃ©rification des mises Ã\xa0 jour...', 'Vérification des mises à jour...'),
    ('Mise Ã\xa0 jour trouvÃ©e. TÃ©lÃ©chargement...', 'Mise à jour trouvée. Téléchargement...'),
    ('SystÃ¨me Ã\xa0 jour. DÃ©marrage...', 'Système à jour. Démarrage...'),
    ('Erreur rÃ©seau. DÃ©marrage...', 'Erreur réseau. Démarrage...'),
    ('Mise Ã\xa0 jour prÃªte. RedÃ©marrage...', 'Mise à jour prête. Redémarrage...'),
]

for old, new in FIXES:
    if old in c:
        c = c.replace(old, new)
        print(f'OK: Fixed "{new}"')
    else:
        print(f'WARN: not found: "{old}"')

with open(path, 'w', encoding='utf-8') as f:
    f.write(c)

print('Done')
