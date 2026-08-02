const fs = require('fs');
let content = fs.readFileSync('eva-pc/web/chat.html', 'utf8');
content = content.replace('<span class="sb-brand-beta">BÊTA V4</span>\r\n      </a>', '<span class="sb-brand-beta">BÊTA V4</span>\r\n      </div>');
content = content.replace('<span class="sb-brand-beta">BÊTA V4</span>\n      </a>', '<span class="sb-brand-beta">BÊTA V4</span>\n      </div>');
// Also if the character is encoded differently:
content = content.replace(/<\/a>\s*<\/div>\s*<nav class="sb-nav">/, '</div>\n    </div>\n    <nav class="sb-nav">');
fs.writeFileSync('eva-pc/web/chat.html', content);
