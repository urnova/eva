const fs = require('fs');
let mainTs = fs.readFileSync('eva-pc/electron/main.ts', 'utf8');

const replacement = `if (parsed.hostname === 'auth' || parsed.pathname.includes('auth')) {
        const params = new URLSearchParams(parsed.search)
        // Décoder le token (Windows peut modifier l'encodage URL)
        let refreshToken = params.get('refreshToken') || params.get('token')
        if (refreshToken) {
          try { refreshToken = decodeURIComponent(refreshToken) } catch { /* already decoded */ }
        }
        const hid = params.get('hid')
        if (refreshToken) {
          console.log('[EVA] Auth callback received, token prefix:', refreshToken.substring(0, 20))
          mainWindow.webContents.send('auth:callback', { refreshToken })
        } else if (hid) {
          mainWindow.webContents.send('auth:callback', { hid })
        }
        mainWindow.show()
        mainWindow.focus()
      } else if (parsed.hostname === 'puter' || parsed.pathname.includes('puter')) {
        const params = new URLSearchParams(parsed.search);
        let puterToken = params.get('token');
        if (puterToken) {
          try { puterToken = decodeURIComponent(puterToken); } catch {}
          console.log('[EVA] Puter auth callback received');
          mainWindow.webContents.send('puter:callback', { token: puterToken });
        }
        mainWindow.show();
        mainWindow.focus();
      }`;

mainTs = mainTs.replace(/if \(parsed\.hostname === 'auth' \|\| parsed\.pathname\.includes\('auth'\)\) \{[\s\S]*?mainWindow\.focus\(\)\n\s*\}/, replacement);

fs.writeFileSync('eva-pc/electron/main.ts', mainTs, 'utf8');
console.log("HANDLE DEEP LINK PUTER ADDED");
