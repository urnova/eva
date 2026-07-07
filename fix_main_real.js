const fs = require('fs');
const { execSync } = require('child_process');

try {
  execSync('git checkout 7ed4ee0 -- eva-pc/electron/main.ts', { stdio: 'inherit' });
  let mainTs = fs.readFileSync('eva-pc/electron/main.ts', 'utf8');

  // Fix the frame to true
  mainTs = mainTs.replace(/frame:\s*false,/, 'frame: true,');

  // Fix the corrupted string FenǦtre
  mainTs = mainTs.replace(/FenǦtre/g, 'Fenêtre');
  mainTs = mainTs.replace(/CrǸer/g, 'Créer');
  mainTs = mainTs.replace(/synchronisǸe/g, 'synchronisée');
  mainTs = mainTs.replace(/copiǸ/g, 'copié');
  mainTs = mainTs.replace(/tǽches/g, 'tâches');
  mainTs = mainTs.replace(/IgnorǸ/g, 'Ignoré');

  fs.writeFileSync('eva-pc/electron/main.ts', mainTs, 'utf8');
  console.log("SUCCESS");
} catch(err) {
  console.error("ERROR:", err);
}
