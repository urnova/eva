const fs = require('fs');
const webFile = 'EVA_V4_fixed_v4/js/app/settings-panel.js';
const pcFile = 'eva-pc/web/js/app/settings-panel.js';

let webContent = fs.readFileSync(webFile, 'utf8');
let pcContent = fs.readFileSync(pcFile, 'utf8');

// Extract the whole `usage` section from Web
let usageMatch = webContent.match(/else if\s*\(\s*section\s*===\s*'usage'\s*\)\s*\{([\s\S]*?)if\s*\(\s*provider\s*===\s*'eva'\s*\)/);
if (usageMatch) {
    let usageBlock = usageMatch[1];
    // Replace the `usage` block in PC
    pcContent = pcContent.replace(/else if\s*\(\s*section\s*===\s*'usage'\s*\)\s*\{([\s\S]*?)if\s*\(\s*provider\s*===\s*'eva'\s*\)/, `else if (section === 'usage') {${usageBlock}if (provider === 'eva') `);
    fs.writeFileSync(pcFile, pcContent);
    console.log("Usage section copied successfully.");
} else {
    console.log("Usage block not found in web file.");
}
