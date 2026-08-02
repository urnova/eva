const fs = require('fs');

const injection = `
// ==========================================
// LLM AGENTIC LOCAL (llama-server)
// ==========================================
let llmProcess = null;
let llmTimeout = null;

function startLLM() {
  if (llmProcess) return Promise.resolve(true);
  
  return new Promise((resolve) => {
    // Find the resources path (works in dev and prod)
    let resourcesPath = app.isPackaged ? process.resourcesPath : path.join(__dirname, '../../');
    const llmDir = path.join(resourcesPath, 'resources', 'llm');
    const serverExe = path.join(llmDir, 'llama-server.exe');
    const modelFile = path.join(llmDir, 'eva-model.gguf');

    if (!fs.existsSync(serverExe) || !fs.existsSync(modelFile)) {
      console.error("[LLM] Missing llama-server.exe or eva-model.gguf in", llmDir);
      return resolve(false);
    }

    console.log("[LLM] Starting local llama-server...");
    llmProcess = child_process.spawn(serverExe, [
      '--model', modelFile,
      '--port', '11434',
      '--ctx-size', '2048',
      '--parallel', '1'
    ], { windowsHide: true });

    llmProcess.on('error', (err) => {
      console.error("[LLM] Spawn error:", err);
      llmProcess = null;
    });

    llmProcess.on('exit', () => {
      console.log("[LLM] Process exited.");
      llmProcess = null;
    });

    // Wait 3 seconds for server to boot up
    setTimeout(() => { resolve(true); }, 3000);
  });
}

function stopLLM() {
  if (llmProcess) {
    console.log("[LLM] Stopping local llama-server due to inactivity...");
    llmProcess.kill();
    llmProcess = null;
  }
}

function resetLLMTimer() {
  if (llmTimeout) clearTimeout(llmTimeout);
  // Box the LLM after 5 minutes of inactivity (300000 ms)
  llmTimeout = setTimeout(stopLLM, 300000);
}

ipcMain.handle('llm:chat', async (event, messages) => {
  resetLLMTimer();
  const started = await startLLM();
  if (!started) throw new Error("Le moteur LLM n'a pas pu démarrer.");
  
  try {
    const fetch = (await import('node-fetch')).default || require('node-fetch');
    const response = await fetch('http://127.0.0.1:11434/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: messages,
        temperature: 0.2,
        stream: false
      })
    });
    
    const data = await response.json();
    return data;
  } catch (err) {
    throw err;
  }
});
`;

let content = fs.readFileSync('eva-pc/electron/main.ts', 'utf8');
if (!content.includes('LLM AGENTIC LOCAL')) {
  content += '\n' + injection;
  fs.writeFileSync('eva-pc/electron/main.ts', content);
  console.log("main.ts updated");
} else {
  console.log("Already updated");
}
