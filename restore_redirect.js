const fs = require('fs');
let authJs = fs.readFileSync('eva-pc/web/js/app/auth.js', 'utf8');
authJs = authJs.replace(/if \(\!user\) \{ console\.log\('\[EVA\] USER IS NULL IN ONAUTHSTATECHANGED'\); \/\* window\.location\.href = 'app-login\.html'; \*\/ return; \}/g, "if (!user) { window.location.href = 'app-login.html'; return; }");
fs.writeFileSync('eva-pc/web/js/app/auth.js', authJs, 'utf8');
console.log("AUTH REDIRECT RESTORED");
