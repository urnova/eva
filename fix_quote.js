const fs = require('fs');
let file = fs.readFileSync('eva-pc/web/js/app/settings-panel.js', 'utf8');
file = file.replace(`''<button class="btn btn-secondary" onclick="changePassword()"`, `'<button class="btn btn-secondary" onclick="changePassword()"`);
fs.writeFileSync('eva-pc/web/js/app/settings-panel.js', file, 'utf8');
console.log("FIXED DOUBLE QUOTE");
