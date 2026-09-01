import sys
sys.stdout.reconfigure(encoding='utf-8')

# Apply same fix to PC version
pc_path = r'f:\code\eva\evaprojectmultiplatforme\eva-pc\web\js\features\cloudworks.js'
try:
    with open(pc_path, 'r', encoding='utf-8') as f:
        c = f.read()
    
    OLD = (
        "async function loadCloudWorks() {\n"
        "    // Récupération version dynamique\n"
        "    \n"
        "        }\n"
        "      }).catch(e=>console.log(e));\n"
        "\n"
        "  if (!window.S || !window.S.user) return;"
    )
    NEW = (
        "async function loadCloudWorks() {\n"
        "  if (!window.S || !window.S.user) return;"
    )
    
    if OLD in c:
        c = c.replace(OLD, NEW, 1)
        print('OK: PC cloudworks.js fixed')
    else:
        # Check if it even has the bug
        if '}).catch(e=>console.log(e))' in c:
            print('PC has the bug but pattern differs - manual check needed')
            idx = c.find('}).catch(e=>console.log(e))')
            print(repr(c[idx-150:idx+50]))
        else:
            print('PC cloudworks.js: no bug found (already clean or different version)')
    
    with open(pc_path, 'w', encoding='utf-8') as f:
        f.write(c)
except Exception as e:
    print('PC file error:', e)
