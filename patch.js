const fs = require('fs');

// 1. Fix core.js
let core = fs.readFileSync('EVA_V4_fixed_v4/js/app/core.js', 'utf8');
core = core.replace(
  /ava\.innerHTML = isEva\s*\?\s*'<svg.*?'\s*:\s*'<span>U<\/span>';/g,
  `var avaContent = '<span>U</span>';
    if (!isEva && window.S) {
      var p = window.S.profile || window.S.user || {};
      if (p.photoURL) {
        avaContent = '<img src="' + p.photoURL + '" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">';
      } else {
        var n = p.displayName || p.nickname || p.email || 'U';
        avaContent = '<span>' + n.charAt(0).toUpperCase() + '</span>';
      }
    }
    ava.innerHTML = isEva
      ? '<svg viewBox="0 0 24 24" style="width:15px;height:15px;stroke:var(--cyan);fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><circle cx="12" cy="16" r="1" fill="var(--cyan)" stroke="none"/></svg>'
      : avaContent;`
);
fs.writeFileSync('EVA_V4_fixed_v4/js/app/core.js', core, 'utf8');

// 2. Fix auth.js
let auth = fs.readFileSync('EVA_V4_fixed_v4/js/app/auth.js', 'utf8');
auth = auth.replace(
  /loadProfile\(user\.uid\)\.then\(\(\) => \{\s*initChatSession\(\);\s*loadConvs\(\);\s*setTimeout\(function\(\)\{\s*loadReminders\(\);\s*\}, 2000\);\s*\}\);/g,
  `loadProfile(user.uid).then(() => {
      setTimeout(function(){ loadReminders(); }, 2000);
    });
    initChatSession();
    loadConvs();`
);
auth = auth.replace(
  /ava\.textContent = name\.split\(' '\)\.map\(function\(n\)\{return n\[0\]\|\|'';\}\)\.join\(''\)\.toUpperCase\(\)\.slice\(0,2\);\s*\}\s*\}/g,
  `ava.textContent = name.split(' ').map(function(n){return n[0]||'';}).join('').toUpperCase().slice(0,2);
    }
  }
  
  var msgAvas = document.querySelectorAll('.message.user .msg-ava');
  msgAvas.forEach(function(avaNode) {
    if (p.photoURL) {
      avaNode.innerHTML = '<img src="' + p.photoURL + '" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">';
    } else {
      var un = p.displayName || p.nickname || p.email || 'U';
      avaNode.innerHTML = '<span>' + un.charAt(0).toUpperCase() + '</span>';
    }
  });`
);
fs.writeFileSync('EVA_V4_fixed_v4/js/app/auth.js', auth, 'utf8');

// 3. Fix chat.html
let chat = fs.readFileSync('EVA_V4_fixed_v4/chat.html', 'utf8');
chat = chat.replace(/Télécharger Agent Desktop/g, 'Télécharger E.V.A Desktop');
fs.writeFileSync('EVA_V4_fixed_v4/chat.html', chat, 'utf8');

// 4. Fix messages.js
let messages = fs.readFileSync('EVA_V4_fixed_v4/js/app/messages.js', 'utf8');
messages = messages.replace(
  /if \(!window\.EVAChatHandler\) \{ toast\('Système non initialisé','error'\); return; \}/g,
  `if (!window.EVAChatHandler) { toast('Système non initialisé','error'); return; }
    if (S.documents && S.documents.some(function(d) { return d._loading; })) { toast('Lecture du document en cours...','warning'); return; }`
);

let docTargetStart = messages.indexOf('var msgContent = text;');
let docTargetEnd = messages.indexOf('var _isLocalProv');
if (docTargetStart !== -1 && docTargetEnd !== -1) {
  let originalBlock = messages.substring(docTargetStart, docTargetEnd);
  
  let newBlock = `var msgContent = text;
    if (allImages.length) {
      window.setThinkingPhase(_SVG_THINK_SEARCH, 'Analyse...', 'J\\'examine votre image...');
      try {
        var vision = await analyzeImage(allImages[0].data, text || 'Décris cette image.');
        if (vision) msgContent = vision;
        for (var _ii = 1; _ii < allImages.length; _ii++) {
          window.setThinkingPhase(_SVG_THINK_SEARCH, 'Analyse...', 'J\\'examine l\\'image ' + (_ii + 1) + ' sur ' + allImages.length + '...');
          try {
            var vision2 = await analyzeImage(allImages[_ii].data, 'Décris aussi cette image.');
            if (vision2) msgContent += '\\n\\n[Image ' + (_ii + 1) + '] ' + vision2;
          } catch(_) {}
        }
      } catch(e) {}
    }
    
    if (allDocs.length) {
      var xmlDocs = '';
      for (var _di = 0; _di < allDocs.length; _di++) {
        if (allDocs[_di] && allDocs[_di].text) {
          xmlDocs += '\\n<document>\\n  <source>' + allDocs[_di].name + '</source>\\n  <document_content>\\n' + allDocs[_di].text + '\\n  </document_content>\\n</document>\\n';
        }
      }
      if (xmlDocs !== '') {
        var originalText = msgContent || text || 'Analyse ce document.';
        msgContent = xmlDocs + '\\n<instructions>\\nUn ou plusieurs documents ont été fournis ci-dessus dans la balise <document>. Tu DOIS analyser leur contenu avant de répondre à la question de l\\'utilisateur, et t\\'y référer explicitement dans ta réponse.\\n</instructions>\\n\\n<user_message>' + originalText + '</user_message>';
      }
    }

    // Recherche web si nécessaire
    `;
    
  messages = messages.substring(0, docTargetStart) + newBlock + messages.substring(docTargetEnd);
}

fs.writeFileSync('EVA_V4_fixed_v4/js/app/messages.js', messages, 'utf8');
