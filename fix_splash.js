const fs = require('fs');
const { execSync } = require('child_process');

try {
  execSync('git checkout 628dbcf -- eva-pc/web/splash.html', { stdio: 'inherit' });
  let splash = fs.readFileSync('eva-pc/web/splash.html', 'utf8');

  // Enlarge logo container and image
  splash = splash.replace(/width: 140px; height: 140px;/, 'width: 250px; height: 250px;');
  splash = splash.replace(/width: 100px; height: auto; object-fit: contain; z-index: 2;/, 'width: 180px; height: auto; object-fit: contain; z-index: 2;');
  
  // Fix the URL to relative
  splash = splash.replace(/src="\/assets\/images\/eva-logo\.png"/, 'src="./assets/images/eva-logo.png"');

  fs.writeFileSync('eva-pc/web/splash.html', splash, 'utf8');
  console.log("SUCCESS");
} catch(err) {
  console.error("ERROR:", err);
}
