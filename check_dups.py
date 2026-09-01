import sys
sys.stdout.reconfigure(encoding='utf-8')

path = r'f:\code\eva\evaprojectmultiplatforme\eva-pc\electron\main.ts'
with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Print lines 898-915 to see what's around the second terminal:create
print('=== Lines 895-915 ===')
for i in range(894, 915):
    print(f'{i+1}: {lines[i].rstrip()[:100]}')

print()
print('=== Lines 995-1015 ===')
for i in range(994, 1015):
    print(f'{i+1}: {lines[i].rstrip()[:100]}')
