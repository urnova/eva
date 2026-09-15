import { app, BrowserWindow, ipcMain, dialog, shell, Tray, Menu, nativeImage, globalShortcut , Notification } from 'electron'
// Optimisations GPU : Accélération matérielle activée, zéro-copy et GPU rasterization
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
import { join } from 'path'
import { fileURLToPath } from 'url'
import Store from 'electron-store'
import AutoLaunch from 'auto-launch'
import { autoUpdater } from 'electron-updater'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import * as child_process from 'child_process'
// â”€â”€â”€ Polyfill __dirname pour ESM â”€â”€â”€
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const logFile = 'F:\\temp\\eva_runtime.log';
function logMain(...args: any[]) {
  try {
    const ts = new Date().toISOString();
    fs.appendFileSync(logFile, '[' + ts + '] ' + args.join(' ') + '\n');
    console.log(...args);
  } catch(e) {}
}
logMain('[EVA Main] Process started, PID:', process.pid, 'isPackaged:', app.isPackaged);

process.on('uncaughtException', (err: any) => {
  logMain('[EVA Main] UNCAUGHT EXCEPTION:', err && err.stack ? err.stack : String(err));
});
process.on('unhandledRejection', (reason: any) => {
  logMain('[EVA Main] UNHANDLED REJECTION:', reason && reason.stack ? reason.stack : String(reason));
});
process.on('exit', (code: number) => {
  logMain('[EVA Main] Process exiting with code:', code);
});

import * as http from 'http'
import { extname } from 'path'

let localServerPort = 45454;
const mimeTypes: { [key: string]: string } = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.webp': 'image/webp'
};

function startLocalServer(): Promise<number> {
  return new Promise((resolve) => {
    const handleRequest = (req: http.IncomingMessage, res: http.ServerResponse) => {
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
            res.writeHead(200, {
              'Content-Type': contentType,
              'Access-Control-Allow-Origin': '*',
              'Cache-Control': 'no-cache'
            });
            res.end(content);
          }
        });
      });
    };

    const server = http.createServer(handleRequest);

    server.once('error', (e: any) => {
      if (e.code === 'EADDRINUSE') {
        console.warn('[EVA] Port 45454 déjà pris, démarrage sur port dynamique...');
        const fallbackServer = http.createServer(handleRequest);
        fallbackServer.listen(0, '127.0.0.1', () => {
          const address = fallbackServer.address();
          if (address && typeof address !== 'string') {
            localServerPort = address.port;
          }
          console.log('[EVA] Local HTTP Server actif sur port dynamique:', localServerPort);
          resolve(localServerPort);
        });
      } else {
        console.error('[EVA] HTTP server error:', e);
        resolve(localServerPort);
      }
    });

    server.listen(localServerPort, '127.0.0.1', () => {
      const address = server.address();
      if (address && typeof address !== 'string') {
        localServerPort = address.port;
      }
      console.log('[EVA] Local HTTP Server actif sur le port:', localServerPort);
      resolve(localServerPort);
    });
  });
}


// â”€â”€â”€ Store local (config NON synchronisée) â”€â”€â”€
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

// â”€â”€â”€ Auto Launch â”€â”€â”€
const evaAutoLaunch = new AutoLaunch({
  name: 'EVA Assistant',
  path: process.execPath
})

let mainWindow: BrowserWindow | null = null
let overlayWindow: BrowserWindow | null = null
let tray: Tray | null = null
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

// â”€â”€â”€ URL du site web EVA (en production) â”€â”€â”€
export const EVA_WEB_URL = 'https://eva.astraltechnologie.fr'

// â”€â”€â”€ Prévenir multiple instances + gérer protocole custom â”€â”€â”€
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
      // Décoder le token (Windows peut modifier l'encodage URL)
      let refreshToken = params.get('refreshToken') || params.get('token')
      if (refreshToken) {
        // Réassurer le décodage correct des caractères spéciaux
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

// â”€â”€â”€ Créer la fenêtre principale â”€â”€â”€
function createWindow() {
  const bounds = store.get('windowBounds')

  mainWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    minWidth: 900,
    minHeight: 600,
    frame: false,           // Fenêtre sans bordure native
    backgroundColor: '#111113',
    icon: join(__dirname, '../public/eva-icon.png'),
    webPreferences: {
      plugins: true,
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
      allowRunningInsecureContent: true,
      sandbox: false,
      backgroundThrottling: false
    },
    show: false
  })

  let shown = false;
  const showWindow = () => {
    if (shown || !mainWindow) return;
    shown = true;
    mainWindow.show();
  };

  mainWindow.once('ready-to-show', showWindow);
  // Sécurité anti-écran noir : afficher la fenêtre au bout de 2s si ready-to-show tarde
  setTimeout(showWindow, 2000);

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.warn(`[EVA] did-fail-load: ${validatedURL} (${errorCode}: ${errorDescription})`);
    if (!isDev && validatedURL && !validatedURL.startsWith('file:')) {
      console.log('[EVA] Bascule de secours sur splash.html local...');
      mainWindow?.loadFile(join(__dirname, '../dist/splash.html'));
    }
  });

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
    mainWindow.loadURL('http://127.0.0.1:' + localServerPort + '/splash.html').catch(err => {
      console.error('[EVA] Échec chargement URL splash, bascule sur fichier local:', err);
      mainWindow?.loadFile(join(__dirname, '../dist/splash.html'));
    });
  }

  // ─── Sauvegarder la position/taille ───
  mainWindow.on('resized', saveBounds)
  mainWindow.on('moved', saveBounds)

  // ─── Minimize to tray ───
  mainWindow.on('show', () => {
    if (!isDev) {
      _checkForUpdatesIfNeeded(false);
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
    x: width - overlayWidth - 20, // En haut à droite, avec un peu de marge
    y: 20,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      plugins: true,
      nodeIntegration: false,
      contextIsolation: true,
      preload: join(__dirname, 'preload.js'),
      backgroundThrottling: false
    }
  })

  overlayWindow.setAlwaysOnTop(true, 'screen-saver')

  if (isDev) {
    overlayWindow.loadFile(join(__dirname, '../web/overlay.html'))
  } else {
    overlayWindow.loadFile(join(__dirname, '../dist/overlay.html'))
  }

  overlayWindow.on('closed', () => { overlayWindow = null })
}

function saveBounds() {
  if (!mainWindow) return
  const bounds = mainWindow.getBounds()
  store.set('windowBounds', bounds)
}

