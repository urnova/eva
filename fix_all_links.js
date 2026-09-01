const fs = require('fs');
const glob = require('fs');

function replaceInFile(filePath, search, replace) {
    if (!fs.existsSync(filePath)) return;
    let content = fs.readFileSync(filePath, 'utf8');
    content = content.replace(search, replace);
    fs.writeFileSync(filePath, content, 'utf8');
}

function replaceAllInFile(filePath, search, replace) {
    if (!fs.existsSync(filePath)) return;
    let content = fs.readFileSync(filePath, 'utf8');
    content = content.split(search).join(replace);
    fs.writeFileSync(filePath, content, 'utf8');
}

// 1. chat.html
let chatHtmlPaths = ['EVA_V4_fixed_v4/chat.html', 'eva-pc/web/chat.html'];
for (let p of chatHtmlPaths) {
    // Remove the dynamic script for github links
    replaceInFile(p, /fetch\('https:\/\/api\.github\.com\/repos\/urnova\/eva\/releases\/latest'\)[\s\S]*?\}\);/m, '');
    
    // Change hardcoded hrefs
    let content = fs.readFileSync(p, 'utf8');
    content = content.replace(/href="https:\/\/github\.com\/urnova\/eva\/releases\/latest\/download\/EVA-Assistant-Setup\.exe"/g, 'href="/download"');
    content = content.replace(/href="https:\/\/github\.com\/urnova\/eva\/releases\/latest"/g, 'href="/download"');
    fs.writeFileSync(p, content, 'utf8');
}

// 2. index.html
let indexHtmlPath = 'EVA_V4_fixed_v4/index.html';
if (fs.existsSync(indexHtmlPath)) {
    let content = fs.readFileSync(indexHtmlPath, 'utf8');
    // The script overwriting the link: dlEl.closest('a').href = ...
    content = content.replace(/dlEl\.closest\('a'\)\.href\s*=\s*'https:\/\/github\.com\/urnova\/eva\/releases\/latest\/download\/E\.V\.A-Setup-'\s*\+\s*vTag\.replace\('v', ''\)\s*\+\s*'\.exe';/g, '');
    content = content.replace(/<script>[\s\S]*?fetch\('https:\/\/api\.github\.com\/repos\/urnova\/eva\/releases\/latest'\)[\s\S]*?<\/script>/, '');
    
    // Replace hrefs
    content = content.replace(/href="https:\/\/github\.com\/urnova\/eva\/releases\/latest\/download\/[^"]+"/g, 'href="/download"');
    content = content.replace(/href="https:\/\/github\.com\/urnova\/eva\/releases\/latest"/g, 'href="/download"');
    
    fs.writeFileSync(indexHtmlPath, content, 'utf8');
}

console.log('All links patched to /download');
