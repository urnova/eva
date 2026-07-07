const fs = require('fs');

const titlebarHTML = `<!-- Barre de titre Electron -->
<div class="electron-titlebar" style="-webkit-app-region: drag; position: fixed; top: 0; left: 0; right: 0; height: 32px; background: rgba(17,17,19,0.9); border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between; align-items: center; z-index: 999999; backdrop-filter: blur(10px);">
  <div style="display: flex; align-items: center; padding-left: 12px; gap: 10px;">
    <img src="./assets/images/eva-logo.png" style="width: 16px; height: 16px; object-fit: contain;">
    <span style="color: #e4e4ef; font-family: 'Space Mono', monospace; font-size: 11px; font-weight: bold; letter-spacing: 1px;">E.V.A DESKTOP</span>
  </div>
  <div style="-webkit-app-region: no-drag; display: flex; height: 100%;">
    <button onclick="if(window.eva) window.eva.window.minimize()" style="width: 46px; height: 100%; background: transparent; border: none; color: #88889a; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.1)';this.style.color='#fff'" onmouseout="this.style.background='transparent';this.style.color='#88889a'">&#x2014;</button>
    <button onclick="if(window.eva) window.eva.window.maximize()" style="width: 46px; height: 100%; background: transparent; border: none; color: #88889a; cursor: pointer; transition: all 0.2s; font-size: 15px;" onmouseover="this.style.background='rgba(255,255,255,0.1)';this.style.color='#fff'" onmouseout="this.style.background='transparent';this.style.color='#88889a'">&#x25A1;</button>
    <button onclick="if(window.eva) window.eva.window.close()" style="width: 46px; height: 100%; background: transparent; border: none; color: #88889a; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='#e81123';this.style.color='#fff'" onmouseout="this.style.background='transparent';this.style.color='#88889a'">&#x2715;</button>
  </div>
</div>
`;

// Fix main.ts
let mainTs = fs.readFileSync('eva-pc/electron/main.ts', 'utf8');
mainTs = mainTs.replace(/frame:\s*true,/, 'frame: false,');
mainTs = mainTs.replace(/titleBarStyle:\s*'hidden',\s*titleBarOverlay:\s*\{[^}]+\},/, '');
fs.writeFileSync('eva-pc/electron/main.ts', mainTs, 'utf8');

// Fix app-login.html
let login = fs.readFileSync('eva-pc/web/app-login.html', 'utf8');
if (!login.includes('electron-titlebar')) {
  login = login.replace(/<div class="page">/, titlebarHTML + '\n<div class="page" style="padding-top: 32px;">');
}
// Enlarge logo massively
login = login.replace(/width:250px;/, 'width:380px;');
fs.writeFileSync('eva-pc/web/app-login.html', login, 'utf8');

// Fix chat.html
let chat = fs.readFileSync('eva-pc/web/chat.html', 'utf8');
if (!chat.includes('electron-titlebar')) {
  chat = chat.replace(/<div class="app-container">/, titlebarHTML + '\n<div class="app-container" style="padding-top: 32px;">');
}
fs.writeFileSync('eva-pc/web/chat.html', chat, 'utf8');

console.log("UI_RESTORED");
