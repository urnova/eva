const fs = require('fs');
let settingsJs = fs.readFileSync('eva-pc/web/js/app/settings-panel.js', 'utf8');

const target = `'<div style="font-weight:700;color:var(--text);font-size:0.9em;margin-bottom:3px;">Tutoriel Ordinateur</div>'`;
const replacement = `'<div style="font-weight:700;color:var(--text);font-size:0.9em;margin-bottom:3px;">Tutoriel Web (Ordinateur)</div>'`;
settingsJs = settingsJs.replace(target, replacement);

const targetMobileCard = `'<div style="font-weight:700;color:var(--text);font-size:0.9em;margin-bottom:3px;">Tutoriel Mobile</div>' +
                '<div style="font-size:0.74em;color:var(--text-muted);line-height:1.5;">6 étapes — Gestes tactiles, voix mains libres, menu hamburger, modules en vue mobile.</div>' +
              '</div>' +
              '<button class="btn btn-secondary" style="flex-shrink:0;" onclick="closeSettings();setTimeout(showTutorialMobile,200);">Lancer</button>' +
            '</div>' +`;

const replacementAppPC = `'<div style="font-weight:700;color:var(--text);font-size:0.9em;margin-bottom:3px;">Tutoriel Mobile</div>' +
                '<div style="font-size:0.74em;color:var(--text-muted);line-height:1.5;">6 étapes — Gestes tactiles, voix mains libres, menu hamburger, modules en vue mobile.</div>' +
              '</div>' +
              '<button class="btn btn-secondary" style="flex-shrink:0;" onclick="closeSettings();setTimeout(showTutorialMobile,200);">Lancer</button>' +
            '</div>' +
            
            /* App PC card */
            '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:14px;padding:18px;display:flex;align-items:center;gap:16px;margin-top:10px;">' +
              '<div style="width:48px;height:48px;border-radius:12px;background:rgba(123,139,245,0.1);border:1px solid rgba(123,139,245,0.25);display:flex;align-items:center;justify-content:center;flex-shrink:0;">' +
                '<span style="font-size:1.5em;">🖥️</span>' +
              '</div>' +
              '<div style="flex:1;min-width:0;">' +
                '<div style="font-weight:700;color:var(--text);font-size:0.9em;margin-bottom:3px;">Tutoriel App PC (OS Agent)</div>' +
                '<div style="font-size:0.74em;color:var(--text-muted);line-height:1.5;">4 étapes — Fenêtre flottante, Wake Word natif, Mode Système et Auto-Updates.</div>' +
              '</div>' +
              '<button class="btn btn-secondary" style="flex-shrink:0;" onclick="closeSettings();setTimeout(window.showTutorialAppPC,200);">Lancer</button>' +
            '</div>' +`;

settingsJs = settingsJs.replace(targetMobileCard, replacementAppPC);

fs.writeFileSync('eva-pc/web/js/app/settings-panel.js', settingsJs, 'utf8');
console.log("SETTINGS PANEL TUTORIAL ADDED");