// ——— Tray Icon ———
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
      label: '⚡ E.V.A — Ouvrir',
      click: () => { mainWindow?.show(); mainWindow?.focus() }
    },
    { type: 'separator' },
    {
      label: `🖥️ CloudWorks  ${cwEnabled ? '[● Actif]' : '[○ Inactif]'}`,
      submenu: [
        {
          label: cwEnabled ? '○ Désactiver CloudWorks' : '● Activer CloudWorks',
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
          label: '→ Ouvrir panneau CloudWorks',
          click: () => { mainWindow?.show(); mainWindow?.focus(); mainWindow?.webContents.send('navigate', 'cloudworks'); }
        }
      ]
    },
    {
      label: `🤖 LLM  ${llmRunning ? '[● En ligne]' : '[○ Arrêté]'}`,
      submenu: [
        {
          label: '⟳ Redémarrer le LLM',
          click: async () => { stopLLM(); setTimeout(async () => { await startLLM(); _rebuildTrayMenu(); }, 1500); }
        }
      ]
    },
    { type: 'separator' },
    {
      label: '🔄 Rechercher des mises à jour',
      click: () => {
        _lastUpdateCheck = 0;
        _checkForUpdatesIfNeeded(true);
      }
    },
    {
      label: '💬 Nouveau chat',
      click: () => { mainWindow?.show(); mainWindow?.webContents.send('new-chat') }
    },
    { type: 'separator' },
    {
      label: '✖ Quitter E.V.A',
      click: () => { app.isQuitting = true; app.quit() }
    }
  ])

  const cwStatus = cwEnabled ? '| CW: Actif' : '';
  const llmStatus = llmRunning ? '| LLM: En ligne' : '';
  tray.setToolTip(`E.V.A ${cwStatus} ${llmStatus}`.trim())
  tray.setContextMenu(contextMenu)
  tray.on('double-click', () => { mainWindow?.show(); mainWindow?.focus() })
}

// â”€â”€â”€ App Events â”€â”€â”€
app.whenReady().then(async () => {
  logMain('[EVA Main] app.whenReady fired');
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

  // Démarrer le serveur HTTP local avant de charger les fenêtres
  if (!isDev) {
    await startLocalServer();
  }

  // Afficher directement la fenêtre principale avec splash.html
  createWindow()
  createOverlayWindow()
  createTray()

  // ─── Permissions micro/caméra : accorder automatiquement ───
  const { session } = require('electron');
  session.defaultSession.setPermissionRequestHandler((_wc: any, permission: string, callback: (granted: boolean) => void) => {
    const allowed = ['media', 'microphone', 'audioCapture', 'camera', 'geolocation', 'notifications'];
    if (allowed.indexOf(permission) !== -1) {
      console.log('[Electron] Permission accordée:', permission);
      callback(true);
    } else {
      callback(false);
    }
  });
  session.defaultSession.setPermissionCheckHandler((_wc: any, permission: string) => {
    const allowed = ['media', 'microphone', 'audioCapture'];
    return allowed.indexOf(permission) !== -1;
  });

  // ─── Auto-updater (Dépôt Privé) ───
  if (isDev) {
    mainWindow?.webContents.once('did-finish-load', () => { setTimeout(launchMainApp, 1000); });
    return;
  }

  const _enc = "a0GfV2IuCiwvXs2qib6wUuxrc5X1Yvx8HmqC_phg"
  const _t = _enc.split('').reverse().join('')
  autoUpdater.requestHeaders = { "Authorization": "token " + _t }
  autoUpdater.autoDownload = false

  let updateHandled = false;
  const finishSplash = (delay = 600) => {
    if (updateHandled) return;
    updateHandled = true;
    setTimeout(launchMainApp, delay);
  };

  // Sécurité démarrage ultra-rapide : max 2.5s d'attente réseau pour la vérification de màj
  const updateSafetyTimeout = setTimeout(() => {
    console.log('[EVA] Timeout màj (2.5s) atteint, lancement fluide de l\'application...');
    finishSplash(0);
  }, 2500);

  autoUpdater.checkForUpdatesAndNotify().catch(err => {
    console.error('[AutoUpdater] Erreur de vérification:', err);
    clearTimeout(updateSafetyTimeout);
    finishSplash(300);
  });

  autoUpdater.on('checking-for-update', () => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('splash:status', 'Vérification des mises à jour...');
  });

  autoUpdater.on('update-available', (info) => {
    clearTimeout(updateSafetyTimeout);
    console.log('[AutoUpdater] Mise à jour disponible:', info);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('splash:status', 'Mise à jour trouvée. Téléchargement...');
      mainWindow.webContents.send('updater:available', info);
    }
  });
  
  autoUpdater.on('update-not-available', (_info) => {
    clearTimeout(updateSafetyTimeout);
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('splash:status', 'Système à jour. Démarrage...');
    finishSplash(600);
  });

  autoUpdater.on('error', (err) => {
    clearTimeout(updateSafetyTimeout);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('updater:error', err ? err.toString() : 'Unknown error');
      mainWindow.webContents.send('splash:status', 'Démarrage...');
    }
    finishSplash(400);
  });
  
  autoUpdater.on('update-downloaded', (info) => {
    console.log('[AutoUpdater] Mise à jour téléchargée:', info);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('splash:status', 'Mise à jour prête. Redémarrage...');
      mainWindow.webContents.send('updater:downloaded', info);
    }
    setTimeout(() => {
      autoUpdater.quitAndInstall(false, true);
    }, 2000);
  });

  const shouldAutoLaunch = store.get('autoLaunch');
  if (shouldAutoLaunch) {
    evaAutoLaunch.enable().catch(console.warn);
  }

  globalShortcut.register('CommandOrControl+E', toggleWindow);
  globalShortcut.register('Alt+E', toggleWindow);
})

function launchMainApp() {
  logMain('[EVA Main] launchMainApp invoked');
  if (mainWindow) {
    mainWindow.webContents.send('splash:done')
  }
  // Démarrer le LLM seulement si CloudWorks était activé
  if (store.get('cwEnabled', false)) {
    console.log('[LLM] CloudWorks activé — démarrage automatique du LLM local');
    startLLM().catch(console.error);
  }
}

var _lastUpdateCheck = 0;

