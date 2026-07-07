const fs = require('fs');
let mainTs = fs.readFileSync('eva-pc/electron/main.ts', 'utf8');

mainTs = mainTs.replace(
  "if (isDev) { mainWindow.webContents.once('did-finish-load', () => { setTimeout(launchMainApp, 1500); }); return; }",
  "if (isDev) { mainWindow?.webContents.once('did-finish-load', () => { setTimeout(launchMainApp, 1500); }); return; }"
);

mainTs = mainTs.replace(
  "const screenshot = await import('screenshot-desktop')",
  "// @ts-ignore\n    const screenshot = await import('screenshot-desktop')"
);

fs.writeFileSync('eva-pc/electron/main.ts', mainTs, 'utf8');
console.log("FIXED TS ERRORS");
