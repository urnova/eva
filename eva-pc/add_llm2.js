const fs = require('fs');
let agent = fs.readFileSync('eva-pc/web/js/features/pc-agent.js', 'utf8');

const agentCode = `
        else if (data.type === 'agentic_task') {
          const prompt = data.payload?.prompt;
          if (prompt) {
            try {
              // Appel de l'Agent local léger (Ollama)
              const llmRes = await fetch('http://localhost:11434/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  model: 'EvaAgentic',
                  prompt: prompt,
                  stream: false,
                  keep_alive: "-1" // Maintien en RAM pour 0 latence
                })
              });
              
              if (llmRes.ok) {
                const llmData = await llmRes.json();
                resultData = { output: llmData.response };
              } else {
                // Tentative de cration automatique du modle s'il n'existe pas encore
                resultData = { output: '[Info] Modle EvaAgentic introuvable ou Ollama non dmarr. Vrifiez l\\'installation via Modelfile.agentic.' };
              }
            } catch(err) {
              resultData = { output: '[LLM Local] Le service local (Ollama) n\\'est pas actif sur le port 11434. Impossible d\\'excuter : ' + prompt };
            }
          }
        }`;

if (!agent.includes('agentic_task')) {
  agent = agent.replace(
    `        else if (data.type === 'run_script') {`,
    agentCode + `\n        else if (data.type === 'run_script') {`
  );
  fs.writeFileSync('eva-pc/web/js/features/pc-agent.js', agent, 'utf8');
  console.log('LLM Agentique (Ollama integration) added to pc-agent.js');
}
