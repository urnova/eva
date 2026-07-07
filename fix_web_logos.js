const fs = require('fs');

const fixFile = (filePath) => {
  let content = fs.readFileSync(filePath, 'utf8');

  // Remove the media query overrides for the tiny logo
  content = content.replace(/\.deco-circle\{width:[^}]+\}/g, '');
  content = content.replace(/\.deco-circle img\{width:[^}]+\}/g, '');
  
  // Replace the default logo CSS
  content = content.replace(/\.deco-circle\{\s*width:[^}]+\s*\}/g, '');
  content = content.replace(/\.deco-circle img\{\s*width:[^}]+\s*\}/g, '');
  
  // Actually, let's just replace the HTML wrapper with a direct image with inline styles for maximum control
  content = content.replace(/<div class="deco-circle">\s*<img src="\/assets\/images\/eva-logo\.png" alt="EVA">\s*<\/div>/, '<img src="/assets/images/eva-logo.png" alt="EVA" style="width:300px;height:auto;object-fit:contain;margin-bottom:20px;filter:drop-shadow(0 0 28px rgba(123,139,245,0.4));">');

  fs.writeFileSync(filePath, content, 'utf8');
};

fixFile('EVA_V4_fixed_v4/app-login.html');
fixFile('EVA_V4_fixed_v4/app-signup.html');

console.log("WEB LOGOS FIXED");
