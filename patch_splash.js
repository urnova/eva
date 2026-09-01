const fs = require('fs');

function patchSplash(filePath) {
  if (!fs.existsSync(filePath)) return;
  let html = fs.readFileSync(filePath, 'utf8');

  // Add a div for the version and release notes
  if (!html.includes('id="update-info"')) {
    let pTarget = `<p style="color:var(--text-muted); font-size:0.9em; margin-bottom:25px; line-height:1.5;">Une nouvelle version d'E.V.A est disponible. Vous devez l'installer pour continuer à utiliser l'application.</p>`;
    let pReplace = `<p style="color:var(--text-muted); font-size:0.9em; margin-bottom:10px; line-height:1.5;">Une nouvelle version d'E.V.A est disponible. Vous devez l'installer pour continuer à utiliser l'application.</p>
      <div id="update-info" style="color:#aaa; font-size:0.8em; margin-bottom:20px; background:rgba(0,0,0,0.3); padding:10px; border-radius:6px; text-align:left; max-height:150px; overflow-y:auto; display:none;"></div>`;
    
    // In case of encoding issues in existing file, use regex
    html = html.replace(/<p style="color:var\(--text-muted\); font-size:0\.9em; margin-bottom:25px; line-height:1\.5;">.*?<\/p>/, pReplace);
  }

  // Update onUpdateAvailable
  let onAvailTarget = `window.eva.updater.onUpdateAvailable((info) => {
          document.getElementById('update-modal').style.display = 'flex';
        });`;
  let onAvailReplace = `window.eva.updater.onUpdateAvailable((info) => {
          document.getElementById('update-modal').style.display = 'flex';
          if (info && (info.version || info.releaseNotes)) {
            let infoDiv = document.getElementById('update-info');
            infoDiv.style.display = 'block';
            let content = '<b>Version ' + (info.version || 'Inconnue') + '</b><br>';
            if (info.releaseNotes) {
              // Si releaseNotes est un HTML (provenant de github)
              let notes = typeof info.releaseNotes === 'string' ? info.releaseNotes : (info.releaseNotes[0] ? info.releaseNotes[0].note : '');
              content += '<div style="margin-top:5px;font-size:0.9em;">' + notes + '</div>';
            }
            infoDiv.innerHTML = content;
          }
        });`;
  
  html = html.replace(onAvailTarget, onAvailReplace);
  fs.writeFileSync(filePath, html, 'utf8');
}

patchSplash('eva-pc/web/splash.html');
patchSplash('eva-pc/dist/splash.html');
