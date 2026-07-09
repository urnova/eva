const fs = require('fs');
const content = fs.readFileSync('eva-pc/web/js/app/settings-panel.js', 'utf8');
const lines = content.split('\n');
console.log(lines[723]);
