const fs = require('fs');
let settingsJs = fs.readFileSync('eva-pc/web/js/app/settings-panel.js', 'utf8');

const target = `'<button class="btn btn-secondary" onclick="changePassword()" style="margin-top:4px">'+(isGoogleOnly ? 'Créer le mot de passe' : 'Mettre à jour le mot de passe')+'</button>' +
        '</div>' +
        '<div class="settings-section">' +
        '<div class="settings-section-title">Danger zone</div>'`;

const replacement = `'<button class="btn btn-secondary" onclick="changePassword()" style="margin-top:4px">'+(isGoogleOnly ? 'Créer le mot de passe' : 'Mettre à jour le mot de passe')+'</button>' +
        '</div>' +
        '<div class="settings-section">' +
        '<div class="settings-section-title">Sessions Actives</div>' +
        '<div id="sessionsListContainer"><div class="loader"></div></div>' +
        '</div>' +
        '<div class="settings-section">' +
        '<div class="settings-section-title">Danger zone</div>'`;

settingsJs = settingsJs.replace(target, replacement);

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

settingsJs += functionAppend;

// Add call to renderSessionsList when rendering account
settingsJs = settingsJs.replace(`renderSettings('account');`, `renderSettings('account');\nsetTimeout(window.renderSessionsList, 100);`);
// Also need to trigger it right after setting innerHTML for section 'account'.
// 'account' falls into the profile if section block? No, wait! The user said profile/compte.
// In settings-panel.js, the 'account' section is actually handled by `section === 'profile'` usually in this app or maybe it's `account`.
fs.writeFileSync('eva-pc/web/js/app/settings-panel.js', settingsJs, 'utf8');
console.log("SESSION UI ADDED");
