const fs = require('fs');

function fixSyntaxMessages() {
  const paths = [
    'f:/code/eva/evaprojectmultiplatforme/EVA_V4_fixed_v4/js/app/messages.js',
    'f:/code/eva/evaprojectmultiplatforme/eva-pc/web/js/app/messages.js'
  ];
  
  paths.forEach(p => {
    if (fs.existsSync(p)) {
      let code = fs.readFileSync(p, 'utf8');
      
      let brokenIdx = code.indexOf(`' +\\n{"type":"bar"`);
      if(brokenIdx !== -1) {
         code = code.replace(`' +\\n{"type":"bar"`, `' +\\n'- Graphique \\u2192 bloc \`\`\`json\\n{"type":"bar"`);
      } else {
         brokenIdx = code.indexOf(`' +\\r\\n{"type":"bar"`);
         if(brokenIdx !== -1) {
            code = code.replace(`' +\\r\\n{"type":"bar"`, `' +\\r\\n'- Graphique \\u2192 bloc \`\`\`json\\r\\n{"type":"bar"`);
         }
      }
      
      // Let's just use string slice to be absolutely safe
      let target = code.indexOf(`}]\\n' +\\n{"type":"bar"`);
      if(target !== -1) {
         code = code.replace(`}]\\n' +\\n{"type":"bar"`, `}]\\n' +\\n'- Graphique \\u2192 bloc \`\`\`json\\n{"type":"bar"`);
      }
      target = code.indexOf(`}]\\n' +\\r\\n{"type":"bar"`);
      if(target !== -1) {
         code = code.replace(`}]\\n' +\\r\\n{"type":"bar"`, `}]\\n' +\\r\\n'- Graphique \\u2192 bloc \`\`\`json\\n{"type":"bar"`);
      }
      
      // The issue is an unescaped literal `\n`. Wait! 
      // Look at the error:
      // +\n{"type":"bar"
      // The `\n` is actually evaluated by JS parser as a newline in the code, but there's no quote!
      // So the literal text in the file is `+\n{"type":"bar"`
      // Meaning it's a plus sign, a newline character, and then `{"type"`.
      
      let literalPlus = code.indexOf(`+\\n{"type":"bar"`); // this is plus, backslash, n
      let newlinePlus = code.indexOf(`+\n{"type":"bar"`); // this is plus, actual newline
      let crlfPlus = code.indexOf(`+\r\n{"type":"bar"`); 
      
      if(newlinePlus !== -1) {
          code = code.replace(`+\n{"type":"bar"`, `+\n'- Graphique \\u2192 bloc \`\`\`json\\n{"type":"bar"`);
      }
      if(crlfPlus !== -1) {
          code = code.replace(`+\r\n{"type":"bar"`, `+\r\n'- Graphique \\u2192 bloc \`\`\`json\\n{"type":"bar"`);
      }

      fs.writeFileSync(p, code, 'utf8');
      console.log('Fixed syntax in ' + p);
    }
  });
}

fixSyntaxMessages();
