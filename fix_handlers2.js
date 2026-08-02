const fs = require('fs');
const filepath = 'eva-pc/web/js/features/pc-agent.js';
let content = fs.readFileSync(filepath, 'utf8');

// replace cmd fetch
content = content.replace(/const cmd = data\.payload\?\.command;/g, 'const cmd = data.payload?.command || data.payload?.script;');

// inject handlers
if (!content.includes("data.type === 'lock'")) {
    const target = 'resultData = { stderr: res.stderr || res.error, exitCode: 1 };\n            }\n          }\n        }';
    const injection = `
      else if (data.type === 'lock') { if (window.eva.system.lock) await window.eva.system.lock(); }
      else if (data.type === 'sleep') { if (window.eva.system.sleep) await window.eva.system.sleep(); }
      else if (data.type === 'shutdown') { if (window.eva.system.shutdown) await window.eva.system.shutdown(); }
`;
    content = content.replace(target, target + injection);
    fs.writeFileSync(filepath, content);
    console.log("Handlers completely updated!");
} else {
    console.log("Already updated.");
}
