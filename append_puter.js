const fs = require('fs');
let settings = fs.readFileSync('eva-pc/web/js/app/settings-panel.js', 'utf8');

settings += `
// Ecouteur pour la connexion Puter via proxy Desktop
if (window.eva && window.eva.onPuterCallback) {
  window.eva.onPuterCallback(function(data) {
    if (data && data.token) {
      if (window.puter) {
        window.puter.auth.signIn(data.token);
      }
      localStorage.setItem('puter_auth_token', data.token);
      S.config.puterUsername = "Connecté (Desktop)";
      saveCfg();
      toast('Puter connecté avec succès', 'success');
      renderSettings('ai');
    }
  });
}
`;

fs.writeFileSync('eva-pc/web/js/app/settings-panel.js', settings, 'utf8');
console.log("PUTER CALLBACK LISTENER ADDED");
