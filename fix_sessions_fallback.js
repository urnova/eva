const fs = require('fs');

const fallbackCode = `
    // Register session
    S.sessionId = localStorage.getItem('eva_session_id');
    if (!S.sessionId) {
      S.sessionId = 'SES-' + Math.random().toString(36).substr(2, 9).toUpperCase();
      localStorage.setItem('eva_session_id', S.sessionId);
    }
    
    var devType = window.eva ? 'Application PC' : (/Mobi|Android/i.test(navigator.userAgent) ? 'Mobile' : 'Navigateur Web');
    var browserName = window.eva ? 'E.V.A OS Agent' : 'Navigateur';
    var osName = window.eva ? 'Windows' : (/Windows/i.test(navigator.userAgent) ? 'Windows' : (/Mac/i.test(navigator.userAgent) ? 'MacOS' : 'Inconnu'));
    
    if (typeof UAParser !== 'undefined') {
      var parser = new UAParser();
      var ua = parser.getResult();
      if (!window.eva && ua.device.type) devType = ua.device.type;
      if (!window.eva && ua.browser.name) browserName = ua.browser.name;
      if (!window.eva && ua.os.name) osName = ua.os.name;
    }
    
    db.collection('users').doc(user.uid).collection('sessions').doc(S.sessionId).set({
      device: devType,
      browser: browserName,
      os: osName,
      lastSeen: window.timestamp ? window.timestamp() : new Date(),
      connectedAt: window.timestamp ? window.timestamp() : new Date(),
      online: true
    }, { merge: true });
    
    // Keep alive every 5 minutes
    setInterval(function() {
      if (S.user) {
        db.collection('users').doc(S.user.uid).collection('sessions').doc(S.sessionId).update({
          lastSeen: window.timestamp ? window.timestamp() : new Date(),
          online: true
        }).catch(function(){});
      }
    }, 300000);
    
    window.addEventListener('beforeunload', function() {
      if (S.user && S.sessionId) {
        db.collection('users').doc(S.user.uid).collection('sessions').doc(S.sessionId).update({
          online: false,
          lastSeen: window.timestamp ? window.timestamp() : new Date()
        }).catch(function(){});
      }
    });

    // Écouter si la session a été révoquée
    db.collection('users').doc(user.uid).collection('sessions').doc(S.sessionId).onSnapshot(function(doc) {
      if (doc.exists && doc.data().revoke === true) {
        auth.signOut().then(function() {
          localStorage.removeItem('eva_session_id');
          window.location.reload();
        });
      } else if (!doc.exists) {
        auth.signOut().then(function() {
          localStorage.removeItem('eva_session_id');
          window.location.reload();
        });
      }
    });
`;

function fixSession(filePath) {
  if (fs.existsSync(filePath)) {
    let js = fs.readFileSync(filePath, 'utf8');
    js = js.replace(/\/\/\s*Register session[\s\S]*?\}\);[\s\S]*?\}\);[\s\S]*?\}/, fallbackCode);
    fs.writeFileSync(filePath, js, 'utf8');
    console.log('Session fallback fixed in ' + filePath);
  }
}

fixSession('eva-pc/web/js/app/auth.js');
fixSession('EVA_V4_fixed_v4/js/app/auth.js');
