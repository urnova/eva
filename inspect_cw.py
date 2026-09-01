import sys, re
sys.stdout.reconfigure(encoding='utf-8')

path = r'f:\code\eva\evaprojectmultiplatforme\EVA_V4_fixed_v4\js\features\cloudworks.js'
with open(path, 'r', encoding='utf-8') as f:
    c = f.read()

print('Starts with:', repr(c[:100]))
print()

# Find and show the broken section
idx = c.find('async function loadCloudWorks()')
print('loadCloudWorks at char:', idx)
if idx >= 0:
    print(repr(c[idx:idx+300]))
