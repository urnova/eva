const fs = require('fs');
let agent = fs.readFileSync('eva-pc/web/js/features/pc-agent.js', 'utf8');

const agentCode = `
        else if (data.type === 'agentic_task') {
          const prompt = data.payload?.prompt;
          if (prompt) {
            try {
              // Tentative d'appel à Ollama (LLM Local en veille)
              const llmRes = await fetch('http://localhost:11434/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  model: 'llama3', // Modèle par défaut léger
                  prompt: 'Tu es E.V.A, un agent système local. Analyse cette requête et donne le résultat de la tâche : ' + prompt,
                  stream: false
                })
              });
              if (llmRes.ok) {
                const llmData = await llmRes.json();
                resultData = { output: llmData.response };
              } else {
                throw new Error('Ollama non démarré ou modèle introuvable');
              }
            } catch(err) {
              // Fallback
              resultData = { output: '[LLM Agentique Local - Mode Éco] Le service local (Ollama) n\\'est pas actif. Impossible d\\'exécuter : ' + prompt };
            }
          }
        }`;

agent = agent.replace(
`        else if (data.type === 'run_script') {`,
agentCode + `\n        else if (data.type === 'run_script') {`
);

fs.writeFileSync('eva-pc/web/js/features/pc-agent.js', agent, 'utf8');
console.log('LLM Agentique (Ollama integration) added to pc-agent.js');
