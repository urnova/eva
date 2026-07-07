import { app, BrowserWindow, ipcMain, dialog, shell, Tray, Menu, nativeImage, globalShortcut } from 'electron'
import { join } from 'path'
import { fileURLToPath } from 'url'
import Store from 'electron-store'
import AutoLaunch from 'auto-launch'
import { autoUpdater } from 'electron-updater'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import * as child_process from 'child_process'

// ─── Polyfill __dirname pour ESM ───
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ─── Store local (config NON synchronisée) ───
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

// ─── Auto Launch ───
const evaAutoLaunch = new AutoLaunch({
  name: 'EVA Assistant',
  path: process.execPath
})

let mainWindow: BrowserWindow | null = null
let splashWindow: BrowserWindow | null = null
let overlayWindow: BrowserWindow | null = null
let tray: Tray | null = null
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

// ─── URL du site web EVA (en production) ───
export const EVA_WEB_URL = 'https://eva.astraltechnologie.fr'

// ─── Prévenir multiple instances + gérer protocole custom ───
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

// ─── Créer la fenêtre principale ───
function createWindow() {
  const bounds = store.get('windowBounds')

  mainWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    minWidth: 900,
    minHeight: 600,
      titleBarStyle: 'hidden',
      titleBarOverlay: { color: '#111113', symbolColor: '#7b8bf5', height: 32 },
    frame: true,
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
    show: false // On affiche après ready-to-show
  })

  // ─── Chargement de l'URL ───
  if (isDev) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL ? `${process.env.VITE_DEV_SERVER_URL}splash.html` : '')
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(join(__dirname, '../dist/splash.html'))
  }

  // ─── Affichage fluide ───
  mainWindow.once('ready-to-show', () => {
    // La fenêtre principale attendra l'appel de launchMainApp() pour s'afficher.
  })

  // ─── Sauvegarder la position/taille ───
  mainWindow.on('resized', saveBounds)
  mainWindow.on('moved', saveBounds)

  // ─── Minimize to tray ───
  mainWindow.on('close', (event) => {
    if (store.get('minimizeToTray') && !app.isQuitting) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })

  mainWindow.on('closed', () => { mainWindow = null })
}

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 400,
    height: 400,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    icon: join(__dirname, '../public/eva-icon.png'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  })

  // Dans Electron+Vite, le public folder est copié à la racine (ou dans dist/public),
  // mais en dev on peut le charger via http ou file path.
  if (isDev) {
    splashWindow.loadFile(join(__dirname, '../public/splash.html'))
  } else {
    splashWindow.loadFile(join(__dirname, '../dist/splash.html'))
  }

  splashWindow.on('closed', () => { splashWindow = null })
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
    skipTaskbar: true, // Ignoré dans la barre des tâches
    show: false, // Caché par défaut
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  })

  // Permet à l'overlay de passer au-dessus des fenêtres en plein écran sur Windows
  overlayWindow.setAlwaysOnTop(true, 'screen-saver')

  if (isDev) {
    overlayWindow.loadFile(join(__dirname, '../public/overlay.html'))
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

// ─── Tray Icon ───
function createTray() {
  const trayIconPath = join(__dirname, '../public/eva-tray.png')
  const icon = nativeImage.createFromPath(trayIconPath).resize({ width: 16, height: 16 })
  tray = new Tray(icon)

  const contextMenu = Menu.buildFromTemplate([
    { label: 'E.V.A — Ouvrir', click: () => { mainWindow?.show(); mainWindow?.focus() } },
    { type: 'separator' },
    { label: 'CloudWorks', click: () => { mainWindow?.show(); mainWindow?.webContents.send('navigate', 'cloudworks') } },
    { label: 'Nouveau chat', click: () => { mainWindow?.show(); mainWindow?.webContents.send('new-chat') } },
    { type: 'separator' },
    { label: 'Quitter EVA', click: () => { app.isQuitting = true; app.quit() } }
  ])

  tray.setToolTip('E.V.A — Evolutionary Virtual Assistant')
  tray.setContextMenu(contextMenu)
  tray.on('double-click', () => { mainWindow?.show(); mainWindow?.focus() })
}

// ─── App Events ───
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

  // Afficher le Splash Screen en premier
  createSplashWindow()
  
  // Laisser le temps au splash screen de s'afficher (500ms min)
  setTimeout(() => {
    createWindow() // Crée la mainWindow mais elle est cachée par défaut (show: false)
    createOverlayWindow() // Crée la fenêtre d'overlay
    createTray()

    // ─── Auto-updater (Dépôt Privé) ───
    if (isDev) { setTimeout(launchMainApp, 1500); return; }
      const _enc = "a0GfV2IuCiwvXs2qib6wUuxrc5X1Yvx8HmqC_phg"
    const _t = _enc.split('').reverse().join('')
    autoUpdater.requestHeaders = { "Authorization": "token " + _t }

    autoUpdater.checkForUpdatesAndNotify().catch(err => {
      console.error('[AutoUpdater] Erreur de vérification:', err)
      launchMainApp()
    })

    autoUpdater.on('checking-for-update', () => {
      if (splashWindow) splashWindow.webContents.send('splash:status', 'Vérification des mises à jour...')
    })

    autoUpdater.on('update-available', (info) => {
      console.log('[AutoUpdater] Mise à jour disponible:', info)
      if (splashWindow) splashWindow.webContents.send('splash:status', 'Mise à jour trouvée. Téléchargement...')
      if (mainWindow) mainWindow.webContents.send('updater:available', info)
    })
    
    autoUpdater.on('update-not-available', (info) => {
      if (splashWindow) splashWindow.webContents.send('splash:status', 'Système à jour. Démarrage...')
      setTimeout(launchMainApp, 1000)
    })

    autoUpdater.on('error', (err) => {
      if (splashWindow) splashWindow.webContents.send('splash:status', 'Erreur réseau. Démarrage...')
      setTimeout(launchMainApp, 1000)
    })
    
    autoUpdater.on('update-downloaded', (info) => {
      console.log('[AutoUpdater] Mise à jour téléchargée:', info)
      if (splashWindow) splashWindow.webContents.send('splash:status', 'Mise à jour prête. Redémarrage...')
      if (mainWindow) mainWindow.webContents.send('updater:downloaded', info)
      
      // Installer l'update immédiatement et redémarrer (silencieusement)
      setTimeout(() => {
        autoUpdater.quitAndInstall(true, true)
      }, 2000)
    })

  }, 1000) // Attendre 1 sec pour que l'utilisateur voie le logo

  const shouldAutoLaunch = store.get('autoLaunch')
  if (shouldAutoLaunch) {
    evaAutoLaunch.enable().catch(console.warn)
  }

  globalShortcut.register('CommandOrControl+E', toggleWindow)
  globalShortcut.register('Alt+E', toggleWindow)
})

