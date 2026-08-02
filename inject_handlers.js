const fs = require('fs');
const filepath = 'eva-pc/web/js/features/pc-agent.js';
let content = fs.readFileSync(filepath, 'utf8');

const injection = `
      else if (data.type === 'run_script') {
        if (window.eva.system.exec) {
          const res = await window.eva.system.exec(data.payload.script);
          if (res.success) {
            resultData = { output: res.data };
          } else throw new Error(res.error);
        }
      }
      else if (data.type === 'lock') {
        if (window.eva.system.lock) {
          await window.eva.system.lock();
        }
      }
      else if (data.type === 'sleep') {
        if (window.eva.system.sleep) {
          await window.eva.system.sleep();
        }
      }
      else if (data.type === 'shutdown') {
        if (window.eva.system.shutdown) {
          await window.eva.system.shutdown();
        }
      }
`;

if (!content.includes("data.type === 'run_script'")) {
    content = content.replace(/else if\s*\(\s*data\.type\s*===\s*'sysinfo'\s*\)\s*\{[\s\S]*?else throw new Error\(res\.error\);\s*\}/, `$&${injection}`);
    fs.writeFileSync(filepath, content);
    console.log("CloudWorks handlers added.");
}
