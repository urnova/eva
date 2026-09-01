const fs = require('fs');

let content = fs.readFileSync('eva-pc/web/splash.html', 'utf8');

// Button 1: Quitter
content = content.replace(
    '<button onclick="window.eva.window.close()" style="padding:10px 20px; border:1px solid rgba(255,255,255,0.1); background:transparent; color:var(--text); border-radius:6px; cursor:pointer; font-family:\'Space Mono\', monospace; transition:all 0.2s;"',
    '<button onclick="window.eva.window.close()" style="padding:10px 20px; border:1px solid rgba(255,255,255,0.1); background:transparent; color:var(--text); border-radius:6px; cursor:pointer; font-family:\'Space Mono\', monospace; transition:all 0.2s; pointer-events:auto; -webkit-app-region:no-drag;"'
);

// Button 2: Télécharger
content = content.replace(
    '<button id="btn-download" onclick="startUpdate()" style="padding:10px 20px; border:none; background:var(--cyan); color:#111; border-radius:6px; cursor:pointer; font-weight:bold; font-family:\'Space Mono\', monospace; transition:all 0.2s; box-shadow:0 0 15px var(--cyan-glow);"',
    '<button id="btn-download" onclick="startUpdate()" style="padding:10px 20px; border:none; background:var(--cyan); color:#111; border-radius:6px; cursor:pointer; font-weight:bold; font-family:\'Space Mono\', monospace; transition:all 0.2s; box-shadow:0 0 15px var(--cyan-glow); pointer-events:auto; -webkit-app-region:no-drag;"'
);

// Modal container
content = content.replace(
    'id="update-modal" style="display:none; position:fixed; inset:0; background:rgba(17,17,19,0.85); backdrop-filter:blur(10px); z-index:999999; flex-direction:column; justify-content:center; align-items:center; -webkit-app-region:no-drag;"',
    'id="update-modal" style="display:none; position:fixed; inset:0; background:rgba(17,17,19,0.85); backdrop-filter:blur(10px); z-index:999999; flex-direction:column; justify-content:center; align-items:center; -webkit-app-region:no-drag; pointer-events:auto;"'
);

// Update info container
content = content.replace(
    '<div id="update-info" style="color:#aaa; font-size:0.8em; margin-bottom:20px; background:rgba(0,0,0,0.3); padding:10px; border-radius:6px; text-align:left; max-height:150px; overflow-y:auto; display:none;"></div>',
    '<div id="update-info" style="color:#aaa; font-size:0.8em; margin-bottom:20px; background:rgba(0,0,0,0.3); padding:10px; border-radius:6px; text-align:left; max-height:150px; overflow-y:auto; display:none; pointer-events:auto; -webkit-app-region:no-drag;"></div>'
);

fs.writeFileSync('eva-pc/web/splash.html', content, 'utf8');
console.log('Update modal fixed');
