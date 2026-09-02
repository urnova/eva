import { app, BrowserWindow, ipcMain, dialog, shell, Tray, Menu, nativeImage, globalShortcut } from 'electron'
app.disableHardwareAcceleration();
import { join } from 'path'
import { fileURLToPath } from 'url'
import Store from 'electron-store'
import AutoLaunch from 'auto-launch'
import { autoUpdater } from 'electron-updater'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import * as child_process from 'child_process'
// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Polyfill __dirname pour ESM Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

import * as http from 'http'
import { extname } from 'path'

let localServerPort = 0;
export let llamaInstance: any = null;
export let llamaModel: any = null;
export let llamaContext: any = null;
export let llmTimeout: any = null;
const mimeTypes: { [key: string]: string } = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpg',
  '.svg': 'image/svg+xml'
};

const httpServer = http.createServer((req, res) => {
  let urlPath = req.url?.split('?')[0] || '/';
  
  if (urlPath === '/login') urlPath = '/app-login.html';
  else if (urlPath === '/onboarding') urlPath = '/onboarding.html';
  else if (urlPath === '/chat') urlPath = '/chat.html';
  else if (urlPath === '/') urlPath = '/splash.html';

  let filePath = join(__dirname, '../dist', urlPath);
  
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      filePath = join(__dirname, '../dist/splash.html');
    }
    const ext = extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    
    fs.readFile(filePath, (error, content) => {
      if (error) {
        res.writeHead(500);
        res.end('Error');
      } else {
        res.writeHead(200, { 'Content-Type': contentType, 'Access-Control-Allow-Origin': '*' });
        res.end(content, 'utf-8');
      }
    });
  });
});

httpServer.listen(0, '127.0.0.1', () => {
  const address = httpServer.address();
  if (address && typeof address !== 'string') {
    localServerPort = address.port;
    console.log('[EVA] Local HTTP Server running on port:', localServerPort);
  }
});


// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Store local (config NON synchronisÃƒÂ©e) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
interface StoreSchema {
  firebaseConfig: Record<string, string> | null
  aiProvider: string
  aiApiKey: string
  aiModel: string
  ttsProvider: string
  ollamaEndpoint: string
  lmstudioEndpoint: string
  openrouterApiKey: string
  geminiApiKey: string
  windowBounds: { width: number; height: number; x?: number; y?: number }
  autoLaunch: boolean
  theme: string
  minimizeToTray: boolean
}

const store = new Store<StoreSchema>({
  defaults: {
    firebaseConfig: null,
    aiProvider: 'puter',
    aiApiKey: '',
    aiModel: 'gpt-4o-mini',
    ttsProvider: 'system',
    ollamaEndpoint: 'http://localhost:11434',
    lmstudioEndpoint: 'http://localhost:1234',
    openrouterApiKey: '',
    geminiApiKey: '',
    windowBounds: { width: 1280, height: 800 },
    autoLaunch: false,
    theme: 'dark',
    minimizeToTray: true
  }
})

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Auto Launch Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
const evaAutoLaunch = new AutoLaunch({
  name: 'EVA Assistant',
  path: process.execPath
})

let mainWindow: BrowserWindow | null = null
let overlayWindow: BrowserWindow | null = null
let tray: Tray | null = null
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ URL du site web EVA (en production) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
export const EVA_WEB_URL = 'https://eva.astraltechnologie.fr'

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ PrÃƒÂ©venir multiple instances + gÃƒÂ©rer protocole custom Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', (_event, argv) => {
    // Sur Windows, le deep link arrive dans les arguments
    const deepLink = argv.find(arg => arg.startsWith('eva-desktop://'))
    if (deepLink && mainWindow) {
      handleDeepLink(deepLink)
    }
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
      mainWindow.show()
    }
  })
}

