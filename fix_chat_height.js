const fs = require('fs');
let chat = fs.readFileSync('eva-pc/web/chat.html', 'utf8');

const oldStyle = `<style>body { padding-top: 32px; box-sizing: border-box; height: 100vh; overflow: hidden; } .sidebar { height: calc(100vh - 32px); top: 32px; }</style>`;
const newStyle = `<style>
  body { padding-top: 32px; box-sizing: border-box; height: 100vh; overflow: hidden; display: flex; flex-direction: row; }
  .sidebar { height: calc(100vh - 32px) !important; top: 32px !important; }
  .main-wrapper, .main-content, #appContainer { height: calc(100vh - 32px) !important; }
</style>`;

if (chat.includes(oldStyle)) {
  chat = chat.replace(oldStyle, newStyle);
  fs.writeFileSync('eva-pc/web/chat.html', chat, 'utf8');
  console.log('Fixed chat.html height');
} else {
  // if not found, we insert it just below the titlebar
  const titlebarEnd = `</div>\n  </div>`;
  const split = chat.split(titlebarEnd);
  if (split.length > 1) {
    chat = split[0] + titlebarEnd + '\n  ' + newStyle + split[1];
    fs.writeFileSync('eva-pc/web/chat.html', chat, 'utf8');
    console.log('Inserted chat.html height fix');
  }
}
