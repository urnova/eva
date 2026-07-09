const fs = require('fs');
let preload = fs.readFileSync('eva-pc/electron/preload.ts', 'utf8');

preload = preload.replace(
`    overlay: {
      show: (state?: string) => ipcRenderer.invoke('overlay:show', state),
      hide: () => ipcRenderer.invoke('overlay:hide'),
      setState: (state: string, text?: string) => ipcRenderer.invoke('overlay:setState', state, text),
      onAction: (callback: (action: string) => void) => {`,
`    overlay: {
      show: (state?: string) => ipcRenderer.invoke('overlay:show', state),
      hide: () => ipcRenderer.invoke('overlay:hide'),
      setState: (state: string, text?: string) => ipcRenderer.invoke('overlay:setState', state, text),
      onSetState: (callback: (state: string, text?: string) => void) => {
        const channel = 'overlay:setState'
        const listener = (_: unknown, state: string, text?: string) => callback(state, text)
        ipcRenderer.on(channel, listener)
        return () => ipcRenderer.removeListener(channel, listener)
      },
      onAction: (callback: (action: string) => void) => {`
);

fs.writeFileSync('eva-pc/electron/preload.ts', preload, 'utf8');
console.log('Added onSetState to preload.ts');
