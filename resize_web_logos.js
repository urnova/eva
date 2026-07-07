const fs = require('fs');

const fixFile = (filePath) => {
  let content = fs.readFileSync(filePath, 'utf8');

  // Replace 300px with 180px
  content = content.replace(/width:300px;/g, 'width:180px;');

  fs.writeFileSync(filePath, content, 'utf8');
};

fixFile('EVA_V4_fixed_v4/app-login.html');
fixFile('EVA_V4_fixed_v4/app-signup.html');

console.log("WEB LOGOS RESIZED");
