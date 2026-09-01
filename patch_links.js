const fs = require('fs');
const path = require('path');

function replaceInFile(filePath, searchRegex, replaceStr) {
    if (!fs.existsSync(filePath)) return;
    let content = fs.readFileSync(filePath, 'utf8');
    content = content.replace(searchRegex, replaceStr);
    fs.writeFileSync(filePath, content, 'utf8');
}

// 1. cloudworks.js
const cwPaths = ['EVA_V4_fixed_v4/js/features/cloudworks.js', 'eva-pc/web/js/features/cloudworks.js'];
cwPaths.forEach(p => {
    // Remove the github fetch logic
    const fetchRegex = /fetch\('https:\/\/api\.github\.com\/repos\/urnova\/eva\/releases\/latest'\)[\s\S]*?\}\);/m;
    replaceInFile(p, fetchRegex, '');
    
    // In case it's an a tag
    const searchA = /<a href="https:\/\/github\.com\/urnova\/eva\/releases\/latest" target="_blank" id="cwDlBtn".*?>[\s\S]*?<\/a>/g;
    replaceInFile(p, searchA, `<button class="cw-dl-btn" id="cwDlBtn" onclick="window.open('/download.html', '_blank')" style="width:100%;margin-top:15px;padding:12px;background:var(--cyan);color:#000;border:none;border-radius:8px;font-weight:700;cursor:pointer;">Télécharger l'Agent PC</button>`);
});

// 2. index.html
const indexHtml = 'EVA_V4_fixed_v4/index.html';
replaceInFile(indexHtml, /fetch\('https:\/\/api\.github\.com\/repos\/urnova\/eva\/releases\/latest'\)[\s\S]*?\}\);/m, '');
replaceInFile(indexHtml, /<a href="https:\/\/github\.com\/urnova\/eva\/releases\/latest".*?>/g, `<a href="/download.html" style="text-decoration:none; margin-top:22px;display:flex;align-items:center;gap:12px;padding:13px 16px;border-radius:12px;border:1px solid rgba(0,212,255,0.4);background:rgba(0,212,255,0.15);cursor:pointer; transition:all 0.3s;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='none'">`);

// Update legal pages dates
['conditions.html', 'confidentialite.html', 'cookies.html'].forEach(page => {
    const p = path.join('EVA_V4_fixed_v4', page);
    replaceInFile(p, /Dernière mise à jour\s*:\s*[A-Za-zû0-9\s]+2026/gi, 'Dernière mise à jour : Septembre 2026');
});

console.log('Links and dates patched.');
