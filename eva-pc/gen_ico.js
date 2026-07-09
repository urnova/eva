const pngToIco = require('png-to-ico').default;
const fs = require('fs');

pngToIco('eva-pc/public/installer-icon.png')
  .then(buf => {
    fs.writeFileSync('eva-pc/public/installer-icon.ico', buf);
    console.log('installer-icon.ico generated');
  })
  .catch(console.error);
