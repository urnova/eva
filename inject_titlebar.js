const fs = require('fs');
let chatHtml = fs.readFileSync('eva-pc/web/chat.html', 'utf8');

const titlebarHtml = `
<!-- Barre de titre Electron -->
<div class="electron-titlebar" style="-webkit-app-region: drag; position: fixed; top: 0; left: 0; right: 0; height: 32px; background: rgba(17,17,19,0.9); border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between; align-items: center; z-index: 999999; backdrop-filter: blur(10px);">
  <div style="display: flex; align-items: center; padding-left: 12px; gap: 10px;">
    <img src="/assets/images/eva-logo.png" style="width: 16px; height: 16px; object-fit: contain;">
    <span style="color: #e4e4ef; font-family: 'Space Mono', monospace; font-size: 11px; font-weight: bold; letter-spacing: 1px;">E.V.A DESKTOP</span>
  </div>
  <div style="-webkit-app-region: no-drag; display: flex; height: 100%;">
    <button onclick="if(window.eva) window.eva.window.minimize()" style="width: 46px; height: 100%; background: transparent; border: none; color: #88889a; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.1)';this.style.color='#fff'" onmouseout="this.style.background='transparent';this.style.color='#88889a'">&#x2014;</button>
    <button onclick="if(window.eva) window.eva.window.maximize()" style="width: 46px; height: 100%; background: transparent; border: none; color: #88889a; cursor: pointer; transition: all 0.2s; font-size: 15px;" onmouseover="this.style.background='rgba(255,255,255,0.1)';this.style.color='#fff'" onmouseout="this.style.background='transparent';this.style.color='#88889a'">&#x25A1;</button>
    <button onclick="if(window.eva) window.eva.window.close()" style="width: 46px; height: 100%; background: transparent; border: none; color: #88889a; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='#e81123';this.style.color='#fff'" onmouseout="this.style.background='transparent';this.style.color='#88889a'">&#x2715;</button>
  </div>
</div>
`;

if (!chatHtml.includes('electron-titlebar')) {
  chatHtml = chatHtml.replace('<body>', '<body>\n' + titlebarHtml + '\n<style>body { padding-top: 32px; } .sidebar { height: calc(100% - 32px); top: 32px; }</style>');
  fs.writeFileSync('eva-pc/web/chat.html', chatHtml, 'utf8');
  console.log("TITLEBAR INJECTED");
} else {
  console.log("TITLEBAR ALREADY EXISTS");
}
