const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('eva-pc/package.json', 'utf8'));
if (!pkg.build.extraResources) {
    pkg.build.extraResources = [
        {
            "from": "resources/",
            "to": "resources/",
            "filter": ["**/*"]
        }
    ];
}
pkg.scripts["postinstall"] = "node scripts/download-llm.js && electron-builder install-app-deps";
fs.writeFileSync('eva-pc/package.json', JSON.stringify(pkg, null, 2));
console.log("package.json updated");
