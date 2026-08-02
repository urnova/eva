const fs = require('fs');
const filepath = 'eva-pc/scripts/download-llm.js';
let content = fs.readFileSync(filepath, 'utf8');

const target = 'execSync(`powershell -command "Expand-Archive -Force \\'${serverZipDest}\\' \\'${LLM_DIR}\\'"`);';
const injection = 'execSync(`tar.exe -xf "${serverZipDest}" -C "${LLM_DIR}"`);';

if (content.includes('Expand-Archive')) {
    content = content.replace(/execSync\(`powershell -command "Expand-Archive -Force '\$\{serverZipDest\}' '\$\{LLM_DIR\}'"`\);/g, injection);
    fs.writeFileSync(filepath, content);
    console.log("Replaced with tar");
} else {
    console.log("Not found.");
}
