const fs = require('fs');

let mainContent = fs.readFileSync('eva-pc/electron/main.ts', 'utf8');
mainContent = mainContent.replace("const fetch = (await import('node-fetch')).default || require('node-fetch');", "");
fs.writeFileSync('eva-pc/electron/main.ts', mainContent);

let preloadContent = fs.readFileSync('eva-pc/electron/preload.ts', 'utf8');
if (!preloadContent.includes('llmChat')) {
  preloadContent = preloadContent.replace(
    /info: \(\) => ipcRenderer\.invoke\('system:info'\),/,
    "info: () => ipcRenderer.invoke('system:info'),\n      llmChat: (messages) => ipcRenderer.invoke('llm:chat', messages),"
  );
  fs.writeFileSync('eva-pc/electron/preload.ts', preloadContent);
  console.log("preload.ts updated");
}
