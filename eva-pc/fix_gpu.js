const fs = require('fs');
let main = fs.readFileSync('eva-pc/electron/main.ts', 'utf8');

if (!main.includes('app.disableHardwareAcceleration()')) {
  main = main.replace(
    `import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, screen } from 'electron'`,
    `import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, screen } from 'electron'\napp.disableHardwareAcceleration();`
  );
  fs.writeFileSync('eva-pc/electron/main.ts', main, 'utf8');
}
