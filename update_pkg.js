const fs = require('fs');
let pkg = JSON.parse(fs.readFileSync('eva-pc/package.json', 'utf8'));

pkg.build.win.publisherName = "Astral Technologie";
pkg.build.win.verifyUpdateCodeSignature = false; // Important for unsigned updates
pkg.build.nsis.artifactName = "E.V.A-Setup.exe";
pkg.build.nsis.uninstallDisplayName = "E.V.A Assistant";

fs.writeFileSync('eva-pc/package.json', JSON.stringify(pkg, null, 2), 'utf8');
console.log("PACKAGE JSON UPDATED");
