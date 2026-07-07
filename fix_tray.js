const fs = require('fs');
let mainTs = fs.readFileSync('eva-pc/electron/main.ts', 'utf8');

mainTs = mainTs.replace(/E\.V\.A.*Ouvrir/g, 'E.V.A — Ouvrir');
mainTs = mainTs.replace(/E\.V\.A.*Evolutionary Virtual Assistant/g, 'E.V.A — Evolutionary Virtual Assistant');

fs.writeFileSync('eva-pc/electron/main.ts', mainTs, 'utf8');
console.log("TRAY MENU FIXED");
