const fs = require('fs');

function fixSyntaxMessages() {
  const paths = [
    'f:/code/eva/evaprojectmultiplatforme/EVA_V4_fixed_v4/js/app/messages.js',
    'f:/code/eva/evaprojectmultiplatforme/eva-pc/web/js/app/messages.js'
  ];
  
  paths.forEach(p => {
    if (fs.existsSync(p)) {
      let code = fs.readFileSync(p, 'utf8');
      
      // Fix the broken string
      // The broken part looks like:
      // '- PDF (Marp) \u2192 [ACTION:{"type":"marp_pdf","filename":"doc.pdf","content":"---\nmarp: true\ntheme: default\n---\n\n# Titre\n\nContenu de la slide"}]\n' +\n{"type":"bar"...
      
      // We can use a regex to match from RÈGLE IMPORTANTE up to {"type":"bar"
      // Let's just fix the syntax error directly
      
      let brokenPart = `'- PDF (Marp) \\u2192 [ACTION:{"type":"marp_pdf","filename":"doc.pdf","content":"---\\nmarp: true\\ntheme: default\\n---\\n\\n# Titre\\n\\nContenu de la slide"}]\\n' +\\n{"type":"bar"`;
      let replacementPart = `'- PDF (Marp) \\u2192 [ACTION:{"type":"marp_pdf","filename":"doc.pdf","content":"---\\nmarp: true\\ntheme: default\\n---\\n\\n# Titre\\n\\nContenu de la slide"}]\\n' +\\n'- Graphique \\u2192 bloc \`\`\`json\\n{"type":"bar"`;
      
      code = code.replace(`']}]\\n' +\\n{"type":"bar"`, `']}]\\n' +\\n'- Graphique \\u2192 bloc \`\`\`json\\n{"type":"bar"`);
      
      // Wait, let's just do it with a safer regex replacing the exact block
      let idx = code.indexOf(`']}]\\n' +\\n{"type":"bar"`);
      if(idx === -1) {
          // try another pattern
          code = code.replace(
              /'- PDF \(Marp\) \\u2192 \[ACTION:\{"type":"marp_pdf","filename":"doc.pdf","content":"---\\nmarp: true\\ntheme: default\\n---\\n\\n# Titre\\n\\nContenu de la slide"\}\]\\n' \+\\n\{"type":"bar"/g,
              `'- PDF (Marp) \\u2192 [ACTION:{"type":"marp_pdf","filename":"doc.pdf","content":"---\\nmarp: true\\ntheme: default\\n---\\n\\n# Titre\\n\\nContenu de la slide"}]\\n' +\\n'- Graphique \\u2192 bloc \`\`\`json\\n{"type":"bar"`
          );
      }
      
      fs.writeFileSync(p, code, 'utf8');
      console.log('Fixed syntax in ' + p);
    }
  });
}

fixSyntaxMessages();
