const fs = require('fs');

let login = fs.readFileSync('eva-pc/web/app-login.html', 'utf8');
login = login.replace(/width:380px;/, 'width:180px;');
fs.writeFileSync('eva-pc/web/app-login.html', login, 'utf8');

console.log("DESKTOP LOGO FIXED");
