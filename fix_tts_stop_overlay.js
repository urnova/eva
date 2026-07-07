const fs = require('fs');
let ttsJs = fs.readFileSync('eva-pc/web/js/voice/tts.js', 'utf8');

const target = `    stopTTS: function() {`;
const replacement = `    stopTTS: function() {
      if (window.eva && window.eva.overlay) {
        window.eva.overlay.hide();
        clearTimeout(window.overlayHideTimeout);
      }`;

ttsJs = ttsJs.replace(target, replacement);

fs.writeFileSync('eva-pc/web/js/voice/tts.js', ttsJs, 'utf8');
console.log("TTS STOP OVERLAY ADDED");
