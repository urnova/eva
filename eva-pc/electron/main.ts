import { installCWRuntime } from './cw-runtime'
import { app, BrowserWindow, ipcMain, dialog, shell, Tray, Menu, nativeImage, globalShortcut , Notification } from 'electron'
// Optimisations GPU + transparence Windows 11 fiable pour l'overlay
app.commandLine.appendSwitch('enable-transparent-visuals');
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
logMain('[EVA Main] Process started, PID:', process.pid, 'isPackaged:', app.isPackaged, 'version:', app.getVersion(), 'exe:', app.getPath('exe'));

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

      let decodedPath: string;
      try { decodedPath = decodeURIComponent(urlPath); } catch (_) { res.writeHead(400); res.end(); return; }
      const webRoot = path.resolve(__dirname, '../dist');
      let filePath = path.resolve(webRoot, '.' + decodedPath);
      if (!filePath.startsWith(webRoot + path.sep)) { res.writeHead(403); res.end(); return; }
      
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
              'X-Content-Type-Options': 'nosniff',
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

  // ─── Visibilité temps réel (Premier plan vs Arrière-plan) ───
  const notifyWindowVisibility = (visible: boolean) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('window:visibility', visible)
    }
  }

  mainWindow.webContents.on('did-finish-load', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    const isVis = !!(mainWindow.isVisible() && !mainWindow.isMinimized())
    notifyWindowVisibility(isVis)
    if (_pendingUpdateDownloaded) {
      mainWindow.webContents.send('updater:downloaded', _pendingUpdateDownloaded)
    } else if (_pendingUpdateInfo) {
      mainWindow.webContents.send('updater:available', _pendingUpdateInfo)
    }
  })

  // ─── Minimize to tray & Visibilité ───
  mainWindow.on('show', () => {
    notifyWindowVisibility(true)
    if (!isDev) {
      _checkForUpdatesIfNeeded(false);
    }
  })
  mainWindow.on('hide', () => notifyWindowVisibility(false))
  mainWindow.on('minimize', () => notifyWindowVisibility(false))
  mainWindow.on('restore', () => notifyWindowVisibility(true))
  mainWindow.on('focus', () => {
    const isVis = !!(mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible() && !mainWindow.isMinimized())
    notifyWindowVisibility(isVis)
  })
  mainWindow.on('maximize', () => notifyWindowVisibility(true))
  mainWindow.on('unmaximize', () => notifyWindowVisibility(true))
  mainWindow.on('close', (event) => {
    if (store.get('minimizeToTray') && !app.isQuitting) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })

  mainWindow.on('closed', () => { mainWindow = null })
}

let _lastOverlayState: { state: string; text?: string; data?: any } | null = null;
let _overlayReady = false;
let _overlayCancelledUntil = 0;
let _pendingUpdateInfo: any = null;
let _pendingUpdateDownloaded: any = null;
let _isDownloadingUpdate = false;
let _isInstallingUpdate = false;

function positionOverlayWindow() {
  if (!overlayWindow || overlayWindow.isDestroyed()) return
  const { screen } = require('electron')
  const primaryDisplay = screen.getPrimaryDisplay()
  const wa = primaryDisplay.workArea || { x: 0, y: 0, width: primaryDisplay.workAreaSize.width, height: primaryDisplay.workAreaSize.height }
  const overlayWidth = 420
  const overlayHeight = 118
  overlayWindow.setBounds({
    width: overlayWidth,
    height: overlayHeight,
    x: Math.round(wa.x + wa.width - overlayWidth - 16),
    y: Math.round(wa.y + 16)
  })
}

