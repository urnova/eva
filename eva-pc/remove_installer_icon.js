const fs = require('fs');
let pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

if (pkg.build && pkg.build.nsis) {
  delete pkg.build.nsis.installerIcon;
  delete pkg.build.nsis.uninstallerIcon;
  delete pkg.build.nsis.installerHeaderIcon;
}

fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2), 'utf8');
console.log("REMOVED INSTALLER ICON CONFIG");
