const fs = require('fs');
let settingsJs = fs.readFileSync('eva-pc/web/js/app/settings-panel.js', 'utf8');

settingsJs = settingsJs.replace(`'<div class="settings-section">' +
        '<div class="settings-section-title">Danger zone</div>'`, 
`'<div class="settings-section">' +
        '<div class="settings-section-title">Sessions Actives</div>' +
        '<div id="sessionsListContainer"><div class="loader"></div></div>' +
        '</div>' +
        '<div class="settings-section">' +
        '<div class="settings-section-title">Danger zone</div>'`);

settingsJs = settingsJs.replace(`'<button class="btn btn-danger" onclick="deleteMyAccount()" style="margin-top:4px">🗑️ Supprimer mon compte</button>' +
        '</div>' +
        '<div style="font-size:0.68em;color:var(--text-dim);margin-top:8px">La suppression du compte est irréversible. Toutes vos données seront effacées définitivement.</div>' +
        '</div>';`, 
`'<button class="btn btn-danger" onclick="deleteMyAccount()" style="margin-top:4px">🗑️ Supprimer mon compte</button>' +
        '</div>' +
        '<div style="font-size:0.68em;color:var(--text-dim);margin-top:8px">La suppression du compte est irréversible. Toutes vos données seront effacées définitivement.</div>' +
        '</div>';
        
      setTimeout(function() { if(window.renderSessionsList) window.renderSessionsList(); }, 200);`);

fs.writeFileSync('eva-pc/web/js/app/settings-panel.js', settingsJs, 'utf8');
console.log("SESSION INIT TRIGGER ADDED");
