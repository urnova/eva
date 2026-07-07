const fs = require('fs');
let preloadTs = fs.readFileSync('eva-pc/electron/preload.ts', 'utf8');

const target = `// 🔒 App Quit`;
const replacement = `// 🔄 Updater
  updater: {
    startDownload: () => ipcRenderer.invoke('updater:start-download'),
    quitAndInstall: () => ipcRenderer.invoke('updater:quit-and-install'),
    onUpdateAvailable: (callback: (info: any) => void) => ipcRenderer.on('updater:available', (e, info) => callback(info)),
    onUpdateProgress: (callback: (progress: any) => void) => ipcRenderer.on('updater:progress', (e, info) => callback(info)),
    onUpdateDownloaded: (callback: () => void) => ipcRenderer.on('updater:downloaded', callback)
  },
  
  // 🔒 App Quit`;

preloadTs = preloadTs.replace(target, replacement);
fs.writeFileSync('eva-pc/electron/preload.ts', preloadTs, 'utf8');
console.log("PRELOAD UPDATER ADDED");
