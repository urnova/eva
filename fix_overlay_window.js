const fs = require('fs');
let mainTs = fs.readFileSync('eva-pc/electron/main.ts', 'utf8');

const target = `    overlayWindow = new BrowserWindow({
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
    } else {`;

const replacement = `    overlayWindow = new BrowserWindow({
      width: overlayWidth,
      height: overlayHeight,
      x: width - overlayWidth - 20, // En haut à droite, avec un peu de marge
      y: 20,
      transparent: true,
      frame: false,
      alwaysOnTop: true,
      resizable: false,
      skipTaskbar: true,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: join(__dirname, 'preload.js')
      }
    })

    overlayWindow.setAlwaysOnTop(true, 'screen-saver')

    if (isDev) {
      overlayWindow.loadFile(join(__dirname, '../web/overlay.html'))
    } else {
      overlayWindow.loadFile(join(__dirname, '../web/overlay.html'))
    }`;

// Replace everything between "overlayWindow = new BrowserWindow" and "} else {" 
// Wait, regex might fail with French accents. Let's do a substring replace or a simpler regex.
mainTs = mainTs.replace(/overlayWindow = new BrowserWindow\(\{[\s\S]*?else \{/m, replacement);

fs.writeFileSync('eva-pc/electron/main.ts', mainTs, 'utf8');
console.log("OVERLAY WINDOW CONFIG FIXED");