function createOverlayWindow() {
  const { screen } = require('electron')
  const primaryDisplay = screen.getPrimaryDisplay()
  const wa = primaryDisplay.workArea || { x: 0, y: 0, width: primaryDisplay.workAreaSize.width, height: primaryDisplay.workAreaSize.height }

  const overlayWidth = 420
  const overlayHeight = 118
  _overlayReady = false

  overlayWindow = new BrowserWindow({
    width: overlayWidth,
    height: overlayHeight,
    x: Math.round(wa.x + wa.width - overlayWidth - 16),
    y: Math.round(wa.y + 16),
    transparent: true,
    frame: false,
    thickFrame: false,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    focusable: false,
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
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  overlayWindow.webContents.on('did-finish-load', () => {
    _overlayReady = true
    if (_lastOverlayState && overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.webContents.send('overlay:setState', _lastOverlayState.state, _lastOverlayState.text, _lastOverlayState.data)
    }
  })

  if (isDev) {
    overlayWindow.loadFile(join(__dirname, '../web/overlay.html'))
  } else {
    overlayWindow.loadFile(join(__dirname, '../dist/overlay.html'))
  }

  overlayWindow.on('closed', () => { overlayWindow = null; _overlayReady = false })
}

function ensureOverlayWindow() {
  if (!overlayWindow || overlayWindow.isDestroyed()) {
    createOverlayWindow()
  }
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
      click: () => { forceQuit = true; app.isQuitting = true; app.quit() }
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
  logMain('[EVA Main] app.whenReady fired, cwEnabled:', store.get('cwEnabled', false));
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
  if (app.isPackaged) {
    (autoUpdater as any).installDirectory = path.dirname(app.getPath('exe'));
    logMain('[AutoUpdater] Target installDirectory:', (autoUpdater as any).installDirectory);
  }

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
    logMain('[AutoUpdater] checking-for-update');
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('splash:status', 'Vérification des mises à jour...');
  });

  autoUpdater.on('update-available', (info) => {
    clearTimeout(updateSafetyTimeout);
    _pendingUpdateInfo = info;
    logMain('[AutoUpdater] Mise à jour disponible:', info?.version || JSON.stringify(info));
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('splash:status', 'Mise à jour trouvée.');
      mainWindow.webContents.send('updater:available', info);
    }
    // Lancer l'app après le splash si aucun téléchargement immédiat n'est en cours, tout en gardant la bannière dans chat.html
    setTimeout(() => {
      if (!updateHandled && !_isDownloadingUpdate) {
        logMain('[EVA] Splash fallback après update-available — ouverture app avec bannière de mise à jour');
        finishSplash(0);
      }
    }, 3500);
  });
  
  autoUpdater.on('update-not-available', (_info) => {
    clearTimeout(updateSafetyTimeout);
    logMain('[AutoUpdater] update-not-available');
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('splash:status', 'Système à jour. Démarrage...');
    finishSplash(600);
  });

  autoUpdater.on('error', (err) => {
    clearTimeout(updateSafetyTimeout);
    _isDownloadingUpdate = false;
    logMain('[AutoUpdater] error:', err ? String(err) : 'Unknown error');
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('updater:error', err ? err.toString() : 'Unknown error');
      mainWindow.webContents.send('splash:status', 'Démarrage...');
    }
    finishSplash(400);
  });
  
  autoUpdater.on('update-downloaded', (info) => {
    _pendingUpdateDownloaded = info;
    _isDownloadingUpdate = false;
    logMain('[AutoUpdater] Mise à jour téléchargée:', info?.version || JSON.stringify(info));
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('splash:status', 'Mise à jour prête. Redémarrage...');
      mainWindow.webContents.send('updater:downloaded', info);
    }
    setTimeout(performQuitAndInstall, 1500);
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

// ─── FIX v5.6.2 : Quit immédiat pour l'installateur ───────────────────
// L'installateur NSIS peut envoyer un signal de quit via IPC ou via taskkill.
// On raccourcit le délai et on s'assure que app.quit() est toujours appelé.
app.on('before-quit', (e) => {
  logMain('[EVA Main] app before-quit fired, forceQuit:', forceQuit);
  if (!forceQuit && mainWindow && !mainWindow.isDestroyed()) {
    e.preventDefault();
    mainWindow.webContents.send('app:request-quit');
    // Réduction du délai : 1s au lieu de 3s (l'installateur n'attend pas)
    setTimeout(() => {
      forceQuit = true;
      app.quit();
    }, 1000);
  }
});

ipcMain.on('app:quit-ready', () => {
  logMain('[EVA Main] app:quit-ready received');
  forceQuit = true;
  app.quit();
});

// Handler dédié pour l'installateur / mise à jour forcée
ipcMain.handle('app:force-quit', () => {
  logMain('[EVA Main] app:force-quit requested');
  forceQuit = true;
  // Fermer toutes les fenêtres, tray compris
  if (tray) { tray.destroy(); tray = null; }
  if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.destroy();
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.destroy();
  setTimeout(() => app.quit(), 100);
  return true;
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
  logMain('[EVA Main] window-all-closed fired, minimizeToTray:', store.get('minimizeToTray'), 'forceQuit:', forceQuit);
  if (process.platform !== 'darwin') {
    // FIX v5.6.2 : si forceQuit est true (installateur / quit explicite), toujours quitter
    if (forceQuit || !store.get('minimizeToTray')) {
      if (tray) { try { tray.destroy(); } catch(e) {} tray = null; }
      app.quit();
    }
    // Sinon : app reste dans le tray (comportement normal)
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
function _showOverlayInternal(state?: string, text?: string, data?: any) {
  if (Date.now() < _overlayCancelledUntil && state !== 'listening' && state !== 'approval') return;
  ensureOverlayWindow()
  positionOverlayWindow()
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.setAlwaysOnTop(true, 'screen-saver')
    if (state) {
      _lastOverlayState = { state, text, data }
      if (_overlayReady) overlayWindow.webContents.send('overlay:setState', state, text, data)
    }
    if (!overlayWindow.isVisible()) overlayWindow.showInactive()
  }
}

ipcMain.handle('overlay:show', (_event, state?: string, text?: string, data?: any) => {
  _showOverlayInternal(state, text, data)
})

ipcMain.handle('window:isFocused', () => !!(mainWindow && !mainWindow.isDestroyed() && mainWindow.isFocused()))

ipcMain.handle('overlay:hide', () => {
  _lastOverlayState = null
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.hide()
  }
})

ipcMain.handle('overlay:setState', (_event, state, text, data) => {
  _lastOverlayState = { state, text, data }
  if (overlayWindow && !overlayWindow.isDestroyed() && _overlayReady) {
    overlayWindow.webContents.send('overlay:setState', state, text, data)
  }
})

function _setSttMicPaused(paused: boolean) {
  if (_sttProcess && _sttProcess.stdin) {
    try {
      const cmd = paused ? 'pause' : 'resume';
      _sttProcess.stdin.write(JSON.stringify({ command: cmd }) + '\n');
    } catch(e) {}
  }
}

function _resetSttBuffer() {
  if (_sttProcess && _sttProcess.stdin) {
    try {
      _sttProcess.stdin.write(JSON.stringify({ command: 'reset' }) + '\n');
    } catch(e) {}
  }
}

// IPC Handler — Mode Jarvis : synchronisation état overlay et microphone
ipcMain.handle('jarvis:state', (_event, data: { state: string, text?: string, pauseMic?: boolean }) => {
  if (data.state === 'hidden') {
    _lastOverlayState = null;
    if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.hide();
  } else {
    _showOverlayInternal(data.state, data.text);
  }
  if (data.pauseMic !== undefined) {
    _setSttMicPaused(!!data.pauseMic);
  }
  return { success: true };
})

// Communication Overlay -> Main App (Ex: Bouton Annuler appuyé, Approbation, Wake Word)
ipcMain.on('overlay:action', (_event, action, data) => {
  // Action wake word : premier plan (chat) vs arrière-plan (Mode Jarvis)
  if (action === 'wakeword' && data) {
    const isForeground = mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible() && !mainWindow.isMinimized();
    if (isForeground && mainWindow) {
      mainWindow.focus();
      mainWindow.webContents.send('wakeword:command', data);
    } else {
      _showOverlayInternal('listening', data);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('jarvis:voiceCommand', { phrase: data, command: data });
      }
    }
    return;
  }
  if (action === 'approve' || action === 'deny') {
    logMain('[Overlay] Décision reçue depuis bulle:', action, data || '');
    _showOverlayInternal('working', action === 'approve' ? 'Action autorisée, exécution...' : 'Action refusée.');
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('overlay:action', action, data);
    }
    return;
  }
  // Autres actions (cancel, etc.) → forwarded tel quel
  if (action === 'cancel') {
    logMain('[Main] Cancel reçu depuis overlay : arrêt LLM, TTS et processus');
    _overlayCancelledUntil = Date.now() + 2500;
    if (activeAbortController) {
      try { activeAbortController.abort(); } catch(e) {}
      activeAbortController = null;
    }
    if (activeExecProcess) {
      try { child_process.execSync(`taskkill /F /T /PID ${activeExecProcess.pid}`); } catch(e) {}
      activeExecProcess = null;
    }
    _killTtsProcess().catch(() => {});
    _setSttMicPaused(false);
    _lastOverlayState = null;
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.hide();
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('tts:force-stop');
    }
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('overlay:action', action, data);
  }
})

