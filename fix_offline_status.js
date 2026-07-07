const fs = require('fs');

// 1. Modify main.ts
let mainTs = fs.readFileSync('eva-pc/electron/main.ts', 'utf8');

if (!mainTs.includes('let forceQuit = false')) {
  const targetQuit = `app.on('will-quit', () => {`;
  const replacementQuit = `let forceQuit = false;

app.on('before-quit', (e) => {
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

app.on('will-quit', () => {`;
  
  mainTs = mainTs.replace(targetQuit, replacementQuit);
  fs.writeFileSync('eva-pc/electron/main.ts', mainTs, 'utf8');
  console.log("FIXED MAIN.TS QUIT INTERCEPTION");
}

// 2. Modify pc-agent.js
let agentJs = fs.readFileSync('eva-pc/web/js/features/pc-agent.js', 'utf8');

if (!agentJs.includes('window.eva.onAppRequestQuit')) {
  // We need to add the ipc listener for 'app:request-quit' in preload.ts and then use it in pc-agent.js
  // Let's modify pc-agent.js first. Instead of window.eva.onAppQuit, we'll use window.eva.onAppRequestQuit
  
  const targetAgentQuit = `window.addEventListener('beforeunload', () => {
        docRef.update({ online: false, lastSeen: typeof window.timestamp === 'function' ? window.timestamp() : new Date() }).catch(()=>{});
      });
      
      if (window.eva && window.eva.onAppQuit) {
        window.eva.onAppQuit(() => {
          docRef.update({ online: false, lastSeen: typeof window.timestamp === 'function' ? window.timestamp() : new Date() }).catch(()=>{});
        });
      }`;
      
  const replacementAgentQuit = `window.addEventListener('beforeunload', () => {
        docRef.update({ online: false, lastSeen: typeof window.timestamp === 'function' ? window.timestamp() : new Date() }).catch(()=>{});
      });
      
      if (window.eva && window.eva.onAppRequestQuit) {
        window.eva.onAppRequestQuit(async () => {
          try {
            await docRef.update({ online: false, lastSeen: typeof window.timestamp === 'function' ? window.timestamp() : new Date() });
          } catch(e) {}
          window.eva.sendQuitReady();
        });
      }`;
      
  agentJs = agentJs.replace(targetAgentQuit, replacementAgentQuit);
  fs.writeFileSync('eva-pc/web/js/features/pc-agent.js', agentJs, 'utf8');
  console.log("FIXED PC-AGENT.JS QUIT HANDLING");
}

// 3. Modify preload.ts
let preloadTs = fs.readFileSync('eva-pc/electron/preload.ts', 'utf8');
if (!preloadTs.includes('onAppRequestQuit: (callback: () => void) => ipcRenderer.on(')) {
  const targetPreload = `onAppQuit: (callback: () => void) => ipcRenderer.on('app:quit', callback),`;
  const replacementPreload = `onAppQuit: (callback: () => void) => ipcRenderer.on('app:quit', callback),
  onAppRequestQuit: (callback: () => void) => ipcRenderer.on('app:request-quit', callback),
  sendQuitReady: () => ipcRenderer.send('app:quit-ready'),`;
  
  preloadTs = preloadTs.replace(targetPreload, replacementPreload);
  fs.writeFileSync('eva-pc/electron/preload.ts', preloadTs, 'utf8');
  console.log("FIXED PRELOAD.TS");
}

