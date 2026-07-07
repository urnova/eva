const fs = require('fs');
let chatHtml = fs.readFileSync('eva-pc/web/chat.html', 'utf8');

const target = `onclick="if(window.eva) window.eva.window.close()"`;
const replacement = `onclick="if(window.pcAgentDocRef){window.pcAgentDocRef.update({online:false}).finally(()=>{if(window.eva)window.eva.window.close()})}else if(window.eva){window.eva.window.close()}"`;

chatHtml = chatHtml.replace(target, replacement);

fs.writeFileSync('eva-pc/web/chat.html', chatHtml, 'utf8');
console.log("CHAT CLOSE BUTTON FIXED");
