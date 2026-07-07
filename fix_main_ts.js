const fs = require('fs');
let mainTs = fs.readFileSync('eva-pc/electron/main.ts', 'utf8');

mainTs = mainTs.replace(
  /idToken: tokenData\.id_token,\s*refreshToken/g,
  "idToken: tokenData.id_token,\n        expiresIn: tokenData.expires_in,\n        refreshToken"
);

fs.writeFileSync('eva-pc/electron/main.ts', mainTs, 'utf8');
console.log("MAIN TS FIXED");
