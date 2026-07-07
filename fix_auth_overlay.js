const fs = require('fs');
let authJs = fs.readFileSync('eva-pc/web/js/app/auth.js', 'utf8');

const target = `    if (window.EVAWakeWord) {
      window.EVAWakeWord.init({
        wakeWords: ['eva', 'éva', 'hey eva', 'e.v.a'],
        onCommand: function(cmd) {
          if (S.busy) return;
          if (window.EVASTS && window.EVASTS.getIsListening()) return;
          sendVoiceCommand(cmd);`;

// To avoid encoding issues with éva, we replace using regex matching exactly the logic.

const regex = /if \(window\.EVAWakeWord\) \{[\s\S]*?onCommand: function\(cmd\) \{[\s\S]*?if \(S\.busy\) return;[\s\S]*?if \(window\.EVASTS && window\.EVASTS\.getIsListening\(\)\) return;[\s\S]*?sendVoiceCommand\(cmd\);/;

const replacement = `if (window.EVAWakeWord) {
      window.EVAWakeWord.init({
        wakeWords: ['eva', 'éva', 'hey eva', 'e.v.a'],
        onCommand: function(cmd) {
          if (S.busy) return;
          if (window.EVASTS && window.EVASTS.getIsListening()) return;
          
          if (window.eva && window.eva.overlay) {
            window.eva.overlay.show('listening');
            window.eva.overlay.setState('thinking', 'Traitement...');
          }
          
          sendVoiceCommand(cmd);`;

authJs = authJs.replace(regex, replacement);

fs.writeFileSync('eva-pc/web/js/app/auth.js', authJs, 'utf8');
console.log("OVERLAY TRIGGER ADDED");
