const fs = require('fs');
let js = fs.readFileSync('EVA_V4_fixed_v4/js/features/cloudworks.js', 'utf8');

js = js.replace(
  `list.innerHTML = '<div class="cw-empty"><div class="cw-empty-icon">\\uD83D\\uDCBB</div><div class="cw-empty-title">AUCUN APPAREIL CONNECTÉ</div>Installez EVA Desktop Agent sur votre PC pour qu\\'il apparaisse ici automatiquement.</div>';`,
  `list.innerHTML = '<div class="cw-empty"><div class="cw-empty-icon">\\uD83D\\uDCBB</div><div class="cw-empty-title">AUCUN APPAREIL CONNECTÉ</div>Installez EVA Desktop Agent sur votre PC pour qu\\'il apparaisse ici automatiquement.<br><br><a href="https://github.com/urnova/eva/releases/latest/download/E.V.A-Setup.exe" target="_blank" class="cw-btn" style="text-decoration:none;display:inline-block;margin-top:10px;">Télécharger E.V.A Desktop (Dernière version)</a></div>';`
);

fs.writeFileSync('EVA_V4_fixed_v4/js/features/cloudworks.js', js, 'utf8');
