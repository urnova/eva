const fs = require('fs');
const content = fs.readFileSync('eva-pc/web/js/app/settings-panel.js', 'utf8');
const lines = content.split('\n');
for(let i=720; i<730; i++) {
  console.log(i+1, lines[i]);
}