function handleDeepLink(url: string) {
  if (!mainWindow) return
  try {
    const parsed = new URL(url)
    if (parsed.hostname === 'auth' || parsed.pathname.includes('auth')) {
      const params = new URLSearchParams(parsed.search)
      // DÃƒÂ©coder le token (Windows peut modifier l'encodage URL)
      let refreshToken = params.get('refreshToken') || params.get('token')
      if (refreshToken) {
        // RÃƒÂ©assurer le dÃƒÂ©codage correct des caractÃƒÂ¨res spÃƒÂ©ciaux
        try { refreshToken = decodeURIComponent(refreshToken) } catch { /* already decoded */ }
      }
      const hid = params.get('hid')
      if (refreshToken) {
        console.log('[EVA] Auth callback received, token prefix:', refreshToken.substring(0, 20))
        mainWindow.webContents.send('auth:callback', { refreshToken })
      } else if (hid) {
        mainWindow.webContents.send('auth:callback', { hid })
      }
      mainWindow.show()
      mainWindow.focus()
    }
  } catch (e) {
    console.error('Deep link parse error:', e)
  }
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ CrÃƒÂ©er la fenÃƒÂªtre principale Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
function createWindow() {
  const bounds = store.get('windowBounds')

  mainWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    minWidth: 900,
    minHeight: 600,
    frame: false,           // FenÃƒÂªtre sans bordure native
    backgroundColor: '#111113',
    icon: join(__dirname, '../public/eva-icon.png'),
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
      allowRunningInsecureContent: true,
      // Permettre les scripts Puter dans le renderer
      sandbox: false
    },
        show: false
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  if (isDev) {
    const loadDevURL = () => {
      mainWindow?.loadURL('http://localhost:5173/splash.html').catch(e => {
        console.log('Vite not ready, retrying...', e.message);
        setTimeout(loadDevURL, 500);
      });
    };
    loadDevURL();
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadURL(('http://127.0.0.1:' + localServerPort + '/splash.html'))
  }

  // Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Sauvegarder la position/taille Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  mainWindow.on('resized', saveBounds)
  mainWindow.on('moved', saveBounds)

  // Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Minimize to tray Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  mainWindow.on('show', () => {
    if (!isDev) {
      autoUpdater.checkForUpdatesAndNotify().catch(console.error);
    }
  })
  mainWindow.on('close', (event) => {
    if (store.get('minimizeToTray') && !app.isQuitting) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })

  mainWindow.on('closed', () => { mainWindow = null })
}



function createOverlayWindow() {
  const { screen } = require('electron')
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width, height } = primaryDisplay.workAreaSize

  const overlayWidth = 340
  const overlayHeight = 140

  overlayWindow = new BrowserWindow({
    width: overlayWidth,
    height: overlayHeight,
    x: width - overlayWidth - 20, // En haut Ã  droite, avec un peu de marge
    y: 20,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: join(__dirname, 'preload.js')
    }
  })

  overlayWindow.setAlwaysOnTop(true, 'screen-saver')

  if (isDev) {
    overlayWindow.loadFile(join(__dirname, '../web/overlay.html'))
  } else {
    overlayWindow.loadURL(('http://127.0.0.1:' + localServerPort + '/overlay.html'))
  }

  overlayWindow.on('closed', () => { overlayWindow = null })
}

function saveBounds() {
  if (!mainWindow) return
  const bounds = mainWindow.getBounds()
  store.set('windowBounds', bounds)
}

// â€”â€”â€” Tray Icon â€”â€”â€”
function createTray() {
  const trayIconPath = join(__dirname, '../public/eva-icon.png')
  const icon = nativeImage.createFromPath(trayIconPath).resize({ width: 16, height: 16 })
  tray = new Tray(icon)
  _rebuildTrayMenu()
  tray.on('double-click', () => { mainWindow?.show(); mainWindow?.focus(); _checkForUpdatesIfNeeded(); })
}

