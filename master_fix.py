import sys
sys.stdout.reconfigure(encoding='utf-8')

# 1. Fix pc-agent.js
for path in [
    r'f:\code\eva\evaprojectmultiplatforme\eva-pc\web\js\features\pc-agent.js',
    r'f:\code\eva\evaprojectmultiplatforme\EVA_V4_fixed_v4\js\features\pc-agent.js',
]:
    with open(path, 'r', encoding='utf-8-sig') as f:
        c = f.read()

    old_isdev = "const isDev = location.hostname === 'localhost' || location.hostname === '127.0.0.1';"
    new_isdev  = "const isDev = false; // PC Desktop always production - detected via window.eva not hostname"
    c = c.replace(old_isdev, new_isdev)

    old_name = "deviceName: isDev ? 'EVA Desktop (Dev)' : 'EVA Desktop',"
    new_name = "deviceName: 'EVA Desktop',"
    c = c.replace(old_name, new_name)

    old_set = "        online: true,\n        lastSeen: ts\n      }, { merge: true });"
    new_set = "        online: true,\n        lastSeen: ts,\n        sessionId: (window.S && window.S.sessionId) ? window.S.sessionId : null\n      }, { merge: true });"
    c = c.replace(old_set, new_set)

    with open(path, 'w', encoding='utf-8') as f:
        f.write(c)
    print('OK pc-agent.js: ' + path)


# 2. Fix PC chat.html - restore navCloudWorks ID
pc_chat = r'f:\code\eva\evaprojectmultiplatforme\eva-pc\web\chat.html'
with open(pc_chat, 'r', encoding='utf-8-sig') as f:
    c = f.read()

c = c.replace('id="navCloudWorks_hidden_pc"', 'id="navCloudWorks"')

with open(pc_chat, 'w', encoding='utf-8') as f:
    f.write(c)
print('OK PC chat.html navCloudWorks ID restored')


# 3. Fix splash.html - encoding corruption
splash = r'f:\code\eva\evaprojectmultiplatforme\eva-pc\web\splash.html'
with open(splash, 'r', encoding='utf-8-sig') as f:
    c = f.read()

replacements = [
    ('Ã ', 'à'), ('Ã©', 'é'), ('Ã¨', 'è'), ('Ãª', 'ê'),
    ('Ã®', 'î'), ('Ã¯', 'ï'), ('Ã´', 'ô'), ('Ã¹', 'ù'),
    ('Ã»', 'û'), ('Ã‰', 'É'), ('Ã€', 'À'), ('Â«', '«'), ('Â»', '»'),
]
for bad, good in replacements:
    c = c.replace(bad, good)

with open(splash, 'w', encoding='utf-8') as f:
    f.write(c)
print('OK splash.html encoding fixed')


# 4. Fix download.html - wrong static href
for dl_path in [
    r'f:\code\eva\evaprojectmultiplatforme\EVA_V4_fixed_v4\download.html',
    r'f:\code\eva\evaprojectmultiplatforme\eva-pc\web\download.html',
]:
    try:
        with open(dl_path, 'r', encoding='utf-8-sig') as f:
            c = f.read()
        c = c.replace(
            'https://github.com/urnova/eva/releases/latest/download/EVA-Assistant-Setup.exe',
            'https://github.com/urnova/eva/releases/latest'
        )
        with open(dl_path, 'w', encoding='utf-8') as f:
            f.write(c)
        print('OK download.html: ' + dl_path)
    except FileNotFoundError:
        print('SKIP: ' + dl_path)

print('\nALL FIXES APPLIED')
