const fs = require('fs');
function fix(filepath) {
    let content = fs.readFileSync(filepath, 'utf8');
    // Replace the malformed string concatenation
    content = content.replace(/prompt \+= \"\r?\n\r?\n\[CLOUDWORKS\]/g, 'prompt += "\\n\\n[CLOUDWORKS]');
    fs.writeFileSync(filepath, content);
}
fix('eva-pc/web/js/app/core.js');
fix('EVA_V4_fixed_v4/js/app/core.js');
