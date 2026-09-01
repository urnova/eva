const fs = require('fs');

function patchMessages() {
  const paths = [
    'f:/code/eva/evaprojectmultiplatforme/EVA_V4_fixed_v4/js/app/messages.js',
    'f:/code/eva/evaprojectmultiplatforme/eva-pc/web/js/app/messages.js'
  ];
  
  paths.forEach(p => {
    if (fs.existsSync(p)) {
      let code = fs.readFileSync(p, 'utf8');
      
      let target = `'- PowerPoint \\' [ACTION:{"type":"pptx","filename":"p.pptx","title":"Titre","slides":[{"title":"S1","points":["Point 1"]}]}]\\n' +
      '- CSV \\' [ACTION:{"type":"csv","filename":"data.csv","headers":["Col1"],"rows":[["val"]]}]\\n' +
      '- Fichier texte \\' [ACTION:{"type":"txt","filename":"fichier.txt","content":"Contenu"}]\\n' +
      '- PDF \\' bloc \`\`\`pdf\\n<!DOCTYPE html>...(HTML complet stylisǸ)...\`\`\`\\n' +`;
      
      let replacement = `'- PowerPoint \\' [ACTION:{"type":"pptx","filename":"p.pptx","theme":"corporate","title":"Titre","slides":[{"title":"S1","content":"Texte structurǸ"}]}] (themes: corporate, modern, minimal)\\n' +
      '- CSV \\' [ACTION:{"type":"csv","filename":"data.csv","headers":["Col1"],"rows":[["val"]]}]\\n' +
      '- Fichier texte \\' [ACTION:{"type":"txt","filename":"fichier.txt","content":"Contenu"}]\\n' +
      '- PDF \\' [ACTION:{"type":"pdf","filename":"doc.pdf","theme":"corporate","content":"# Titre\\nTexte structurǸ en Markdown pur sans balises. NE JAMAIS utiliser de couleur noire en fond."}] (themes: corporate, modern, minimal)\\n' +`;
      
      // Handle the strange characters properly using indexOf and replace
      let idx1 = code.indexOf(`'- PowerPoint`);
      let idx2 = code.indexOf(`'- Graphique`, idx1);
      
      if (idx1 !== -1 && idx2 !== -1) {
        let before = code.substring(0, idx1);
        let after = code.substring(idx2);
        
        let newContent = `'- PowerPoint \\u2192 [ACTION:{"type":"pptx","filename":"p.pptx","theme":"corporate","title":"Titre","slides":[{"title":"S1","content":"Texte"}]}] (themes: corporate, modern, minimal)\\n' +
        '- CSV \\u2192 [ACTION:{"type":"csv","filename":"data.csv","headers":["Col1"],"rows":[["val"]]}]\\n' +
        '- Fichier texte \\u2192 [ACTION:{"type":"txt","filename":"fichier.txt","content":"Contenu"}]\\n' +
        '- PDF \\u2192 [ACTION:{"type":"pdf","filename":"doc.pdf","theme":"corporate","content":"# Titre\\nTexte structur\\u00E9 en Markdown."}] (themes: corporate, modern, minimal)\\n' +
        `;
        
        code = before + newContent + after;
        fs.writeFileSync(p, code, 'utf8');
        console.log('Patched ' + p);
      } else {
        console.log('Could not find prompt in ' + p);
      }
    }
  });
}

patchMessages();
