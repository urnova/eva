import sys
sys.stdout.reconfigure(encoding='utf-8')

path = r'f:\code\eva\evaprojectmultiplatforme\EVA_V4_fixed_v4\js\features\cloudworks.js'
with open(path, 'r', encoding='utf-8') as f:
    c = f.read()

# The broken section to remove:
# '    // Récupération version dynamique\n    \n        }\n      }).catch(e=>console.log(e));\n\n  '
# Replace the function body start: remove the garbage lines, keep everything else

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
    print('OK: removed broken fetch remnant')
else:
    print('WARN: pattern not found')
    # Try with CRLF
    OLD2 = OLD.replace('\n', '\r\n')
    NEW2 = NEW.replace('\n', '\r\n')
    if OLD2 in c:
        c = c.replace(OLD2, NEW2, 1)
        print('OK: removed (CRLF version)')
    else:
        print('Pattern not found in either LF or CRLF. Showing context:')
        idx = c.find('}).catch(e=>console.log(e))')
        print(repr(c[idx-100:idx+50]))

with open(path, 'w', encoding='utf-8') as f:
    f.write(c)

# Verify
with open(path, 'r', encoding='utf-8') as f:
    c2 = f.read()
idx = c2.find('loadCloudWorks')
print('After fix:')
print(repr(c2[idx:idx+100]))
