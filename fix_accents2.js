const fs = require('fs');
let mainTs = fs.readFileSync('eva-pc/electron/main.ts', 'utf8');

mainTs = mainTs.replace(/E\.V\.A \uFFFD" Ouvrir/g, 'E.V.A — Ouvrir');
mainTs = mainTs.replace(/E\.V\.A \uFFFD" Evolutionary/g, 'E.V.A — Evolutionary');
mainTs = mainTs.replace(/Mise \uFFFD jour/g, 'Mise à jour');
mainTs = mainTs.replace(/T\uFFFDl\uFFFDchargement/g, 'Téléchargement');
mainTs = mainTs.replace(/V\uFFFDrification/g, 'Vérification');
mainTs = mainTs.replace(/D\uFFFDp\uFFFDt/g, 'Dépôt');
mainTs = mainTs.replace(/Priv\uFFFD/g, 'Privé');
mainTs = mainTs.replace(/t\uFFFDl\uFFFDcharg\uFFFDe/g, 'téléchargée');
mainTs = mainTs.replace(/pr\uFFFDte/g, 'prête');
mainTs = mainTs.replace(/Red\uFFFDmarrage/g, 'Redémarrage');

fs.writeFileSync('eva-pc/electron/main.ts', mainTs, 'utf8');
console.log("ACCENTS COMPLETELY FIXED");
