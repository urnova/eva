import sys
sys.stdout.reconfigure(encoding='utf-8')

path = r'f:\code\eva\evaprojectmultiplatforme\eva-pc\electron\main.ts'
with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

total = len(lines)
print('Total lines:', total)

# Find all key handlers to understand structure
markers = ['autolaunch:get', 'autolaunch:set', 'app:version', 'app:path', 'app:quit', 
           'updater:start-download', 'updater:quit-and-install', 'fs:list', 'terminal:create']

for m in markers:
    for i, l in enumerate(lines):
        if m in l:
            print(f'  Line {i+1}: {l.strip()[:80]}')
