const fs = require('fs');

const path = 'f:/code/eva/evaprojectmultiplatforme/eva-pc/web/splash.html';
let code = fs.readFileSync(path, 'utf8');

// Add -webkit-app-region: no-drag to the buttons directly
code = code.replace('<button onclick="window.eva.window.close()" style="', '<button onclick="window.eva.window.close()" style="-webkit-app-region: no-drag; ');
code = code.replace('<button id="btn-download" onclick="startUpdate()" style="', '<button id="btn-download" onclick="startUpdate()" style="-webkit-app-region: no-drag; ');

// Let's also ensure the modal block itself doesn't somehow cause issues by pointer-events
code = code.replace('<div id="update-modal" style="display:none; position:fixed; inset:0; background:rgba(17,17,19,0.85); backdrop-filter:blur(10px); z-index:999999; flex-direction:column; justify-content:center; align-items:center; -webkit-app-region:no-drag;">', '<div id="update-modal" style="display:none; position:fixed; inset:0; background:rgba(17,17,19,0.85); backdrop-filter:blur(10px); z-index:999999; flex-direction:column; justify-content:center; align-items:center; -webkit-app-region:no-drag; pointer-events:auto;">');

fs.writeFileSync(path, code, 'utf8');
console.log('Fixed splash buttons');
