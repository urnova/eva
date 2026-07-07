const fs = require('fs');
let ttsJs = fs.readFileSync('eva-pc/web/js/voice/tts.js', 'utf8');

// The easiest way is to modify EVATTS.speakText directly to intercept the call.
// But TTS is asynchronous. It might take time to generate audio, during which EVA is "thinking".
// We already set "thinking" in auth.js onCommand.

const target = `    speakText: function(text, config) {`;
const replacement = `    speakText: function(text, config) {
      if (window.eva && window.eva.overlay) {
        window.eva.overlay.setState('speaking', text);
        // On cachera l'overlay au bout d'un certain temps basé sur la longueur du texte si l'événement de fin n'est pas fiable.
        const durationEst = Math.max(3000, text.length * 60);
        clearTimeout(window.overlayHideTimeout);
        window.overlayHideTimeout = setTimeout(() => {
          window.eva.overlay.hide();
        }, durationEst);
      }`;

ttsJs = ttsJs.replace(target, replacement);

fs.writeFileSync('eva-pc/web/js/voice/tts.js', ttsJs, 'utf8');
console.log("TTS OVERLAY ADDED");
