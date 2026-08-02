const fs = require('fs');
let content = fs.readFileSync('eva-pc/web/chat.html', 'utf8');
content = content.replace(/<\/a>\s*<\/div>/g, '</div>\n    </div>');
fs.writeFileSync('eva-pc/web/chat.html', content);
