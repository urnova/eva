const fs = require('fs');
let authJs = fs.readFileSync('eva-pc/web/js/app/auth.js', 'utf8');

const target = `if (window.eva && window.eva.overlay) {
              window.eva.overlay.show('listening');
              window.eva.overlay.setState('thinking', 'Traitement...');
            }
            
            sendVoiceCommand(cmd);`;

const replacement = `if (window.eva && window.eva.overlay && window.EVAChatHandler) {
              window.eva.overlay.show('listening');
              window.eva.overlay.setState('thinking', 'Analyse...');
              
              var provider = window.EVAChatHandler.getCurrentProvider();
              var cfg = window.EVAChatHandler.getCurrentConfig();
              if (provider) {
                var ctx = window.EVAChatHandler.getContext() || [];
                ctx.push({role: 'system', content: 'Tu es E.V.A (Evolutionary Virtual Assistant). Réponds très brièvement et directement à la commande vocale de l\'utilisateur.'});
                ctx.push({role: 'user', content: cmd});
                
                provider.chat(ctx, cfg).then(function(res) {
                  if (res && res.content) {
                    window.eva.overlay.setState('speaking', res.content);
                    if (window.EVATTS) window.EVATTS.speakText(res.content);
                  } else {
                    window.eva.overlay.hide();
                  }
                }).catch(function(e) {
                  window.eva.overlay.setState('remote', 'Erreur IA');
                  setTimeout(function() { window.eva.overlay.hide(); }, 3000);
                });
              } else {
                window.eva.overlay.setState('remote', 'Aucun modèle IA');
                setTimeout(function() { window.eva.overlay.hide(); }, 3000);
              }
            } else {
              if (window.sendVoiceCommand) sendVoiceCommand(cmd);
            }`;

authJs = authJs.replace(target, replacement);

fs.writeFileSync('eva-pc/web/js/app/auth.js', authJs, 'utf8');
console.log("PC AGENT VOICE FLOW IMPLEMENTED");
