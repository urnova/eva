const fs = require('fs');
let authJs = fs.readFileSync('eva-pc/web/js/app/auth.js', 'utf8');

const targetInit = `S.user = user;
    S.busy = false;`;

const replacementInit = `S.user = user;
    S.busy = false;
    
    // Register session
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
      if (doc.exists && doc.data().revoked === true) {
        auth.signOut().then(function() {
          localStorage.removeItem('eva_session_id');
          window.location.reload();
        });
      }
    });`;

authJs = authJs.replace(targetInit, replacementInit);
fs.writeFileSync('eva-pc/web/js/app/auth.js', authJs, 'utf8');
console.log("SESSION TRACKING ADDED");
