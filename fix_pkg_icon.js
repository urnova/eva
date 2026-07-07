const fs = require('fs');
let pkg = JSON.parse(fs.readFileSync('eva-pc/package.json', 'utf8'));

pkg.build = pkg.build || {};
pkg.build.win = pkg.build.win || {};
pkg.build.nsis = pkg.build.nsis || {};

pkg.build.nsis.installerIcon = "public/installer-icon.png";
pkg.build.nsis.uninstallerIcon = "public/installer-icon.png";
pkg.build.nsis.installerHeaderIcon = "public/installer-icon.png";

fs.writeFileSync('eva-pc/package.json', JSON.stringify(pkg, null, 2), 'utf8');
console.log("PACKAGE JSON INSTALLER ICON SET");
