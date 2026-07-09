const fs = require('fs');
let js = fs.readFileSync('eva-pc/deploy.js', 'utf8');

js = js.replace(
  "spawnSync('pnpm', ['run', 'build']",
  "spawnSync('F:\\\\donnee_app\\\\dev_tool\\\\node\\\\npm.cmd', ['run', 'build']"
);

js = js.replace(
  "spawnSync('pnpm', ['exec', 'electron-builder'",
  "spawnSync('F:\\\\donnee_app\\\\dev_tool\\\\node\\\\npx.cmd', ['electron-builder'"
);

fs.writeFileSync('eva-pc/deploy.js', js, 'utf8');
console.log('deploy.js updated to use npm/npx with full path');
