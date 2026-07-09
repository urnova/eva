const fs = require('fs');
let agentJS = fs.readFileSync('eva-pc/web/js/features/pc-agent.js', 'utf8');

agentJS = agentJS.replace(
`.where('deviceId', '==', deviceId)
      .where('status', '==', 'pending')
      .onSnapshot(async (snap) => {
        for (const change of snap.docChanges()) {
          if (change.type === 'added') {
            await handleCommand(change.doc.id, change.doc.data(), uid);
          }
        }
      });`,
`.where('deviceId', '==', deviceId)
      .onSnapshot(async (snap) => {
        for (const change of snap.docChanges()) {
          if (change.type === 'added') {
            const data = change.doc.data();
            if (data.status === 'pending') {
              await handleCommand(change.doc.id, data, uid);
            }
          }
        }
      }, (e) => console.error('Erreur listenCommands:', e));`
);

fs.writeFileSync('eva-pc/web/js/features/pc-agent.js', agentJS, 'utf8');
console.log("FIXED MISSING INDEX");