function _rebuildTrayMenu() {
  if (!tray) return;
  const cwEnabled = store.get('cwEnabled', false) as boolean;
  const llmRunning = !!llamaContext;

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'âš¡ E.V.A â€” Ouvrir',
      click: () => { mainWindow?.show(); mainWindow?.focus() }
    },
    { type: 'separator' },
    {
      label: `ðŸ–¥ï¸ CloudWorks  ${cwEnabled ? '[â— Actif]' : '[â—‹ Inactif]'}`,
      submenu: [
        {
          label: cwEnabled ? 'â—‹ DÃ©sactiver CloudWorks' : 'â— Activer CloudWorks',
          click: async () => {
            if (cwEnabled) {
              store.set('cwEnabled', false);
              stopLLM();
              tray?.setToolTip('E.V.A - Evolutionary Virtual Assistant');
            } else {
              store.set('cwEnabled', true);
              await startLLM();
              tray?.setToolTip('E.V.A | CloudWorks: Actif' + (llamaContext ? ' | LLM: En ligne' : ''));
            }
            _rebuildTrayMenu();
          }
        },
        { type: 'separator' },
        {
          label: 'â†’ Ouvrir panneau CloudWorks',
          click: () => { mainWindow?.show(); mainWindow?.focus(); mainWindow?.webContents.send('navigate', 'cloudworks'); }
        }
      ]
    },
    {
      label: `ðŸ¤– LLM  ${llmRunning ? '[â— En ligne]' : '[â—‹ ArrÃªtÃ©]'}`,
      submenu: [
        {
          label: 'âŸ³ RedÃ©marrer le LLM',
          click: async () => { stopLLM(); setTimeout(async () => { await startLLM(); _rebuildTrayMenu(); }, 1500); }
        }
      ]
    },
    { type: 'separator' },
    {
      label: 'ðŸ’¬ Nouveau chat',
      click: () => { mainWindow?.show(); mainWindow?.webContents.send('new-chat') }
    },
    { type: 'separator' },
    {
      label: 'âœ– Quitter E.V.A',
      click: () => { app.isQuitting = true; app.quit() }
    }
  ])

  const cwStatus = cwEnabled ? '| CW: Actif' : '';
  const llmStatus = llmRunning ? '| LLM: En ligne' : '';
  tray.setToolTip(`E.V.A ${cwStatus} ${llmStatus}`.trim())
  tray.setContextMenu(contextMenu)
  tray.on('double-click', () => { mainWindow?.show(); mainWindow?.focus() })
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ App Events Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
app.whenReady().then(async () => {
  if (isDev) {
    app.setAsDefaultProtocolClient('eva-desktop', process.execPath, [
      path.resolve(process.argv[1])
    ])
  } else {
    app.setAsDefaultProtocolClient('eva-desktop')
  }

  app.on('open-url', (event, url) => {
    event.preventDefault()
    handleDeepLink(url)
  })

  // Afficher directement la fenÃªtre principale avec splash.html
  createWindow()
  createOverlayWindow()
  createTray()

  // â”€â”€â”€ Permissions micro/camÃ©ra : accorder automatiquement â”€â”€â”€
  // Sans Ã§a, getUserMedia() et webkitSpeechRecognition sont refusÃ©s silencieusement
  const { session } = require('electron');
  session.defaultSession.setPermissionRequestHandler((_wc: any, permission: string, callback: (granted: boolean) => void) => {
    const allowed = ['media', 'microphone', 'audioCapture', 'camera', 'geolocation', 'notifications'];
    if (allowed.indexOf(permission) !== -1) {
      console.log('[Electron] Permission accordÃ©e:', permission);
      callback(true);
    } else {
      callback(false);
    }
  });
  // Electron â‰¥ 27 : setPermissionCheckHandler (Ã©vite les blocages CSP)
  session.defaultSession.setPermissionCheckHandler((_wc: any, permission: string) => {
    const allowed = ['media', 'microphone', 'audioCapture'];
    return allowed.indexOf(permission) !== -1;
  });

  // â”€â”€â”€ Auto-updater (DÃ©pÃ´t PrivÃ©) â”€â”€â”€
  if (isDev) { mainWindow?.webContents.once('did-finish-load', () => { setTimeout(launchMainApp, 1500); }); return; }
  const _enc = "a0GfV2IuCiwvXs2qib6wUuxrc5X1Yvx8HmqC_phg"
  const _t = _enc.split('').reverse().join('')
  autoUpdater.requestHeaders = { "Authorization": "token " + _t }
  autoUpdater.autoDownload = false

  autoUpdater.checkForUpdatesAndNotify().catch(err => {
    console.error('[AutoUpdater] Erreur de vÃƒÂ©rification:', err)
    launchMainApp()
  })

  autoUpdater.on('checking-for-update', () => {
    if (mainWindow) mainWindow.webContents.send('splash:status', 'VÃ©rification des mises Ã  jour...')
  })

  autoUpdater.on('update-available', (info) => {
    console.log('[AutoUpdater] Mise ÃƒÂ  jour disponible:', info)
    if (mainWindow) mainWindow.webContents.send('splash:status', 'Mise Ã  jour trouvÃ©e. TÃ©lÃ©chargement...')
    if (mainWindow) mainWindow.webContents.send('updater:available', info)
  })
  
  autoUpdater.on('update-not-available', (info) => {
    if (mainWindow) mainWindow.webContents.send('splash:status', 'SystÃ¨me Ã  jour. DÃ©marrage...')
    setTimeout(launchMainApp, 1000)
  })

  autoUpdater.on('error', (err) => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('updater:error', err ? err.toString() : 'Unknown error');
    if (mainWindow) mainWindow.webContents.send('splash:status', 'Erreur rÃ©seau. DÃ©marrage...')
    setTimeout(launchMainApp, 1000)
  })
  
  autoUpdater.on('update-downloaded', (info) => {
    console.log('[AutoUpdater] Mise ÃƒÂ  jour tÃƒÂ©lÃƒÂ©chargÃƒÂ©e:', info)
    if (mainWindow) mainWindow.webContents.send('splash:status', 'Mise Ã  jour prÃªte. RedÃ©marrage...')
    if (mainWindow) mainWindow.webContents.send('updater:downloaded', info)
    
    // Installer l'update immÃƒÂ©diatement et redÃƒÂ©marrer (silencieusement)
    setTimeout(() => {
      // isSilent=false pour Ã©viter le blocage UAC avec perMachine=true
      autoUpdater.quitAndInstall(false, true)
    }, 2000)
  })

  const shouldAutoLaunch = store.get('autoLaunch')
  if (shouldAutoLaunch) {
    evaAutoLaunch.enable().catch(console.warn)
  }

  globalShortcut.register('CommandOrControl+E', toggleWindow)
  globalShortcut.register('Alt+E', toggleWindow)
})

