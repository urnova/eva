const fs = require('fs');

let html = fs.readFileSync('EVA_V4_fixed_v4/chat.html', 'utf8');
let htmlOld = `<div id="fileViewerOverlay" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.85);backdrop-filter:blur(5px);z-index:999999;align-items:center;justify-content:center;flex-direction:column;opacity:0;transition:opacity 0.2s;">
  <div style="position:absolute;top:20px;right:20px;display:flex;gap:15px;z-index:10;">
    <button onclick="closeFileViewer()" style="background:rgba(255,255,255,0.1);border:none;color:#fff;border-radius:50%;width:40px;height:40px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:20px;transition:background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.2)'" onmouseout="this.style.background='rgba(255,255,255,0.1)'">✖</button>
  </div>
  <div id="fileViewerHeader" style="position:absolute;top:25px;left:25px;color:#fff;font-family:'Space Mono',monospace;font-size:16px;background:rgba(0,0,0,0.5);padding:8px 15px;border-radius:8px;"></div>
  
  <div id="fileViewerContent" style="width:90%;height:85%;background:var(--surface);border-radius:12px;overflow:auto;padding:30px;color:var(--text);font-family:sans-serif;font-size:14px;line-height:1.6;box-shadow:0 10px 40px rgba(0,0,0,0.5);display:none;white-space:pre-wrap;"></div>
  
  <img id="imageViewerContent" style="max-width:90%;max-height:85%;object-fit:contain;border-radius:8px;box-shadow:0 10px 40px rgba(0,0,0,0.5);display:none;" />
</div>`;

let htmlNew = `<div id="fileViewerOverlay" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.85);backdrop-filter:blur(5px);z-index:999999;align-items:center;justify-content:center;flex-direction:column;opacity:0;transition:opacity 0.2s;">
  <div style="position:absolute;top:20px;right:20px;display:flex;gap:15px;z-index:10;">
    <button id="fileViewerDownloadBtn" onclick="downloadCurrentFile()" style="display:none;background:rgba(255,255,255,0.1);border:none;color:#fff;border-radius:8px;padding:8px 15px;cursor:pointer;align-items:center;justify-content:center;font-size:14px;font-family:'Space Mono',monospace;transition:background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.2)'" onmouseout="this.style.background='rgba(255,255,255,0.1)'">Télécharger</button>
    <button id="fileViewerPrintBtn" onclick="printCurrentFile()" style="display:none;background:rgba(255,255,255,0.1);border:none;color:#fff;border-radius:8px;padding:8px 15px;cursor:pointer;align-items:center;justify-content:center;font-size:14px;font-family:'Space Mono',monospace;transition:background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.2)'" onmouseout="this.style.background='rgba(255,255,255,0.1)'">Imprimer</button>
    <button onclick="closeFileViewer()" style="background:rgba(255,255,255,0.1);border:none;color:#fff;border-radius:50%;width:40px;height:40px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:20px;transition:background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.2)'" onmouseout="this.style.background='rgba(255,255,255,0.1)'">✖</button>
  </div>
  <div id="fileViewerHeader" style="position:absolute;top:25px;left:25px;color:#fff;font-family:'Space Mono',monospace;font-size:16px;background:rgba(0,0,0,0.5);padding:8px 15px;border-radius:8px;"></div>
  
  <div id="fileViewerContent" style="width:90%;height:85%;background:var(--surface);border-radius:12px;overflow:auto;padding:30px;color:var(--text);font-family:sans-serif;font-size:14px;line-height:1.6;box-shadow:0 10px 40px rgba(0,0,0,0.5);display:none;white-space:pre-wrap;"></div>
  <iframe id="fileViewerIframe" style="width:90%;height:85%;background:#fff;border-radius:12px;border:none;box-shadow:0 10px 40px rgba(0,0,0,0.5);display:none;"></iframe>
  
  <img id="imageViewerContent" style="max-width:90%;max-height:85%;object-fit:contain;border-radius:8px;box-shadow:0 10px 40px rgba(0,0,0,0.5);display:none;" />
</div>`;

// Replace using regex that ignores whitespace differences safely
let startIdx = html.indexOf('<div id="fileViewerOverlay"');
let endIdx = html.indexOf('</div>\n</body>', startIdx);
if (startIdx !== -1 && endIdx !== -1) {
  html = html.substring(0, startIdx) + htmlNew + html.substring(endIdx + 6);
  fs.writeFileSync('EVA_V4_fixed_v4/chat.html', html, 'utf8');
}
