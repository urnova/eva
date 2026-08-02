const fs = require('fs');
const filepath = 'eva-pc/web/js/app/file-gen.js';
let content = fs.readFileSync(filepath, 'utf8');

const target = `var snap = await window.db.collection('cloudworks').doc(uid).collection('devices').where('deviceType','==','windows').get();
          var onlineDevice = null;
          snap.forEach(function(d) { if (d.data().online) onlineDevice = d.id; });`;

const injection = `var onlineDevice = action.deviceId || null;
          if (!onlineDevice) {
            var snap = await window.db.collection('cloudworks').doc(uid).collection('devices').where('deviceType','==','windows').get();
            snap.forEach(function(d) { if (d.data().online) onlineDevice = d.id; });
          }`;

if (content.includes(target)) {
    content = content.replace(target, injection);
    fs.writeFileSync(filepath, content);
    console.log("file-gen.js PC updated");
} else {
    console.log("Target not found in file-gen.js PC");
}