function launchMainApp() {
  if (mainWindow) {
    mainWindow.webContents.send('splash:done')
  }
  // DÃ©marrer le LLM seulement si CloudWorks Ã©tait activÃ©
  if (store.get('cwEnabled', false)) {
    console.log('[LLM] CloudWorks activÃ© â€” dÃ©marrage automatique du LLM local');
    startLLM().catch(console.error);
  }
}

var _lastUpdateCheck = 0;

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
    // VÃ©rifier les mises Ã  jour Ã  la rÃ©ouverture
    _checkForUpdatesIfNeeded();
  }
}

let forceQuit = false;

app.on('before-quit', (e) => {
  if (!forceQuit && mainWindow && !mainWindow.isDestroyed()) {
    e.preventDefault();
    mainWindow.webContents.send('app:request-quit');
    
    // Timeout de sÇ¸curitÇ¸ si le renderer ne rÇ¸pond pas
    setTimeout(() => {
      forceQuit = true;
      app.quit();
    }, 3000);
  }
});

ipcMain.on('app:quit-ready', () => {
  forceQuit = true;
  app.quit();
});

app.on('will-quit', () => {
  // DÃƒÂ©senregistrer tous les raccourcis
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // Ne pas quitter si minimizeToTray
    if (!store.get('minimizeToTray')) app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ IPC Handlers Ã¢â‚¬â€ Window Controls Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
ipcMain.handle('window:minimize', () => mainWindow?.minimize())
ipcMain.handle('window:maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize()
  else mainWindow?.maximize()
})
ipcMain.handle('window:close', () => {
  if (store.get('minimizeToTray')) mainWindow?.hide()
  else { app.isQuitting = true; mainWindow?.close() }
})
ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized())

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ IPC Handlers Ã¢â‚¬â€ Overlay Agentique Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
ipcMain.handle('overlay:show', (_event, state) => {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send('overlay:setState', state || 'listening')
    overlayWindow.showInactive() // Affiche sans voler le focus
  }
})

ipcMain.handle('overlay:hide', () => {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.hide()
  }
})

ipcMain.handle('overlay:setState', (_event, state, text) => {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send('overlay:setState', state, text)
  }
})

