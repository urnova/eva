const fs = require('fs');

function patchChatHtml(filePath) {
  if (!fs.existsSync(filePath)) return;
  let html = fs.readFileSync(filePath, 'utf8');

  if (!html.includes('id="fileViewerOverlay"')) {
    let htmlInsert = `
<!-- File Viewer Overlay -->
<div id="fileViewerOverlay" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.85);backdrop-filter:blur(5px);z-index:999999;align-items:center;justify-content:center;flex-direction:column;opacity:0;transition:opacity 0.2s;">
  <div style="position:absolute;top:20px;right:20px;display:flex;gap:15px;z-index:10;">
    <button onclick="closeFileViewer()" style="background:rgba(255,255,255,0.1);border:none;color:#fff;border-radius:50%;width:40px;height:40px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:20px;transition:background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.2)'" onmouseout="this.style.background='rgba(255,255,255,0.1)'">✖</button>
  </div>
  <div id="fileViewerHeader" style="position:absolute;top:25px;left:25px;color:#fff;font-family:'Space Mono',monospace;font-size:16px;background:rgba(0,0,0,0.5);padding:8px 15px;border-radius:8px;"></div>
  
  <div id="fileViewerContent" style="width:90%;height:85%;background:var(--surface);border-radius:12px;overflow:auto;padding:30px;color:var(--text);font-family:sans-serif;font-size:14px;line-height:1.6;box-shadow:0 10px 40px rgba(0,0,0,0.5);display:none;white-space:pre-wrap;"></div>
  
  <img id="imageViewerContent" style="max-width:90%;max-height:85%;object-fit:contain;border-radius:8px;box-shadow:0 10px 40px rgba(0,0,0,0.5);display:none;" />
</div>
`;
    html = html.replace('</body>', htmlInsert + '\n</body>');
    fs.writeFileSync(filePath, html, 'utf8');
  }
}

function patchCoreJs(filePath) {
  if (!fs.existsSync(filePath)) return;
  let js = fs.readFileSync(filePath, 'utf8');

  if (!js.includes('window.openDocumentViewer')) {
    let jsInsert = `
window.openDocumentViewer = function(doc) {
  var overlay = document.getElementById('fileViewerOverlay');
  var header = document.getElementById('fileViewerHeader');
  var content = document.getElementById('fileViewerContent');
  var imgContent = document.getElementById('imageViewerContent');
  if(!overlay) return;
  
  header.innerText = doc.name || 'Document';
  content.style.display = 'block';
  imgContent.style.display = 'none';
  
  if (doc.text) {
    content.textContent = doc.text;
  } else {
    content.innerHTML = '<div style="color:var(--text-muted);text-align:center;margin-top:20px;">Contenu du document non disponible (non lu ou non sauvegardé dans cette session).</div>';
  }
  
  overlay.style.display = 'flex';
  setTimeout(function(){ overlay.style.opacity = '1'; }, 10);
};

window.openImageViewer = function(url) {
  var overlay = document.getElementById('fileViewerOverlay');
  var header = document.getElementById('fileViewerHeader');
  var content = document.getElementById('fileViewerContent');
  var imgContent = document.getElementById('imageViewerContent');
  if(!overlay) return;
  
  header.innerText = 'Image';
  content.style.display = 'none';
  imgContent.style.display = 'block';
  imgContent.src = url;
  
  overlay.style.display = 'flex';
  setTimeout(function(){ overlay.style.opacity = '1'; }, 10);
};

window.closeFileViewer = function() {
  var overlay = document.getElementById('fileViewerOverlay');
  if(!overlay) return;
  overlay.style.opacity = '0';
  setTimeout(function(){ overlay.style.display = 'none'; }, 200);
};
`;
    js += '\n' + jsInsert;
    fs.writeFileSync(filePath, js, 'utf8');
  }
}

patchChatHtml('EVA_V4_fixed_v4/chat.html');
patchCoreJs('EVA_V4_fixed_v4/js/app/core.js');
