const fs = require('fs');

const sessionCode = `
    // Register session
    if (typeof UAParser !== 'undefined') {
      S.sessionId = localStorage.getItem('eva_session_id');
      if (!S.sessionId) {
        S.sessionId = 'SES-' + Math.random().toString(36).substr(2, 9).toUpperCase();
        localStorage.setItem('eva_session_id', S.sessionId);
      }
      
      var parser = new UAParser();
      var ua = parser.getResult();
      var devType = window.eva ? 'Application PC' : (ua.device.type === 'mobile' ? 'Mobile' : 'Navigateur Web');
      var browserName = window.eva ? 'E.V.A OS Agent' : (ua.browser.name || 'Inconnu');
      var osName = window.eva ? 'Windows' : (ua.os.name || 'Inconnu');
      
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
    }
`;

function injectSession(filePath) {
  if (fs.existsSync(filePath)) {
    let js = fs.readFileSync(filePath, 'utf8');
    if (!js.includes('eva_session_id')) {
      js = js.replace('S.user = user;', 'S.user = user;\n' + sessionCode);
      fs.writeFileSync(filePath, js, 'utf8');
      console.log('Session tracking injected in ' + filePath);
    } else {
      console.log('Session tracking already in ' + filePath);
    }
  }
}

injectSession('eva-pc/web/js/app/auth.js');
injectSession('EVA_V4_fixed_v4/js/app/auth.js');
