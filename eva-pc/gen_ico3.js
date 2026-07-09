const pngToIco = require('png-to-ico').default;
const fs = require('fs');

pngToIco('EVA_V4_fixed_v4/assets/images/eva-icon.png')
  .then(buf => {
    fs.writeFileSync('eva-pc/public/installer-icon.ico', buf);
    console.log('installer-icon.ico generated');
  })
  .catch(console.error);
