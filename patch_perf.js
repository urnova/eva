const fs = require('fs');

function patchConversations() {
  const paths = [
    'f:/code/eva/evaprojectmultiplatforme/EVA_V4_fixed_v4/js/app/conversations.js',
    'f:/code/eva/evaprojectmultiplatforme/eva-pc/web/js/app/conversations.js'
  ];
  
  paths.forEach(p => {
    if (fs.existsSync(p)) {
      let code = fs.readFileSync(p, 'utf8');
      
      // Inject loader before await db
      let target = `updateModelSelectUI();
      var snap = await db.collection('users').doc(S.user.uid)`;
      
      let replacement = `updateModelSelectUI();
      var _ml = document.getElementById('messagesList');
      if (_ml) _ml.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);font-family:monospace;font-size:13px;animation:pulse 1.5s infinite;">Chargement de la conversation...</div>';
      var snap = await db.collection('users').doc(S.user.uid)`;
      
      code = code.replace(target, replacement);
      fs.writeFileSync(p, code, 'utf8');
      console.log('Patched ' + p);
    }
  });
}

function patchMessages() {
  const paths = [
    'f:/code/eva/evaprojectmultiplatforme/EVA_V4_fixed_v4/js/app/messages.js',
    'f:/code/eva/evaprojectmultiplatforme/eva-pc/web/js/app/messages.js'
  ];
  
  paths.forEach(p => {
    if (fs.existsSync(p)) {
      let code = fs.readFileSync(p, 'utf8');
      
      // Use DocumentFragment in renderMsgs
      let target = `    for (var i = _renderedMsgOffset; i < S.messages.length; i++) {
      var _md = buildMsgDom(S.messages[i]);
      _md.dataset.msgIdx = i;
      list.appendChild(_md);
    }`;
      
      let replacement = `    var frag = document.createDocumentFragment();
    for (var i = _renderedMsgOffset; i < S.messages.length; i++) {
      var _md = buildMsgDom(S.messages[i]);
      _md.dataset.msgIdx = i;
      frag.appendChild(_md);
    }
    list.appendChild(frag);`;
      
      code = code.replace(target, replacement);
      fs.writeFileSync(p, code, 'utf8');
      console.log('Patched ' + p);
    }
  });
}

patchConversations();
patchMessages();
