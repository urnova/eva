const fs = require('fs');
const file = 'eva-pc/web/chat.html';
let content = fs.readFileSync(file, 'utf8');

const targetStyle = `<style>
  body { padding-top: 32px; box-sizing: border-box; height: 100vh; overflow: hidden; display: flex; flex-direction: row; }
  .sidebar { height: calc(100vh - 32px) !important; top: 32px !important; }
  .main-wrapper, .main-content, #appContainer { height: calc(100vh - 32px) !important; }
</style>`;

const replStyle = `<style>
  body { padding-top: 32px; box-sizing: border-box; height: 100vh; overflow: hidden; display: flex; flex-direction: row; }
  .sidebar { height: calc(100vh - 32px) !important; top: 32px !important; }
  .main-wrapper, .main-content, #appContainer, .app-main { height: calc(100vh - 32px) !important; }
</style>`;

content = content.replace(targetStyle, replStyle);
fs.writeFileSync(file, content, 'utf8');
console.log('chat.html PC layout fixed');
