const fs = require('fs');

function patchMessages() {
  const paths = [
    'f:/code/eva/evaprojectmultiplatforme/EVA_V4_fixed_v4/js/app/messages.js',
    'f:/code/eva/evaprojectmultiplatforme/eva-pc/web/js/app/messages.js'
  ];
  
  paths.forEach(p => {
    if (fs.existsSync(p)) {
      let code = fs.readFileSync(p, 'utf8');
      
      // Use regex to replace the loop appending to list
      code = code.replace(/for\s*\(\s*var\s*i\s*=\s*_renderedMsgOffset;\s*i\s*<\s*S\.messages\.length;\s*i\+\+\s*\)\s*\{\s*var\s*_md\s*=\s*buildMsgDom\(S\.messages\[i\]\);\s*_md\.dataset\.msgIdx\s*=\s*i;\s*list\.appendChild\(_md\);\s*\}/g, 
        `var frag = document.createDocumentFragment();
    for (var i = _renderedMsgOffset; i < S.messages.length; i++) {
      var _md = buildMsgDom(S.messages[i]);
      _md.dataset.msgIdx = i;
      frag.appendChild(_md);
    }
    list.appendChild(frag);`);
      
      fs.writeFileSync(p, code, 'utf8');
      console.log('Patched frag in ' + p);
    }
  });
}

patchMessages();
