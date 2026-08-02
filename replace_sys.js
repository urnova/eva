const fs = require('fs');
const filepath = 'eva-pc/web/js/features/pc-agent.js';
let content = fs.readFileSync(filepath, 'utf8');

content = content.replace(/SYS/g, 'await window.getDynamicSysPrompt()');
fs.writeFileSync(filepath, content);
console.log("SYS replaced by await window.getDynamicSysPrompt() in pc-agent.js");
