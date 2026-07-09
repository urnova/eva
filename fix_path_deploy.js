const fs = require('fs');
let js = fs.readFileSync('eva-pc/deploy.js', 'utf8');

js = `
process.env.PATH = "F:\\\\donnee_app\\\\dev_tool\\\\node;" + process.env.PATH;
` + js;

fs.writeFileSync('eva-pc/deploy.js', js, 'utf8');
console.log('deploy.js updated to include node in PATH');
