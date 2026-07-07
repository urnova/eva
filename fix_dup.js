const fs = require('fs');
let mainTs = fs.readFileSync('eva-pc/electron/main.ts', 'utf8');

// Remove the second titleBarStyle
mainTs = mainTs.replace(/\s*titleBarStyle:\s*'hidden',/g, ''); // Remove all
// Put it back exactly once
mainTs = mainTs.replace(/minHeight:\s*600,/, "minHeight: 600,\n      titleBarStyle: 'hidden',");

fs.writeFileSync('eva-pc/electron/main.ts', mainTs, 'utf8');
