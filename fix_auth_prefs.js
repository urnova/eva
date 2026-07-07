const fs = require('fs');
let authJs = fs.readFileSync('eva-pc/web/js/app/auth.js', 'utf8');

const target = `if (S.profile.preferences) {`;
const replacement = `if (S.profile.preferences) {
          if (window.eva) {
            const localCfg = S.config;
            S.config = Object.assign({}, S.config, S.profile.preferences);
            ['aiProvider', 'aiModel', 'ollamaEndpoint', 'lmstudioEndpoint', 'voiceProvider', 'speechRate', 'openrouterApiKey', 'geminiApiKey', 'openAIApiKey', 'claudeApiKey', 'mistralApiKey', 'huggingfaceApiKey'].forEach(k => {
              if (localCfg[k] !== undefined) S.config[k] = localCfg[k];
            });
          } else {
            S.config = Object.assign({}, S.config, S.profile.preferences);
          }`;

authJs = authJs.replace(/if \(S\.profile\.preferences\) \{\s*\/\* Firebase gagne[^\n]+\n\s*S\.config = Object\.assign\(\{\}, S\.config, S\.profile\.preferences\);/, replacement);

fs.writeFileSync('eva-pc/web/js/app/auth.js', authJs, 'utf8');
console.log("AUTH JS PREFERENCES FIXED");
