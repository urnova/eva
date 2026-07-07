const fs = require('fs');
let mainTs = fs.readFileSync('eva-pc/electron/main.ts', 'utf8');

// Change loadURL back to splash.html
mainTs = mainTs.replace(/'http:\/\/localhost:5173\/chat\.html'/, "process.env.VITE_DEV_SERVER_URL ? `${process.env.VITE_DEV_SERVER_URL}splash.html` : ''");
mainTs = mainTs.replace(/mainWindow\.loadFile\(join\(__dirname, '\.\.\/dist\/chat\.html'\)\)/, "mainWindow.loadFile(join(__dirname, '../dist/splash.html'))");

fs.writeFileSync('eva-pc/electron/main.ts', mainTs, 'utf8');
