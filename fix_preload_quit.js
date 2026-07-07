const fs = require('fs');
let preloadTs = fs.readFileSync('eva-pc/electron/preload.ts', 'utf8');

const replacement = `  // 🔒 App Quit
  onAppQuit: (callback: () => void) => {
    ipcRenderer.on('app:quit-request', callback)
  },`;

preloadTs = preloadTs.replace(`const evaAPI = {`, `const evaAPI = {\n` + replacement);

fs.writeFileSync('eva-pc/electron/preload.ts', preloadTs, 'utf8');
console.log("PRELOAD APP QUIT ADDED");
