const fs = require('fs');

let js = fs.readFileSync('EVA_V4_fixed_v4/js/app/core.js', 'utf8');

let newFuncs = `
window._currentViewerDoc = null;

window.openDocumentViewer = function(doc) {
  window._currentViewerDoc = doc;
  var overlay = document.getElementById('fileViewerOverlay');
  var header = document.getElementById('fileViewerHeader');
  var content = document.getElementById('fileViewerContent');
  var iframe = document.getElementById('fileViewerIframe');
  var imgContent = document.getElementById('imageViewerContent');
  var downloadBtn = document.getElementById('fileViewerDownloadBtn');
  var printBtn = document.getElementById('fileViewerPrintBtn');
  if(!overlay) return;
  
  header.innerText = doc.name || 'Document';
  content.style.display = 'none';
  iframe.style.display = 'none';
  imgContent.style.display = 'none';
  downloadBtn.style.display = 'flex';
  printBtn.style.display = 'flex';
  
  if (doc.url) {
    if (doc.ext === 'pdf') {
      iframe.src = doc.url + '#toolbar=0';
      iframe.style.display = 'block';
    } else if (['js', 'html', 'css', 'json', 'txt', 'csv', 'md'].includes(doc.ext)) {
      content.style.display = 'block';
      content.style.fontFamily = "'Space Mono', monospace";
      if (doc.text) {
        content.textContent = doc.text;
      } else {
        // Fetch text from blob URL
        fetch(doc.url).then(r => r.text()).then(t => { content.textContent = t; });
      }
    } else {
      // Pour les autres formats (Excel, PPT, docx, etc.), la prévisualisation native iframe ne marche pas offline sans office viewer
      // On affiche le texte extrait s'il existe, sinon on indique que la visualisation complète n'est pas dispo mais téléchargeable.
      content.style.display = 'block';
      if (doc.text) {
        content.textContent = doc.text;
      } else {
        content.innerHTML = '<div style="color:var(--text-muted);text-align:center;margin-top:20px;">Aperçu direct non disponible pour ce format. Veuillez télécharger le document.</div>';
      }
    }
  } else if (doc.text) {
    content.style.display = 'block';
    content.textContent = doc.text;
  } else {
    content.style.display = 'block';
    content.innerHTML = '<div style="color:var(--text-muted);text-align:center;margin-top:20px;">Contenu du document non disponible (non lu ou non sauvegardé dans cette session).</div>';
  }
  
  overlay.style.display = 'flex';
  setTimeout(function(){ overlay.style.opacity = '1'; }, 10);
};

window.openImageViewer = function(url) {
  window._currentViewerDoc = {url: url, name: 'image.png', ext: 'png'};
  var overlay = document.getElementById('fileViewerOverlay');
  var header = document.getElementById('fileViewerHeader');
  var content = document.getElementById('fileViewerContent');
  var iframe = document.getElementById('fileViewerIframe');
  var imgContent = document.getElementById('imageViewerContent');
  var downloadBtn = document.getElementById('fileViewerDownloadBtn');
  var printBtn = document.getElementById('fileViewerPrintBtn');
  if(!overlay) return;
  
  header.innerText = 'Image';
  content.style.display = 'none';
  iframe.style.display = 'none';
  imgContent.style.display = 'block';
  downloadBtn.style.display = 'flex';
  printBtn.style.display = 'flex';
  imgContent.src = url;
  
  overlay.style.display = 'flex';
  setTimeout(function(){ overlay.style.opacity = '1'; }, 10);
};

window.closeFileViewer = function() {
  var overlay = document.getElementById('fileViewerOverlay');
  if(!overlay) return;
  overlay.style.opacity = '0';
  setTimeout(function(){ 
    overlay.style.display = 'none'; 
    var iframe = document.getElementById('fileViewerIframe');
    if (iframe) iframe.src = 'about:blank';
  }, 200);
};

window.downloadCurrentFile = function() {
  if (!window._currentViewerDoc || !window._currentViewerDoc.url) return;
  var a = document.createElement('a');
  a.href = window._currentViewerDoc.url;
  a.download = window._currentViewerDoc.name || 'document';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

window.printCurrentFile = function() {
  if (!window._currentViewerDoc || !window._currentViewerDoc.url) return;
  var iframe = document.getElementById('fileViewerIframe');
  if (iframe && iframe.style.display === 'block') {
    iframe.contentWindow.print();
  } else if (window._currentViewerDoc.ext === 'png' || window._currentViewerDoc.ext === 'jpg' || window._currentViewerDoc.ext === 'jpeg') {
    var pWin = window.open(window._currentViewerDoc.url, '_blank');
    if(pWin) { pWin.onload = function(){ pWin.print(); }; }
  } else {
    var pr = window.open('', '', 'width=800,height=600');
    var txt = document.getElementById('fileViewerContent').textContent;
    pr.document.write('<pre style="white-space:pre-wrap;font-family:sans-serif;">' + txt.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</pre>');
    pr.document.close();
    pr.focus();
    pr.print();
    pr.close();
  }
};
`;

let target = js.indexOf('window.openDocumentViewer =');
if (target !== -1) {
  js = js.substring(0, target) + newFuncs;
  fs.writeFileSync('EVA_V4_fixed_v4/js/app/core.js', js, 'utf8');
}
