print('=== Verification finale v5.6.15 ===')

checks = [
    ('chat.html PC',
     r'f:\code\eva\evaprojectmultiplatforme\eva-pc\web\chat.html', 'utf-8', [
        ('sendBtn" title="Envoyer" disabled', False, 'disabled retiré du HTML'),
        ('sendBtn" title="Envoyer">', True, 'sendBtn sans disabled'),
    ]),
    ('ui-setup.js',
     r'f:\code\eva\evaprojectmultiplatforme\eva-pc\web\js\app\ui-setup.js', 'latin-1', [
        ('FIX v5.6.15', True, 'sendBtn activé dans setupUI()'),
    ]),
    ('cw-agent.js',
     r'f:\code\eva\evaprojectmultiplatforme\eva-pc\web\js\features\cw-agent.js', 'utf-8', [
        ('FIX v5.6.15', True, 'LLM local prioritaire'),
        ('window.eva.system.llmChat', True, 'llmChat présent'),
        ('Fallback EVAChatHandler (Puter)', True, 'Puter en dernier recours'),
    ]),
    ('installer.nsh',
     r'f:\code\eva\evaprojectmultiplatforme\eva-pc\build\installer.nsh', 'utf-8', [
        ('RMDir /r', False, 'Plus de suppression models'),
        ('FIX v5.6.15', True, 'Fix NSIS présent'),
    ]),
    ('dist cw-agent.js',
     r'f:\code\eva\evaprojectmultiplatforme\eva-pc\dist\js\features\cw-agent.js', 'utf-8', [
        ('FIX v5.6.15', True, 'dist: LLM local prioritaire'),
    ]),
]

all_ok = True
for label, path, enc, tests in checks:
    try:
        with open(path, encoding=enc, errors='replace') as f:
            c = f.read()
        for needle, should_exist, desc in tests:
            found = needle in c
            ok = found == should_exist
            if not ok:
                all_ok = False
            print(f'  [{"OK" if ok else "FAIL"}] {label}: {desc}')
    except Exception as e:
        print(f'  [ERR] {label}: {e}')
        all_ok = False

print()
print('TOUT OK' if all_ok else 'ECHEC -- voir ci-dessus')
