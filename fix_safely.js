const fs = require('fs');
const filepath = 'eva-pc/web/chat.html';
let content = fs.readFileSync(filepath, 'utf8');

const target = `<a href="/" style="display:flex;align-items:center;gap:10px;text-decoration:none;" title="Retour à l'accueil">
      <img src="/assets/images/eva-logo.png" alt="EVA" class="sb-logo-img">
      <span class="sb-brand-beta">BÊTA V4</span>
    </a>`;

const replacement = `<div style="display:flex;align-items:center;gap:10px;text-decoration:none;" title="EVA Desktop Agent">
      <img src="/assets/images/eva-logo.png" alt="EVA" class="sb-logo-img">
      <span class="sb-brand-beta">BÊTA V4</span>
    </div>`;

// Fallback search that works regardless of encoding
content = content.replace(/<div class="sb-header">\s*<a href="\/" style="display:flex;align-items:center;gap:10px;text-decoration:none;" title="[^"]*">\s*<img src="\/assets\/images\/eva-logo\.png" alt="EVA" class="sb-logo-img">\s*<span class="sb-brand-beta">[^<]*<\/span>\s*<\/a>\s*<\/div>/, `<div class="sb-header">\n    <div style="display:flex;align-items:center;gap:10px;text-decoration:none;" title="EVA Desktop Agent">\n      <img src="/assets/images/eva-logo.png" alt="EVA" class="sb-logo-img">\n      <span class="sb-brand-beta">BÊTA V4</span>\n    </div>\n  </div>`);

fs.writeFileSync(filepath, content);
console.log("Fixed safely.");
