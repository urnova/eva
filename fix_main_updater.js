const fs = require('fs');
let mainTs = fs.readFileSync('eva-pc/electron/main.ts', 'utf8');

const target1 = `autoUpdater.requestHeaders = { "Authorization": "token " + _t }`;
const replacement1 = `autoUpdater.requestHeaders = { "Authorization": "token " + _t }
  autoUpdater.autoDownload = false`;
mainTs = mainTs.replace(target1, replacement1);

const target2 = `autoUpdater.on('update-available', (info) => {
    console.log('[AutoUpdater] Mise à jour disponible:', info)
    if (mainWindow) mainWindow.webContents.send('splash:status', 'Mise à jour trouvée. Téléchargement...')
    if (mainWindow) mainWindow.webContents.send('updater:available', info)
  })`;
const replacement2 = `autoUpdater.on('update-available', (info) => {
    console.log('[AutoUpdater] Mise à jour disponible:', info)
    if (mainWindow) mainWindow.webContents.send('splash:status', 'Mise à jour trouvée !')
    if (mainWindow) mainWindow.webContents.send('updater:available', info)
  })
  
  autoUpdater.on('download-progress', (progressObj) => {
    if (mainWindow) mainWindow.webContents.send('updater:progress', progressObj)
  })
  
  ipcMain.handle('updater:start-download', () => {
    autoUpdater.downloadUpdate()
  })
  
  ipcMain.handle('updater:quit-and-install', () => {
    autoUpdater.quitAndInstall(true, true)
  })`;
mainTs = mainTs.replace(target2, replacement2);

fs.writeFileSync('eva-pc/electron/main.ts', mainTs, 'utf8');
console.log("MAIN UPDATER MODIFIED");
