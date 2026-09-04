import { contextBridge, ipcRenderer } from 'electron'

// ─── API EVA exposée au renderer via contextBridge ───
// Pas de nodeIntegration → sécurité maximale

const evaAPI = {
  // 🔄 Updater
  updater: {
    startDownload: () => ipcRenderer.invoke('updater:start-download'),
    quitAndInstall: () => ipcRenderer.invoke('updater:quit-and-install'),
    onUpdateAvailable: (callback: (info: any) => void) => ipcRenderer.on('updater:available', (e, info) => callback(info)),
    onUpdateProgress: (callback: (progress: any) => void) => ipcRenderer.on('updater:progress', (e, info) => callback(info)),
    onUpdateDownloaded: (callback: () => void) => ipcRenderer.on('updater:downloaded', callback),
    onUpdateError: (callback: (err: any) => void) => ipcRenderer.on('updater:error', (e, err) => callback(err))
  },

  // 🔒 App Quit
  onAppQuit: (callback: () => void) => {
    ipcRenderer.on('app:quit-request', callback)
  },

  // ── Window Controls ──
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized')
  },

  // ── electron-store (config locale) ──
  store: {
    get: (key: string) => ipcRenderer.invoke('store:get', key),
    set: (key: string, value: unknown) => ipcRenderer.invoke('store:set', key, value),
    delete: (key: string) => ipcRenderer.invoke('store:delete', key),
    getAll: () => ipcRenderer.invoke('store:getAll')
  },

  // ── Filesystem ──
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

  // ── Terminal ──
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

  // ── System ──
  system: {
    info: () => ipcRenderer.invoke('system:info'),
    stats: () => ipcRenderer.invoke('system:stats'),
    llmChat: (messages: any) => ipcRenderer.invoke('llm:chat', messages),
    llmStart: () => ipcRenderer.invoke('llm:start'),
    llmStop: () => ipcRenderer.invoke('llm:stop'),
    llmStatus: () => ipcRenderer.invoke('llm:status'),
    llmCheck: () => ipcRenderer.invoke('llm:check'),
    llmDownload: () => ipcRenderer.invoke('llm:download'),
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

  // ── CloudWorks ──
  cloudworks: {
    enable: () => ipcRenderer.invoke('cloudworks:enable'),
    disable: () => ipcRenderer.invoke('cloudworks:disable')
  },


  // ── STT (Speech-to-Text — PowerShell Windows) ──
  stt: {
    start: () => ipcRenderer.invoke('stt:start'),
    stop: () => ipcRenderer.invoke('stt:stop'),
    onResult: (callback: (result: {text: string}) => void) => {
      ipcRenderer.removeAllListeners('stt:result');
      ipcRenderer.on('stt:result', (_: unknown, result: {text: string}) => callback(result));
    },
    onStopped: (callback: () => void) => {
      ipcRenderer.removeAllListeners('stt:stopped');
      ipcRenderer.on('stt:stopped', () => callback());
    },
    offAll: () => {
      ipcRenderer.removeAllListeners('stt:result');
      ipcRenderer.removeAllListeners('stt:stopped');
    }
  },
  // ── LLM status (événement temps réel depuis main) ──
  onLLMDownloadProgress: (callback: (data: { progress: number, downloadedBytes: number, totalBytes: number }) => void) => {
    ipcRenderer.on('llm:download-progress', (_: unknown, data: any) => callback(data))
  },
  onLLMStatusChanged: (callback: (status: { running: boolean }) => void) => {
    ipcRenderer.on('llm:status-changed', (_: unknown, status: { running: boolean }) => callback(status))
  },


  // ── Auto Launch ──
  autoLaunch: {
    get: () => ipcRenderer.invoke('autolaunch:get'),
    set: (enabled: boolean) => ipcRenderer.invoke('autolaunch:set', enabled)
  },

  // ── App Info + Force Quit ──
  app: {
    notify: (title: string, body: string) => ipcRenderer.invoke('app:notify', title, body),
      version: () => ipcRenderer.invoke('app:version'),
    platform: () => ipcRenderer.invoke('app:platform'),
    name: () => ipcRenderer.invoke('app:name'),
    path: () => ipcRenderer.invoke('app:path'),
    quit: () => ipcRenderer.invoke('app:quit')
  },

  // ── Navigation (depuis tray/main) ──
  onNavigate: (callback: (route: string) => void) => {
    ipcRenderer.on('navigate', (_: unknown, route: string) => callback(route))
  },
  onNewChat: (callback: () => void) => {
    ipcRenderer.on('new-chat', () => callback())
  },
  onWakeWordCommand: (callback: (text: string) => void) => {
    ipcRenderer.on('wakeword:command', (_: unknown, text: string) => callback(text))
  },

  // ── Auth callback (depuis protocole eva-desktop://) ──
  onAuthCallback: (callback: (data: { refreshToken?: string; hid?: string }) => void) => {
    ipcRenderer.on('auth:callback', (_: unknown, data: { refreshToken?: string; hid?: string }) => callback(data))
  },

  // Connexion Puter via proxy (eva-desktop://puter?token=...)
  onPuterCallback: (callback: (data: { token: string }) => void) => {
    ipcRenderer.on('puter:callback', (_: unknown, data: { token: string }) => callback(data))
  },

  // ─── Splash Screen ───
  onSplashStatus: (callback: (status: string) => void) => {
    ipcRenderer.on('splash:status', (_: unknown, status: string) => callback(status))
  },
  onSplashDone: (callback: () => void) => {
    ipcRenderer.on('splash:done', () => callback())
  },

  // ── Ouvrir URL dans le navigateur système ──
  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),

  // ── Échange du refresh token via main process (Node.js, sans restriction CORS) ──
  exchangeToken: (refreshToken: string, apiKey: string) =>
    ipcRenderer.invoke('auth:exchangeToken', refreshToken, apiKey),

  // ── Popup Auth (conservé pour fallback futur) ──
  openAuthWindow: (url: string) => ipcRenderer.invoke('auth:openAuthWindow', url),

  // ── Overlay Agentique ──
  
  // ── TTS (Text-to-Speech — Windows SAPI) ──
  tts: {
    speak: (text: string) => ipcRenderer.invoke('tts:speak', text),
    stop: () => ipcRenderer.invoke('tts:stop'),
  },

overlay: {
    show: (state?: string) => ipcRenderer.invoke('overlay:show', state),
    hide: () => ipcRenderer.invoke('overlay:hide'),
    setState: (state: string, text?: string) => ipcRenderer.invoke('overlay:setState', state, text),
    sendAction: (action: string, data?: string) => ipcRenderer.send('overlay:action', action, data),
    onSetState: (callback: (state: string, text?: string) => void) => {
      const channel = 'overlay:setState'
      const listener = (_: unknown, state: string, text?: string) => callback(state, text)
      ipcRenderer.on(channel, listener)
      return () => ipcRenderer.removeListener(channel, listener)
    },
    onAction: (callback: (action: string, data?: string) => void) => {
      const channel = 'overlay:action'
      const listener = (_: unknown, action: string, data?: string) => callback(action, data)
      ipcRenderer.on(channel, listener)
      return () => ipcRenderer.removeListener(channel, listener)
    }
  }
}

contextBridge.exposeInMainWorld('eva', evaAPI)

// Type global pour TypeScript dans le renderer
// Note: EvaAPI est déclaré dans src/types/index.ts via declare global
