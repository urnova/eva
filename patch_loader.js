const fs = require('fs');

function patchLoader() {
  const paths = [
    'f:/code/eva/evaprojectmultiplatforme/EVA_V4_fixed_v4/js/app/conversations.js',
    'f:/code/eva/evaprojectmultiplatforme/eva-pc/web/js/app/conversations.js'
  ];
  
  paths.forEach(p => {
    if (fs.existsSync(p)) {
      let code = fs.readFileSync(p, 'utf8');
      
      code = code.replace(/updateModelSelectUI\(\);\s*var snap = await db\.collection/g,
        `updateModelSelectUI();\n      var _ml = document.getElementById('messagesList');\n      if (_ml) _ml.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);font-family:monospace;font-size:13px;">Chargement de la conversation...</div>';\n      var snap = await db.collection`);
        
      fs.writeFileSync(p, code, 'utf8');
      console.log('Patched loader in ' + p);
    }
  });
}

patchLoader();
