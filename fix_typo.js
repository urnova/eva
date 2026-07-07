const fs = require('fs');
let login = fs.readFileSync('eva-pc/web/app-login.html', 'utf8');

login = login.replace(/res\.id_token/g, 'res.idToken');

fs.writeFileSync('eva-pc/web/app-login.html', login, 'utf8');
console.log("TYPO FIXED");
