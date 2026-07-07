const fs = require('fs');
let mainTs = fs.readFileSync('eva-pc/electron/main.ts', 'utf8');

const target = `    if (isDev) {`;
const replacement = `    // Autoriser les popups d'authentification (Puter, etc.)
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      if (url.includes('puter.com') || url.includes('auth')) {
        return {
          action: 'allow',
          overrideBrowserWindowOptions: {
            frame: true,
            autoHideMenuBar: true,
            webPreferences: {
              nodeIntegration: false,
              contextIsolation: true
            }
          }
        };
      }
      require('electron').shell.openExternal(url);
      return { action: 'deny' };
    });

    if (isDev) {`;

mainTs = mainTs.replace(target, replacement);

fs.writeFileSync('eva-pc/electron/main.ts', mainTs, 'utf8');
console.log("WINDOW OPEN HANDLER ADDED");
