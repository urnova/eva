const fs = require('fs');

function patchChatHandler() {
  const paths = [
    'f:/code/eva/evaprojectmultiplatforme/EVA_V4_fixed_v4/js/ai/chat-handler.js',
    'f:/code/eva/evaprojectmultiplatforme/eva-pc/web/js/ai/chat-handler.js'
  ];
  
  paths.forEach(p => {
    if (fs.existsSync(p)) {
      let code = fs.readFileSync(p, 'utf8');
      
      let newCode = code.replace(/if\s*\(actionObj\.type\s*===\s*'pdf'\)\s*\{\s*_evaGeneratePdf\(actionObj\);\s*\}/, 
        "if (actionObj.type === 'pdf' || actionObj.type === 'marp_pdf') { _evaGeneratePdf(actionObj); }");
        
      newCode = newCode.replace(/else if\s*\(actionObj\.type\s*===\s*'pptx'\)\s*\{\s*_evaGeneratePptx\(actionObj\);\s*\}/, 
        "else if (actionObj.type === 'pptx' || actionObj.type === 'marp_pptx') { _evaGeneratePptx(actionObj); }");
      
      fs.writeFileSync(p, newCode, 'utf8');
      console.log('Patched chat-handler: ' + p);
    }
  });
}

patchChatHandler();
