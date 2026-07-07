const pngToIco = require('png-to-ico');
const fs = require('fs');

pngToIco('public/installer-icon.png')
  .then(buf => {
    fs.writeFileSync('public/installer-icon.ico', buf);
    console.log("ICON CONVERTED TO ICO");
  })
  .catch(console.error);
