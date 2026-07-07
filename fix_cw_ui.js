const fs = require('fs');
let cwJs = fs.readFileSync('EVA_V4_fixed_v4/js/features/cloudworks.js', 'utf8');

const target = `function loadCloudWorks() {
  if (!window.S || !window.S.user) return;
  var uid = S.user.uid;
  var list = document.getElementById('cwDeviceList');`;

const replacement = `function loadCloudWorks() {
  if (!window.S || !window.S.user) return;
  var uid = S.user.uid;
  var list = document.getElementById('cwDeviceList');

  // Si on est sur l'application PC (Agent local), l'interface est différente
  if (window.eva) {
    if (list) {
      list.innerHTML = \`<div class="cw-card cw-card-online" style="margin-bottom: 20px;">
        <div class="cw-card-header">
          <div class="cw-card-left">
            <div class="cw-icon" style="background: rgba(123, 139, 245, 0.2); color: #7b8bf5;">💻</div>
            <div class="cw-info">
              <div class="cw-device-name">\${localStorage.getItem('cw_device_id') || 'Mon PC'}</div>
              <div class="cw-device-sub">E.V.A CloudWorks Agent (Local)</div>
            </div>
          </div>
          <div class="cw-card-right">
            <span class="cw-badge cw-badge-on">EN LIGNE (AGENT ACTIF)</span>
          </div>
        </div>
        <div style="padding: 15px; font-size: 0.8em; color: var(--text-muted); line-height: 1.5;">
          Cet ordinateur est configuré comme agent distant CloudWorks.<br>
          Il peut recevoir des commandes (Capture d'écran, informations système, etc.) depuis votre interface Web ou Mobile.
        </div>
      </div>\`;
    }
    
    // On ne charge pas les autres appareils, on écoute juste les résultats de cet agent
    if (_cwResultUnsub) { _cwResultUnsub(); _cwResultUnsub = null; }
    var _initSnap = true;
    _cwResultUnsub = window.db.collection('cloudworks').doc(uid).collection('commands')
      .where('deviceId', '==', localStorage.getItem('cw_device_id'))
      .orderBy('updatedAt','desc')
      .limit(MAX_LOG)
      .onSnapshot(function(snap) { 
        _handleResultsSnap(snap, _initSnap); 
        _initSnap = false;
      });
    return;
  }`;

cwJs = cwJs.replace(target, replacement);
fs.writeFileSync('EVA_V4_fixed_v4/js/features/cloudworks.js', cwJs, 'utf8');
console.log("PC CLOUDWORKS UI UPDATED");
