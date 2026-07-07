const fs = require('fs');
let chatHandlerJs = fs.readFileSync('EVA_V4_fixed_v4/js/ai/chat-handler.js', 'utf8');

chatHandlerJs = chatHandlerJs.replace(`getIsProcessing,`, `getIsProcessing,
  getCurrentProvider: function() { return currentProvider; },
  getCurrentConfig: function() { return currentConfig; },`);

fs.writeFileSync('EVA_V4_fixed_v4/js/ai/chat-handler.js', chatHandlerJs, 'utf8');
console.log("CHATHANDLER EXPORTS ADDED");
