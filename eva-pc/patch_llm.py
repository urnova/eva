import sys, re
sys.stdout.reconfigure(encoding='utf-8')

with open(r'electron/main.ts', 'r', encoding='utf-8', errors='replace') as f:
    text = f.read()

NEW_LLM_BLOCK = """// ==========================================
// LLM AGENTIC LOCAL (node-llama-cpp)
// ==========================================
import { getLlama, LlamaChatSession, type ChatHistoryItem } from "node-llama-cpp";

let llamaInstance: any = null;
let llamaModel: any = null;
let llamaContext: any = null;
let llmTimeout: any = null;

async function startLLM(): Promise<boolean> {
  if (llamaModel && llamaContext) return true;

  try {
    const resourcesPath = app.isPackaged ? process.resourcesPath : path.join(__dirname, '../');
    const llmDir = path.join(resourcesPath, 'resources', 'llm');
    const modelFile = path.join(llmDir, 'EVA-PC-Agentic-3B-Q4_K_M-v3.gguf');

    if (!fs.existsSync(modelFile)) {
      console.error('[LLM] Modèle introuvable:', modelFile);
      return false;
    }

    if (!llamaInstance) {
      console.log('[LLM] Initialisation de node-llama-cpp...');
      llamaInstance = await getLlama();
      console.log('[LLM] Backend détecté automatiquement:', llamaInstance.gpu);
    }

    console.log('[LLM] Chargement du modèle...');
    llamaModel = await llamaInstance.loadModel({ modelPath: modelFile });
    
    console.log('[LLM] Création du contexte...');
    llamaContext = await llamaModel.createContext({ contextSize: 4096 });
    
    console.log('[LLM] Moteur LLM prêt !');
    _notifyLLMReady();
    return true;
  } catch (err: any) {
    console.error('[LLM] Erreur lors du chargement:', err);
    llamaModel = null;
    llamaContext = null;
    return false;
  }
}

function stopLLM() {
  if (llamaContext) {
    console.log('[LLM] Arrêt et libération de la RAM...');
    try { llamaContext.dispose(); } catch(e) {}
    try { llamaModel.dispose(); } catch(e) {}
    llamaContext = null;
    llamaModel = null;
    
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('llm:status-changed', { running: false });
    }
    _rebuildTrayMenu();
  }
}

function resetLLMTimer() {
  if (store.get('cwEnabled', false)) {
    if (llmTimeout) { clearTimeout(llmTimeout); llmTimeout = null; }
    return;
  }
  if (llmTimeout) clearTimeout(llmTimeout);
  llmTimeout = setTimeout(stopLLM, 300000);
}

function _notifyLLMReady() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('llm:status-changed', { running: true });
  }
  _rebuildTrayMenu();
}

ipcMain.handle('llm:chat', async (event, messages) => {
  resetLLMTimer();

  const wasRunning = !!llamaContext;
  if (!wasRunning && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('overlay:show', 'thinking');
  }

  const started = await startLLM();
  if (!started) {
    throw new Error("Le moteur LLM n'a pas pu démarrer (fichier introuvable ou erreur GPU). Vérifiez les logs.");
  }

  try {
    const sequence = llamaContext.getSequence();
    const session = new LlamaChatSession({
      contextSequence: sequence
    });

    const history: ChatHistoryItem[] = [];
    let promptMsg = "";

    for (let i = 0; i < messages.length; i++) {
      const m = messages[i];
      if (i === messages.length - 1 && m.role === 'user') {
        promptMsg = m.content;
        break;
      }
      if (m.role === 'system') history.push({ type: 'system', text: m.content });
      else if (m.role === 'user') history.push({ type: 'user', text: m.content });
      else if (m.role === 'assistant') history.push({ type: 'model', response: [m.content] });
    }

    session.setChatHistory(history);
    
    const responseText = await session.prompt(promptMsg, {
      maxTokens: 2048,
      temperature: 0.2
    });
    
    return {
      choices: [{ message: { role: 'assistant', content: responseText } }]
    };
  } catch (err: any) {
    console.error('[LLM API] Erreur:', err?.message || err);
    throw new Error(err?.message || String(err));
  }
});

ipcMain.handle('llm:start', async () => {
  const started = await startLLM();
  return { success: started };
});

ipcMain.handle('llm:stop', async () => {
  stopLLM();
  return { success: true };
});

ipcMain.handle('llm:status', async () => {
  return { running: !!llamaContext, pid: process.pid };
});
"""

new_text = re.sub(r'// ==========================================\n// LLM AGENTIC LOCAL[\s\S]*?(?=(// CloudWorks enable|ipcMain\.handle\(\'cloudworks:enable\'))', NEW_LLM_BLOCK + '\n\n', text)

if len(new_text) == len(text):
    print("Replacement failed")
else:
    with open(r'electron/main.ts', 'w', encoding='utf-8') as f:
        f.write(new_text)
    print("Successfully replaced LLM section with node-llama-cpp.")