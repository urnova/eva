const fs = require('fs');
let preload = fs.readFileSync('eva-pc/electron/preload.ts', 'utf8');

const target = `onAuthCallback: (callback: (data: { refreshToken?: string; hid?: string }) => void) => {
    ipcRenderer.on('auth:callback', (_: unknown, data: { refreshToken?: string; hid?: string }) => callback(data))
  },`;

const replacement = target + `

  // Connexion Puter via proxy (eva-desktop://puter?token=...)
  onPuterCallback: (callback: (data: { token: string }) => void) => {
    ipcRenderer.on('puter:callback', (_: unknown, data: { token: string }) => callback(data))
  },`;

preload = preload.replace(/onAuthCallback:[\s\S]*?\},/, replacement);

fs.writeFileSync('eva-pc/electron/preload.ts', preload, 'utf8');
console.log("PRELOAD UPDATED");
