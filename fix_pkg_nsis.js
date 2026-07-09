const fs = require('fs');
let pkg = JSON.parse(fs.readFileSync('eva-pc/package.json', 'utf8'));

pkg.build.artifactName = "E.V.A-Setup.exe";
pkg.build.nsis = {
  "oneClick": false,
  "allowToChangeInstallationDirectory": true,
  "installerIcon": "public/installer-icon.ico",
  "uninstallerIcon": "public/installer-icon.ico",
  "uninstallDisplayName": "Désinstaller E.V.A",
  "createDesktopShortcut": true,
  "createStartMenuShortcut": true
};

fs.writeFileSync('eva-pc/package.json', JSON.stringify(pkg, null, 2), 'utf8');
console.log('package.json updated for NSIS');
