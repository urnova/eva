const fs = require('fs');

// 1. Modify firebase-config.js to force localStorage persistence
let fbConfig = fs.readFileSync('eva-pc/web/js/core/firebase-config.js', 'utf8');
if (!fbConfig.includes('setPersistence')) {
  fbConfig = fbConfig.replace(
    /window\.auth = firebase\.auth\(\);/,
    "window.auth = firebase.auth();\nwindow.auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(e => console.warn(e));"
  );
  fs.writeFileSync('eva-pc/web/js/core/firebase-config.js', fbConfig, 'utf8');
}

// 2. Modify app-login.html to use localStorage instead of IndexedDB
let login = fs.readFileSync('eva-pc/web/app-login.html', 'utf8');

// Replace the IDB logic with localStorage
const idbRegex = /var dbReq = indexedDB\.open\('firebaseLocalStorageDb'\);[\s\S]*?store\.put\(\{ fbase_key: fbaseKey, value: sessionData \}\);\s*tx\.oncomplete = function\(\) \{\s*setTimeout\(function\(\) \{\s*window\.location\.href = 'chat\.html';\s*\}, 500\);\s*\};\s*\};\s*/;

const localStorageLogic = `
                localStorage.setItem(fbaseKey, JSON.stringify(sessionData));
                setTimeout(function() {
                  window.location.href = 'chat.html';
                }, 100);
`;

if (idbRegex.test(login)) {
  login = login.replace(idbRegex, localStorageLogic);
  fs.writeFileSync('eva-pc/web/app-login.html', login, 'utf8');
} else {
  console.log("Regex didn't match! Please check the file.");
}

console.log("MIGRATED TO LOCALSTORAGE");
