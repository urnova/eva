const fs = require('fs');
let html = fs.readFileSync('EVA_V4_fixed_v4/index.html', 'utf8');

// Replace the download grid and title
const target = `<div style="text-align:center;max-width:600px;margin:0 auto 0">
      <div class="section-label">Téléchargement</div>
      <h2 class="section-title">EVA Partout</h2>
      <p class="section-sub" style="margin:0 auto">Applications mobiles et desktop bientôt disponibles. Retrouvez dès maintenant toutes les fonctionnalités via l'interface web.</p>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;max-width:780px;margin:48px auto 0;">
      <div class="feature-card" style="display:flex;flex-direction:column;">
        <div class="feature-icon"><svg viewBox="0 0 24 24"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg></div>
        <div class="feature-title">EVA MOBILE</div>
        <div class="feature-desc" style="margin-bottom:auto;">Application Android avec notifications push, interface tactile optimisée et mode hors-ligne avec IA locale.</div>
        <div style="margin-top:22px;display:flex;align-items:center;gap:12px;padding:13px 16px;border-radius:12px;border:1px solid rgba(123,139,245,0.2);background:rgba(123,139,245,0.04);cursor:not-allowed;">
          <span style="font-size:1.3em;">📱</span>
          <div style="flex:1;">
            <div style="font-size:0.9em;font-weight:700;color:var(--text);">Télécharger l'APK</div>
            <div style="font-size:0.7em;color:var(--text-muted);margin-top:2px;">Bientôt disponible</div>
          </div>
        </div>
      </div>
      <div class="feature-card" style="display:flex;flex-direction:column;">
        <div class="feature-icon"><svg viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg></div>
        <div class="feature-title">EVA DESKTOP</div>
        <div class="feature-desc" style="margin-bottom:auto;">Application Windows native. Contrôle complet du PC, mode overlay transparent et performances optimales.</div>
        <div style="margin-top:22px;display:flex;align-items:center;gap:12px;padding:13px 16px;border-radius:12px;border:1px solid rgba(123,139,245,0.2);background:rgba(123,139,245,0.04);cursor:not-allowed;">
          <span style="font-size:1.3em;">💻</span>
          <div style="flex:1;">
            <div style="font-size:0.9em;font-weight:700;color:var(--text);">Télécharger pour PC</div>
            <div style="font-size:0.7em;color:var(--text-muted);margin-top:2px;">Bientôt disponible</div>
          </div>
        </div>
      </div>
    </div>`;

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
        <a href="https://github.com/urnova/eva/releases/latest/download/EVA-Assistant-Setup.exe" style="text-decoration:none;margin-top:22px;display:flex;align-items:center;gap:12px;padding:13px 16px;border-radius:12px;border:1px solid rgba(123,139,245,0.4);background:rgba(123,139,245,0.15);cursor:pointer;transition:all 0.2s;" onmouseover="this.style.boxShadow='0 0 20px rgba(123,139,245,0.3)'" onmouseout="this.style.boxShadow='none'">
          <span style="font-size:1.3em;">💻</span>
          <div style="flex:1;">
            <div style="font-size:0.9em;font-weight:700;color:var(--text);">Télécharger pour Windows</div>
            <div style="font-size:0.7em;color:var(--cyan);margin-top:2px;">Setup.exe (Windows 10/11)</div>
          </div>
        </a>
      </div>
    </div>`;

html = html.replace(target, replacement);

fs.writeFileSync('EVA_V4_fixed_v4/index.html', html, 'utf8');
console.log("INDEX HTML DOWNLOAD FIXED");
