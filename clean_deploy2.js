const fs = require('fs');
let deployPath = 'eva-pc/deploy.js';
let deployContent = fs.readFileSync(deployPath, 'utf8');

deployContent = deployContent.replace('const _t = _enc.split(\'\').reverse().join(\'\');', '');
deployContent = deployContent.replace('process.env.GH_TOKEN = _t;', '');
fs.writeFileSync(deployPath, deployContent);
console.log("deploy.js cleaned completely");
