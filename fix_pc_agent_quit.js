const fs = require('fs');
let pcAgentJs = fs.readFileSync('eva-pc/web/js/features/pc-agent.js', 'utf8');

const target = `window.addEventListener('beforeunload', () => {
        docRef.update({ online: false, lastSeen: typeof window.timestamp === 'function' ? window.timestamp() : new Date() }).catch(()=>{});
      });`;

const replacement = target + `
      
      if (window.eva && window.eva.onAppQuit) {
        window.eva.onAppQuit(() => {
          docRef.update({ online: false, lastSeen: typeof window.timestamp === 'function' ? window.timestamp() : new Date() }).catch(()=>{});
        });
      }`;

pcAgentJs = pcAgentJs.replace(target, replacement);

fs.writeFileSync('eva-pc/web/js/features/pc-agent.js', pcAgentJs, 'utf8');
console.log("PC AGENT ONAPPQUIT ADDED");
