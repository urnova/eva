const fs = require('fs');
const https = require('https');
const path = require('path');
const zlib = require('zlib');
const { execSync } = require('child_process');

const LLM_DIR = path.join(__dirname, '../resources/llm');
const MODEL_URL = "https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf";
const LLAMA_SERVER_URL = "https://github.com/ggerganov/llama.cpp/releases/download/b4546/llama-b4546-bin-win-vulkan-x64.zip";

if (!fs.existsSync(LLM_DIR)) {
  fs.mkdirSync(LLM_DIR, { recursive: true });
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(dest)) {
      console.log(`[Skip] ${path.basename(dest)} exists.`);
      return resolve();
    }
    console.log(`Downloading ${path.basename(dest)}...`);
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        return downloadFile(response.headers.location, dest).then(resolve).catch(reject);
      }
      
      const totalSize = parseInt(response.headers['content-length'], 10);
      let downloaded = 0;
      
      response.on('data', (chunk) => {
        downloaded += chunk.length;
        const percent = ((downloaded / totalSize) * 100).toFixed(2);
        process.stdout.write(`\rProgress: ${percent}%`);
      });
      
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log(`\nDownloaded ${path.basename(dest)}`);
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

async function run() {
  try {
    const modelDest = path.join(LLM_DIR, 'eva-model.gguf');
    await downloadFile(MODEL_URL, modelDest);
    
    const serverZipDest = path.join(LLM_DIR, 'llama-server.zip');
    await downloadFile(LLAMA_SERVER_URL, serverZipDest);
    
    // Unzip using powershell
    const serverExePath = path.join(LLM_DIR, 'llama-server.exe');
    if(!fs.existsSync(serverExePath)) {
        console.log("Extracting llama-server.zip...");
        execSync(`tar.exe -xf "${serverZipDest}" -C "${LLM_DIR}"`);
        console.log("Extraction complete.");
    }
    console.log("LLM Resources ready!");
  } catch(e) {
    console.error("Error downloading LLM resources:", e);
    process.exit(1);
  }
}
run();
