import sys, re
sys.stdout.reconfigure(encoding='utf-8')

path = r'f:\code\eva\evaprojectmultiplatforme\eva-pc\electron\main.ts'
with open(path, 'r', encoding='utf-8') as f:
    c = f.read()

# Remove any duplicate sections that were accidentally added
# Find the second occurrence of 'autolaunch:get' and remove everything from the first dup to just before '// --- Updater IPC ---'
UPDATER_ANCHOR = "// --- Updater IPC ---"
AUTO_LAUNCH_ANCHOR = "ipcMain.handle('autolaunch:get'"

# Find all positions of autolaunch:get
positions = [m.start() for m in re.finditer(re.escape(AUTO_LAUNCH_ANCHOR), c)]
print('autolaunch:get positions:', positions)

# Find all positions of app:quit
appquit_positions = [m.start() for m in re.finditer(re.escape("ipcMain.handle('app:quit'"), c)]
print('app:quit positions:', appquit_positions)

# Find updater IPC anchor positions
updater_positions = [m.start() for m in re.finditer(re.escape(UPDATER_ANCHOR), c)]
print('updater IPC positions:', updater_positions)

if len(positions) > 1:
    # Find the first autolaunch and the updater section
    first_auto = positions[0]
    updater_start = c.find(UPDATER_ANCHOR)
    
    # The duplicate block starts just before the second autolaunch and goes to the first updater
    # We need to find the block between the FIRST app:path and the updater anchor
    # Look for the first 'app:path' handler
    first_apppath = c.find("ipcMain.handle('app:path'")
    print('first app:path at:', first_apppath)
    
    # The good section ends at first app:path + its line
    end_of_apppath_line = c.find('\n', first_apppath) + 1
    
    # The updater anchor is what should come after
    # Find if there's a duplicate autolaunch AFTER the app:path
    for pos in positions:
        if pos > end_of_apppath_line:
            # This is a duplicate - remove from here to just before the LAST updater anchor
            last_updater = updater_positions[-1]
            print(f'Removing duplicate from {pos} to {last_updater}')
            c = c[:pos] + c[last_updater:]
            break
    
    # Verify
    positions2 = [m.start() for m in re.finditer(re.escape(AUTO_LAUNCH_ANCHOR), c)]
    print('After cleanup, autolaunch:get positions:', positions2)

# Now add app:quit if not present
if "ipcMain.handle('app:quit'" not in c:
    # Add after app:path handler
    old = "ipcMain.handle('app:path', () => app.getPath('userData'))"
    new = old + "\nipcMain.handle('app:quit', () => { app.isQuitting = true; app.quit() })"
    if old in c:
        c = c.replace(old, new, 1)
        print('Added app:quit')
    else:
        print('WARN: app:path not found')
else:
    print('app:quit already present')

with open(path, 'w', encoding='utf-8') as f:
    f.write(c)

print('Total lines:', len(c.splitlines()))
print('Done')
