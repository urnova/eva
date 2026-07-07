const fs = require('fs');
let html = fs.readFileSync('EVA_V4_fixed_v4/download.html', 'utf8');

const regexMobile = /(<!-- Mobile -->\s*<div class="dl-card">.*?<\/div>\s*<\/div>)/s;
html = html.replace(regexMobile, '');

const regexDesktop = /<div class="dl-btn-name">Télécharger pour Windows<\/div>\s*<div class="dl-btn-format">Windows 10\/11 - x64<\/div>\s*<\/div>\s*<span class="dl-btn-soon">Bientôt<\/span>/;
const replacementDesktop = `<div class="dl-btn-name">Télécharger pour Windows</div>
            <div class="dl-btn-format">Windows 10/11 - Setup.exe</div>
          </div>`;
html = html.replace(regexDesktop, replacementDesktop);

// Remove the disabled state of the desktop button
const targetDesktopBtn = `<div class="dl-btn">
          <div class="dl-btn-icon">💻</div>
          <div class="dl-btn-info">
            <div class="dl-btn-name">Télécharger pour Windows</div>
            <div class="dl-btn-format">Windows 10/11 - Setup.exe</div>
          </div>
        </div>`;

const replacementDesktopBtn = `<a href="https://github.com/urnova/eva/releases/latest" target="_blank" class="dl-btn" style="text-decoration:none;">
          <div class="dl-btn-icon">💻</div>
          <div class="dl-btn-info">
            <div class="dl-btn-name">Télécharger pour Windows</div>
            <div class="dl-btn-format">Windows 10/11 - Setup.exe</div>
          </div>
        </a>`;
html = html.replace(/<div class="dl-btn">\s*<div class="dl-btn-icon">💻<\/div>\s*<div class="dl-btn-info">\s*<div class="dl-btn-name">Télécharger pour Windows<\/div>\s*<div class="dl-btn-format">Windows 10\/11 - Setup\.exe<\/div>\s*<\/div>\s*<\/div>/, replacementDesktopBtn);

fs.writeFileSync('EVA_V4_fixed_v4/download.html', html, 'utf8');
console.log("DOWNLOAD HTML FIXED");
