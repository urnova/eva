import sys
sys.stdout.reconfigure(encoding='utf-8')
with open('eva-pc/electron/main.ts', 'r', encoding='utf-8') as f:
    lines = f.readlines()
for i,l in enumerate(lines):
    if 'splash' in l.lower() or 'Splash' in l:
        print(i+1, repr(l[:120]))
