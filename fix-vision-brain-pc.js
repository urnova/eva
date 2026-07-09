const fs = require('fs');
const file = 'eva-pc/web/js/app/advanced.js';
let content = fs.readFileSync(file, 'utf8');

// Replace the context truncation logic in _visionCallAI
const target1 = `        var allMsgs = _VS[prefix].messages || [];
        var contextMsgs = allMsgs.slice(-4);
        var messages = [{ role: 'system', content: sysPrompt }];
        for (var i = 0; i < contextMsgs.length; i++) {
          messages.push({ role: contextMsgs[i].role, content: String(contextMsgs[i].content).slice(0, 600) });
        }`;

const repl1 = `        var allMsgs = _VS[prefix].messages || [];
        // Cerveau temporaire : conserver jusqu'à 20 messages complets
        var contextMsgs = allMsgs.slice(-20);
        var messages = [{ role: 'system', content: sysPrompt }];
        
        // Création du "Mini cerveau temporaire"
        var sessionBrain = '--- HISTORIQUE COMPLET (CERVEAU TEMPORAIRE) ---\\n';
        allMsgs.forEach(m => {
           sessionBrain += (m.role==='user'?'Utilisateur: ':'EVA: ') + String(m.content) + '\\n';
        });
        messages[0].content += '\\n\\n' + sessionBrain;

        for (var i = 0; i < contextMsgs.length; i++) {
          messages.push({ role: contextMsgs[i].role, content: String(contextMsgs[i].content) });
        }`;

content = content.replace(target1, repl1);

const target2 = `        var allMsgsOai = _VS[prefix].messages || [];
        var contextOai = allMsgsOai.slice(-4);
        oaiMessages = [{ role: 'system', content: sysPrompt }];
        for (var j = 0; j < contextOai.length; j++) {
          oaiMessages.push({ role: contextOai[j].role, content: String(contextOai[j].content).slice(0, 600) });
        }`;

const repl2 = `        var allMsgsOai = _VS[prefix].messages || [];
        var contextOai = allMsgsOai.slice(-20);
        oaiMessages = [{ role: 'system', content: sysPrompt }];
        
        // Création du "Mini cerveau temporaire"
        var sessionBrainOai = '--- HISTORIQUE COMPLET (CERVEAU TEMPORAIRE) ---\\n';
        allMsgsOai.forEach(m => {
           sessionBrainOai += (m.role==='user'?'Utilisateur: ':'EVA: ') + String(m.content) + '\\n';
        });
        oaiMessages[0].content += '\\n\\n' + sessionBrainOai;

        for (var j = 0; j < contextOai.length; j++) {
          oaiMessages.push({ role: contextOai[j].role, content: String(contextOai[j].content) });
        }`;

content = content.replace(target2, repl2);

fs.writeFileSync(file, content, 'utf8');
console.log('Vision brain implemented');

