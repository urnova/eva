import { contextBridge, ipcRenderer } from 'electron'

// â”€â”€â”€ API EVA exposÃ©e au renderer via contextBridge â”€â”€â”€
// Pas de nodeIntegration â†’ sÃ©curitÃ© maximale

const evaAPI = {
  // ðŸ”„ Updater
  updater: {
    startDownload: () => ipcRenderer.invoke('updater:start-download'),
    quitAndInstall: () => ipcRenderer.invoke('updater:quit-and-install'),
    onUpdateAvailable: (callback: (info: any) => void) => ipcRenderer.on('updater:available', (e, info) => callback(info)),
    onUpdateProgress: (callback: (progress: any) => void) => ipcRenderer.on('updater:progress', (e, info) => callback(info)),
    onUpdateDownloaded: (callback: () => void) => ipcRenderer.on('updater:downloaded', callback)
  },
  
  // ðŸ”’ App Quit
  onAppQuit: (callback: () => void) => {
    ipcRenderer.on('app:quit-request', callback)
  },
  // â”€â”€ Window Controls â”€â”€
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized')
  },

  // â”€â”€ electron-store (config locale) â”€â”€
  store: {
    get: (key: string) => ipcRenderer.invoke('store:get', key),
    set: (key: string, value: unknown) => ipcRenderer.invoke('store:set', key, value),
    delete: (key: string) => ipcRenderer.invoke('store:delete', key),
    getAll: () => ipcRenderer.invoke('store:getAll')
  },

  // â”€â”€ Filesystem â”€â”€
  fs: {
    list: (dirPath: string) => ipcRenderer.invoke('fs:list', dirPath),
    read: (filePath: string) => ipcRenderer.invoke('fs:read', filePath),
    write: (filePath: string, content: string) => ipcRenderer.invoke('fs:write', filePath, content),
    delete: (filePath: string) => ipcRenderer.invoke('fs:delete', filePath),
    rename: (oldPath: string, newPath: string) => ipcRenderer.invoke('fs:rename', oldPath, newPath),
    mkdir: (dirPath: string) => ipcRenderer.invoke('fs:mkdir', dirPath),
    openDialog: (options: unknown) => ipcRenderer.invoke('fs:openDialog', options),
    saveDialog: (options: unknown) => ipcRenderer.invoke('fs:saveDialog', options),
    openPath: (filePath: string) => ipcRenderer.invoke('fs:openPath', filePath),
    showInExplorer: (filePath: string) => ipcRenderer.invoke('fs:showInExplorer', filePath),
    drives: () => ipcRenderer.invoke('fs:drives'),
    homedir: () => ipcRenderer.invoke('fs:homedir')
  },

  // â”€â”€ Terminal â”€â”€
  terminal: {
    create: (termId: string) => ipcRenderer.invoke('terminal:create', termId),
    write: (termId: string, data: string) => ipcRenderer.invoke('terminal:write', termId, data),
    resize: (termId: string, cols: number, rows: number) => ipcRenderer.invoke('terminal:resize', termId, cols, rows),
    kill: (termId: string) => ipcRenderer.invoke('terminal:kill', termId),
    onData: (termId: string, callback: (data: string) => void) => {
      const channel = `terminal:data:${termId}`
      const listener = (_: unknown, data: string) => callback(data)
      ipcRenderer.on(channel, listener)
      return () => ipcRenderer.removeListener(channel, listener)
    },
    onExit: (termId: string, callback: () => void) => {
      const channel = `terminal:exit:${termId}`
      const listener = () => callback()
      ipcRenderer.on(channel, listener)
      return () => ipcRenderer.removeListener(channel, listener)
    }
  },

  // â”€â”€ System â”€â”€
  system: {
    info: () => ipcRenderer.invoke('system:info'),
      llmChat: (messages) => ipcRenderer.invoke('llm:chat', messages),
    cpuLoad: () => ipcRenderer.invoke('system:cpuLoad'),
    screenshot: () => ipcRenderer.invoke('system:screenshot'),
    exec: (cmd: string) => ipcRenderer.invoke('system:exec', cmd),
    sleep: () => ipcRenderer.invoke('system:sleep'),
    shutdown: () => ipcRenderer.invoke('system:shutdown'),
    restart: () => ipcRenderer.invoke('system:restart'),
    lock: () => ipcRenderer.invoke('system:lock'),
    processes: () => ipcRenderer.invoke('system:processes'),
    killProcess: (pid: number) => ipcRenderer.invoke('system:killProcess', pid)
  },

  // â”€â”€ Auto Launch â”€â”€
  autoLaunch: {
    get: () => ipcRenderer.invoke('autolaunch:get'),
    set: (enabled: boolean) => ipcRenderer.invoke('autolaunch:set', enabled)
  },

  // â”€â”€ App Info â”€â”€
  app: {
    version: () => ipcRenderer.invoke('app:version'),
    platform: () => ipcRenderer.invoke('app:platform'),
    name: () => ipcRenderer.invoke('app:name'),
    path: () => ipcRenderer.invoke('app:path')
  },

  // â”€â”€ Navigation (depuis tray/main) â”€â”€
  onNavigate: (callback: (route: string) => void) => {
    ipcRenderer.on('navigate', (_: unknown, route: string) => callback(route))
  },
  onNewChat: (callback: () => void) => {
    ipcRenderer.on('new-chat', () => callback())
  },

  // â”€â”€ Auth callback (depuis protocole eva-desktop://) â”€â”€
  onAuthCallback: (callback: (data: { refreshToken?: string; hid?: string }) => void) => {
    ipcRenderer.on('auth:callback', (_: unknown, data: { refreshToken?: string; hid?: string }) => callback(data))
  },

  // Connexion Puter via proxy (eva-desktop://puter?token=...)
  onPuterCallback: (callback: (data: { token: string }) => void) => {
    ipcRenderer.on('puter:callback', (_: unknown, data: { token: string }) => callback(data))
  },

  // â”€â”€â”€ Splash Screen â”€â”€â”€
  onSplashStatus: (callback: (status: string) => void) => {
    ipcRenderer.on('splash:status', (_: unknown, status: string) => callback(status))
  },
  onSplashDone: (callback: () => void) => {
    ipcRenderer.on('splash:done', () => callback())
  },

  // â”€â”€ Ouvrir URL dans le navigateur systÃ¨me â”€â”€
  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),

  // â”€â”€ Ã‰change du refresh token via main process (Node.js, sans restriction CORS) â”€â”€
  exchangeToken: (refreshToken: string, apiKey: string) =>
    ipcRenderer.invoke('auth:exchangeToken', refreshToken, apiKey),

  // â”€â”€ Popup Auth (conservÃ© pour fallback futur) â”€â”€
  openAuthWindow: (url: string) => ipcRenderer.invoke('auth:openAuthWindow', url),

  // â”€â”€ Overlay Agentique â”€â”€
  overlay: {
    show: (state?: string) => ipcRenderer.invoke('overlay:show', state),
    hide: () => ipcRenderer.invoke('overlay:hide'),
    setState: (state: string, text?: string) => ipcRenderer.invoke('overlay:setState', state, text),
      onSetState: (callback: (state: string, text?: string) => void) => {
        const channel = 'overlay:setState'
        const listener = (_: unknown, state: string, text?: string) => callback(state, text)
        ipcRenderer.on(channel, listener)
        return () => ipcRenderer.removeListener(channel, listener)
      },
    onAction: (callback: (action: string) => void) => {
      const channel = 'overlay:action'
      const listener = (_: unknown, action: string) => callback(action)
      ipcRenderer.on(channel, listener)
      return () => ipcRenderer.removeListener(channel, listener)
    }
  }
}

contextBridge.exposeInMainWorld('eva', evaAPI)

// Type global pour TypeScript dans le renderer
// Note: EvaAPI est dÃ©clarÃ© dans src/types/index.ts via declare global

