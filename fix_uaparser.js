const fs = require('fs');
let authJs = fs.readFileSync('eva-pc/web/js/app/auth.js', 'utf8');

const target = `var parser = new UAParser();
    var ua = parser.getResult();
    var devType = window.eva ? 'Application PC' : (ua.device.type === 'mobile' ? 'Mobile' : 'Navigateur Web');
    var browserName = window.eva ? 'E.V.A OS Agent' : (ua.browser.name || 'Inconnu');
    var osName = window.eva ? 'Windows' : (ua.os.name || 'Inconnu');`;

const replacement = `var devType = window.eva ? 'Application PC' : (/Mobi|Android/i.test(navigator.userAgent) ? 'Mobile' : 'Navigateur Web');
    var browserName = window.eva ? 'E.V.A OS Agent' : 'Navigateur';
    var osName = window.eva ? 'Windows' : (/Windows/i.test(navigator.userAgent) ? 'Windows' : /Mac/i.test(navigator.userAgent) ? 'MacOS' : 'Inconnu');`;

authJs = authJs.replace(target, replacement);
fs.writeFileSync('eva-pc/web/js/app/auth.js', authJs, 'utf8');
console.log("SESSION TRACKING FIXED UAPARSER");