// â”€â”€â”€ IPC Handler â€” Ouvrir URL dans le navigateur système â”€â”€â”€
ipcMain.handle('shell:openExternal', (event, value: string) => {
  assertCWLocalSender(event);
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('URL_DENIED');
  return shell.openExternal(url.href);
})

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
function _prepareUpdaterEnv(): string {
  const exeDir = path.dirname(app.getPath('exe'));
  if (app.isPackaged) {
    (autoUpdater as any).installDirectory = exeDir;
  }
  const minBytes = 1500 * 1024 * 1024;
  const sysTmp = os.tmpdir();
  let tmpFree = 0;
  try {
    const st = fs.statfsSync(sysTmp);
    tmpFree = st.bavail * st.bsize;
  } catch (_) {}
  if (tmpFree < minBytes) {
    const candidates = [
      path.join(path.dirname(exeDir), '.eva-update-tmp'),
      'F:\\temp\\eva-update-tmp',
    ];
    for (const c of candidates) {
      try {
        fs.mkdirSync(c, { recursive: true });
        const st = fs.statfsSync(c);
        if (st.bavail * st.bsize >= minBytes) {
          process.env.TEMP = c;
          process.env.TMP = c;
          logMain('[AutoUpdater] TEMP redirigé hors C: ->', c);
          return c;
        }
      } catch (_) {}
    }
  }
  return sysTmp;
}