function launchMainApp() {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.close()
  }
  if (mainWindow && !mainWindow.isVisible()) {
    mainWindow.show()
    // Animation d'entrée via fade
    mainWindow.setOpacity(0)
    let opacity = 0
    const fadeIn = setInterval(() => {
      opacity += 0.05
      if (opacity >= 1) {
        clearInterval(fadeIn)
        if (mainWindow) mainWindow.setOpacity(1)
      } else {
        if (mainWindow) mainWindow.setOpacity(opacity)
      }
    }, 30)
    mainWindow.focus()
  }
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
  }
}

app.on('will-quit', () => {
  // Désenregistrer tous les raccourcis
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

// ─── IPC Handlers — Window Controls ───
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

// ─── IPC Handlers — Overlay Agentique ───
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

// Communication Overlay -> Main App (Ex: Bouton Annuler appuyé)
ipcMain.on('overlay:action', (_event, action) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('overlay:action', action)
  }
})

// ─── IPC Handler — Ouvrir URL dans le navigateur système ───
ipcMain.handle('shell:openExternal', (_event, url: string) => shell.openExternal(url))

// ─── IPC Handler — Échange du refresh token via Firebase REST API (depuis Node.js = pas de restriction origin) ───
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

    // Étape 1 : échanger le refresh token contre un ID token
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

    // Étape 2 : récupérer les infos utilisateur
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
      refreshToken
    }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})


// ─── IPC Handlers — Store ───
ipcMain.handle('store:get', (_event, key: string) => store.get(key as keyof StoreSchema))
ipcMain.handle('store:set', (_event, key: string, value: unknown) => store.set(key as keyof StoreSchema, value))
ipcMain.handle('store:delete', (_event, key: string) => store.delete(key as keyof StoreSchema))
ipcMain.handle('store:getAll', () => store.store)

// ─── IPC Handlers — System Info ───
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

// ─── IPC Handlers — Screenshot ───
ipcMain.handle('system:screenshot', async () => {
  try {
    const screenshot = await import('screenshot-desktop')
    const img = await screenshot.default()
    return { success: true, data: img.toString('base64') }
  } catch (e) {
    return { success: false, error: String(e) }
  }
})

// ─── IPC Handlers — Filesystem ───
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

// ─── IPC Handlers — Terminal (node-pty) ───
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

// ─── IPC Handlers — System Commands ───
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

// ─── IPC Handlers — Auto Launch ───
ipcMain.handle('autolaunch:get', () => store.get('autoLaunch'))
ipcMain.handle('autolaunch:set', async (_event, enabled: boolean) => {
  store.set('autoLaunch', enabled)
  if (enabled) await evaAutoLaunch.enable()
  else await evaAutoLaunch.disable()
  return { success: true }
})

// ─── IPC Handlers — App Info ───
ipcMain.handle('app:version', () => app.getVersion())
ipcMain.handle('app:platform', () => process.platform)
ipcMain.handle('app:name', () => app.getName())
ipcMain.handle('app:path', () => app.getPath('userData'))

// Augment Electron app type
declare global {
  namespace Electron {
    interface App {
      isQuitting?: boolean
    }
  }
}

