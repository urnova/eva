const fs = require('fs');

function update(filepath) {
    let content = fs.readFileSync(filepath, 'utf8');
    const targetRegex = /var snap = await window\.db\.collection\('cloudworks'\)\.doc\(uid\)\.collection\('devices'\)\.where\('deviceType','==','windows'\)\.get\(\);\s*var onlineDevice = null;\s*snap\.forEach\(function\(d\)\s*\{ if \(d\.data\(\)\.online\) onlineDevice = d\.id; \}\);/;
    
    const injection = `var onlineDevice = action.deviceId || null;
          if (!onlineDevice) {
            var snap = await window.db.collection('cloudworks').doc(uid).collection('devices').where('deviceType','==','windows').get();
            snap.forEach(function(d) { if (d.data().online) onlineDevice = d.id; });
          }`;

    if (targetRegex.test(content)) {
        content = content.replace(targetRegex, injection);
        fs.writeFileSync(filepath, content);
        console.log("Updated: " + filepath);
    } else {
        console.log("Target not found in: " + filepath);
    }
}

update('eva-pc/web/js/app/file-gen.js');
update('EVA_V4_fixed_v4/js/app/file-gen.js');