function performQuitAndInstall() {
  if (_isInstallingUpdate) return;
  _isInstallingUpdate = true;
  const updTmp = _prepareUpdaterEnv();
  logMain('[AutoUpdater] performQuitAndInstall started | dir:', (autoUpdater as any).installDirectory || '(default)', '| TEMP:', updTmp);
  forceQuit = true;
  app.isQuitting = true;
  try { activeAbortController?.abort(); } catch(_) {}
  try { stopLLM(); } catch(_) {}
  try { if (_sttProcess) { _sttProcess.kill(); _sttProcess = null; } } catch(_) {}
  try { if (_ttsProcess) { _ttsProcess.kill(); _ttsProcess = null; } } catch(_) {}
  try { if (activeExecProcess) { child_process.execSync(`taskkill /F /T /PID ${activeExecProcess.pid}`); activeExecProcess = null; } } catch(_) {}
  try { globalShortcut.unregisterAll(); } catch(_) {}
  try { if (tray) { tray.destroy(); tray = null; } } catch(_) {}
  try { if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.destroy(); } catch(_) {}
  try { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.destroy(); } catch(_) {}
  setImmediate(() => {
    autoUpdater.quitAndInstall(false, true);
  });
}

ipcMain.handle('updater:check', async () => {
  if (_pendingUpdateDownloaded && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('updater:downloaded', _pendingUpdateDownloaded);
  } else if (_pendingUpdateInfo && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('updater:available', _pendingUpdateInfo);
  }
  if (!isDev) {
    _lastUpdateCheck = 0;
    _checkForUpdatesIfNeeded(false);
  }
  return { ok: true, availableInfo: _pendingUpdateInfo, downloadedInfo: _pendingUpdateDownloaded };
})

