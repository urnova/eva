const fs = require('fs');

function fixSyntaxMessages() {
  const paths = [
    'f:/code/eva/evaprojectmultiplatforme/EVA_V4_fixed_v4/js/app/messages.js',
    'f:/code/eva/evaprojectmultiplatforme/eva-pc/web/js/app/messages.js'
  ];
  
  paths.forEach(p => {
    if (fs.existsSync(p)) {
      let code = fs.readFileSync(p, 'utf8');
      
      // Let's replace the EXACT literal substring that causes the error
      let badString = "]}]\\n' +\\n'- Graphique";
      let goodString = "]}]\\n' + '\\n- Graphique";
      code = code.replace(badString, goodString);
      
      let badString2 = "]}]\\n' +\\r\\n'- Graphique";
      let goodString2 = "]}]\\n' + '\\n- Graphique";
      code = code.replace(badString2, goodString2);

      fs.writeFileSync(p, code, 'utf8');
      console.log('Fixed syntax in ' + p);
    }
  });
}

fixSyntaxMessages();
