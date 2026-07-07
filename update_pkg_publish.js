const fs = require('fs');
let pkg = JSON.parse(fs.readFileSync('eva-pc/package.json', 'utf8'));

// Version 5.2.0
pkg.version = "5.2.0";

pkg.build = pkg.build || {};
pkg.build.publish = [
  {
    "provider": "github",
    "owner": "urnova",
    "repo": "eva",
    "releaseType": "release"
  }
];

fs.writeFileSync('eva-pc/package.json', JSON.stringify(pkg, null, 2), 'utf8');
console.log("PACKAGE JSON UPDATED FOR PUBLISH");