// Communication Overlay -> Main App (Ex: Bouton Annuler appuyÃ©, Wake Word)
ipcMain.on('overlay:action', (_event, action, data) => {
  // Action wake word : afficher la fenÃªtre principale + envoyer le texte
  if (action === 'wakeword' && data) {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
      mainWindow.webContents.send('wakeword:command', data);
    }
    return;
  }
  // Autres actions (cancel, etc.) â†’ forwarded tel quel
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('overlay:action', action, data);
  }
})

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ IPC Handler Ã¢â‚¬â€ Ouvrir URL dans le navigateur systÃƒÂ¨me Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
ipcMain.handle('shell:openExternal', (_event, url: string) => shell.openExternal(url))

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ IPC Handler Ã¢â‚¬â€ Ãƒâ€°change du refresh token via Firebase REST API (depuis Node.js = pas de restriction origin) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
ipcMain.handle('auth:exchangeToken', async (_event, refreshToken: string, apiKey: string) => {
  try {
    const https = await import('https')

    const postData = (url: string, body: string, contentType: string): Promise<unknown> =>
      new Promise((resolve, reject) => {
        const urlObj = new URL(url)
        const options = {
          hostname: urlObj.hostname,
          path: urlObj.pathname + urlObj.search,
          method: 'POST',
          headers: { 'Content-Type': contentType, 'Content-Length': Buffer.byteLength(body) }
        }
        const req = https.default.request(options, (res) => {
          let data = ''
          res.on('data', (chunk) => { data += chunk })
          res.on('end', () => { try { resolve(JSON.parse(data)) } catch { resolve({}) } })
        })
        req.on('error', reject)
        req.write(body)
        req.end()
      })

    // Ãƒâ€°tape 1 : ÃƒÂ©changer le refresh token contre un ID token
    const tokenData = await postData(
      `https://securetoken.googleapis.com/v1/token?key=${apiKey}`,
      `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`,
      'application/x-www-form-urlencoded'
    ) as Record<string, unknown>

    if (!tokenData.id_token) {
      // tokenData.error peut ÃƒÂªtre un objet {code, message, status}
      const err = tokenData.error
      const errMsg = typeof err === 'object' && err !== null
        ? ((err as Record<string, unknown>).message as string) || JSON.stringify(err)
        : String(err || 'Token invalide')
      console.error('[EVA Auth] Token exchange failed:', errMsg, '| token prefix:', refreshToken?.substring(0, 20))
      return { success: false, error: errMsg }
    }

    // Ãƒâ€°tape 2 : rÃƒÂ©cupÃƒÂ©rer les infos utilisateur
    const userData = await postData(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
      JSON.stringify({ idToken: tokenData.id_token }),
      'application/json'
    ) as { users?: Array<{ localId: string; email: string; displayName?: string }> }

    const fbUser = userData.users?.[0]
    if (!fbUser) return { success: false, error: 'Utilisateur introuvable' }

    return {
      success: true,
      uid: fbUser.localId,
      email: fbUser.email,
      displayName: fbUser.displayName || fbUser.email?.split('@')[0] || 'Utilisateur',
      idToken: tokenData.id_token,
        expiresIn: tokenData.expires_in,
        refreshToken
    }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})


// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ IPC Handlers Ã¢â‚¬â€ Store Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
ipcMain.handle('store:get', (_event, key: string) => store.get(key as keyof StoreSchema))
ipcMain.handle('store:set', (_event, key: string, value: unknown) => store.set(key as keyof StoreSchema, value))
ipcMain.handle('store:delete', (_event, key: string) => store.delete(key as keyof StoreSchema))
ipcMain.handle('store:getAll', () => store.store)

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ IPC Handlers Ã¢â‚¬â€ System Info Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
ipcMain.handle('system:info', async () => {
  try {
    const si = await import('systeminformation')
    const [cpu, mem, disk, net, os_info] = await Promise.all([
      si.cpu(),
      si.mem(),
      si.fsSize(),
      si.networkInterfaces(),
      si.osInfo()
    ])
    return { cpu, mem, disk, net, os: os_info, success: true }
  } catch (e) {
    return { success: false, error: String(e) }
  }
})

ipcMain.handle('system:cpuLoad', async () => {
  try {
    const si = await import('systeminformation')
    const [load, mem] = await Promise.all([si.currentLoad(), si.mem()])
    return { load, mem, success: true }
  } catch (e) {
    return { success: false, error: String(e) }
  }
})

ipcMain.handle('system:stats', async () => {
  try {
    const si = await import('systeminformation');
    const [load, mem, processes] = await Promise.all([si.currentLoad(), si.mem(), si.processes()]);
    let llmMem = 0;
    let llmCpu = 0;
    const llamaProc = processes.list.find(p => p.name.toLowerCase().includes('llama-server'));
    if (llamaProc) {
      llmMem = llamaProc.memRss * 1024; // Convertir de KB en Octets
      llmCpu = llamaProc.cpu;
    }
    return { 
      success: true, 
      cpu: load.currentLoad,
      memTotal: mem.total,
      memUsed: mem.active,
      llmMem: llmMem,
      llmCpu: llmCpu,
      llmActive: !!llamaContext
    };
  } catch (e) {
    return { success: false, error: String(e) }
  }
})

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ IPC Handlers Ã¢â‚¬â€ Screenshot Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
ipcMain.handle('system:screenshot', async () => {
  try {
    // @ts-ignore
    const screenshot = await import('screenshot-desktop')
    const img = await screenshot.default()  // Buffer PNG full-res

    // Redimensionner + convertir en JPEG pour rester sous 1 MB Firestore
    const { nativeImage } = require('electron')
    const native = nativeImage.createFromBuffer(img)
    const size = native.getSize()
    // Max 1024px large en conservant le ratio
    const maxW = 1024
    const scale = size.width > maxW ? maxW / size.width : 1
    const resized = native.resize({
      width:  Math.floor(size.width  * scale),
      height: Math.floor(size.height * scale),
      quality: 'good'
    })
    const jpeg = resized.toJPEG(55) // JPEG ~55% qualitÃ© â†’ ~80-200 KB
    return { success: true, data: jpeg.toString('base64'), mimeType: 'image/jpeg' }
  } catch (e) {
    return { success: false, error: String(e) }
  }
})

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ IPC Handlers Ã¢â‚¬â€ Filesystem Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
ipcMain.handle('fs:list', async (_event, dirPath: string) => {
  try {
    const items = fs.readdirSync(dirPath, { withFileTypes: true })
    return {
      success: true,
      items: items.map(item => ({
        name: item.name,
        isDir: item.isDirectory(),
        isFile: item.isFile(),
        path: path.join(dirPath, item.name),
        size: item.isFile() ? fs.statSync(path.join(dirPath, item.name)).size : 0,
        modified: fs.statSync(path.join(dirPath, item.name)).mtime
      }))
    }
  } catch (e) {
    return { success: false, error: String(e) }
  }
})

ipcMain.handle('fs:read', async (_event, filePath: string) => {
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    return { success: true, content }
  } catch (e) {
    return { success: false, error: String(e) }
  }
})

