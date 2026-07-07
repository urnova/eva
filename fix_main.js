const fs = require('fs');
const { execSync } = require('child_process');

try {
  execSync('git checkout 628dbcf -- eva-pc/electron/main.ts', { stdio: 'inherit' });
  let mainTs = fs.readFileSync('eva-pc/electron/main.ts', 'utf8');

  // Add titleBarStyle and titleBarOverlay to the main window
  mainTs = mainTs.replace(
    /minHeight:\s*600,/,
    "minHeight: 600,\n      titleBarStyle: 'hidden',\n      titleBarOverlay: { color: '#111113', symbolColor: '#7b8bf5', height: 32 },"
  );
  
  // Remove frame: false ONLY for the main window (the first occurrence)
  mainTs = mainTs.replace(/frame:\s*false,\s*\/\/\s*Fenêtre sans bordure native/, 'frame: true,');

  fs.writeFileSync('eva-pc/electron/main.ts', mainTs, 'utf8');
  console.log("SUCCESS");
} catch(err) {
  console.error("ERROR:", err);
}
