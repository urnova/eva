const fs = require('fs');
let mainTs = fs.readFileSync('eva-pc/electron/main.ts', 'utf8');

mainTs = mainTs.replace(/E\.V\.A \?\" Ouvrir/g, 'E.V.A — Ouvrir');
mainTs = mainTs.replace(/Mise \? jour/g, 'Mise à jour');
mainTs = mainTs.replace(/T\?l\?chargement/g, 'Téléchargement');
mainTs = mainTs.replace(/V\?rification/g, 'Vérification');
mainTs = mainTs.replace(/D\?p\?t/g, 'Dépôt');
mainTs = mainTs.replace(/Priv\?/g, 'Privé');
mainTs = mainTs.replace(/E\.V\.A \?\" Evolutionary Virtual Assistant/g, 'E.V.A — Evolutionary Virtual Assistant');
mainTs = mainTs.replace(/const trayIconPath = join\(__dirname, '\.\.\/public\/eva-tray\.png'\)/g, "const trayIconPath = join(__dirname, '../web/assets/images/eva-logo.png')");

// Also there might be some other garbled chars in comments, but they don't affect UI.
// Let's also fix "Quitter EVA" to "Quitter E.V.A" just in case.
mainTs = mainTs.replace(/Quitter EVA/g, 'Quitter E.V.A');

fs.writeFileSync('eva-pc/electron/main.ts', mainTs, 'utf8');
console.log("MAIN TS ACCENTS AND TRAY FIXED");