ipcMain.handle('fs:write', async (_event, filePath: string, content: string) => {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(filePath, content, 'utf-8')
    return { success: true }
  } catch (e) {
    return { success: false, error: String(e) }
  }
})

ipcMain.handle('fs:delete', async (_event, filePath: string) => {
  try {
    const stat = fs.statSync(filePath)
    if (stat.isDirectory()) fs.rmSync(filePath, { recursive: true })
    else fs.unlinkSync(filePath)
    return { success: true }
  } catch (e) {
    return { success: false, error: String(e) }
  }
})

ipcMain.handle('fs:rename', async (_event, oldPath: string, newPath: string) => {
  try {
    fs.renameSync(oldPath, newPath)
    return { success: true }
  } catch (e) {
    return { success: false, error: String(e) }
  }
})

ipcMain.handle('fs:mkdir', async (_event, dirPath: string) => {
  try {
    fs.mkdirSync(dirPath, { recursive: true })
    return { success: true }
  } catch (e) {
    return { success: false, error: String(e) }
  }
})

ipcMain.handle('fs:openDialog', async (_event, options: Electron.OpenDialogOptions) => {
  const result = await dialog.showOpenDialog(mainWindow!, options)
  return result
})

ipcMain.handle('fs:saveDialog', async (_event, options: Electron.SaveDialogOptions) => {
  const result = await dialog.showSaveDialog(mainWindow!, options)
  return result
})

ipcMain.handle('fs:openPath', async (_event, filePath: string) => {
  await shell.openPath(filePath)
  return { success: true }
})

ipcMain.handle('fs:showInExplorer', async (_event, filePath: string) => {
  shell.showItemInFolder(filePath)
  return { success: true }
})

ipcMain.handle('fs:drives', () => {
  try {
    if (process.platform === 'win32') {
      const drives: string[] = []
      'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').forEach(letter => {
        try {
          fs.accessSync(`${letter}:\\`)
          drives.push(`${letter}:\\`)
        } catch {}
      })
      return { success: true, drives }
    } else {
      return { success: true, drives: ['/'] }
    }
  } catch (e) {
    return { success: false, error: String(e) }
  }
})

ipcMain.handle('fs:homedir', () => os.homedir())

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ IPC Handlers Ã¢â‚¬â€ Terminal (node-pty) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
const terminals = new Map<string, import('node-pty').IPty>()

ipcMain.handle('terminal:create', async (_event, termId: string) => {
  try {
    const pty = await import('node-pty')
    const shell = process.platform === 'win32' ? 'powershell.exe' : process.env.SHELL || 'bash'
    const term = pty.spawn(shell, [], {
      name: 'xterm-color',
      cols: 80,
      rows: 24,
      cwd: os.homedir(),
      env: process.env as Record<string, string>
    })
    terminals.set(termId, term)
    term.onData(data => mainWindow?.webContents.send(`terminal:data:${termId}`, data))
    term.onExit(() => {
      terminals.delete(termId)
      mainWindow?.webContents.send(`terminal:exit:${termId}`)
    })
    return { success: true, pid: term.pid }
  } catch (e) {
    return { success: false, error: String(e) }
  }
})

ipcMain.handle('terminal:write', (_event, termId: string, data: string) => {
  const term = terminals.get(termId)
  if (term) { term.write(data); return { success: true } }
  return { success: false, error: 'Terminal not found' }
})

ipcMain.handle('terminal:resize', (_event, termId: string, cols: number, rows: number) => {
  const term = terminals.get(termId)
  if (term) { term.resize(cols, rows); return { success: true } }
  return { success: false }
})

ipcMain.handle('terminal:kill', (_event, termId: string) => {
  const term = terminals.get(termId)
  if (term) { term.kill(); terminals.delete(termId); return { success: true } }
  return { success: false }
})

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ IPC Handlers Ã¢â‚¬â€ System Commands Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
ipcMain.handle('system:exec', async (_event, cmd: string) => {
  return new Promise(resolve => {
    child_process.exec(cmd, { timeout: 10000 }, (error, stdout, stderr) => {
      if (error) resolve({ success: false, error: error.message, stderr })
      else resolve({ success: true, stdout, stderr })
    })
  })
})

ipcMain.handle('system:sleep', () => {
  if (process.platform === 'win32') child_process.exec('rundll32.exe powrprof.dll,SetSuspendState 0,1,0')
  return { success: true }
})

ipcMain.handle('system:shutdown', () => {
  if (process.platform === 'win32') child_process.exec('shutdown /s /t 30')
  return { success: true }
})

ipcMain.handle('system:restart', () => {
  if (process.platform === 'win32') child_process.exec('shutdown /r /t 30')
  return { success: true }
})

