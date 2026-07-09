const fs = require('fs');
let main = fs.readFileSync('eva-pc/electron/main.ts', 'utf8');

if (!main.includes('app.disableHardwareAcceleration()')) {
  main = main.replace(
    `import { app, BrowserWindow, ipcMain, dialog, shell, Tray, Menu, nativeImage, globalShortcut } from 'electron'`,
    `import { app, BrowserWindow, ipcMain, dialog, shell, Tray, Menu, nativeImage, globalShortcut } from 'electron'\napp.disableHardwareAcceleration();`
  );
  fs.writeFileSync('eva-pc/electron/main.ts', main, 'utf8');
  console.log('Added app.disableHardwareAcceleration()');
}
