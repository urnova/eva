const fs = require('fs');

let mainPath = 'eva-pc/electron/main.ts';
let mainTS = fs.readFileSync(mainPath, 'utf8');

// Add IPC handlers for updater
if (!mainTS.includes("ipcMain.handle('updater:start-download'")) {
  let ipcTarget = "ipcMain.handle('app:path', () => app.getPath('userData'))";
  let insertIPC = `ipcMain.handle('app:path', () => app.getPath('userData'))

// --- Updater IPC ---
ipcMain.handle('updater:start-download', () => {
  if (!isDev) {
    autoUpdater.downloadUpdate().catch(console.error);
  }
})
ipcMain.handle('updater:quit-and-install', () => {
  if (!isDev) {
    autoUpdater.quitAndInstall(true, true);
  }
})
autoUpdater.on('download-progress', (progressObj) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('updater:progress', progressObj);
  }
});
`;
  mainTS = mainTS.replace(ipcTarget, insertIPC);
}

// Check for updates on window show
if (!mainTS.includes("mainWindow.on('show', () => {")) {
  let showTarget = "mainWindow.on('close', (event) => {";
  let insertShow = `mainWindow.on('show', () => {
    if (!isDev) {
      autoUpdater.checkForUpdatesAndNotify().catch(console.error);
    }
  })
  mainWindow.on('close', (event) => {`;
  mainTS = mainTS.replace(showTarget, insertShow);
}

fs.writeFileSync(mainPath, mainTS, 'utf8');
