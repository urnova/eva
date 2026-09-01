const fs = require('fs');
let content = fs.readFileSync('EVA_V4_fixed_v4/js/app/messages.js', 'utf8');
content = content.replace(
  /S\.documents\.push\(\{ name: file\.name, ext: ext, text: null, size: file\.size, _loading: true \}\);/,
  "S.documents.push({ name: file.name, ext: ext, text: null, size: file.size, url: URL.createObjectURL(file), _loading: true });"
);
fs.writeFileSync('EVA_V4_fixed_v4/js/app/messages.js', content, 'utf8');
