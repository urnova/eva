const fs = require('fs');
let login = fs.readFileSync('eva-pc/web/app-login.html', 'utf8');

login = login.replace(/res\.expires_in/g, 'res.expiresIn');

fs.writeFileSync('eva-pc/web/app-login.html', login, 'utf8');
console.log("EXPIRES IN FIXED");
