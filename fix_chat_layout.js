const fs = require('fs');
let chatHtml = fs.readFileSync('eva-pc/web/chat.html', 'utf8');

const target = `<style>body { padding-top: 32px; } .sidebar { height: calc(100% - 32px); top: 32px; }</style>`;
const replacement = `<style>body { padding-top: 32px; box-sizing: border-box; height: 100vh; overflow: hidden; } .sidebar { height: calc(100vh - 32px); top: 32px; }</style>`;

chatHtml = chatHtml.replace(target, replacement);

fs.writeFileSync('eva-pc/web/chat.html', chatHtml, 'utf8');
console.log("CHAT HTML LAYOUT FIXED");
