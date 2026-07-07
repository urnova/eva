const fs = require('fs');
console.log(fs.readFileSync('eva-pc/electron/main.ts', 'utf8').indexOf('public/splash.html'));
console.log(fs.readFileSync('eva-pc/electron/main.ts', 'utf8').indexOf('splashWindow'));
