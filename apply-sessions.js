const fs = require('fs');

const injectionHtml = `
<div class="settings-section">
  <div class="settings-section-title">Appareils & Sessions Connectées</div>
  <div id="sessionsListContainer" style="display:flex;flex-direction:column;gap:8px;background:rgba(255,255,255,0.03);padding:10px;border-radius:8px;">
    <div style="font-size:0.85em;color:#888;">Chargement des sessions...</div>
  </div>
</div>
<div class="settings-section">`;

const injectionJs = `
function loadConnectedSessions() {
  const container = document.getElementById('sessionsListContainer');
  if(!container || !S.user) return;
  window.db.collection('cloudworks').doc(S.user.uid).collection('devices').onSnapshot(snap => {
    let html = '';
    if(snap.empty) {
      html = '<div style="font-size:0.85em;color:#888;">Aucune session détectée.</div>';
    } else {
      snap.forEach(doc => {
        const d = doc.data();
        const isOnline = d.online ? '<span style="color:#10b981">● En ligne</span>' : '<span style="color:#ef4444">○ Hors-ligne</span>';
        const lastSeen = d.updatedAt ? (d.updatedAt.toDate ? d.updatedAt.toDate().toLocaleString() : new Date(d.updatedAt).toLocaleString()) : 'Inconnu';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.1);">';
        html += '<div><strong style="display:block;margin-bottom:4px;">'+(d.deviceName||doc.id)+'</strong><div style="font-size:0.8em;color:#aaa;">'+isOnline+' - Dernière activité: '+lastSeen+'</div></div>';
        html += '<button class="btn btn-danger" style="padding:4px 8px;font-size:0.8em;" onclick="revokeSession(\\''+doc.id+'\\')">Déconnecter</button>';
        html += '</div>';
      });
    }
    container.innerHTML = html;
  });
}

window.revokeSession = async function(deviceId) {
  if(confirm("Êtes-vous sûr de vouloir déconnecter cet appareil ?")) {
    if(confirm("DOUBLE VALIDATION : Confirmez-vous la révocation définitive de l'accès pour cet appareil ?")) {
      try {
        await window.db.collection('cloudworks').doc(S.user.uid).collection('devices').doc(deviceId).set({ forceLogout: true }, { merge: true });
        if(window.toast) window.toast("Session révoquée avec succès. L'appareil sera déconnecté.", "success");
      } catch(e) {
        if(window.toast) window.toast("Erreur: "+e.message, "error");
      }
    }
  }
}
`;

function processFile(path) {
  let content = fs.readFileSync(path, 'utf8');
  if(!content.includes('Appareils & Sessions Connectées')) {
    content = content.replace('<div class="settings-section">\' +\n        \'<div class="settings-section-title">Danger zone</div>', injectionHtml + '\n\' +\n        \'<div class="settings-section-title">Danger zone</div>');
  }
  if(!content.includes('loadConnectedSessions()')) {
    content = content + '\n\n' + injectionJs;
  }
  
  // also need to trigger loadConnectedSessions when tab changes to account
  if(content.includes("case 'account':")) {
      content = content.replace("case 'account':", "case 'account':\n      setTimeout(loadConnectedSessions, 100);");
  }
  fs.writeFileSync(path, content);
}

processFile('EVA_V4_fixed_v4/js/app/settings-panel.js');
processFile('eva-pc/web/js/app/settings-panel.js');

// Also inject forceLogout listener in core.js
function processCore(path) {
    let content = fs.readFileSync(path, 'utf8');
    if(!content.includes('forceLogout')) {
        let snippet = `
        // Check for forceLogout
        window.db.collection('cloudworks').doc(user.uid).collection('devices').where('forceLogout','==',true).onSnapshot(snap => {
            snap.forEach(doc => {
                if(window.S && window.S.deviceId && doc.id === window.S.deviceId) {
                    window.db.collection('cloudworks').doc(user.uid).collection('devices').doc(doc.id).delete().then(() => {
                        window.auth.signOut().then(() => { window.location.reload(); });
                    });
                }
            });
        });
        `;
        content = content.replace("console.log('[Auth] Logged in:', user);", "console.log('[Auth] Logged in:', user);\n" + snippet);
        fs.writeFileSync(path, content);
    }
}
processCore('EVA_V4_fixed_v4/js/app/core.js');
processCore('eva-pc/web/js/app/core.js');

console.log("Done");
