const fs = require('fs');

function patchPC() {
  const path = 'f:/code/eva/evaprojectmultiplatforme/eva-pc/web/chat.html';
  let html = fs.readFileSync(path, 'utf8');

  // Insert the Title Bar right after <body>
  if (!html.includes('electron-titlebar')) {
    const titleBar = `
<div class="electron-titlebar" style="-webkit-app-region: drag; position: fixed; top: 0; left: 0; right: 0; height: 32px; background: rgba(17,17,19,0.9); border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between; align-items: center; z-index: 999999; backdrop-filter: blur(10px);">
    <div style="display: flex; align-items: center; padding-left: 12px; gap: 10px;">
      <img src="/assets/images/eva-logo.png" style="width: 16px; height: 16px; object-fit: contain;">
      <span style="color: #e4e4ef; font-family: 'Space Mono', monospace; font-size: 11px; font-weight: bold; letter-spacing: 1px;">E.V.A DESKTOP <span id="app-version-display" style="color: #7b8bf5; font-size: 10px; margin-left: 6px;"></span></span>
  <script>
    setTimeout(() => {
      if(window.eva && window.eva.app && window.eva.app.version) {
        window.eva.app.version().then(v => {
          const el = document.getElementById('app-version-display');
          if(el) el.innerText = "v" + v;
        }).catch(e=>console.error('Error fetching version:', e));
      }
    }, 100);
  </script>
    </div>
    <div style="-webkit-app-region: no-drag; display: flex; height: 100%;">
      <button onclick="if(window.eva) window.eva.window.minimize()" style="width: 46px; height: 100%; background: transparent; border: none; color: #88889a; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.1)';this.style.color='#fff'" onmouseout="this.style.background='transparent';this.style.color='#88889a'">&#x2014;</button>
      <button onclick="if(window.eva) window.eva.window.maximize()" style="width: 46px; height: 100%; background: transparent; border: none; color: #88889a; cursor: pointer; transition: all 0.2s; font-size: 15px;" onmouseover="this.style.background='rgba(255,255,255,0.1)';this.style.color='#fff'" onmouseout="this.style.background='transparent';this.style.color='#88889a'">&#x25A1;</button>
      <button onclick="if(window.pcAgentDocRef){window.pcAgentDocRef.update({online:false}).finally(()=>{if(window.eva)window.eva.window.close()})}else if(window.eva){window.eva.window.close()}" style="width: 46px; height: 100%; background: transparent; border: none; color: #88889a; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='#e81123';this.style.color='#fff'" onmouseout="this.style.background='transparent';this.style.color='#88889a'">&#x2715;</button>
    </div>
  </div>
  <style>
    body { padding-top: 32px !important; box-sizing: border-box; height: 100vh; overflow: hidden; display: flex; flex-direction: row; }
    .sidebar { height: calc(100vh - 32px) !important; top: 32px !important; }
    .main-wrapper, .main-content, #appContainer, .app-main { height: calc(100vh - 32px) !important; }
  </style>
`;
    html = html.replace('<body>', '<body>\n' + titleBar);
  }

  // Restore pc-agent.js script reference
  if (!html.includes('pc-agent.js')) {
    html = html.replace('<script src="/js/features/cloudworks.js"></script>', '<script src="/js/features/cloudworks.js"></script>\n<script src="/js/features/pc-agent.js"></script>');
  }

  fs.writeFileSync(path, html, 'utf8');
  console.log("Patched chat.html");
}

patchPC();