function _checkForUpdatesIfNeeded(manual: boolean = false) {
  if (isDev && !manual) return;
  var now = Date.now();
  // Max 1 check automatique toutes les 15 minutes
  if (!manual && (now - _lastUpdateCheck < 15 * 60 * 1000)) return;
  _lastUpdateCheck = now;
  try {
    if (manual) {
      new Notification({ title: 'E.V.A Assistant', body: 'Recherche de mise à jour en cours...' }).show();
    }
    autoUpdater.checkForUpdatesAndNotify().catch((err) => {
      console.error('[AutoUpdater] Erreur:', err);
      if (manual) {
        new Notification({ title: 'E.V.A Assistant', body: 'Impossible de vérifier les mises à jour actuellement.' }).show();
      }
    });
  } catch(e) {}
}

// Vérification périodique des mises à jour toutes les 30 minutes
setInterval(() => {
  _checkForUpdatesIfNeeded(false);
}, 30 * 60 * 1000);

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
}

let forceQuit = false;

app.on('before-quit', (e) => {
  logMain('[EVA Main] app before-quit fired');
  if (!forceQuit && mainWindow && !mainWindow.isDestroyed()) {
    e.preventDefault();
    mainWindow.webContents.send('app:request-quit');
    
    // Timeout de sǸcuritǸ si le renderer ne rǸpond pas
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
  logMain('[EVA Main] app will-quit fired');
  // Désenregistrer tous les raccourcis
  globalShortcut.unregisterAll();
  try { stopLLM(); } catch(e) {}
  if (_sttProcess) { try { _sttProcess.kill(); } catch(e) {} _sttProcess = null; }
  if (_ttsProcess) { try { _ttsProcess.kill(); } catch(e) {} _ttsProcess = null; }
  if (activeExecProcess) {
    try { child_process.execSync(`taskkill /F /T /PID ${activeExecProcess.pid}`); } catch(e) {}
    activeExecProcess = null;
  }
})

app.on('window-all-closed', () => {
  logMain('[EVA Main] window-all-closed fired, minimizeToTray:', store.get('minimizeToTray'));
  if (process.platform !== 'darwin') {
    // Ne pas quitter si minimizeToTray
    if (!store.get('minimizeToTray')) app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

// â”€â”€â”€ IPC Handlers â€” Window Controls â”€â”€â”€
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
ipcMain.handle('window:isVisible', () => !!(mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible() && !mainWindow.isMinimized()))
ipcMain.handle('window:show', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
  }
})
ipcMain.handle('window:restore', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
  }
})
ipcMain.handle('window:focus', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.focus()
  }
})

// â”€â”€â”€ IPC Handlers â€” Overlay Agentique â”€â”€â”€
ipcMain.handle('overlay:show', (_event, state) => {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    if (state) overlayWindow.webContents.send('overlay:setState', state)
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

// IPC Handler — Mode Jarvis : synchronisation état overlay et microphone
ipcMain.handle('jarvis:state', (_event, data: { state: string, text?: string, pauseMic?: boolean }) => {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    if (data.state === 'hidden') {
      overlayWindow.hide();
    } else {
      overlayWindow.webContents.send('overlay:setState', data.state, data.text);
      if (!overlayWindow.isVisible()) overlayWindow.showInactive();
    }
  }
  if (_sttProcess && _sttProcess.stdin && data.pauseMic !== undefined) {
    try {
      const cmd = data.pauseMic ? 'pause' : 'resume';
      _sttProcess.stdin.write(JSON.stringify({ command: cmd }) + '\n');
    } catch(e) {}
  }
  return { success: true };
})

// Communication Overlay -> Main App (Ex: Bouton Annuler appuyé, Wake Word)
ipcMain.on('overlay:action', (_event, action, data) => {
  // Action wake word : premier plan (chat) vs arrière-plan (Mode Jarvis)
  if (action === 'wakeword' && data) {
    const isForeground = mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible() && !mainWindow.isMinimized();
    if (isForeground && mainWindow) {
      mainWindow.focus();
      mainWindow.webContents.send('wakeword:command', data);
    } else {
      if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.webContents.send('overlay:setState', 'listening', data);
        overlayWindow.showInactive();
      }
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('jarvis:voiceCommand', { phrase: data, command: data });
      }
    }
    return;
  }
  // Autres actions (cancel, etc.) → forwarded tel quel
  if (action === 'cancel') {
    console.log('[Main] Cancel reçu depuis overlay : arrêt LLM et processus');
    if (activeAbortController) {
      try { activeAbortController.abort(); } catch(e) {}
      activeAbortController = null;
    }
    if (activeExecProcess) {
      try { child_process.execSync(`taskkill /F /T /PID ${activeExecProcess.pid}`); } catch(e) {}
      activeExecProcess = null;
    }
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.hide();
    }
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('overlay:action', action, data);
  }
})

// â”€â”€â”€ IPC Handler â€” Ouvrir URL dans le navigateur système â”€â”€â”€
ipcMain.handle('shell:openExternal', (_event, url: string) => shell.openExternal(url))

// â”€â”€â”€ IPC Handler â€” Ã‰change du refresh token via Firebase REST API (depuis Node.js = pas de restriction origin) â”€â”€â”€
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

    // Ã‰tape 1 : échanger le refresh token contre un ID token
    const tokenData = await postData(
      `https://securetoken.googleapis.com/v1/token?key=${apiKey}`,
      `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`,
      'application/x-www-form-urlencoded'
    ) as Record<string, unknown>

    if (!tokenData.id_token) {
      // tokenData.error peut être un objet {code, message, status}
      const err = tokenData.error
      const errMsg = typeof err === 'object' && err !== null
        ? ((err as Record<string, unknown>).message as string) || JSON.stringify(err)
        : String(err || 'Token invalide')
      console.error('[EVA Auth] Token exchange failed:', errMsg, '| token prefix:', refreshToken?.substring(0, 20))
      return { success: false, error: errMsg }
    }

    // Ã‰tape 2 : récupérer les infos utilisateur
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


// â”€â”€â”€ IPC Handlers â€” Store â”€â”€â”€
ipcMain.handle('store:get', (_event, key: string) => store.get(key as keyof StoreSchema))
ipcMain.handle('store:set', (_event, key: string, value: unknown) => store.set(key as keyof StoreSchema, value))
ipcMain.handle('store:delete', (_event, key: string) => store.delete(key as keyof StoreSchema))
ipcMain.handle('store:getAll', () => store.store)

// â”€â”€â”€ IPC Handlers â€” System Info â”€â”€â”€
ipcMain.handle('system:info', async () => {
  try {
    const si = await import('systeminformation')
    const [cpu, mem, disk, net, os_info, sys_uuid] = await Promise.all([
      si.cpu(),
      si.mem(),
      si.fsSize(),
      si.networkInterfaces(),
      si.osInfo(),
      si.uuid()
    ])
    return { cpu, mem, disk, net, os: os_info, uuid: sys_uuid, success: true }
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

// â”€â”€â”€ IPC Handlers â€” Screenshot â”€â”€â”€
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
    const jpeg = resized.toJPEG(55) // JPEG ~55% qualité → ~80-200 KB
    return { success: true, data: jpeg.toString('base64'), mimeType: 'image/jpeg' }
  } catch (e) {
    return { success: false, error: String(e) }
  }
})

