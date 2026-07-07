const fs = require('fs');
let mainTs = fs.readFileSync('eva-pc/electron/main.ts', 'utf8');

// Add titleBarStyle and titleBarOverlay to the main window
mainTs = mainTs.replace(
  /minHeight:\s*600,/,
  "minHeight: 600,\n      titleBarStyle: 'hidden',\n      titleBarOverlay: { color: '#111113', symbolColor: '#7b8bf5', height: 32 },"
);

fs.writeFileSync('eva-pc/electron/main.ts', mainTs, 'utf8');
console.log("SUCCESS");
