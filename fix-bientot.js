const fs = require('fs');
const files = [
  'EVA_V4_fixed_v4/chat.html',
  'eva-pc/web/chat.html'
];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');

  // Replace Bientôt block with direct download link
  // The original HTML looks like:
  // <a href="#" class="cw-dl-btn-v2" onclick="return false;" title="Bientôt disponible">
  //   <svg ...</svg>
  //   <div style="...">
  //     <div style="...">EVA Desktop Agent</div>
  //     <div style="...">Windows • macOS • Linux</div>
  //   </div>
  //   <span class="cw-soon-badge">Bientôt</span>
  // </a>

  // We can use regex to replace the entire <a> tag
  const regex = /<a href="#" class="cw-dl-btn-v2" onclick="return false;" title="Bient\u00F4t disponible">[\s\S]*?<\/a>/;
  
  const repl = `<a href="https://github.com/urnova/eva/releases/latest/download/E.V.A-Setup.exe" target="_blank" class="cw-dl-btn-v2" style="text-decoration:none;">
              <svg viewBox="0 0 24 24" width="20" height="20" stroke="var(--cyan)" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              <div style="text-align:left;flex:1;">
                <div style="font-weight:600;color:var(--text);font-size:0.95em;">Télécharger EVA Desktop Agent</div>
                <div style="font-size:0.75em;color:var(--text-muted);margin-top:2px;">Windows (Dernière version)</div>
              </div>
              <span class="cw-soon-badge" style="background:rgba(74, 222, 128, 0.15);color:#4ade80;border:1px solid rgba(74, 222, 128, 0.3);">Télécharger</span>
            </a>`;

  content = content.replace(regex, repl);
  fs.writeFileSync(file, content, 'utf8');
});
console.log('Bientôt badges fixed');
