const fs = require('fs');
let mainTs = fs.readFileSync('eva-pc/electron/main.ts', 'utf8');

// Supprimer le code injecté par erreur dans createOverlayWindow
const wrongInjectionRegex = /\s*\/\/\s*Autoriser les popups d'authentification \(Puter, etc\.\)[\s\S]*?require\('electron'\)\.shell\.openExternal\(url\);\s*return \{ action: 'deny' \};\s*\}\);\s*if \(isDev\) \{/m;

mainTs = mainTs.replace(wrongInjectionRegex, '\n  if (isDev) {');

// Ajouter le code correct dans createWindow
const target = `    // 🚀 Chargement de l'URL 🚀
    if (isDev) {`;

const replacement = `    // 🚀 Chargement de l'URL 🚀
    // Autoriser les popups d'authentification (Puter, etc.)
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
console.log("FIXED BRACKETS IN MAIN TS");