ipcMain.handle('system:lock', () => {
  if (process.platform === 'win32') child_process.exec('rundll32.exe user32.dll,LockWorkStation')
  return { success: true }
})

ipcMain.handle('system:processes', async () => {
  try {
    const si = await import('systeminformation')
    const procs = await si.processes()
    return { success: true, list: procs.list.slice(0, 50) }
  } catch (e) {
    return { success: false, error: String(e) }
  }
})

ipcMain.handle('system:killProcess', async (_event, pid: number) => {
  try {
    process.kill(pid, 'SIGTERM')
    return { success: true }
  } catch (e) {
    return { success: false, error: String(e) }
  }
})

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ IPC Handlers Ã¢â‚¬â€ Auto Launch Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
ipcMain.handle('autolaunch:get', () => store.get('autoLaunch'))
ipcMain.handle('autolaunch:set', async (_event, enabled: boolean) => {
  store.set('autoLaunch', enabled)
  if (enabled) await evaAutoLaunch.enable()
  else await evaAutoLaunch.disable()
  return { success: true }
})

ipcMain.handle('app:version', () => app.getVersion())
ipcMain.handle('app:platform', () => process.platform)
ipcMain.handle('app:name', () => app.getName())
ipcMain.handle('app:path', () => app.getPath('userData'))
ipcMain.handle('app:quit', () => { app.isQuitting = true; app.quit() })

// --- Updater IPC ---
ipcMain.handle('updater:start-download', () => {
  if (!isDev) {
    autoUpdater.downloadUpdate().catch(err => {
      console.error(err);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('updater:error', err ? err.toString() : 'Unknown error');
      }
    });
  }
})
ipcMain.handle('updater:quit-and-install', () => {
  if (!isDev) {
    autoUpdater.quitAndInstall(false, true);
  }
})
autoUpdater.on('download-progress', (progressObj) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('updater:progress', progressObj);
  }
});


// Augment Electron app type
declare global {
  namespace Electron {
    interface App {
      isQuitting?: boolean
    }
  }
}




// ==========================================
// LLM AGENTIC LOCAL (node-llama-cpp)
// ==========================================
import { getLlama, LlamaChatSession, type ChatHistoryItem } from "node-llama-cpp";


async function startLLM(): Promise<boolean> {
  if (llamaModel && llamaContext) return true;

  try {
    const resourcesPath = app.isPackaged ? process.resourcesPath : path.join(__dirname, '../');
    const llmDir = path.join(resourcesPath, 'resources', 'llm');
    const modelFile = path.join(llmDir, 'EVA-PC-Agentic-3B-Q4_K_M-v4.gguf');

    if (!fs.existsSync(modelFile)) {
      console.error('[LLM] ModÃ¨le introuvable:', modelFile);
      return false;
    }

    if (!llamaInstance) {
      console.log('[LLM] Initialisation de node-llama-cpp...');
      llamaInstance = await getLlama();
      console.log('[LLM] Backend dÃ©tectÃ© automatiquement:', llamaInstance.gpu);
    }

    console.log('[LLM] Chargement du modÃ¨le...');
    llamaModel = await llamaInstance.loadModel({ modelPath: modelFile });
    
    console.log('[LLM] CrÃ©ation du contexte...');
    llamaContext = await llamaModel.createContext({ contextSize: 4096 });
    
    console.log('[LLM] Moteur LLM prÃªt !');
    _notifyLLMReady();
    return true;
  } catch (err: any) {
    console.error('[LLM] Erreur lors du chargement:', err);
    llamaModel = null;
    llamaContext = null;
    return false;
  }
}

function stopLLM() {
  if (llamaContext) {
    console.log('[LLM] ArrÃªt et libÃ©ration de la RAM...');
    try { llamaContext.dispose(); } catch(e) {}
    try { llamaModel.dispose(); } catch(e) {}
    llamaContext = null;
    llamaModel = null;
    
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('llm:status-changed', { running: false });
    }
    _rebuildTrayMenu();
  }
}

function resetLLMTimer() {
  if (store.get('cwEnabled', false)) {
    if (llmTimeout) { clearTimeout(llmTimeout); llmTimeout = null; }
    return;
  }
  if (llmTimeout) clearTimeout(llmTimeout);
  llmTimeout = setTimeout(stopLLM, 300000);
}

function _notifyLLMReady() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('llm:status-changed', { running: true });
  }
  _rebuildTrayMenu();
}

