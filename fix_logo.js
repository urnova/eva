const fs = require('fs');
let content = fs.readFileSync('eva-pc/web/chat.html', 'utf8');
content = content.replace('<a href="/" style="display:flex;align-items:center;gap:10px;text-decoration:none;" title="Retour \u00e0 l\'accueil">', '<div style="display:flex;align-items:center;gap:10px;text-decoration:none;" title="EVA Desktop Agent">');
content = content.replace('<span class="sb-brand-beta">BÊTA V4</span>\r\n      </a>', '<span class="sb-brand-beta">BÊTA V4</span>\r\n      </div>');
content = content.replace('<span class="sb-brand-beta">BÊTA V4</span>\n      </a>', '<span class="sb-brand-beta">BÊTA V4</span>\n      </div>');
// Fallback if accents differ
content = content.replace(/<a href="\/"[^>]*>/, '<div style="display:flex;align-items:center;gap:10px;text-decoration:none;" title="EVA Desktop Agent">');
content = content.replace(/<\/a>\s*<\/div>\s*<nav class="sb-nav">/g, '</div>\n    </div>\n    <nav class="sb-nav">');
fs.writeFileSync('eva-pc/web/chat.html', content);
