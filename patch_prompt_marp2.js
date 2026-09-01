const fs = require('fs');

function patchMessagesMarp() {
  const paths = [
    'f:/code/eva/evaprojectmultiplatforme/EVA_V4_fixed_v4/js/app/messages.js',
    'f:/code/eva/evaprojectmultiplatforme/eva-pc/web/js/app/messages.js'
  ];
  
  paths.forEach(p => {
    if (fs.existsSync(p)) {
      let code = fs.readFileSync(p, 'utf8');
      
      let targetStart = `'- PowerPoint \\u2192 [ACTION:{"type":"pptx"`;
      let idx1 = code.indexOf(targetStart);
      let idx2 = code.indexOf(`'- Graphique`, idx1);
      
      if (idx1 !== -1 && idx2 !== -1) {
        let before = code.substring(0, idx1);
        let after = code.substring(idx2);
        
        let newContent = `'- PowerPoint (Marp) \\u2192 [ACTION:{"type":"marp_pptx","filename":"p.pptx","content":"---\\nmarp: true\\ntheme: default\\n---\\n\\n# Titre\\n\\nContenu de la slide"}]\\n' +
        '- CSV \\u2192 [ACTION:{"type":"csv","filename":"data.csv","headers":["Col1"],"rows":[["val"]]}]\\n' +
        '- Fichier texte \\u2192 [ACTION:{"type":"txt","filename":"fichier.txt","content":"Contenu"}]\\n' +
        '- PDF (Marp) \\u2192 [ACTION:{"type":"marp_pdf","filename":"doc.pdf","content":"---\\nmarp: true\\ntheme: default\\n---\\n\\n# Titre\\n\\nContenu de la slide"}]\\n' +
        `;
        
        code = before + newContent + after;
        fs.writeFileSync(p, code, 'utf8');
        console.log('Patched Marp ' + p);
      } else {
        console.log('Could not find prompt in ' + p);
      }
    }
  });
}

patchMessagesMarp();