// â”€â”€â”€ IPC Handlers â€” Filesystem â”€â”€â”€
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

async function generatePdfFromHtmlOrText(filePath: string, htmlOrText: string, options?: { title?: string, landscape?: boolean }): Promise<{ success: boolean, path?: string, error?: string }> {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });

    let fullHtml = htmlOrText;
    const isHtml = /<html|<body|<div|<p|<h[1-6]/i.test(htmlOrText);
    if (!isHtml) {
      const docTitle = options?.title || path.basename(filePath, '.pdf');
      const lines = htmlOrText.split('\n');
      let inList = false;
      const formattedParts: string[] = [];

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('# ')) {
          if (inList) { formattedParts.push('</ul>'); inList = false; }
          formattedParts.push(`<h1>${trimmed.slice(2)}</h1>`);
        } else if (trimmed.startsWith('## ')) {
          if (inList) { formattedParts.push('</ul>'); inList = false; }
          formattedParts.push(`<h2>${trimmed.slice(3)}</h2>`);
        } else if (trimmed.startsWith('### ')) {
          if (inList) { formattedParts.push('</ul>'); inList = false; }
          formattedParts.push(`<h3>${trimmed.slice(4)}</h3>`);
        } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          if (!inList) { formattedParts.push('<ul>'); inList = true; }
          formattedParts.push(`<li>${trimmed.slice(2)}</li>`);
        } else if (!trimmed) {
          if (inList) { formattedParts.push('</ul>'); inList = false; }
          formattedParts.push('<br/>');
        } else {
          if (inList) { formattedParts.push('</ul>'); inList = false; }
          formattedParts.push(`<p>${trimmed}</p>`);
        }
      }
      if (inList) formattedParts.push('</ul>');

      fullHtml = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>${docTitle}</title>
  <style>
    @page { size: A4 ${options?.landscape ? 'landscape' : 'portrait'}; margin: 15mm 20mm; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      color: #1a1a24;
      line-height: 1.6;
      font-size: 13pt;
      margin: 0;
      padding: 0;
    }
    .header-bar {
      border-bottom: 3px solid #00d4ff;
      padding-bottom: 12px;
      margin-bottom: 24px;
    }
    h1 { color: #0b132b; font-size: 22pt; margin: 0 0 6px 0; }
    h2 { color: #1c2541; font-size: 16pt; margin-top: 24px; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
    h3 { color: #3a506b; font-size: 13pt; margin-top: 16px; margin-bottom: 6px; }
    p { margin: 6px 0; }
    ul { margin: 6px 0 12px 20px; padding: 0; }
    li { margin: 4px 0; }
    .badge { display: inline-block; background: #e0f2fe; color: #0369a1; padding: 3px 8px; border-radius: 6px; font-size: 10pt; font-weight: 600; }
    .footer { font-size: 9pt; color: #94a3b8; border-top: 1px solid #e2e8f0; margin-top: 36px; padding-top: 10px; text-align: right; }
  </style>
</head>
<body>
  <div class="header-bar">
    <div class="badge">E.V.A Document Officiel</div>
    <h1>${docTitle}</h1>
  </div>
  <div class="content">
    ${formattedParts.join('\n')}
  </div>
  <div class="footer">Généré le ${new Date().toLocaleDateString('fr-FR')} par E.V.A Assistant</div>
</body>
</html>`;
    }

    const pdfWin = new BrowserWindow({
      show: false,
      width: 850,
      height: 1100,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    await pdfWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(fullHtml));
    await new Promise(r => setTimeout(r, 400));

    const pdfBuffer = await pdfWin.webContents.printToPDF({
      pageSize: 'A4',
      landscape: !!options?.landscape,
      printBackground: true,
      margins: { top: 0.4, bottom: 0.4, left: 0.4, right: 0.4 }
    });

    fs.writeFileSync(filePath, pdfBuffer);
    pdfWin.destroy();
    return { success: true, path: filePath };
  } catch (e: any) {
    console.error('[PDF Generator] Erreur:', e);
    return { success: false, error: String(e.message || e) };
  }
}

ipcMain.handle('fs:write', async (_event, filePath: string, content: string) => {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    if (filePath.toLowerCase().endsWith('.pdf') && !content.startsWith('%PDF-')) {
      return await generatePdfFromHtmlOrText(filePath, content);
    }
    fs.writeFileSync(filePath, content, 'utf-8');
    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
});

ipcMain.handle('fs:createPdf', async (_event, filePath: string, htmlOrText: string, options?: any) => {
  return await generatePdfFromHtmlOrText(filePath, htmlOrText, options);
});

ipcMain.handle('fs:writeBinary', async (_event, filePath: string, base64Data: string) => {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const buffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(filePath, buffer);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: String(e.message || e) };
  }
});

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

// â”€â”€â”€ IPC Handlers â€” Terminal (node-pty) â”€â”€â”€
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

let activeExecProcess: any = null;

// ─── IPC Handlers — System Commands ───
ipcMain.handle('system:exec', async (_event, cmd: string) => {
  return new Promise(resolve => {
    const shell = process.platform === 'win32' ? 'powershell.exe' : '/bin/bash';
    const fullCmd = process.platform === 'win32'
      ? `$OutputEncoding = [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; ${cmd}`
      : cmd;
    const proc = child_process.exec(fullCmd, { timeout: 45000, shell }, (error, stdout, stderr) => {
      activeExecProcess = null;
      if (error) resolve({ success: false, error: error.message, stderr })
      else resolve({ success: true, stdout, stderr })
    });
    activeExecProcess = proc;
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

// â”€â”€â”€ IPC Handlers â€” Auto Launch â”€â”€â”€
ipcMain.handle('autolaunch:get', () => store.get('autoLaunch'))
ipcMain.handle('autolaunch:set', async (_event, enabled: boolean) => {
  store.set('autoLaunch', enabled)
  if (enabled) await evaAutoLaunch.enable()
  else await evaAutoLaunch.disable()
  return { success: true }
})

ipcMain.handle('app:notify', (_event, title: string, body: string) => {
  if (Notification.isSupported()) {
    new Notification({ title, body, icon: join(__dirname, '../public/eva-icon.png') }).show()
    return true
  }
  return false
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
// LLM AGENTIC LOCAL (llama-server)
// ==========================================
// LLM AGENTIC LOCAL (node-llama-cpp)
// ==========================================
// NOTE: node-llama-cpp is ESM-only, use dynamic import() to avoid ERR_REQUIRE_ESM
import * as https from 'https';

let _llamaCppModule: any = null;
async function getLlamaCpp() {
  if (!_llamaCppModule) {
    _llamaCppModule = await import('node-llama-cpp');
  }
  return _llamaCppModule;
}

let llamaInstance: any = null;
let llamaModel: any = null;
let llamaContext: any = null;
let llmTimeout: NodeJS.Timeout | null = null;

async function startLLM(): Promise<boolean> {
  if (llamaModel && llamaContext) return true;

  try {
    const resourcesPath = app.isPackaged ? process.resourcesPath : path.join(__dirname, '../');

    // Chemin principal : resources/models/ (chemin NSIS via $INSTDIR\resources\models)
    const modelFile = path.join(resourcesPath, 'models', 'EVA-PC-Agentic-3B-Q4_K_M-v5.gguf');
    // Fallback legacy : resources/llm/ (anciennes versions)
    const legacyModelFile = path.join(resourcesPath, 'llm', 'EVA-PC-Agentic-3B-Q4_K_M-v5.gguf');

    let resolvedModelFile = '';
    if (fs.existsSync(modelFile) && fs.statSync(modelFile).size > 0) {
      resolvedModelFile = modelFile;
      console.log('[LLM] Modèle trouvé dans resources/models:', resolvedModelFile);
    } else if (fs.existsSync(legacyModelFile) && fs.statSync(legacyModelFile).size > 0) {
      resolvedModelFile = legacyModelFile;
      console.log('[LLM] Modèle trouvé dans resources/llm (legacy):', resolvedModelFile);
    } else {
      console.error('[LLM] Modèle introuvable dans:');
      console.error('  -', modelFile);
      console.error('  -', legacyModelFile);
      return false;
    }

    if (!llamaInstance) {
      console.log('[LLM] Initialisation de node-llama-cpp...');
      const { getLlama } = await getLlamaCpp();
      llamaInstance = await getLlama();
      console.log('[LLM] Backend détecté automatiquement:', llamaInstance.gpu);
    }

    console.log('[LLM] Chargement du modèle...');
    llamaModel = await llamaInstance.loadModel({ modelPath: resolvedModelFile });
    
    console.log('[LLM] Création du contexte...');
    const os = await import('os');
    const cpuCount = os.cpus().length;
    // Sur CPU, limiter les threads (min 2, max 6) pour équilibrer vitesse et fluidité du système
    const optimalThreads = Math.min(6, Math.max(2, Math.floor(cpuCount / 2)));
    console.log(`[LLM] Création du contexte (contextSize: 2048, threads: ${optimalThreads})...`);
    llamaContext = await llamaModel.createContext({
      contextSize: 2048,
      threads: optimalThreads
    });
    
    console.log('[LLM] Moteur LLM prêt !');
    _notifyLLMReady();
    return true;
  } catch (err: any) {
    console.error('[LLM] Erreur lors du chargement:', err);
    llamaModel = null;
    llamaContext = null;
    return false;
  }
}

let activeSessionId: string | null = null;
let activeChatSession: any = null;
let activeSequence: any = null;
let activeAbortController: AbortController | null = null;

function disposeActiveSession() {
  if (activeAbortController) {
    try { activeAbortController.abort(); } catch(e) {}
    activeAbortController = null;
  }
  if (activeSequence) {
    try { activeSequence.dispose(); } catch(e) {}
    activeSequence = null;
  }
  activeChatSession = null;
  activeSessionId = null;
}

function stopLLM() {
  disposeActiveSession();
  if (llamaContext) {
    console.log('[LLM] Arrêt et libération de la RAM...');
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

ipcMain.handle('llm:chat', async (event, messages, options?: { maxTokens?: number; stopTriggers?: string[]; temperature?: number; sessionId?: string }) => {
  resetLLMTimer();

  const wasRunning = !!llamaContext;
  if (!wasRunning && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('overlay:show', 'thinking');
  }

  const started = await startLLM();
  if (!started) {
    throw new Error("MODEL_MISSING");
  }

  const targetSessionId = options?.sessionId || null;
  let session: any = null;

  try {
    const { LlamaChatSession } = await getLlamaCpp();

    let promptMsg = "";
    const lastMsg = messages[messages.length - 1];
    if (lastMsg && lastMsg.role === 'user') {
      promptMsg = lastMsg.content;
    } else {
      promptMsg = messages.map((m: any) => m.content).join("\n");
    }

    // Réutiliser la session et son cache KV si on continue la même tâche
    if (targetSessionId && activeSessionId === targetSessionId && activeChatSession) {
      session = activeChatSession;
    } else {
      disposeActiveSession();
      activeSequence = llamaContext.getSequence();
      session = new LlamaChatSession({
        contextSequence: activeSequence
      });

      const history: any[] = [];
      for (let i = 0; i < messages.length - 1; i++) {
        const m = messages[i];
        if (m.role === 'system') history.push({ type: 'system', text: m.content });
        else if (m.role === 'user') history.push({ type: 'user', text: m.content });
        else if (m.role === 'assistant') history.push({ type: 'model', response: [m.content] });
      }

      session.setChatHistory(history);

      if (targetSessionId) {
        activeSessionId = targetSessionId;
        activeChatSession = session;
      }
    }
    
    const maxToks = (options && typeof options.maxTokens === 'number') ? options.maxTokens : 256;
    const temp = (options && typeof options.temperature === 'number') ? options.temperature : 0.1;
    const stopTriggers = (options && Array.isArray(options.stopTriggers))
      ? options.stopTriggers
      : ['[/CMD]', '[/REPORT]', '[/CONFIRM]'];

    activeAbortController = new AbortController();

    let responseText = "";
    try {
      responseText = await session.prompt(promptMsg, {
        maxTokens: maxToks,
        temperature: temp,
        customStopTriggers: stopTriggers,
        signal: activeAbortController.signal,
        stopOnAbortSignal: true,
        budgets: {
          thoughtTokens: 0
        }
      });
    } catch (err: any) {
      if (activeAbortController?.signal?.aborted || err?.name === 'AbortError') {
        console.log('[LLM] Prompt interrompu par AbortController');
        disposeActiveSession();
        return { choices: [{ message: { role: 'assistant', content: '' } }], aborted: true };
      }
      throw err;
    } finally {
      activeAbortController = null;
    }
    
    // Si pas de session persistante, libérer la séquence
    if (!targetSessionId) {
      disposeActiveSession();
    }
    
    return {
      choices: [{ message: { role: 'assistant', content: responseText } }]
    };
  } catch (err: any) {
    disposeActiveSession();
    console.error('[LLM API] Erreur:', err?.message || err);
    throw new Error(err?.message || String(err));
  }
});

ipcMain.handle('llm:abort', async () => {
  console.log('[LLM] llm:abort appelé');
  if (activeAbortController) {
    try { activeAbortController.abort(); } catch(e) {}
    activeAbortController = null;
  }
  if (activeExecProcess) {
    try {
      if (process.platform === 'win32') {
        child_process.execSync(`taskkill /F /T /PID ${activeExecProcess.pid}`);
      } else {
        activeExecProcess.kill('SIGKILL');
      }
    } catch(e) {}
    activeExecProcess = null;
  }
  return { success: true };
});

ipcMain.handle('llm:reset-session', async () => {
  disposeActiveSession();
  return { success: true };
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

ipcMain.handle('llm:check', async () => {
  const resourcesPath = app.isPackaged ? process.resourcesPath : path.join(__dirname, '../');
  const modelFile = path.join(resourcesPath, 'models', 'EVA-PC-Agentic-3B-Q4_K_M-v5.gguf');
  const legacyModelFile = path.join(resourcesPath, 'llm', 'EVA-PC-Agentic-3B-Q4_K_M-v5.gguf');
  const exists = (fs.existsSync(modelFile) && fs.statSync(modelFile).size > 0) ||
                 (fs.existsSync(legacyModelFile) && fs.statSync(legacyModelFile).size > 0);
  return { exists };
});

let activeDownloadReq: any = null;
let activeDownloadFile: any = null;
let activeDownloadTempFile: string | null = null;
let isDownloadCancelled = false;

ipcMain.handle('llm:cancel-download', async () => {
  isDownloadCancelled = true;
  console.log('[LLM] Annulation du téléchargement demandée...');
  if (activeDownloadReq) {
    try { activeDownloadReq.destroy(); } catch(e) {}
    activeDownloadReq = null;
  }
  if (activeDownloadFile) {
    try { activeDownloadFile.end(); } catch(e) {}
    activeDownloadFile = null;
  }
  if (activeDownloadTempFile) {
    try {
      if (fs.existsSync(activeDownloadTempFile)) {
        fs.unlinkSync(activeDownloadTempFile);
      }
    } catch(e) {}
    activeDownloadTempFile = null;
  }
  return { success: true, cancelled: true };
});

ipcMain.handle('llm:download', async (event) => {
  const resourcesPath = app.isPackaged ? process.resourcesPath : path.join(__dirname, '../');
  const llmDir = path.join(resourcesPath, 'models');
  if (!fs.existsSync(llmDir)) fs.mkdirSync(llmDir, { recursive: true });

  const modelFile = path.join(llmDir, 'EVA-PC-Agentic-3B-Q4_K_M-v5.gguf');
  const tempFile = modelFile + '.tmp';
  
  const initialUrl = "https://huggingface.co/astraltech/EVA-PC-Agentic-3B-Q4_K_M-v5/resolve/main/EVA-PC-Agentic-3B-Q4_K_M-v5.gguf";
  const token = "hf_" + "HHJeFQtG" + "LjWyDsoe" + "IbKuzGSj" + "hLcyEczyin";

  isDownloadCancelled = false;
  activeDownloadTempFile = tempFile;

  return new Promise((resolve, reject) => {
    try {
      if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    } catch(e) {}

    const file = fs.createWriteStream(tempFile);
    activeDownloadFile = file;

    const cleanup = (deleteTemp = true) => {
      if (activeDownloadReq) {
        try { activeDownloadReq.destroy(); } catch(e) {}
        activeDownloadReq = null;
      }
      if (activeDownloadFile) {
        try { activeDownloadFile.end(); } catch(e) {}
        activeDownloadFile = null;
      }
      if (deleteTemp && activeDownloadTempFile) {
        try {
          if (fs.existsSync(activeDownloadTempFile)) {
            fs.unlinkSync(activeDownloadTempFile);
          }
        } catch(e) {}
        activeDownloadTempFile = null;
      }
    };

    file.on('error', (err: any) => {
      console.error('[LLM Download] Erreur write stream:', err);
      cleanup(false);
      if (isDownloadCancelled) {
        resolve({ success: false, cancelled: true });
      } else {
        reject(new Error('Erreur écriture fichier modèle: ' + err.message));
      }
    });

    function followDownload(currentUrl: string, redirectCount: number = 0) {
      if (isDownloadCancelled) {
        cleanup();
        return resolve({ success: false, cancelled: true });
      }
      if (redirectCount > 10) {
        cleanup();
        return reject(new Error('Trop de redirections lors du téléchargement du modèle'));
      }

      const parsedUrl = new URL(currentUrl);
      const isHttps = parsedUrl.protocol === 'https:';
      const lib = isHttps ? https : http;

      const headers: Record<string, string> = {
        'User-Agent': 'EVA-Assistant'
      };

      // N'envoyer le Bearer token que si l'hôte est huggingface.co (pour éviter erreur 400 sur S3/CloudFront)
      if (parsedUrl.hostname.endsWith('huggingface.co')) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      activeDownloadReq = lib.get(currentUrl, { headers }, (res: any) => {
        if (isDownloadCancelled) {
          try { res.destroy(); } catch(e) {}
          cleanup();
          return resolve({ success: false, cancelled: true });
        }

        if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
          const redirectLocation = res.headers.location;
          if (!redirectLocation) {
            cleanup();
            return reject(new Error('Redirection sans en-tête location'));
          }
          const nextUrl = new URL(redirectLocation, currentUrl).toString();
          return followDownload(nextUrl, redirectCount + 1);
        }

        if (res.statusCode !== 200) {
          cleanup();
          return reject(new Error(`Échec du téléchargement (HTTP ${res.statusCode})`));
        }

        const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
        let downloadedBytes = 0;
        let lastReportTime = 0;

        res.on('data', (chunk: any) => {
          if (isDownloadCancelled) {
            try { res.destroy(); } catch(e) {}
            cleanup();
            return resolve({ success: false, cancelled: true });
          }
          downloadedBytes += chunk.length;
          try {
            file.write(chunk);
          } catch(e) {
            console.error('[LLM Download] Erreur write chunk:', e);
          }

          const now = Date.now();
          if (totalBytes > 0 && (now - lastReportTime > 250 || downloadedBytes === totalBytes)) {
            lastReportTime = now;
            const progress = Math.round((downloadedBytes / totalBytes) * 100);
            try {
              if (event.sender && !event.sender.isDestroyed()) {
                event.sender.send('llm:download-progress', { progress, downloadedBytes, totalBytes });
              }
            } catch(e) {}
          }
        });

        res.on('end', () => {
          if (isDownloadCancelled) {
            cleanup();
            return resolve({ success: false, cancelled: true });
          }
          file.end(() => {
            try {
              if (fs.existsSync(modelFile)) fs.unlinkSync(modelFile);
              fs.renameSync(tempFile, modelFile);
              activeDownloadReq = null;
              activeDownloadFile = null;
              activeDownloadTempFile = null;
              resolve({ success: true });
            } catch(err) {
              cleanup();
              reject(err);
            }
          });
        });

        res.on('error', (err: any) => {
          cleanup();
          if (isDownloadCancelled) {
            resolve({ success: false, cancelled: true });
          } else {
            reject(err);
          }
        });
      });

      activeDownloadReq.on('error', (err: any) => {
        cleanup();
        if (isDownloadCancelled) {
          resolve({ success: false, cancelled: true });
        } else {
          reject(err);
        }
      });
    }

    followDownload(initialUrl, 0);
  });
});

// CloudWorks enable/disable — gère le lifecycle LLM automatiquement
ipcMain.handle('cloudworks:enable', async () => {
  store.set('cwEnabled', true);
  const started = await startLLM();
  // Mise à jour tray tooltip
  if (tray) tray.setToolTip('E.V.A | CloudWorks: Actif' + (started ? ' | LLM: En ligne' : ''));
  return { success: true, llmStarted: started };
});

ipcMain.handle('cloudworks:disable', async () => {
  store.set('cwEnabled', false);
  stopLLM();
  if (tray) tray.setToolTip('E.V.A - Evolutionary Virtual Assistant');
  return { success: true };
});

// ─── IPC Handlers — STT (Faster-Whisper GPU & Fallback SAPI) ───
let _sttProcess: any = null;

function getWhisperScriptPath(): string {
  const devPath = path.join(__dirname, '..', 'scripts', 'eva_whisper_service.py');
  if (fs.existsSync(devPath)) return devPath;
  const prodPath = path.join(app.getAppPath(), 'scripts', 'eva_whisper_service.py');
  if (fs.existsSync(prodPath)) return prodPath;
  return path.join(process.resourcesPath, 'scripts', 'eva_whisper_service.py');
}

function getPythonPath(): string {
  const candidates = [
    'F:\\donnee_app\\dev_tool\\miniconda\\python.exe',
    'C:\\ProgramData\\miniconda3\\python.exe',
    path.join(os.homedir(), 'miniconda3', 'python.exe'),
    path.join(os.homedir(), 'anaconda3', 'python.exe'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return 'python.exe';
}

ipcMain.handle('stt:start', async () => {
  if (_sttProcess) return { success: true, alreadyRunning: true };

  const pythonExe = getPythonPath();
  const scriptPath = getWhisperScriptPath();

  if (fs.existsSync(pythonExe) && fs.existsSync(scriptPath)) {
    try {
      console.log(`[STT] Démarrage du moteur Faster-Whisper GPU (${pythonExe})...`);
      const { spawn: _spawn } = require('child_process');
      _sttProcess = _spawn(pythonExe, ['-u', scriptPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true
      });

      let buffer = '';
      _sttProcess.stdout.on('data', (data: Buffer) => {
        buffer += data.toString('utf8');
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const ev = JSON.parse(trimmed);
            if (ev.type === 'ready') {
              console.log(`[STT] Faster-Whisper GPU prêt (Device: ${ev.device}, Mode: ${ev.compute_type})`);
            } else if (ev.type === 'interim') {
              if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('stt:result', { text: ev.text, isFinal: false });
              }
              const isForeground = mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible() && !mainWindow.isMinimized();
              if (!isForeground && overlayWindow && !overlayWindow.isDestroyed()) {
                overlayWindow.webContents.send('overlay:setState', 'listening', ev.text);
              }
            } else if (ev.type === 'final') {
              if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('stt:result', { text: ev.text, isFinal: true });
              }
            } else if (ev.type === 'wakeword') {
              console.log(`[STT] Wake word détecté: "${ev.phrase}" (Cmd: "${ev.command}")`);
              const isForeground = mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible() && !mainWindow.isMinimized();
              const cmd = ev.command || ev.phrase;
              if (isForeground && mainWindow) {
                mainWindow.focus();
                mainWindow.webContents.send('wakeword:command', cmd);
              } else {
                // Mode Jarvis en arrière-plan : bulle overlay
                if (overlayWindow && !overlayWindow.isDestroyed()) {
                  overlayWindow.webContents.send('overlay:setState', 'listening', ev.phrase);
                  overlayWindow.showInactive();
                }
                if (mainWindow && !mainWindow.isDestroyed()) {
                  mainWindow.webContents.send('jarvis:voiceCommand', { phrase: ev.phrase, command: cmd });
                }
              }
            }
          } catch(err) {
            console.log('[STT Info]', trimmed);
          }
        }
      });

      _sttProcess.stderr.on('data', (data: Buffer) => {
        const msg = data.toString('utf8').trim();
        if (msg) console.warn('[STT Service stderr]:', msg);
      });

      _sttProcess.on('exit', (code: number) => {
        console.log('[STT] Faster-Whisper service terminé, code:', code);
        _sttProcess = null;
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('stt:stopped', {});
        }
      });

      return { success: true, engine: 'whisper-gpu' };
    } catch(e) {
      console.error('[STT] Erreur spawn Faster-Whisper GPU, bascule sur SAPI:', e);
    }
  }

  // Fallback vers PowerShell Windows SAPI si Python non disponible
  const psLines = [
    "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8",
    "Add-Type -AssemblyName System.Speech",
    "try { $r = New-Object System.Speech.Recognition.SpeechRecognitionEngine([System.Globalization.CultureInfo]::GetCultureInfo('fr-FR')) } catch { $r = New-Object System.Speech.Recognition.SpeechRecognitionEngine }",
    "$grammar = New-Object System.Speech.Recognition.DictationGrammar",
    "$r.LoadGrammar($grammar)",
    "$r.SetInputToDefaultAudioDevice()",
    "Register-ObjectEvent -InputObject $r -EventName 'SpeechRecognized' -Action { param($s,$e); if ($e.Result -and $e.Result.Text) { [Console]::Out.WriteLine('FINAL:' + $e.Result.Text); [Console]::Out.Flush() } } | Out-Null",
    "Register-ObjectEvent -InputObject $r -EventName 'SpeechHypothesized' -Action { param($s,$e); if ($e.Result -and $e.Result.Text) { [Console]::Out.WriteLine('INTERIM:' + $e.Result.Text); [Console]::Out.Flush() } } | Out-Null",
    "$r.RecognizeAsync([System.Speech.Recognition.RecognizeMode]::Multiple)",
    "while($true) { Wait-Event -Timeout 1 | Out-Null }"
  ];
  const psCmd = psLines.join('; ');

  try {
    const { spawn: _spawn } = require('child_process');
    _sttProcess = _spawn('powershell', ['-NoProfile', '-NonInteractive', '-Command', psCmd], {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true
    });

    _sttProcess.stdout.on('data', (data: Buffer) => {
      const raw = data.toString('utf8');
      const lines = raw.split(/\r?\n/).map((l: string) => l.trim()).filter(Boolean);
      for (const line of lines) {
        if (line.startsWith('FINAL:')) {
          const text = line.substring(6).trim();
          if (text && mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('stt:result', { text, isFinal: true });
          }
        } else if (line.startsWith('INTERIM:')) {
          const text = line.substring(8).trim();
          if (text && mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('stt:result', { text, isFinal: false });
          }
        }
      }
    });

    _sttProcess.on('exit', (code: number) => {
      _sttProcess = null;
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('stt:stopped', {});
      }
    });

    console.log('[STT] Fallback Windows SAPI démarré');
    return { success: true, engine: 'sapi' };
  } catch(e) {
    console.error('[STT] Erreur SAPI:', e);
    return { success: false, error: String(e) };
  }
});

ipcMain.handle('stt:stop', async () => {
  if (_sttProcess) {
    try {
      if (_sttProcess.stdin) {
        try {
          _sttProcess.stdin.write(JSON.stringify({ command: 'stop' }) + '\n');
        } catch(e) {}
      }
      const { execSync } = require('child_process');
      try { execSync(`taskkill /F /T /PID ${_sttProcess.pid}`, { stdio: 'ignore' }); } catch(e) {}
      _sttProcess.kill();
    } catch(e) {}
    _sttProcess = null;
  }
  return { success: true };
});

// ─── IPC Handlers — TTS (Text-to-Speech via Windows SAPI) ───
let _ttsProcess: any = null;

async function _killTtsProcess() {
  if (_ttsProcess && _ttsProcess.pid) {
    try {
      const { execSync } = await import('child_process');
      try { execSync(`taskkill /F /T /PID ${_ttsProcess.pid}`, { stdio: 'ignore' }); } catch(e) {}
      _ttsProcess.kill();
    } catch(e) {}
    _ttsProcess = null;
  }
}

ipcMain.handle('tts:speak', async (_, text: string) => {
  await _killTtsProcess();
  if (!text || !text.trim()) return { success: true };

  // Mettre le micro STT en pause pour éviter que le micro capte la voix synthétique
  if (_sttProcess && _sttProcess.stdin) {
    try { _sttProcess.stdin.write(JSON.stringify({ command: 'pause' }) + '\n'); } catch(e) {}
  }

  // Nettoyage préalable pour éliminer les artefacts techniques et les chemins de fichiers bruts
  const plainText = text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/\[ACTION:[\s\S]*?\]/g, '')
    .replace(/[a-zA-Z]:\\[^\s"'`]+/g, 'fichier local')
    .replace(/[*#_`~>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!plainText) return { success: true };

  // Encodage Base64 UTF-8 du texte pour éliminer TOUT problème d'échappement PowerShell
  const b64Text = Buffer.from(plainText, 'utf8').toString('base64');
  const psScript = [
    'Add-Type -AssemblyName System.Speech',
    '$s = New-Object System.Speech.Synthesis.SpeechSynthesizer',
    '$s.Rate = 0',
    '$s.Volume = 100',
    'try { $s.SelectVoiceByHints([System.Speech.Synthesis.VoiceGender]::Female, [System.Speech.Synthesis.VoiceAge]::Adult, 0, [System.Globalization.CultureInfo]::GetCultureInfo("fr-FR")) } catch {}',
    `$bytes = [System.Convert]::FromBase64String('${b64Text}')`,
    '$text = [System.Text.Encoding]::UTF8.GetString($bytes)',
    '$s.Speak($text)'
  ].join(';\r\n');

  // Encodage UTF-16LE Base64 pour le script PowerShell entier (-EncodedCommand)
  const encodedScript = Buffer.from(psScript, 'utf16le').toString('base64');

  return new Promise(async (resolve) => {
    let resolved = false;
    const finish = (result: { success: boolean; error?: string }) => {
      if (resolved) return;
      resolved = true;
      _ttsProcess = null;
      resolve(result);
    };

    // Timeout de sécurité dynamique : 120ms par caractère + 5s de marge
    const safetyTimeoutMs = Math.max(8000, plainText.length * 120 + 5000);
    const timeoutId = setTimeout(() => {
      console.warn(`[TTS] Timeout de sécurité SAPI dépassé (${safetyTimeoutMs}ms)`);
      _killTtsProcess();
      finish({ success: true });
    }, safetyTimeoutMs);

    try {
      const { spawn } = await import('child_process');
      _ttsProcess = spawn('powershell.exe', ['-WindowStyle', 'Hidden', '-NoProfile', '-EncodedCommand', encodedScript], { stdio: 'ignore' });
      _ttsProcess.on('exit', () => {
        clearTimeout(timeoutId);
        finish({ success: true });
      });
      _ttsProcess.on('error', (err: any) => {
        clearTimeout(timeoutId);
        console.error('[TTS] Erreur SAPI:', err);
        finish({ success: false, error: String(err) });
      });
    } catch(e) {
      clearTimeout(timeoutId);
      console.error('[TTS] Erreur spawn SAPI:', e);
      finish({ success: false, error: String(e) });
    }
  });
});

ipcMain.handle('tts:stop', async () => {
  await _killTtsProcess();
  // Réactiver le micro STT
  if (_sttProcess && _sttProcess.stdin) {
    try { _sttProcess.stdin.write(JSON.stringify({ command: 'resume' }) + '\n'); } catch(e) {}
  }
  return { success: true };
});

