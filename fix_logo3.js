const fs = require('fs');
let content = fs.readFileSync('eva-pc/web/chat.html', 'utf8');
content = content.replace(/<\/a>\s*<\/div>\s*<nav class="sb-nav">/g, '</div>\n    </div>\n    <nav class="sb-nav">');
fs.writeFileSync('eva-pc/web/chat.html', content);