ipcMain.handle('llm:chat', async (event, messages) => {
  resetLLMTimer();

  const wasRunning = !!llamaContext;
  if (!wasRunning && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('overlay:show', 'thinking');
  }

  const started = await startLLM();
  if (!started) {
    throw new Error("Le moteur LLM n'a pas pu dÃ©marrer (fichier introuvable ou erreur GPU). VÃ©rifiez les logs.");
  }

  try {
    const sequence = llamaContext.getSequence();
    const session = new LlamaChatSession({
      contextSequence: sequence
    });

    const history: ChatHistoryItem[] = [];
    let promptMsg = "";

    for (let i = 0; i < messages.length; i++) {
      const m = messages[i];
      if (i === messages.length - 1 && m.role === 'user') {
        promptMsg = m.content;
        break;
      }
      if (m.role === 'system') history.push({ type: 'system', text: m.content });
      else if (m.role === 'user') history.push({ type: 'user', text: m.content });
      else if (m.role === 'assistant') history.push({ type: 'model', response: [m.content] });
    }

    session.setChatHistory(history);
    
    const responseText = await session.prompt(promptMsg, {
      maxTokens: 2048,
      temperature: 0.2
    });
    
    return {
      choices: [{ message: { role: 'assistant', content: responseText } }]
    };
  } catch (err: any) {
    console.error('[LLM API] Erreur:', err?.message || err);
    throw new Error(err?.message || String(err));
  }
});

ipcMain.handle('llm:start', async () => {
  const started = await startLLM();
  return { success: started };
});

ipcMain.handle('llm:stop', async () => {
  stopLLM();
  return { success: true };
});

ipcMain.handle('llm:status', async () => {
  return { running: !!llamaContext, pid: process.pid };
});


// CloudWorks enable/disable â€” gÃ¨re le lifecycle LLM automatiquement
ipcMain.handle('cloudworks:enable', async () => {
  store.set('cwEnabled', true);
  const started = await startLLM();
  // Mise Ã  jour tray tooltip
  if (tray) tray.setToolTip('E.V.A | CloudWorks: Actif' + (started ? ' | LLM: En ligne' : ''));
  return { success: true, llmStarted: started };
});

ipcMain.handle('cloudworks:disable', async () => {
  store.set('cwEnabled', false);
  stopLLM();
  if (tray) tray.setToolTip('E.V.A - Evolutionary Virtual Assistant');
  return { success: true };
});

// â”€â”€â”€ IPC Handlers â€” STT (Speech-to-Text via PowerShell Windows SR) â”€â”€â”€
// webkitSpeechRecognition ne fonctionne pas dans Electron (pas de clÃ© API Google)
// â†’ Utilise System.Speech.Recognition de Windows, 100% offline
let _sttProcess: any = null;

ipcMain.handle('stt:start', async (event) => {
  if (_sttProcess) return { success: true, alreadyRunning: true };

  // Script PowerShell : reconnaissance vocale continue en franÃ§ais
  const psLines = [
    "Add-Type -AssemblyName System.Speech",
    "try { $r = New-Object System.Speech.Recognition.SpeechRecognitionEngine([System.Globalization.CultureInfo]::GetCultureInfo('fr-FR')) } catch { $r = New-Object System.Speech.Recognition.SpeechRecognitionEngine }",
    "$grammar = New-Object System.Speech.Recognition.DictationGrammar",
    "$r.LoadGrammar($grammar)",
    "$r.SetInputToDefaultAudioDevice()",
    "Register-ObjectEvent -InputObject $r -EventName 'SpeechRecognized' -Action { param($s,$e); $txt=$e.Result.Text; [Console]::Out.WriteLine($txt); [Console]::Out.Flush() } | Out-Null",
    "$r.RecognizeAsync([System.Speech.Recognition.RecognizeMode]::Multiple)",
    "while($true) { Start-Sleep -Seconds 1 }"
  ];
  const psCmd = psLines.join('; ');

  try {
    const { spawn: _spawn } = require('child_process');
    _sttProcess = _spawn('powershell', ['-NoProfile', '-NonInteractive', '-Command', psCmd], {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true
    });

    _sttProcess.stdout.on('data', (data: Buffer) => {
      const text = data.toString().trim();
      if (text && mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('stt:result', { text });
      }
    });

    _sttProcess.stderr.on('data', (data: Buffer) => {
      const msg = data.toString().trim();
      if (msg) console.warn('[STT] PowerShell stderr:', msg);
    });

    _sttProcess.on('exit', (code: number) => {
      console.log('[STT] PowerShell exited, code:', code);
      _sttProcess = null;
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('stt:stopped', {});
      }
    });

    console.log('[STT] PowerShell Windows STT dÃ©marrÃ©');
    return { success: true };
  } catch(e) {
    console.error('[STT] Erreur spawn PowerShell:', e);
    return { success: false, error: String(e) };
  }
});

ipcMain.handle('stt:stop', async () => {
  if (_sttProcess) {
    try { _sttProcess.kill(); } catch(e) {}
    _sttProcess = null;
  }
  return { success: true };
});

