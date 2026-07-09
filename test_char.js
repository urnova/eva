const fs = require('fs');
const content = fs.readFileSync('eva-pc/web/js/app/settings-panel.js', 'utf8');
const lines = content.split('\n');
const line = lines[723];
console.log("Length:", line.length);
for(let i=150; i<180; i++) {
  if (line[i]) console.log(i, line[i], line.charCodeAt(i).toString(16));
}
