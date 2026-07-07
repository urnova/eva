const fs = require('fs');

// 1. Restore clean files from the safe commit 628dbcf
const { execSync } = require('child_process');
execSync('git checkout 628dbcf -- eva-pc/web/app-login.html');
execSync('git checkout 628dbcf -- eva-pc/web/chat.html');

// 2. Modify app-login.html cleanly
let login = fs.readFileSync('eva-pc/web/app-login.html', 'utf8');

// Remove the HTML titlebar since we restored titleBarStyle: 'hidden'
login = login.replace(/<div id="electronTitlebar"[\s\S]*?<\/script>/, '');
login = login.replace(/<!-- \?\?\? Barre de titre Electron \?\?\? -->[\s\S]*?<\/div>\s*<\/div>/, '');
login = login.replace(/<div class="electron-titlebar"[\s\S]*?<\/div>\s*<\/div>/, '');
login = login.replace(/<script>document\.body\.style\.paddingTop[^<]*<\/script>/g, '');
login = login.replace(/<div class="page" style="padding-top: 32px;">/, '<div class="page">');

// Fix logo size to 250px and path
login = login.replace(
  /<img src="\/assets\/images\/eva-logo\.png"[^>]*>/,
  '<img src="./assets/images/eva-logo.png" alt="EVA" style="width:250px;height:auto;object-fit:contain;margin-bottom:20px;filter:drop-shadow(0 0 28px rgba(123,139,245,0.4));">'
);

// Inject IndexedDB fix with onupgradeneeded to prevent auto-logout
const authCallbackRegex = /if\s*\(window\.eva\s*&&\s*window\.eva\.onAuthCallback\)\s*\{[\s\S]*?\}\);?\s*\}/;
const idbFix = 
  if (window.eva && window.eva.onAuthCallback) {
    window.eva.onAuthCallback(async function(data) {
      if (data.refreshToken || data.hid) {
        showMsg('Authentification réussie ! Création de la session locale...', 'success');
        try {
          var firebaseConfig = { apiKey: "AIzaSyDrXk8X9Ow7CcOc0Sr-yv3mXvzatNxpj3o" };
          var res = await window.eva.exchangeToken(data.refreshToken, firebaseConfig.apiKey);
          if (res && res.id_token) {
            var payload = JSON.parse(atob(res.id_token.split('.')[1]));
            var dbReq = indexedDB.open('firebaseLocalStorageDb');
            dbReq.onupgradeneeded = function(e) {
              var db = e.target.result;
              db.createObjectStore('firebaseLocalStorage', { keyPath: 'fbase_key' });
            };
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
login = login.replace(authCallbackRegex, idbFix);
fs.writeFileSync('eva-pc/web/app-login.html', login, 'utf8');

// 3. Modify chat.html cleanly
let chat = fs.readFileSync('eva-pc/web/chat.html', 'utf8');
chat = chat.replace(/<div id="electronTitlebar"[\s\S]*?<\/script>/, '');
chat = chat.replace(/<div class="electron-titlebar"[\s\S]*?<\/div>\s*<\/div>/, '');
chat = chat.replace(/<script>document\.body\.style\.paddingTop[^<]*<\/script>/g, '');
fs.writeFileSync('eva-pc/web/chat.html', chat, 'utf8');

// 4. Modify splash.html cleanly
let splash = fs.readFileSync('eva-pc/web/splash.html', 'utf8');
splash = splash.replace(
  /<img src="\.\/assets\/images\/eva-logo\.png"[^>]*>/,
  '<img src="./assets/images/eva-logo.png" alt="EVA Logo" style="width:250px;height:auto;object-fit:contain;filter:drop-shadow(0 0 20px rgba(123,139,245,0.4));">'
);
fs.writeFileSync('eva-pc/web/splash.html', splash, 'utf8');

console.log("SUCCESS");
