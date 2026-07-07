const fs = require('fs');
let mainTs = fs.readFileSync('eva-pc/electron/main.ts', 'utf8');

const targetMenu = `{ label: 'Quitter EVA', click: () => { app.isQuitting = true; app.quit() } }`;
const replacementMenu = `{ label: 'Quitter EVA', click: () => { app.isQuitting = true; mainWindow?.webContents.send('app:quit-request'); setTimeout(() => app.quit(), 1000); } }`;
mainTs = mainTs.replace(targetMenu, replacementMenu);

fs.writeFileSync('eva-pc/electron/main.ts', mainTs, 'utf8');
console.log("MAIN TRAY QUIT FIXED");
