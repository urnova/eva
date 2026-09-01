const fs = require('fs');

function patchFileGen(filePath) {
  let js = fs.readFileSync(filePath, 'utf8');

  // Extract suggestions
  let target = `  /* ── Nettoyage du texte affiché — supprimer les plages (du dernier au premier) ── */`;
  let insert = `
  /* ── Extraction des suggestions de suivi ── */
  var suggestions = null;
  var sugRe = /\\[SUGGESTIONS:\\s*(\\[[^\\]]+\\])\\s*\\]/g;
  var sm;
  while ((sm = sugRe.exec(content)) !== null) {
    try {
      suggestions = JSON.parse(sm[1]);
      removeRanges.push([sm.index, sm.index + sm[0].length]);
    } catch(e) {}
  }
  
  /* ── Nettoyage du texte affiché — supprimer les plages (du dernier au premier) ── */`;

  if (js.includes(target) && !js.includes('Extraction des suggestions')) {
    js = js.replace(target, insert);
  }

  // Return an object instead of string if there are suggestions?
  // Wait! parseEvaActions currently returns a string. `return clean.trim();`
  // If I return an object, it breaks other things like TTS.
  // Actually, I can attach the suggestions to a global variable `window._lastEvaSuggestions` and then in `appendMsg` I can read it!
  
  let target2 = `  return clean.trim();`;
  let insert2 = `  window._lastEvaSuggestions = suggestions;
  return clean.trim();`;
  
  if (js.includes(target2) && !js.includes('window._lastEvaSuggestions')) {
    js = js.replace(/return clean\.trim\(\);/g, insert2);
  }

  fs.writeFileSync(filePath, js, 'utf8');
}

patchFileGen('EVA_V4_fixed_v4/js/app/file-gen.js');