ipcMain.handle('updater:start-download', () => {
  if (!isDev) {
    _isDownloadingUpdate = true;
    logMain('[AutoUpdater] Téléchargement démarré par l’utilisateur');
    autoUpdater.downloadUpdate().catch(err => {
      _isDownloadingUpdate = false;
      logMain('[AutoUpdater] Erreur téléchargement:', err ? String(err) : 'Unknown error');
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('updater:error', err ? err.toString() : 'Unknown error');
      }
    });
  }
})
ipcMain.handle('updater:quit-and-install', () => {
  if (!isDev) {
    performQuitAndInstall();
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

let _cwStartPromise: Promise<boolean> | null = null;
let _cwLlmBusy = false;
let _cwStopRequested = false;
let _cwPromptTask: string | null = null;
async function startLLM(): Promise<boolean> {
  if (_cwStartPromise) return _cwStartPromise;
  _cwStartPromise = _startLLMInternal();
  try { return await _cwStartPromise; }
  finally { _cwStartPromise = null; }
}
async function _startLLMInternal(): Promise<boolean> {
  if (llamaModel && llamaContext) return true;

  try {
    // userData survit aux mises à jour (contrairement à resourcesPath qui peut être en lecture seule)
    const userDataModels = path.join(app.getPath('userData'), 'models');
    const resourcesPath = app.isPackaged ? process.resourcesPath : path.join(__dirname, '../');

    // Ordre de recherche: userData/models (téléchargé par l'utilisateur) → resources/models → resources/llm (legacy)
    const userDataModelFile = path.join(userDataModels, 'EVA-PC-Agentic-3B-Q4_K_M-v5.gguf');
    const modelFile = path.join(resourcesPath, 'models', 'EVA-PC-Agentic-3B-Q4_K_M-v5.gguf');
    const legacyModelFile = path.join(resourcesPath, 'llm', 'EVA-PC-Agentic-3B-Q4_K_M-v5.gguf');

    let resolvedModelFile = '';
    if (fs.existsSync(userDataModelFile) && fs.statSync(userDataModelFile).size > 100_000_000) {
      resolvedModelFile = userDataModelFile;
      console.log('[LLM] Modèle trouvé dans userData/models:', resolvedModelFile);
    } else if (fs.existsSync(modelFile) && fs.statSync(modelFile).size > 100_000_000) {
      resolvedModelFile = modelFile;
      console.log('[LLM] Modèle trouvé dans resources/models:', resolvedModelFile);
    } else if (fs.existsSync(legacyModelFile) && fs.statSync(legacyModelFile).size > 100_000_000) {
      resolvedModelFile = legacyModelFile;
      console.log('[LLM] Modèle trouvé dans resources/llm (legacy):', resolvedModelFile);
    } else {
      console.error('[LLM] Modèle introuvable. Chemins vérifiés:');
      console.error('  -', userDataModelFile, '→', fs.existsSync(userDataModelFile) ? fs.statSync(userDataModelFile).size + ' octets' : 'absent');
      console.error('  -', modelFile, '→', fs.existsSync(modelFile) ? fs.statSync(modelFile).size + ' octets' : 'absent');
      console.error('  -', legacyModelFile, '→', fs.existsSync(legacyModelFile) ? fs.statSync(legacyModelFile).size + ' octets' : 'absent');
      return false;
    }

    if (!llamaInstance) {
      console.log('[LLM] Initialisation de node-llama-cpp...');
      const { getLlama } = await getLlamaCpp();
      try {
        llamaInstance = await getLlama();
      } catch (eAuto: any) {
        logMain('[LLM] getLlama auto échoué, tentative Vulkan puis CPU:', eAuto?.message || String(eAuto));
        try {
          llamaInstance = await getLlama({ gpu: 'vulkan', build: 'never' });
        } catch (_eVulk: any) {
          llamaInstance = await getLlama({ gpu: false, build: 'never' });
        }
      }
      console.log('[LLM] Backend détecté automatiquement:', llamaInstance.gpu);
    }

    console.log('[LLM] Chargement du modèle...');
    llamaModel = await llamaInstance.loadModel({ modelPath: resolvedModelFile });
    
    console.log('[LLM] Création du contexte...');
    const os = await import('os');
    const cpuCount = os.cpus().length;
    // Sur CPU, limiter les threads (min 2, max 6) pour équilibrer vitesse et fluidité du système
    const optimalThreads = Math.min(6, Math.max(2, Math.floor(cpuCount / 2)));
    console.log(`[LLM] Création du contexte (contextSize: 8192, threads: ${optimalThreads})...`);
    llamaContext = await llamaModel.createContext({
      contextSize: 8192, // FIX v5.6.20: 8192 au lieu de 2048 pour eviter tout crash par saturation de tokens
      threads: optimalThreads
    });
    
    console.log('[LLM] Moteur LLM prêt !');
    logMain('[LLM] Modèle chargé avec succès:', resolvedModelFile);
    _notifyLLMReady();
    return true;
  } catch (err: any) {
    logMain('[LLM] Erreur chargement modèle:', err?.message || String(err));
    try { await llamaContext?.dispose(); } catch (_) {}
    try { await llamaModel?.dispose(); } catch (_) {}
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
  if (activeChatSession) {
    try { activeChatSession.dispose({ disposeSequence: false }); } catch (_) {}
  }
  if (activeSequence) {
    try { activeSequence.dispose(); } catch(e) {}
    activeSequence = null;
  }
  activeChatSession = null;
  activeSessionId = null;
}

function stopLLM() {
  if (_cwStartPromise || _cwLlmBusy) {
    _cwStopRequested = true;
    activeAbortController?.abort();
    if (_cwStartPromise && !_cwLlmBusy) _cwStartPromise.finally(() => { if (!_cwLlmBusy) { _cwStopRequested=false; stopLLM(); } });
    return;
  }
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

function assertCWLocalSender(event: any) {
  if (!mainWindow || event.sender !== mainWindow.webContents || !event.senderFrame ||
      event.senderFrame !== event.sender.mainFrame) throw new Error('IPC_SENDER_DENIED');
  const url = new URL(event.senderFrame.url);
  const local = url.origin === 'http://127.0.0.1:' + localServerPort ||
    (isDev && url.origin === 'http://localhost:5173');
  const localFile = url.protocol === 'file:' &&
    path.resolve(fileURLToPath(url)).startsWith(path.resolve(__dirname, '../dist') + path.sep);
  if (!local && !localFile) throw new Error('IPC_ORIGIN_DENIED');
}
installCWRuntime({ ipcMain, dialog, shell, BrowserWindow, store,
  mainWindow: () => mainWindow,
  assertSender: assertCWLocalSender,
  abortLLM: (id: string) => { if (_cwPromptTask === id) activeAbortController?.abort(); },
  onApprovalOverlay: ({ taskId, tool, summary }: any) => {
    _showOverlayInternal('approval', summary || `Autoriser : ${tool}`, { taskId, tool, summary });
  }
});
ipcMain.handle('llm:chat', async (event, messages: any[], options: any = {}) => {
  assertCWLocalSender(event);
  if (_cwLlmBusy) throw new Error('LLM_BUSY');
  if (!Array.isArray(messages) || !messages.length || messages.length > 40 ||
      messages.some(m => !['system', 'user', 'assistant'].includes(m.role) || typeof m.content !== 'string') ||
      JSON.stringify(messages).length > 64000) throw new Error('INVALID_MESSAGES');
  if (messages[messages.length-1].role !== 'user') throw new Error('LAST_MESSAGE_MUST_BE_USER');
  if (options.jsonSchema && JSON.stringify(options.jsonSchema).length > 45000) throw new Error('SCHEMA_TOO_LARGE');
  _cwLlmBusy = true;
  _cwPromptTask = String(options.sessionId || 'local-chat');
  const controller = new AbortController();
  let timedOut = false;
  let timer: NodeJS.Timeout | null = null;
  const t0 = Date.now();
  try {
    if (llmTimeout) { clearTimeout(llmTimeout); llmTimeout = null; }
    disposeActiveSession();
    activeAbortController = controller;
    timer = setTimeout(() => { timedOut = true; controller.abort(); },
      Math.max(1000, Math.min(180000, Number(options.timeoutMs) || 120000)));
    if (!await startLLM()) throw new Error('MODEL_MISSING_OR_START_FAILED');
    if (controller.signal.aborted || _cwStopRequested) throw new Error('CANCELLED');
    const { LlamaChatSession } = await getLlamaCpp();
    activeSequence = llamaContext.getSequence();
    activeChatSession = new LlamaChatSession({ contextSequence: activeSequence });
    const history = messages.slice(0,-1).map((m: any) => m.role === 'assistant'
      ? { type: 'model', response: [m.content] } : { type: m.role, text: m.content });
    activeChatSession.setChatHistory(history);
    // Rebuild from caller history on every call: no cross-task cache contamination.
    const grammar = options.jsonSchema
      ? await llamaInstance.createGrammarForJsonSchema(options.jsonSchema) : undefined;
    const response = await activeChatSession.prompt(messages[messages.length-1].content, {
      grammar,
      maxTokens: Math.max(64, Math.min(4096, Number(options.maxTokens || options.max_tokens) || 1024)),
      temperature: Math.max(0, Math.min(1, Number(options.temperature) || 0)),
      customStopTriggers: Array.isArray(options.stopTriggers) ? options.stopTriggers : [],
      signal: controller.signal, stopOnAbortSignal: true,
      budgets: { thoughtTokens: 0 }
    });
    logMain('[LLM] llm:chat OK in', (Date.now() - t0) + 'ms', 'chars:', (response || '').length);
    if (timedOut) throw new Error('LLM_TIMEOUT');
    if (controller.signal.aborted) return { aborted: true, choices: [] };
    return { choices: [{ message: { role: 'assistant', content: response } }] };
  } catch (err: any) {
    logMain('[LLM] llm:chat ERR after', (Date.now() - t0) + 'ms:', err?.message || String(err));
    throw err;
  } finally {
    if (timer) clearTimeout(timer);
    _cwPromptTask = null;
    _cwLlmBusy = false;
    disposeActiveSession();
    if (_cwStopRequested) { _cwStopRequested = false; stopLLM(); }
    resetLLMTimer();
  }
});

ipcMain.handle('llm:abort', async (event) => {
  assertCWLocalSender(event);
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

ipcMain.handle('llm:reset-session', async (event) => {
  assertCWLocalSender(event);
  if (_cwLlmBusy) { activeAbortController?.abort(); return { success: false, error: 'LLM_BUSY_ABORT_REQUESTED' }; }
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
  const userDataModelFile = path.join(app.getPath('userData'), 'models', 'EVA-PC-Agentic-3B-Q4_K_M-v5.gguf');
  const resourcesPath = app.isPackaged ? process.resourcesPath : path.join(__dirname, '../');
  const modelFile = path.join(resourcesPath, 'models', 'EVA-PC-Agentic-3B-Q4_K_M-v5.gguf');
  const legacyModelFile = path.join(resourcesPath, 'llm', 'EVA-PC-Agentic-3B-Q4_K_M-v5.gguf');
  const exists = (fs.existsSync(userDataModelFile) && fs.statSync(userDataModelFile).size > 100_000_000) ||
                 (fs.existsSync(modelFile) && fs.statSync(modelFile).size > 100_000_000) ||
                 (fs.existsSync(legacyModelFile) && fs.statSync(legacyModelFile).size > 100_000_000);
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
  // Télécharger dans userData (toujours accessible en écriture, survit aux mises à jour)
  const llmDir = path.join(app.getPath('userData'), 'models');
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

ipcMain.handle('cloudworks:setAutonomous', async (event, enabled: boolean) => {
  assertCWLocalSender(event);
  store.set('cwAutonomousMode', !!enabled);
  return { success: true, autonomousMode: !!enabled };
});

// ─── IPC Handlers — STT (Faster-Whisper GPU & Fallback SAPI) ───
let _sttProcess: any = null;
let _sttReady = false;
let _sttEngine = '';
let _sttStartPromise: Promise<{ success: boolean; alreadyRunning?: boolean; engine?: string; error?: string }> | null = null;

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
  if (_sttProcess && _sttReady) return { success: true, alreadyRunning: true, engine: _sttEngine || 'whisper-gpu' };
  if (_sttStartPromise) return _sttStartPromise;

  const pythonExe = getPythonPath();
  const scriptPath = getWhisperScriptPath();

  if (fs.existsSync(pythonExe) && fs.existsSync(scriptPath)) {
    _sttStartPromise = new Promise((resolve) => {
      let settled = false;
      const done = (res: { success: boolean; engine?: string; error?: string }) => {
        if (settled) return;
        settled = true;
        _sttStartPromise = null;
        resolve(res);
      };
      try {
        logMain(`[STT] Démarrage du moteur Faster-Whisper GPU (${pythonExe})...`);
        const { spawn: _spawn } = require('child_process');
        const hfHome = process.env.HF_HOME || (fs.existsSync('F:\\huggingface_cache') ? 'F:\\huggingface_cache' : path.join(app.getPath('userData'), 'hf_cache'));
        try { fs.mkdirSync(hfHome, { recursive: true }); } catch (_) {}
        _sttReady = false;
        _sttEngine = 'whisper-gpu';
        _sttProcess = _spawn(pythonExe, ['-u', scriptPath], {
          stdio: ['pipe', 'pipe', 'pipe'],
          windowsHide: true,
          env: {
            ...process.env,
            HF_HOME: hfHome,
            HF_HUB_DISABLE_SYMLINKS_WARNING: '1',
            PYTHONIOENCODING: 'utf-8'
          }
        });

        const startupTimer = setTimeout(() => {
          if (!_sttReady) {
            logMain('[STT] Timeout démarrage Faster-Whisper (20s), repli navigateur/Vosk');
            try { _sttProcess?.kill(); } catch (_) {}
            _sttProcess = null;
            _sttReady = false;
            _sttEngine = '';
            done({ success: false, error: 'WHISPER_TIMEOUT' });
          }
        }, 20000);

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
                clearTimeout(startupTimer);
                _sttReady = true;
                _sttEngine = 'whisper-gpu';
                logMain(`[STT] Faster-Whisper prêt (${ev.model}, ${ev.device}, ${ev.compute_type})`);
                done({ success: true, engine: 'whisper-gpu' });
              } else if (ev.type === 'error') {
                clearTimeout(startupTimer);
                logMain('[STT] Erreur moteur Whisper:', ev.message || trimmed);
                if (!_sttReady) {
                  try { _sttProcess?.kill(); } catch (_) {}
                  _sttProcess = null;
                  _sttEngine = '';
                  done({ success: false, error: ev.message || 'WHISPER_ERROR' });
                }
              } else if (ev.type === 'interim') {
                if (mainWindow && !mainWindow.isDestroyed()) {
                  mainWindow.webContents.send('stt:result', { text: ev.text, isFinal: false });
                }
                const isForeground = mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible() && !mainWindow.isMinimized();
                const busyOverlay = _lastOverlayState && ['thinking', 'speaking', 'cloudworks', 'working', 'remote', 'approval'].includes(_lastOverlayState.state);
                if (!isForeground && !busyOverlay && overlayWindow && !overlayWindow.isDestroyed() && overlayWindow.isVisible()) {
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
                const busyOverlay = _lastOverlayState && ['thinking', 'speaking', 'cloudworks', 'working', 'remote', 'approval'].includes(_lastOverlayState.state);
                if (isForeground && mainWindow) {
                  mainWindow.focus();
                  mainWindow.webContents.send('wakeword:command', cmd);
                } else if (!busyOverlay) {
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
          if (msg && /Error|Traceback|Exception/i.test(msg)) logMain('[STT stderr]:', msg.slice(0, 300));
        });

        _sttProcess.on('exit', (code: number) => {
          clearTimeout(startupTimer);
          const wasReady = _sttReady;
          logMain('[STT] Faster-Whisper terminé, code:', code, 'wasReady:', wasReady);
          _sttProcess = null;
          _sttReady = false;
          _sttEngine = '';
          if (!wasReady) {
            done({ success: false, error: 'WHISPER_EXITED_' + code });
          } else if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('stt:stopped', {});
          }
        });
      } catch(e) {
        logMain('[STT] Erreur spawn Faster-Whisper:', String(e));
        _sttProcess = null;
        _sttReady = false;
        done({ success: false, error: String(e) });
      }
    });
    const whisperRes = await _sttStartPromise;
    if (whisperRes && whisperRes.success) return whisperRes;
    logMain('[STT] Retour échec Faster-Whisper au renderer pour repli Vosk:', whisperRes?.error);
    return whisperRes;
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

ipcMain.handle('stt:reset', async () => {
  _resetSttBuffer();
  return { success: true };
});

ipcMain.handle('stt:stop', async () => {
  _sttReady = false;
  _sttEngine = '';
  _sttStartPromise = null;
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
  _setSttMicPaused(false);
  return { success: true };
});

ipcMain.handle('tts:mic-paused', async (_event, paused: boolean) => {
  _setSttMicPaused(!!paused);
  return { success: true };
});

// ─── Edge Neural TTS (Microsoft Edge Read Aloud — gratuit, sans clé, sans quota) ───
ipcMain.handle('tts:edge-speak', async (_event, text: string, voice: string = 'fr-FR-DeniseNeural', rate?: string) => {
  const cleanText = String(text || '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/\[ACTION:[\s\S]*?\]/g, '')
    .replace(/[a-zA-Z]:\\[^\s"'`]+/g, 'fichier local')
    .replace(/[*#_`~>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleanText) return { success: true, audioBase64: '', mimeType: 'audio/mpeg' };

  const safeVoice = (typeof voice === 'string' && /^[a-z]{2}-[A-Z]{2}-[A-Za-z0-9]+Neural$/.test(voice))
    ? voice : 'fr-FR-DeniseNeural';

  let tts: any = null;
  try {
    const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');
    tts = new MsEdgeTTS();
    await tts.setMetadata(safeVoice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    const streamOpts = rate ? { rate } : undefined;
    const { audioStream } = tts.toStream(cleanText, streamOpts);
    const audioBuf: Buffer = await new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const tmo = setTimeout(() => reject(new Error('EDGE_TTS_TIMEOUT')), 15000);
      audioStream.on('data', (chunk: Buffer) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      audioStream.on('end', () => { clearTimeout(tmo); resolve(Buffer.concat(chunks)); });
      audioStream.on('error', (err: any) => { clearTimeout(tmo); reject(err); });
    });
    return {
      success: true,
      audioBase64: audioBuf.toString('base64'),
      mimeType: 'audio/mpeg',
      voice: safeVoice
    };
  } catch (err: any) {
    logMain('[TTS Edge] Erreur:', err?.message || String(err));
    return { success: false, error: err?.message || String(err) };
  } finally {
    try { tts?.close(); } catch(_) {}
  }
});

// ─── PWA Detection (FIX v5.6.11) ────────────────────────────────────────────
ipcMain.handle('pwa:detect', async (_e: any, args: any) => {
  const name: string = (args && args.name) ? args.name.toLowerCase() : '';
  const url: string  = (args && args.url)  ? args.url  : '';
  try {
    const { execSync } = require('child_process');
    // Chercher les PWA Chrome/Edge dans le registre Windows
    // Chrome stocke les PWA sous HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall
    // Edge aussi. On cherche par nom ou domaine.
    const regOutput = execSync(
      'reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall" /s /f "' +
      (name || 'App') + '" 2>nul',
      { encoding: 'utf-8', timeout: 3000 }
    );
    if (regOutput && regOutput.trim()) {
      // Extraire le DisplayName et le chemin d'exécution
      const lines = regOutput.split('\n');
      let execPath: string | null = null;
      for (const line of lines) {
        if (line.trim().startsWith('DisplayIcon') || line.trim().startsWith('DisplayName')) {
          const parts = line.split('REG_SZ');
          if (parts[1]) {
            const val = parts[1].trim();
            if (val.endsWith('.exe') || val.includes('.exe,')) {
              execPath = val.split(',')[0].trim();
              break;
            }
          }
        }
      }
      return { found: true, execPath };
    }
    return { found: false, execPath: null };
  } catch (err: any) {
    // Pas de PWA trouvée ou reg indisponible
    return { found: false, execPath: null };
  }
});

// ─── shell:open (FIX v5.6.11) ────────────────────────────────────────────────
ipcMain.handle('shell:open', async (_e: any, args: any) => {
  const { shell } = require('electron');
  const path: string = args && args.path ? args.path : '';
  if (!path) return { success: false };
  try {
    await shell.openPath(path);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

