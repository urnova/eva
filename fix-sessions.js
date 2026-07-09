const fs = require('fs');
const files = [
  'EVA_V4_fixed_v4/js/app/settings-panel.js',
  'eva-pc/web/js/app/settings-panel.js'
];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');

  // Insert the HTML block for Active Sessions
  const targetHtml = `'<button class="btn btn-secondary" onclick="changePassword()" style="margin-top:4px">'+(isGoogleOnly ? 'CrÃ©er le mot de passe' : 'Mettre Ã  jour le mot de passe')+'</button>' +
      '</div>' +
      '<div class="settings-section">' +
      '<div class="settings-section-title">Danger zone</div>'`;

  const replHtml = `'<button class="btn btn-secondary" onclick="changePassword()" style="margin-top:4px">'+(isGoogleOnly ? 'CrÃ©er le mot de passe' : 'Mettre Ã  jour le mot de passe')+'</button>' +
      '</div>' +
      '<div class="settings-section">' +
      '<div class="settings-section-title">Sessions actives</div>' +
      '<div id="activeSessionsContainer" style="font-size:0.8em;color:var(--text-muted);">Chargement...</div>' +
      '</div>' +
      '<div class="settings-section">' +
      '<div class="settings-section-title">Danger zone</div>'`;

  if (content.includes("Mettre Ã  jour le mot de passe")) {
    // using regex because of encoding issues
    content = content.replace(/Mettre Ã  jour le mot de passe'\)\+'<\/button>' \+\s+'<\/div>' \+\s+'<div class="settings-section">' \+\s+'<div class="settings-section-title">Danger zone<\/div>'/, 
      "Mettre Ã  jour le mot de passe')+'</button>' +\n      '</div>' +\n      '<div class=\"settings-section\">' +\n      '<div class=\"settings-section-title\">Sessions actives</div>' +\n      '<div id=\"activeSessionsContainer\" style=\"font-size:0.8em;color:var(--text-muted);\">Chargement...</div>' +\n      '</div>' +\n      '<div class=\"settings-section\">' +\n      '<div class=\"settings-section-title\">Danger zone</div>'");
  } else {
    // try with regular latin1 characters
    content = content.replace(/Mettre à jour le mot de passe'\)\+'<\/button>' \+\s+'<\/div>' \+\s+'<div class="settings-section">' \+\s+'<div class="settings-section-title">Danger zone<\/div>'/, 
      "Mettre à jour le mot de passe')+'</button>' +\n      '</div>' +\n      '<div class=\"settings-section\">' +\n      '<div class=\"settings-section-title\">Sessions actives</div>' +\n      '<div id=\"activeSessionsContainer\" style=\"font-size:0.8em;color:var(--text-muted);\">Chargement...</div>' +\n      '</div>' +\n      '<div class=\"settings-section\">' +\n      '<div class=\"settings-section-title\">Danger zone</div>'");
  }

  // Inject logic at the end of the file
  if (!content.includes('function loadActiveSessions')) {
    content += `

/* --- SESSIONS ACTIVES --- */
function loadActiveSessions() {
  if (!S.user) return;
  db.collection('users').doc(S.user.uid).collection('sessions').orderBy('lastSeen', 'desc').get().then(function(snap) {
    var c = document.getElementById('activeSessionsContainer');
    if (!c) return;
    if (snap.empty) { c.innerHTML = 'Aucune session.'; return; }
    
    var html = '<div style="display:flex;flex-direction:column;gap:8px">';
    snap.forEach(function(doc) {
      var d = doc.data();
      var isCurrent = doc.id === S.sessionId;
      var dateStr = d.connectedAt ? new Date(d.connectedAt.toMillis ? d.connectedAt.toMillis() : d.connectedAt).toLocaleDateString('fr-FR', {day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}) : 'Inconnu';
      var seenStr = d.lastSeen ? new Date(d.lastSeen.toMillis ? d.lastSeen.toMillis() : d.lastSeen).toLocaleDateString('fr-FR', {day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}) : 'Inconnu';
      
      var deviceName = d.device || 'Inconnu';
      var osName = d.os || '';
      var browserName = d.browser || '';
      var icon = d.device === 'Application PC' ? '💻' : (d.device === 'Mobile' ? '📱' : '🌐');
      
      var statusDot = d.online ? '<span style="color:#4ade80">●</span> En ligne' : '<span style="color:var(--text-muted)">○</span> Hors ligne';
      if (isCurrent) statusDot = '<span style="color:#4ade80">●</span> Actuel';

      html += '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:12px;display:flex;align-items:center;gap:12px;">' +
        '<div style="font-size:1.5em">' + icon + '</div>' +
        '<div style="flex:1;min-width:0;">' +
          '<div style="font-weight:600;color:var(--text);font-size:1em;margin-bottom:2px;">' + deviceName + ' ' + (osName ? '('+osName+')' : '') + '</div>' +
          '<div style="font-size:0.85em;color:var(--text-muted);">' + browserName + ' • ' + statusDot + '</div>' +
          '<div style="font-size:0.75em;color:var(--text-dim);margin-top:4px;">Connecté le: ' + dateStr + '<br>Vu: ' + seenStr + '</div>' +
        '</div>' +
        (!isCurrent ? '<button class="btn btn-danger" style="padding:6px 12px;font-size:0.8em;flex-shrink:0" onclick="revokeSession(\\'' + doc.id + '\\')">Déconnecter</button>' : '') +
      '</div>';
    });
    html += '</div>';
    c.innerHTML = html;
  }).catch(function(e) {
    var c = document.getElementById('activeSessionsContainer');
    if(c) c.innerHTML = 'Erreur: ' + e.message;
  });
}

function revokeSession(sid) {
  if (!S.user) return;
  db.collection('users').doc(S.user.uid).collection('sessions').doc(sid).delete().then(function() {
    loadActiveSessions();
    toast('Session déconnectée avec succès', 'success');
  }).catch(function(e) {
    toast('Erreur: ' + e.message, 'error');
  });
}
window.revokeSession = revokeSession;
`;
  }

  // Hook loadActiveSessions into renderSettings('account')
  if (!content.includes('loadActiveSessions();')) {
    // Find the end of renderSettings
    content = content.replace(/setTimeout\(function\(\)\{\s*document\.getElementById\('settingsContent'\)\.scrollTop = 0;\s*\}, 10\);/, "setTimeout(function(){ document.getElementById('settingsContent').scrollTop = 0; }, 10);\n    if (section === 'account') loadActiveSessions();");
  }

  fs.writeFileSync(file, content, 'utf8');
});
console.log('Active Sessions implemented');
