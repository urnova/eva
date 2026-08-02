const fs = require('fs');
const filepath = 'eva-pc/scripts/download-llm.js';
let content = fs.readFileSync(filepath, 'utf8');

const regex = /execSync\(`powershell -command "Expand-Archive -Force '\$\{serverZipDest\}' '\$\{LLM_DIR\}'"\);/;
const injection = `execSync(\`tar.exe -xf "\${serverZipDest}" -C "\${LLM_DIR}"\`);`;

if (content.match(regex)) {
    content = content.replace(regex, injection);
    fs.writeFileSync(filepath, content);
    console.log("Unzip logic replaced with tar.exe");
} else {
    console.log("Unzip logic not found.");
}
