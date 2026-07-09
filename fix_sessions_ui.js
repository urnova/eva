const fs = require('fs');

const sessionsJS = `
window.loadSessions = function() {
  var c = document.getElementById('sessionsListContainer');
  if(!c) return;
  db.collection('users').doc(S.user.uid).collection('sessions').orderBy('lastSeen', 'desc').onSnapshot(function(snap) {
    if(!document.getElementById('sessionsListContainer')) return;
    c.innerHTML = '';
    if(snap.empty) {
      c.innerHTML = '<div style="color:var(--text-muted);font-size:0.8em;text-align:center;">Aucune session trouvée.</div>';
      return;
    }
    snap.forEach(function(doc) {
      var d = doc.data();
      if(d.revoke) return;
      var isCurrent = (S.sessionId === doc.id);
      
      var lastSeenDate = d.lastSeen && d.lastSeen.toDate ? d.lastSeen.toDate() : new Date();
      var diffMins = Math.floor((new Date() - lastSeenDate) / 60000);
      var isOnline = diffMins < 6 || d.online;
      
      var connDateStr = d.connectedAt && d.connectedAt.toDate ? d.connectedAt.toDate().toLocaleDateString('fr-FR', {day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'}) : 'Inconnu';
      
      var div = document.createElement('div');
      div.style.cssText = 'background:var(--surface2);border:1px solid ' + (isCurrent ? 'rgba(123,139,245,0.4)' : 'var(--border)') + ';border-radius:10px;padding:12px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;';
      
      var left = '<div style="display:flex;flex-direction:column;">' +
        '<div style="font-weight:700;color:var(--text);font-size:0.9em;display:flex;align-items:center;gap:6px;">' +
        (d.device==='Application PC'?'💻':(d.device==='Mobile'?'📱':'🌐')) + ' ' + (d.os || 'Inconnu') + ' - ' + (d.browser || 'Inconnu') +
        (isCurrent ? '<span style="font-size:0.65em;background:var(--cyan);color:#000;padding:2px 6px;border-radius:4px;">ACTUELLE</span>' : '') +
        '</div>' +
        '<div style="font-size:0.7em;color:var(--text-muted);margin-top:4px;">Connecté le: ' + connDateStr + '</div>' +
        '<div style="font-size:0.7em;color:' + (isOnline ? 'var(--green)' : 'var(--text-dim)') + ';margin-top:2px;">' + 
        (isOnline ? '🟢 En ligne' : '⚪ Hors ligne (Vu il y a ' + (diffMins>60 ? Math.floor(diffMins/60)+'h' : diffMins+'m') + ')') + 
        '</div>' +
      '</div>';
      
      var right = isCurrent ? '' : '<button class="btn btn-danger" style="padding:6px 10px;font-size:0.75em;" onclick="revokeSession(\\''+doc.id+'\\')">Retirer</button>';
      
      div.innerHTML = left + right;
      c.appendChild(div);
    });
  }, function(e) {
    c.innerHTML = '<div style="color:#ff4d6d;font-size:0.8em;text-align:center;">Erreur de lecture</div>';
  });
};

window.revokeSession = function(sid) {
  if(confirm('Voulez-vous déconnecter cet appareil ?')) {
    db.collection('users').doc(S.user.uid).collection('sessions').doc(sid).update({ revoke: true }).catch(function(e){
      console.error(e);
      alert('Erreur: ' + e.message);
    });
  }
};
`;

function injectSessionsJS(file) {
  let js = fs.readFileSync(file, 'utf8');
  if(!js.includes('window.loadSessions')) {
    js += '\n\n' + sessionsJS;
    
    // Inject the call in renderSettings('account')
    js = js.replace('setTimeout(renderBrainMap, 100);', 'setTimeout(renderBrainMap, 100);');
    
    const targetCall = `      '<button class="btn btn-secondary" onclick="changePassword()" style="margin-top:4px">'+(isGoogleOnly ? 'Créer le mot de passe' : 'Mettre à jour le mot de passe')+'</button>' +
        '</div>' +
        '<div class="settings-section">' +
        '<div class="settings-section-title">Sessions Actives</div>' +
        '<div id="sessionsListContainer"><div class="loader"></div></div>' +
        '</div>' +
        '<div class="settings-section">' +
        '<div class="settings-section-title">Danger zone</div>'`;
        
    if (js.includes('Sessions Actives')) {
      js = js.replace(`        '<div id="sessionsListContainer"><div class="loader"></div></div>' +
        '</div>' +`, `        '<div id="sessionsListContainer"><div class="loader"></div></div>' +
        '</div>' +
        '<script>setTimeout(loadSessions, 100);</script>' + `); 
        // Wait, HTML inside innerHTML won't execute scripts!
        // We need to just call setTimeout(loadSessions, 100) at the end of renderSettings
    }
    
    const renderSettingsEnd = `  } else if (section === 'notifications') {`;
    js = js.replace(renderSettingsEnd, `    setTimeout(loadSessions, 100);\n  } else if (section === 'notifications') {`);
    
    fs.writeFileSync(file, js, 'utf8');
    console.log("Sessions UI injected in " + file);
  }
}

injectSessionsJS('eva-pc/web/js/app/settings-panel.js');
injectSessionsJS('EVA_V4_fixed_v4/js/app/settings-panel.js');
