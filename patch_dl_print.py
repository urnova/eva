import sys
sys.stdout.reconfigure(encoding='utf-8')

files_core = [
    r'f:\code\eva\evaprojectmultiplatforme\EVA_V4_fixed_v4\js\app\core.js',
    r'f:\code\eva\evaprojectmultiplatforme\eva-pc\web\js\app\core.js',
]

OLD_DL = "downloadCurrentFile = function() {\n  if (!window._currentViewerDoc || !window._currentViewerDoc.url) return;\n  var a = document.createElement('a');\n  a.href = window._currentViewerDoc.url;\n  a.download = window._currentViewerDoc.name || 'document';\n  document.body.appendChild(a);\n  a.click();\n  document.body.removeChild(a);\n};"

NEW_DL = """downloadCurrentFile = function() {
  if (!window._currentViewerDoc || !window._currentViewerDoc.url) return;
  var doc2 = window._currentViewerDoc;
  if (doc2.ext === 'pdf') {
    /* PDF stored as HTML blob — trigger print dialog so user saves a real PDF */
    var iframe = document.getElementById('fileViewerIframe');
    if (iframe && iframe.contentWindow && iframe.src !== 'about:blank') {
      try { iframe.contentWindow.print(); return; } catch(e) {}
    }
    var win = window.open(doc2.url, '_blank');
    if (win) { win.onload = function() { setTimeout(function(){ win.print(); }, 400); }; }
    return;
  }
  var a = document.createElement('a');
  a.href = doc2.url;
  a.download = doc2.name || 'document';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};"""

OLD_PRINT = "printCurrentFile = function() {\n  if (!window._currentViewerDoc || !window._currentViewerDoc.url) return;\n  var iframe = document.getElementById('fileViewerIframe');\n  if (iframe && iframe.style.display === 'block') {\n    iframe.contentWindow.print();"

NEW_PRINT = """printCurrentFile = function() {
  if (!window._currentViewerDoc || !window._currentViewerDoc.url) return;
  var doc2 = window._currentViewerDoc;
  /* PPTX/XLSX cannot be printed from browser — show hint */
  if (doc2.ext === 'pptx' || doc2.ext === 'xlsx') {
    if (typeof toast === 'function') toast('Téléchargez le fichier et imprimez depuis PowerPoint / Excel.', 'info');
    return;
  }
  var iframe = document.getElementById('fileViewerIframe');
  if (iframe && iframe.style.display === 'block') {
    try { iframe.contentWindow.print(); } catch(e) {
      var win = window.open(doc2.url, '_blank');
      if (win) { win.onload = function() { setTimeout(function(){ win.print(); }, 400); }; }
    }"""

for path in files_core:
    with open(path, 'r', encoding='utf-8') as f:
        c = f.read()

    ok = []
    if OLD_DL in c:
        c = c.replace(OLD_DL, NEW_DL)
        ok.append('download')
    else:
        print('WARN: download not matched in', path)

    if OLD_PRINT in c:
        c = c.replace(OLD_PRINT, NEW_PRINT)
        ok.append('print')
    else:
        print('WARN: print not matched in', path)

    with open(path, 'w', encoding='utf-8') as f:
        f.write(c)
    print('OK', ok, path[-50:])

print('done')
