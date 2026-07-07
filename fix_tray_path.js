const fs = require('fs');
let mainTs = fs.readFileSync('eva-pc/electron/main.ts', 'utf8');

mainTs = mainTs.replace(/const trayIconPath = join\(__dirname, '.*'\)/g, "const trayIconPath = join(__dirname, '../public/eva-icon.png')");

fs.writeFileSync('eva-pc/electron/main.ts', mainTs, 'utf8');
console.log("TRAY ICON PATH FIXED");
