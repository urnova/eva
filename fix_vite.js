const fs = require('fs');
let viteConfig = fs.readFileSync('eva-pc/vite.config.ts', 'utf8');
viteConfig = viteConfig.replace(/options\.reload\(\)/g, 'options.startup()');
fs.writeFileSync('eva-pc/vite.config.ts', viteConfig, 'utf8');
console.log("VITE CONFIG FIXED");
