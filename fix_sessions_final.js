const fs = require('fs');
let settingsJs = fs.readFileSync('eva-pc/web/js/app/settings-panel.js', 'utf8');

const regex = /(<button class="btn btn-secondary" onclick="changePassword\(\)".*?<\/button>'\s*\+\s*'<div class="settings-section">'\s*\+\s*'<div class="settings-section-title">Danger zone<\/div>')/m;

const replacement = `'<button class="btn btn-secondary" onclick="changePassword()" style="margin-top:4px">'+(isGoogleOnly ? 'Créer le mot de passe' : 'Mettre à jour le mot de passe')+'</button>' +
        '</div>' +
        '<div class="settings-section">' +
        '<div class="settings-section-title">Sessions Actives</div>' +
        '<div id="sessionsListContainer"><div class="loader"></div></div>' +
        '</div>' +
        '<div class="settings-section">' +
        '<div class="settings-section-title">Danger zone</div>'`;

settingsJs = settingsJs.replace(regex, replacement);

const regex2 = /('<div style="font-size:0\.68em;color:var\(--text-dim\);margin-top:8px">La suppression du compte est irrǸversible\. Toutes vos donnǸes seront effacǸes dǸfinitivement\.<\/div>'\s*\+\s*'<\/div>';)/m;

const replacement2 = `'<div style="font-size:0.68em;color:var(--text-dim);margin-top:8px">La suppression du compte est irréversible. Toutes vos données seront effacées définitivement.</div>' +
        '</div>';
      setTimeout(function() { if(window.renderSessionsList) window.renderSessionsList(); }, 200);`;

settingsJs = settingsJs.replace(regex2, replacement2);

const functionAppend = `
window.revokeSession = async function(sid) {
  if(!confirm("Déconnecter cet appareil ?")) return;
  try {
    await db.collection('users').doc(S.user.uid).collection('sessions').doc(sid).update({ revoked: true });
    toast("Appareil déconnecté", "success");
  } catch(e) {
    toast("Erreur", "error");
  }
};

window.renderSessionsList = function() {
  var c = document.getElementById('sessionsListContainer');
  if(!c) return;
  if(!S.user) return;
  db.collection('users').doc(S.user.uid).collection('sessions').orderBy('lastSeen', 'desc').get().then(function(snap) {
    if(!document.getElementById('sessionsListContainer')) return;
    var html = '';
    snap.forEach(function(doc) {
      var d = doc.data();
      if (d.revoked) return;
      var isMe = doc.id === S.sessionId;
      var dateStr = d.lastSeen && d.lastSeen.toDate ? d.lastSeen.toDate().toLocaleString('fr-FR') : 'Inconnu';
      html += '<div style="background:rgba(255,255,255,0.05);padding:10px;border-radius:8px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;">' +
        '<div>' +
          '<div style="font-weight:bold;font-size:0.9em;color:'+(d.online ? '#4ade80' : 'var(--text-color)')+'">' + (d.device || 'Inconnu') + (isMe ? ' (Cet appareil)' : '') + '</div>' +
          '<div style="font-size:0.75em;color:var(--text-muted)">' + (d.browser || '?') + ' sur ' + (d.os || '?') + '</div>' +
          '<div style="font-size:0.7em;color:var(--text-dim)">Dernière activité: ' + dateStr + '</div>' +
        '</div>' +
        (isMe ? '' : '<button class="btn btn-secondary" style="padding:4px 10px;font-size:0.75em" onclick="revokeSession(\\''+doc.id+'\\')">Déconnecter</button>') +
      '</div>';
    });
    if(!html) html = '<div style="font-size:0.8em;color:var(--text-muted)">Aucune autre session active.</div>';
    document.getElementById('sessionsListContainer').innerHTML = html;
  });
};
`;

if (!settingsJs.includes('revokeSession')) {
  settingsJs += functionAppend;
}

fs.writeFileSync('eva-pc/web/js/app/settings-panel.js', settingsJs, 'utf8');
console.log("SESSION MANAGER FULLY ADDED");
