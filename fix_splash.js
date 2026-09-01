const fs = require('fs');

const file = 'f:/code/eva/evaprojectmultiplatforme/eva-pc/web/splash.html';
if (fs.existsSync(file)) {
  let code = fs.readFileSync(file, 'utf8');
  
  // Fix encoding issues
  code = code.replace(/Mise Ã\s*jour/g, 'Mise à jour');
  code = code.replace(/TÃ©lÃ©charger/g, 'Télécharger');
  code = code.replace(/continuer Ã\s*utiliser/g, 'continuer à utiliser');
  code = code.replace(/VÃ©rification/g, 'Vérification');
  code = code.replace(/Mise Ã\s*jour trouvÃ©e/g, 'Mise à jour trouvée');
  code = code.replace(/tÃ©lÃ©chargÃ©e/g, 'téléchargée');
  code = code.replace(/prÃªte/g, 'prête');
  code = code.replace(/RedÃ©marrage/g, 'Redémarrage');
  code = code.replace(/SystÃ¨me/g, 'Système');
  code = code.replace(/DÃ©marrage/g, 'Démarrage');
  code = code.replace(/dÃ©marrage/g, 'démarrage');
  code = code.replace(/rÃ©seau/g, 'réseau');
  code = code.replace(/TÃ©lÃ©chargement/g, 'Téléchargement');
  code = code.replace(/Mise  jour/g, 'Mise à jour');
  
  fs.writeFileSync(file, code, 'utf8');
  console.log('Fixed splash.html');
}
