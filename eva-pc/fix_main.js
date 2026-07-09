const fs = require('fs');
const file = 'eva-pc/electron/main.ts';
let code = fs.readFileSync(file, 'utf8');

// 1. Add GPU switches and userData path at top
const target1 = `import { app, BrowserWindow, ipcMain, dialog, shell, Tray, Menu, nativeImage, globalShortcut } from 'electron'
app.disableHardwareAcceleration();`;

const repl1 = `import { app, BrowserWindow, ipcMain, dialog, shell, Tray, Menu, nativeImage, globalShortcut } from 'electron'
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.disableHardwareAcceleration();

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
if (isDev) {
  app.setPath('userData', require('path').join(app.getPath('appData'), 'eva-dev-' + process.pid));
}`;

code = code.replace(target1, repl1);

// 2. Remove duplicate isDev
const target2 = `let tray: Tray | null = null
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged`;

const repl2 = `let tray: Tray | null = null`;

code = code.replace(target2, repl2);

// 3. Fix ready-to-show and loadURL
const target3 = `    show: false // On affiche aprÃ¨s ready-to-show
  })

  // â”€â”€â”€ Chargement de l'URL â”€â”€â”€
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173/splash.html')
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(join(__dirname, '../dist/splash.html'))
  }

  // â”€â”€â”€ Affichage â”€â”€â”€
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })`;

const repl3 = `    show: false
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  if (isDev) {
    const loadDevURL = () => {
      mainWindow?.loadURL('http://localhost:5173/splash.html').catch(e => {
        console.log('Vite not ready, retrying...', e.message);
        setTimeout(loadDevURL, 500);
      });
    };
    loadDevURL();
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(join(__dirname, '../dist/splash.html'))
  }`;

// Note: special chars in target3 might fail due to encoding. Let's use regex.
code = code.replace(/show: false[\s\S]+?mainWindow\?\.show\(\)[\s\S]+?\}\)/, repl3);

fs.writeFileSync(file, code, 'utf8');
console.log('main.ts updated via script');
