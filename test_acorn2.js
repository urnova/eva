const acorn = require('eva-pc/node_modules/acorn');
const fs = require('fs');
const code = fs.readFileSync('eva-pc/web/js/app/settings-panel.js', 'utf8');
try {
  acorn.parse(code, { ecmaVersion: 2022, sourceType: 'module' });
  console.log("ACORN PARSE SUCCESS");
} catch (e) {
  console.log("ACORN PARSE ERROR:", e.message);
  console.log(e.loc);
}
