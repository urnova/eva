import sys
sys.stdout.reconfigure(encoding='utf-8')

# ═══ FIX 1: Tray menu — supprimer Arrêter/Démarrer, garder seulement Redémarrer ═══
with open(r'eva-pc/electron/main.ts', 'r', encoding='utf-8', errors='replace') as f:
    mt = f.read()

OLD_LLM_SUBMENU = """    {
      label: `🤖 LLM Local  ${llmRunning ? '[● En ligne]' : '[○ Arrêté]'}`,
      submenu: [
        {
          label: llmRunning ? '■ Arrêter le LLM' : '▶ Démarrer le LLM',
          click: async () => {
            if (llmRunning) { stopLLM(); } else { await startLLM(); }
            _rebuildTrayMenu();
          }
        },
        {
          label: '⟳ Redémarrer le LLM',
          click: async () => { stopLLM(); setTimeout(async () => { await startLLM(); _rebuildTrayMenu(); }, 1500); }
        }
      ]
    },"""

NEW_LLM_SUBMENU = """    {
      label: `🤖 LLM  ${llmRunning ? '[● En ligne]' : '[○ Arrêté]'}`,
      submenu: [
        {
          label: '⟳ Redémarrer le LLM',
          click: async () => { stopLLM(); setTimeout(async () => { await startLLM(); _rebuildTrayMenu(); }, 1500); }
        }
      ]
    },"""

if OLD_LLM_SUBMENU in mt:
    mt = mt.replace(OLD_LLM_SUBMENU, NEW_LLM_SUBMENU, 1)
    print('FIX 1: LLM tray submenu simplified')
else:
    print('WARN FIX 1: LLM submenu pattern not found')

# ═══ FIX 3: Auto-update check on window show (reopen from tray) ═══
OLD_TOGGLE = """function toggleWindow() {
  if (!mainWindow) return
  if (mainWindow.isVisible()) {
    if (mainWindow.isFocused()) {
      mainWindow.hide()
    } else {
      mainWindow.focus()
    }
  } else {
    mainWindow.show()
    mainWindow.focus()
  }
}"""

NEW_TOGGLE = """var _lastUpdateCheck = 0;

function _checkForUpdatesIfNeeded() {
  if (isDev) return;
  var now = Date.now();
  // Max 1 check toutes les 15 minutes
  if (now - _lastUpdateCheck < 15 * 60 * 1000) return;
  _lastUpdateCheck = now;
  try {
    autoUpdater.checkForUpdatesAndNotify().catch(() => {});
  } catch(e) {}
}

function toggleWindow() {
  if (!mainWindow) return
  if (mainWindow.isVisible()) {
    if (mainWindow.isFocused()) {
      mainWindow.hide()
    } else {
      mainWindow.focus()
    }
  } else {
    mainWindow.show()
    mainWindow.focus()
    // Vérifier les mises à jour à la réouverture
    _checkForUpdatesIfNeeded();
  }
}"""

if OLD_TOGGLE in mt:
    mt = mt.replace(OLD_TOGGLE, NEW_TOGGLE, 1)
    print('FIX 3: Auto-update check on reopen added')
else:
    print('WARN FIX 3: toggleWindow pattern not found')

# Also trigger check when double-clicking tray icon
OLD_DBL = "  tray.on('double-click', () => { mainWindow?.show(); mainWindow?.focus() })\n}\n\nfunction _rebuildTrayMenu"
NEW_DBL = "  tray.on('double-click', () => { mainWindow?.show(); mainWindow?.focus(); _checkForUpdatesIfNeeded(); })\n}\n\nfunction _rebuildTrayMenu"
if OLD_DBL in mt:
    mt = mt.replace(OLD_DBL, NEW_DBL, 1)
    print('FIX 3b: Update check on tray double-click added')

# ═══ FIX 4: quitAndInstall — passer de silent à non-silent pour éviter blocage UAC ═══
# The auto-downloaded update triggers quitAndInstall(true, true) silently
# With perMachine=true this needs UAC which fails in silent mode
OLD_QAI = "    setTimeout(() => {\n      autoUpdater.quitAndInstall(true, true)\n    }, 2000)"
NEW_QAI = "    setTimeout(() => {\n      // isSilent=false pour éviter le blocage UAC avec perMachine=true\n      autoUpdater.quitAndInstall(false, true)\n    }, 2000)"

if OLD_QAI in mt:
    mt = mt.replace(OLD_QAI, NEW_QAI, 1)
    print('FIX 4: quitAndInstall changed to non-silent mode')
else:
    print('WARN FIX 4: quitAndInstall pattern not found')

# Also in the IPC handler
OLD_QAI2 = "    autoUpdater.quitAndInstall(true, true);"
NEW_QAI2 = "    autoUpdater.quitAndInstall(false, true);"
if OLD_QAI2 in mt:
    mt = mt.replace(OLD_QAI2, NEW_QAI2, 1)
    print('FIX 4b: IPC quitAndInstall also fixed')

with open(r'eva-pc/electron/main.ts', 'w', encoding='utf-8') as f:
    f.write(mt)
print('main.ts saved')
