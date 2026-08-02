const fs = require('fs');
const filepath = 'eva-pc/web/js/features/pc-agent.js';
let content = fs.readFileSync(filepath, 'utf8');

content = content.replace(/const cmd = data\.payload\?\.command;/, 'const cmd = data.payload?.command || data.payload?.script;');

const injection = `
      else if (data.type === 'lock') { if (window.eva.system.lock) await window.eva.system.lock(); }
      else if (data.type === 'sleep') { if (window.eva.system.sleep) await window.eva.system.sleep(); }
      else if (data.type === 'shutdown') { if (window.eva.system.shutdown) await window.eva.system.shutdown(); }
`;
if (!content.includes("data.type === 'lock'")) {
    content = content.replace(/else if \(\s*data\.type === 'run_script'\s*\) \{[\s\S]*?\}\s*\}/, `$&${injection}`);
    fs.writeFileSync(filepath, content);
    console.log("Handlers updated.");
}
