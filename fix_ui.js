const fs = require('fs');
const path = require('path');

const basePath = 'f:/code/eva/evaprojectmultiplatforme/eva-pc/web';

// Titlebar HTML + CSS
const titlebarHtml = 
  <style>
    .electron-titlebar {
      position: fixed; top: 0; left: 0; width: 100%; height: 32px;
      background: rgba(17, 17, 19, 0.95); z-index: 10000;
      display: flex; justify-content: space-between; align-items: center;
      border-bottom: 1px solid rgba(255,255,255,0.05);
      -webkit-app-region: drag;
      font-family: 'Space Mono', monospace;
    }
    .electron-titlebar .title { padding-left: 15px; font-size: 0.7em; color: #7b8bf5; letter-spacing: 2px; font-weight: 700; }
    .electron-titlebar .controls { display: flex; height: 100%; -webkit-app-region: no-drag; }
    .electron-titlebar .tb-btn {
      width: 45px; height: 100%; background: transparent; border: none; color: #aaa;
      cursor: pointer; display: flex; align-items: center; justify-content: center; font-family: sans-serif;
      transition: 0.2s;
    }
    .electron-titlebar .tb-btn:hover { background: rgba(255,255,255,0.1); color: #fff; }
    .electron-titlebar .tb-btn.close:hover { background: #e81123; color: #fff; }
  </style>
  <div class="electron-titlebar">
    <div class="title">EVA DESKTOP</div>
    <div class="controls">
      <button class="tb-btn" onclick="if(window.eva) window.eva.window.minimize()">_</button>
      <button class="tb-btn" onclick="if(window.eva) window.eva.window.maximize()">□</button>
      <button class="tb-btn close" onclick="if(window.eva) window.eva.window.close()">✕</button>
    </div>
  </div>
;

// 1. Fix app-login.html
try {
  let appLogin = fs.readFileSync(path.join(basePath, 'app-login.html'), 'utf8');

  // Insert titlebar (replacing old logic if present or inserting after body)
  if (appLogin.includes('<div id="electronTitlebar"')) {
    appLogin = appLogin.replace(/<div id="electronTitlebar"[\s\S]*?<\/script>/g, titlebarHtml + '\n<script>document.body.style.paddingTop = "32px";</script>');
  } else if (!appLogin.includes('class="electron-titlebar"')) {
    appLogin = appLogin.replace('<body>', '<body>\n' + titlebarHtml + '\n<script>document.body.style.paddingTop = "32px";</script>');
  }

  // Fix logo
  appLogin = appLogin.replace(
    '<img src="/assets/images/eva-logo.png" alt="EVA" style="width:160px;height:auto;margin-bottom:20px;filter:drop-shadow(0 0 28px rgba(255,130,80,0.4));">',
    '<img src="/assets/images/eva-logo.png" alt="EVA" style="width:140px;height:auto;object-fit:contain;margin-bottom:20px;filter:drop-shadow(0 0 28px rgba(255,130,80,0.4));">'
  );

  // Inject IndexedDB fix for auto-logout
  const idbFix = 
    if (window.eva && window.eva.onAuthCallback) {
      window.eva.onAuthCallback(async function(data) {
        if (data.refreshToken || data.hid) {
          showMsg('Authentification réussie ! Création de la session...', 'success');
          try {
            var firebaseConfig = { apiKey: "AIzaSyDrXk8X9Ow7CcOc0Sr-yv3mXvzatNxpj3o" };
            var res = await window.eva.exchangeToken(data.refreshToken, firebaseConfig.apiKey);
            if (res && res.id_token) {
              var payload = JSON.parse(atob(res.id_token.split('.')[1]));
              var dbReq = indexedDB.open('firebaseLocalStorageDb');
              dbReq.onsuccess = function(e) {
                var idb = e.target.result;
                var tx = idb.transaction('firebaseLocalStorage', 'readwrite');
                var store = tx.objectStore('firebaseLocalStorage');
                var fbaseKey = 'firebase:authUser:' + firebaseConfig.apiKey + ':[DEFAULT]';
                var sessionData = {
                  uid: payload.user_id,
                  email: payload.email,
                  displayName: payload.name || payload.email.split('@')[0],
                  photoURL: payload.picture || null,
                  stsTokenManager: {
                    refreshToken: data.refreshToken,
                    accessToken: res.id_token,
                    expirationTime: Date.now() + (parseInt(res.expires_in) * 1000)
                  }
                };
                store.put({ fbase_key: fbaseKey, value: sessionData });
                tx.oncomplete = function() {
                  setTimeout(function() { window.location.href = 'chat.html'; }, 500);
                };
              };
              dbReq.onerror = function() { window.location.href = 'chat.html'; };
            } else {
              window.location.href = 'chat.html';
            }
          } catch(err) {
            window.location.href = 'chat.html';
          }
        }
      });
    };
  
  if (!appLogin.includes('indexedDB.open')) {
    appLogin = appLogin.replace(/if \(window\.eva && window\.eva\.onAuthCallback\) \{[\s\S]*?\}\);?\s*\}/, idbFix);
  }

  fs.writeFileSync(path.join(basePath, 'app-login.html'), appLogin, 'utf8');
} catch (e) { console.error("Error modifying app-login.html:", e); }

// 2. Fix chat.html
try {
  let chatHtml = fs.readFileSync(path.join(basePath, 'chat.html'), 'utf8');
  if (chatHtml.includes('<div id="electronTitlebar"')) {
    chatHtml = chatHtml.replace(/<div id="electronTitlebar"[\s\S]*?<\/script>/g, titlebarHtml + '\n<script>document.body.style.paddingTop = "32px";</script>');
  } else if (!chatHtml.includes('class="electron-titlebar"')) {
    chatHtml = chatHtml.replace('<body>', '<body>\n' + titlebarHtml + '\n<script>document.body.style.paddingTop = "32px";</script>');
  }
  fs.writeFileSync(path.join(basePath, 'chat.html'), chatHtml, 'utf8');
} catch (e) { console.error("Error modifying chat.html:", e); }

console.log("Done");
