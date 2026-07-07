const fs = require('fs');
const { execSync } = require('child_process');

try {
  // Restore main.ts from 7ed4ee0 which has the correct splash screen logic
  execSync('git checkout 7ed4ee0 -- eva-pc/electron/main.ts', { stdio: 'inherit' });
  let mainTs = fs.readFileSync('eva-pc/electron/main.ts', 'utf8');

  // Fix the frame to true to ensure native buttons show up
  mainTs = mainTs.replace(/frame:\s*false,/, 'frame: true,');

  // Add the titleBarOverlay missing in 7ed4ee0
  mainTs = mainTs.replace(
    /titleBarStyle:\s*'hidden',/,
    "titleBarStyle: 'hidden',\n      titleBarOverlay: { color: '#111113', symbolColor: '#7b8bf5', height: 32 },"
  );

  fs.writeFileSync('eva-pc/electron/main.ts', mainTs, 'utf8');
  console.log("SUCCESS");
} catch(err) {
  console.error("ERROR:", err);
}
