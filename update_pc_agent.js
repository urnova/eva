const fs = require('fs');
let content = fs.readFileSync('eva-pc/web/js/features/pc-agent.js', 'utf8');

const target = `const r = await fetch('http://127.0.0.1:11434/api/chat', {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({
              model: 'qwen2.5:1.5b',
              messages: history,
              stream: false,
              temperature: 0.2
            })
          });
          const data = await r.json();`;
          
const replacement = `const data = await window.eva.system.llmChat(history);
          // Format adapter from openai-compatible (llama-server) to ollama format
          if (data.choices && data.choices[0] && data.choices[0].message) {
            data.message = data.choices[0].message;
          }`;
          
if (content.includes("http://127.0.0.1:11434/api/chat")) {
  content = content.replace(/const r = await fetch\('http:\/\/127\.0\.0\.1:11434\/api\/chat'[\s\S]*?const data = await r\.json\(\);/, replacement);
  fs.writeFileSync('eva-pc/web/js/features/pc-agent.js', content);
  console.log("pc-agent.js updated");
} else {
  console.log("Not found");
}
