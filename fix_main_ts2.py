import sys
sys.stdout.reconfigure(encoding='utf-8')

path = r'f:\code\eva\evaprojectmultiplatforme\eva-pc\electron\main.ts'
with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

print(f'Total lines before: {len(lines)}')

# Lines 806-1006 (0-indexed: 805-1005) are garbage.
# Line 804 (0-indexed 803): autolaunch:set handler starts
# Line 805 (0-indexed 804): "  store.set('autoLaunch', enabled)"
# Line 806 (0-indexed 805): "  if (enabled) await evaAutoLaunch.enable()"
# Lines 807-1006: GARBAGE (must replace with proper closing of autolaunch:set)
# Lines 1007+ (0-indexed 1006+): app:version, app:path, app:quit, updater IPC ... (KEEP)

# Proper closing for the autolaunch:set handler:
REPLACEMENT = [
    "  else await evaAutoLaunch.disable()\n",
    "  return { success: true }\n",
    "})\n",
    "\n",
]

# Keep lines 0-805 (lines 1-806), then insert replacement, then keep lines 1006+ (lines 1007+)
new_lines = lines[:806] + REPLACEMENT + lines[1006:]

print(f'Total lines after: {len(new_lines)}')

# Verify key lines around the fix
print('Lines around fix:')
for i in range(803, min(820, len(new_lines))):
    print(f'  {i+1}: {new_lines[i].rstrip()[:100]}')

with open(path, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print('Done')
