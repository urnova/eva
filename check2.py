import sys
sys.stdout.reconfigure(encoding='utf-8')
path = r'f:\code\eva\evaprojectmultiplatforme\eva-pc\electron\main.ts'
with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()
print('Lines 806-820:')
for i in range(805, 820):
    print(f'{i+1}: {lines[i].rstrip()[:100]}')
