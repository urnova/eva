const fs = require('fs');
const content = fs.readFileSync('eva-pc/web/js/app/settings-panel.js', 'utf8');
const lines = content.split('\n');
const line = lines[723];
const idx = line.indexOf('irr');
console.log(line.substring(idx - 10, idx + 20));
for(let i=idx-2; i<idx+15; i++) {
  if (line[i]) console.log(line[i], line.charCodeAt(i).toString(16));
}
