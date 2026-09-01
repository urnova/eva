const fs = require('fs');

const mainTsPath = 'f:/code/eva/evaprojectmultiplatforme/eva-pc/electron/main.ts';
if (fs.existsSync(mainTsPath)) {
  let mainTs = fs.readFileSync(mainTsPath, 'utf8');
  
  // Fix weird characters
  mainTs = mainTs.replace(/VǸrification/g, 'Vérification');
  mainTs = mainTs.replace(/Mise  jour trouvǸe/g, 'Mise à jour trouvée');
  mainTs = mainTs.replace(/TǸlǸchargement/g, 'Téléchargement');
  mainTs = mainTs.replace(/tǸlǸchargǸe/g, 'téléchargée');
  mainTs = mainTs.replace(/prǦte/g, 'prête');
  mainTs = mainTs.replace(/RedǸmarrage/g, 'Redémarrage');
  mainTs = mainTs.replace(/Systme/g, 'Système');
  mainTs = mainTs.replace(/DǸmarrage/g, 'Démarrage');
  mainTs = mainTs.replace(/rǸseau/g, 'réseau');
  mainTs = mainTs.replace(/Mise  jour/g, 'Mise à jour');
  
  // Add error catch to IPC handle
  mainTs = mainTs.replace(/autoUpdater\.downloadUpdate\(\)\.catch\(console\.error\);/g, 
    `autoUpdater.downloadUpdate().catch(err => {
      console.error(err);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('updater:error', err ? err.toString() : 'Unknown error');
      }
    });`);
    
  // Add updater:error handler
  let targetError = `autoUpdater.on('error', (err) => {`;
  let newError = `autoUpdater.on('error', (err) => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('updater:error', err ? err.toString() : 'Unknown error');`;
  mainTs = mainTs.replace(targetError, newError);
  
  fs.writeFileSync(mainTsPath, mainTs, 'utf8');
}

const splashPath = 'f:/code/eva/evaprojectmultiplatforme/eva-pc/web/splash.html';
if (fs.existsSync(splashPath)) {
  let splash = fs.readFileSync(splashPath, 'utf8');
  
  // Display error in modal
  let targetScript = `window.eva.updater.onUpdateProgress((prog) => {`;
  let newScript = `if (window.eva.updater.onUpdateError) {
          window.eva.updater.onUpdateError((err) => {
            document.getElementById('update-progress').style.display = 'none';
            document.getElementById('update-actions').style.display = 'flex';
            downloadStarted = false;
            let infoDiv = document.getElementById('update-info');
            infoDiv.style.display = 'block';
            infoDiv.innerHTML = '<b style="color:var(--red)">Erreur de tlchargement:</b><br><span style="color:var(--red);font-size:0.8em">' + err + '</span><br>Veuillez ressayer ou tlcharger manuellement depuis GitHub.';
          });
        }
        
        window.eva.updater.onUpdateProgress((prog) => {`;
        
  splash = splash.replace(targetScript, newScript);
  
  fs.writeFileSync(splashPath, splash, 'utf8');
}

const preloadPath = 'f:/code/eva/evaprojectmultiplatforme/eva-pc/electron/preload.ts';
if (fs.existsSync(preloadPath)) {
  let preload = fs.readFileSync(preloadPath, 'utf8');
  
  let targetAPI = `onUpdateDownloaded: (callback: () => void) => ipcRenderer.on('updater:downloaded', callback)`;
  let newAPI = `onUpdateDownloaded: (callback: () => void) => ipcRenderer.on('updater:downloaded', callback),\n    onUpdateError: (callback: (err: any) => void) => ipcRenderer.on('updater:error', (e, err) => callback(err))`;
  
  preload = preload.replace(targetAPI, newAPI);
  fs.writeFileSync(preloadPath, preload, 'utf8');
}
