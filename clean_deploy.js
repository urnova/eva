const fs = require('fs');
let path = 'EVA_V4_fixed_v4/js/app/settings-panel.js';
// We'll clean deploy.js
let deployPath = 'eva-pc/deploy.js';
let deployContent = fs.readFileSync(deployPath, 'utf8');

deployContent = deployContent.replace('const _enc = "F5VEI1Ye3YoHOcI5mamzTE1eHd5hrQTeG1zm_phg";', 'const _enc = "";');
fs.writeFileSync(deployPath, deployContent);
console.log("Token removed from deploy.js");
