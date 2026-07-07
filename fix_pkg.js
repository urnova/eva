const fs = require('fs');

let pkg = JSON.parse(fs.readFileSync('eva-pc/package.json', 'utf8'));

// Change electron:dev to just "vite"
pkg.scripts['electron:dev'] = 'vite';

fs.writeFileSync('eva-pc/package.json', JSON.stringify(pkg, null, 2), 'utf8');

console.log("PACKAGE FIXED");
