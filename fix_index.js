const fs = require('fs');
let html = fs.readFileSync('EVA_V4_fixed_v4/index.html', 'utf8');

// The section has `<div class="section-label">T\x8F\x8Fl\x8F\x8Fchargement</div>` or similar
const regex = /<div class="section-label">.*?T[^<]+chargement.*?<\/div>[\s\S]*?<div class="feature-title">EVA DESKTOP<\/div>[\s\S]*?Bient.*?t disponible.*?<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*<\/div>/g;

const replacement = `<div style="text-align:center;max-width:600px;margin:0 auto 0">
      <div class="section-label">Téléchargement</div>
      <h2 class="section-title">EVA Partout</h2>
      <p class="section-sub" style="margin:0 auto">Téléchargez l'application native pour Windows et profitez de l'intégration CloudWorks OS Agent avec E.V.A.</p>
    </div>
    <div style="display:flex;justify-content:center;margin:48px auto 0;">
      <div class="feature-card" style="display:flex;flex-direction:column;max-width:400px;width:100%;">
        <div class="feature-icon"><svg viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg></div>
        <div class="feature-title">EVA DESKTOP</div>
        <div class="feature-desc" style="margin-bottom:auto;">Application Windows native. Contrôle complet du PC, mode overlay transparent et performances optimales.</div>
        <a href="https://github.com/urnova/eva/releases/latest/download/E.V.A-Setup.exe" style="text-decoration:none;margin-top:22px;display:flex;align-items:center;gap:12px;padding:13px 16px;border-radius:12px;border:1px solid rgba(123,139,245,0.4);background:rgba(123,139,245,0.15);cursor:pointer;transition:all 0.2s;" onmouseover="this.style.boxShadow='0 0 20px rgba(123,139,245,0.3)'" onmouseout="this.style.boxShadow='none'">
          <span style="font-size:1.3em;">💻</span>
          <div style="flex:1;">
            <div style="font-size:0.9em;font-weight:700;color:var(--text);">Télécharger pour Windows</div>
            <div style="font-size:0.7em;color:var(--cyan);margin-top:2px;">Setup.exe (Windows 10/11)</div>
          </div>
        </a>
      </div>
    </div>`;

html = html.replace(regex, replacement);

fs.writeFileSync('EVA_V4_fixed_v4/index.html', html, 'utf8');
console.log("FIXED INDEX HTML MOBILE REF");
