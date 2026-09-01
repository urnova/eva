const fs = require('fs');
const splashPath = 'f:/code/eva/evaprojectmultiplatforme/eva-pc/web/splash.html';
if (fs.existsSync(splashPath)) {
  let splash = fs.readFileSync(splashPath, 'utf8');
  
  // Display error in modal with a manual download button
  let targetScript = `infoDiv.innerHTML = '<b style="color:var(--red)">Erreur de tlchargement:</b><br><span style="color:var(--red);font-size:0.8em">' + err + '</span><br><br><button onclick="window.eva.window.openExternal(\\'https://github.com/urnova/eva/releases\\')" style="padding:6px 12px; border:1px solid var(--cyan); background:transparent; color:var(--cyan); border-radius:4px; cursor:pointer; font-size:0.9em;">Tlcharger manuellement</button>';`;
  let targetOld = `infoDiv.innerHTML = '<b style="color:var(--red)">Erreur de tlchargement:</b><br><span style="color:var(--red);font-size:0.8em">' + err + '</span><br>Veuillez ressayer ou tlcharger manuellement depuis GitHub.';`;
  let newScript = `infoDiv.innerHTML = '<b style="color:var(--red)">Erreur de téléchargement:</b><br><span style="color:var(--red);font-size:0.8em">' + err + '</span><br><br><button onclick="window.eva.openExternal(\\'https://github.com/urnova/eva/releases\\')" style="padding:6px 12px; border:1px solid var(--cyan); background:transparent; color:var(--cyan); border-radius:4px; cursor:pointer; font-size:0.9em;">Télécharger manuellement</button>';`;
  
  splash = splash.replace(targetScript, newScript).replace(targetOld, newScript);
  
  fs.writeFileSync(splashPath, splash, 'utf8');
}
