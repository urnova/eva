const fs = require('fs');
let pcAgentJs = fs.readFileSync('eva-pc/web/js/features/pc-agent.js', 'utf8');

pcAgentJs = pcAgentJs.replace(`const docRef = window.db.collection('cloudworks').doc(uid).collection('devices').doc(deviceId);`, 
`const docRef = window.db.collection('cloudworks').doc(uid).collection('devices').doc(deviceId);
window.pcAgentDocRef = docRef;`);

fs.writeFileSync('eva-pc/web/js/features/pc-agent.js', pcAgentJs, 'utf8');
console.log("PC AGENT REF EXPOSED");
