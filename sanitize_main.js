const fs = require('fs');
let mainTs = fs.readFileSync('eva-pc/electron/main.ts', 'utf8');

mainTs = mainTs.replace(/FenǦtre/g, 'Fenetre');
mainTs = mainTs.replace(/CrǸer/g, 'Creer');
mainTs = mainTs.replace(/synchronisǸe/g, 'synchronisee');
mainTs = mainTs.replace(/copiǸ/g, 'copie');
mainTs = mainTs.replace(/tǽches/g, 'taches');
mainTs = mainTs.replace(/IgnorǸ/g, 'Ignore');
mainTs = mainTs.replace(/VǸrification/g, 'Verification');
mainTs = mainTs.replace(/TǸlǸchargement/g, 'Telechargement');
mainTs = mainTs.replace(/Systme/g, 'Systeme');
mainTs = mainTs.replace(/DǸmarrage/g, 'Demarrage');
mainTs = mainTs.replace(/rǸseau/g, 'reseau');
mainTs = mainTs.replace(/tǸlǸchargǸe/g, 'telechargee');
mainTs = mainTs.replace(/prǦte/g, 'prete');
mainTs = mainTs.replace(/RedǸmarrage/g, 'Redemarrage');
mainTs = mainTs.replace(/DǸpt PrivǸ/g, 'Depot Prive');
mainTs = mainTs.replace(/vǸrification/g, 'verification');

fs.writeFileSync('eva-pc/electron/main.ts', mainTs, 'utf8');
console.log("SANITIZED");
