const fs = require('fs');
let path = 'EVA_V4_fixed_v4/js/app/settings-panel.js';
let content = fs.readFileSync(path, 'utf8');

const targetStr = '<div class="settings-section-title">Danger zone</div>';

const newStr = `'<div class="settings-section" id="account-devices-section">' +
        '<div class="settings-section-title">Appareils et Sessions Connectés</div>' +
        '<div id="account-devices-list" style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px">Chargement...</div>' +
        '</div>' +
        '<div class="settings-section">' +
        '<div class="settings-section-title">Danger zone</div>'`;

if(content.includes(targetStr)) {
  content = content.replace(`'<div class="settings-section">' +\n        '<div class="settings-section-title">Danger zone</div>'`, newStr);
  content = content.replace(`'<div class="settings-section">' +\r\n        '<div class="settings-section-title">Danger zone</div>'`, newStr);
  
  // also add a function to render the devices
  const renderCode = `setTimeout(loadSessions, 100);`;

  const newRenderCode = `setTimeout(loadSessions, 100);\n      setTimeout(renderAccountDevices, 100);`;

  content = content.replace(renderCode, newRenderCode);
  
  // add the function renderAccountDevices
  const addFn = `async function changeEmail() {`;
  const fnCode = `
  window.renderAccountDevices = function() {
    var c = document.getElementById('account-devices-list');
    if (!c) return;
    var devices = (S.profile && Array.isArray(S.profile.fcmDevices)) ? S.profile.fcmDevices : [];
    if (devices.length === 0) {
      c.innerHTML = '<div style="font-size:0.8em;color:var(--text-muted)">Aucun appareil connecté.</div>';
      return;
    }
    var html = '';
    devices.forEach(function(d) {
      var dateStr = d.registeredAt ? new Date(d.registeredAt).toLocaleString() : 'Inconnu';
      var isCurrent = d.token === window._fcmToken;
      html += '<div style="background:var(--surface2);padding:10px;border-radius:8px;border:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">';
      html += '<div>';
      html += '<div style="font-weight:bold;font-size:0.85em;color:var(--text)">' + esc(d.name || 'Appareil inconnu') + (isCurrent ? ' <span style="color:var(--cyan);font-size:0.8em">(Actuel)</span>' : '') + '</div>';
      html += '<div style="font-size:0.7em;color:var(--text-muted)">IP: ' + esc(d.ip || '?') + ' | Inscrit le: ' + dateStr + '</div>';
      html += '</div>';
      if (!isCurrent) {
        html += '<button class="btn btn-secondary" style="color:#ef4444;border-color:rgba(239,68,68,0.4);padding:4px 8px;font-size:0.75em" onclick="revokeDeviceToken(\\'' + esc(d.token) + '\\')">Déconnecter</button>';
      }
      html += '</div>';
    });
    c.innerHTML = html;
  };
  
  window.revokeDeviceToken = async function(token) {
    if (!confirm('Voulez-vous vraiment déconnecter cet appareil ? (Double validation : OK pour confirmer)')) return;
    if (!confirm('Êtes-vous absolument sûr de vouloir le déconnecter ?')) return;
    try {
      if (S.profile && Array.isArray(S.profile.fcmDevices)) {
        var updated = S.profile.fcmDevices.filter(function(d){ return d.token !== token; });
        await db.collection('users').doc(S.user.uid).update({ fcmDevices: updated });
        S.profile.fcmDevices = updated;
        toast('Appareil déconnecté avec succès', 'success');
        renderAccountDevices();
      }
    } catch(e) {
      toast('Erreur: ' + e.message, 'error');
    }
  };

  async function changeEmail() {`;

  content = content.replace(addFn, fnCode);
  
  fs.writeFileSync(path, content);
  console.log("Injected account devices view");
} else {
  console.log("Not found");
}
