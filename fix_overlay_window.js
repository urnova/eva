const fs = require('fs');
let mainTs = fs.readFileSync('eva-pc/electron/main.ts', 'utf8');

const regex = /function createOverlayWindow\(\) \{[\s\S]*?store\.set\('windowBounds', bounds\)\s*\}/m;

const correctCode = `function createOverlayWindow() {
  const { screen } = require('electron')
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width, height } = primaryDisplay.workAreaSize

  const overlayWidth = 340
  const overlayHeight = 140

  overlayWindow = new BrowserWindow({
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
    overlayWindow.loadFile(join(__dirname, '../dist/overlay.html'))
  }

  overlayWindow.on('closed', () => { overlayWindow = null })
}

function saveBounds() {
  if (!mainWindow) return
  const bounds = mainWindow.getBounds()
  store.set('windowBounds', bounds)
}`;

mainTs = mainTs.replace(regex, correctCode);
fs.writeFileSync('eva-pc/electron/main.ts', mainTs, 'utf8');
console.log("FIXED CREATEOVERLAYWINDOW");
