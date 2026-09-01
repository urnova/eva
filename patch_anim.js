const fs = require('fs');

function patchMessages() {
  const paths = [
    'f:/code/eva/evaprojectmultiplatforme/EVA_V4_fixed_v4/js/app/messages.js',
    'f:/code/eva/evaprojectmultiplatforme/eva-pc/web/js/app/messages.js'
  ];
  
  paths.forEach(p => {
    if (fs.existsSync(p)) {
      let code = fs.readFileSync(p, 'utf8');
      
      let target = `      var _md = buildMsgDom(S.messages[i]);
      _md.dataset.msgIdx = i;
      frag.appendChild(_md);`;
      
      let replacement = `      var _md = buildMsgDom(S.messages[i]);
      _md.dataset.msgIdx = i;
      _md.style.animation = 'none'; /* Disable animation for history to prevent lag */
      frag.appendChild(_md);`;
      
      // Also apply to loadOlderMsgs
      let target2 = `      var _md2 = buildMsgDom(S.messages[i]);
      _md2.dataset.msgIdx = i;
      frag.appendChild(_md2);`;
      
      let replacement2 = `      var _md2 = buildMsgDom(S.messages[i]);
      _md2.dataset.msgIdx = i;
      _md2.style.animation = 'none';
      frag.appendChild(_md2);`;
      
      code = code.replace(target, replacement).replace(target2, replacement2);
      fs.writeFileSync(p, code, 'utf8');
      console.log('Patched animations in ' + p);
    }
  });
}

patchMessages();
