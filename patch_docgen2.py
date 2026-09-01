import sys
sys.stdout.reconfigure(encoding='utf-8')

A4_CSS = '''<style id="__eva_a4__">
html{background:#6b6b6b;padding:28px 16px;margin:0;min-height:100vh;box-sizing:border-box}
body{background:white!important;max-width:794px;margin:0 auto 32px!important;padding:45px 60px!important;
  box-shadow:0 4px 24px rgba(0,0,0,.45);box-sizing:border-box;min-height:1123px;
  font-size:13.5px;line-height:1.75;position:relative}
body::after{content:attr(data-page);position:absolute;bottom:18px;right:32px;
  font-size:11px;color:#aaa;font-family:sans-serif}
@page{size:A4 portrait;margin:20mm}
@media print{
  html{background:white!important;padding:0}
  body{box-shadow:none;margin:0!important;padding:0!important;max-width:none!important;min-height:auto;font-size:12px}
}
</style>'''

PPTX_PREVIEW_FN = r"""
/* ── Aperçu HTML des slides PPTX dans le viewer ── */
function _renderPptxPreview(slides, container) {
  container.style.cssText = 'background:#1a1a2e;padding:20px;overflow-y:auto;';
  slides.forEach(function(s, i) {
    var card = document.createElement('div');
    card.style.cssText = 'background:#0d0d1a;border:1px solid #1e3a5f;border-radius:12px;padding:20px 26px;margin-bottom:18px;position:relative;border-left:4px solid #00d4ff;';
    var num = document.createElement('div');
    num.style.cssText = 'position:absolute;top:12px;right:16px;font-size:10px;color:#445577;font-family:monospace;';
    num.textContent = (i+1)+'/'+slides.length;
    var title = document.createElement('div');
    title.style.cssText = 'font-size:1.1em;font-weight:700;color:#00d4ff;margin-bottom:10px;line-height:1.3;';
    title.textContent = s.title || '';
    card.appendChild(num);
    card.appendChild(title);
    if (s.subtitle) {
      var sub = document.createElement('div');
      sub.style.cssText = 'font-size:0.82em;color:#9999cc;font-style:italic;margin-bottom:8px;';
      sub.textContent = s.subtitle;
      card.appendChild(sub);
    }
    if (s.points && s.points.length) {
      s.points.forEach(function(p) {
        var li = document.createElement('div');
        li.style.cssText = 'display:flex;align-items:flex-start;gap:8px;margin-bottom:5px;';
        li.innerHTML = '<span style="color:#00d4ff;margin-top:3px;flex-shrink:0;">›</span><span style="color:#dde0f5;font-size:0.88em;line-height:1.5;">'+_escHtml(p)+'</span>';
        card.appendChild(li);
      });
    } else if (s.content) {
      var ct = document.createElement('div');
      ct.style.cssText = 'color:#dde0f5;font-size:0.88em;line-height:1.6;white-space:pre-wrap;';
      ct.textContent = s.content;
      card.appendChild(ct);
    }
    container.appendChild(card);
  });
}
function _escHtml(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
"""

files_fg = [
    r'f:\code\eva\evaprojectmultiplatforme\EVA_V4_fixed_v4\js\app\file-gen.js',
    r'f:\code\eva\evaprojectmultiplatforme\eva-pc\web\js\app\file-gen.js',
]
files_core = [
    r'f:\code\eva\evaprojectmultiplatforme\EVA_V4_fixed_v4\js\app\core.js',
    r'f:\code\eva\evaprojectmultiplatforme\eva-pc\web\js\app\core.js',
]

# ═══════════════════════════════════════════════════════════════════════
# 1. PATCH file-gen.js
# ═══════════════════════════════════════════════════════════════════════
for path in files_fg:
    with open(path, 'r', encoding='utf-8') as f:
        c = f.read()
    changed = []

    # A) Inject A4 CSS into _evaGenerateHtmlPdf
    OLD_INJECT = "    /* Inject print CSS if not already present */\n    if (!htmlContent.includes('@media print')) {"
    NEW_INJECT = """    /* Inject A4 page-simulation CSS (viewer + print) */
    if (!htmlContent.includes('__eva_a4__')) {
      var a4css = '""" + A4_CSS.replace("'", "\\'").replace("\n", "\\n") + """';
      if (htmlContent.includes('</head>')) {
        htmlContent = htmlContent.replace('</head>', a4css + '</head>');
      } else if (htmlContent.includes('<body')) {
        htmlContent = htmlContent.replace('<body', a4css + '<body');
      } else {
        htmlContent = a4css + htmlContent;
      }
    }
    /* Inject print CSS if not already present */
    if (!htmlContent.includes('@media print')) {"""

    if OLD_INJECT in c:
        c = c.replace(OLD_INJECT, NEW_INJECT)
        changed.append('A4 CSS injection')
    else:
        print(f'  WARN A4 CSS injection not matched in {path}')

    # B) Store slides data in cache for PPTX viewer (inside _evaGeneratePptx, before writeFile)
    OLD_WRITE = "    pptx.write({outputType:'blob'}).then(function(blob) {"
    NEW_WRITE = """    /* Store slides for viewer preview */
    if (!window._evaSlidesCache) window._evaSlidesCache = {};
    pptx.write({outputType:'blob'}).then(function(blob) {"""

    if OLD_WRITE in c:
        c = c.replace(OLD_WRITE, NEW_WRITE, 1)
        changed.append('slides cache storage')
    else:
        print(f'  WARN slides cache not matched in {path}')

    # C) After creating the blob URL, store it in cache
    OLD_CACHE = "      var url = URL.createObjectURL(blob);\n      toast('PowerPoint prêt : '+filename, 'success');"
    NEW_CACHE = "      var url = URL.createObjectURL(blob);\n      if (window._evaSlidesCache) window._evaSlidesCache[url] = action.slides || [];\n      toast('PowerPoint prêt : '+filename, 'success');"

    if OLD_CACHE in c:
        c = c.replace(OLD_CACHE, NEW_CACHE, 1)
        changed.append('slides cache URL key')
    else:
        print(f'  WARN cache URL key not matched in {path}')

    # D) Add _renderPptxPreview helper before _evaGeneratePptx
    ANCHOR_PPTX = "async function _evaGeneratePptx(action) {"
    if ANCHOR_PPTX in c and '_renderPptxPreview' not in c:
        c = c.replace(ANCHOR_PPTX, PPTX_PREVIEW_FN + "\n" + ANCHOR_PPTX, 1)
        changed.append('_renderPptxPreview helper')

    with open(path, 'w', encoding='utf-8') as f:
        f.write(c)
    print(f'  file-gen.js ({", ".join(changed)}): {path}')


# ═══════════════════════════════════════════════════════════════════════
# 2. PATCH core.js
# ═══════════════════════════════════════════════════════════════════════
for path in files_core:
    with open(path, 'r', encoding='utf-8') as f:
        c = f.read()
    changed = []

    # A) Fix PPTX viewer (show HTML preview instead of black void)
    OLD_PPTX_V = "      content.style.display = 'block';\n      if (doc.text) {\n        content.textContent = doc.text;\n      } else {\n        content.innerHTML = '<div style=\"color:var(--text-muted);text-align:center;margin-top:20px;\">Aperçu direct non disponible pour ce format. Veuillez télécharger le document.</div>';\n      }"
    NEW_PPTX_V = """      var slidesData = window._evaSlidesCache && window._evaSlidesCache[doc.url];
      if (slidesData && slidesData.length) {
        content.style.display = 'block';
        content.innerHTML = '';
        if (typeof _renderPptxPreview === 'function') {
          _renderPptxPreview(slidesData, content);
        } else {
          content.style.cssText += ';background:#1a1a2e;padding:16px;';
          content.innerHTML = '<div style="color:#00d4ff;text-align:center;padding:40px;font-size:0.9em;">Aperçu des ' + slidesData.length + ' diapositives — Téléchargez le .pptx pour une lecture complète.</div>';
        }
        printBtn.style.display = 'none';
      } else {
        content.style.display = 'block';
        content.innerHTML = '<div style="color:var(--text-muted);text-align:center;margin-top:40px;font-size:0.9em;">Téléchargez le fichier .pptx pour le visualiser dans PowerPoint ou LibreOffice.</div>';
        printBtn.style.display = 'none';
      }"""

    if OLD_PPTX_V in c:
        c = c.replace(OLD_PPTX_V, NEW_PPTX_V)
        changed.append('PPTX viewer preview')
    else:
        print(f'  WARN PPTX viewer pattern not matched in {path}')

    # B) Fix downloadCurrentFile: for 'pdf' ext, open print dialog instead
    OLD_DL = "  window.downloadCurrentFile = function() {\n    if (!window._currentViewerDoc || !window._currentViewerDoc.url) return;\n    var a = document.createElement('a');\n    a.href = window._currentViewerDoc.url;\n    a.download = window._currentViewerDoc.name || 'document';\n    document.body.appendChild(a);\n    a.click();\n    document.body.removeChild(a);\n  };"
    NEW_DL = """  window.downloadCurrentFile = function() {
    if (!window._currentViewerDoc || !window._currentViewerDoc.url) return;
    var doc2 = window._currentViewerDoc;
    if (doc2.ext === 'pdf') {
      /* PDF files are stored as HTML blobs — open print dialog to save as real PDF */
      var iframe = document.getElementById('fileViewerIframe');
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.print();
      } else {
        var win = window.open(doc2.url, '_blank');
        if (win) { win.onload = function() { setTimeout(function(){ win.print(); }, 300); }; }
      }
      return;
    }
    var a = document.createElement('a');
    a.href = doc2.url;
    a.download = doc2.name || 'document';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };"""

    if OLD_DL in c:
        c = c.replace(OLD_DL, NEW_DL)
        changed.append('downloadCurrentFile PDF->print')
    else:
        print(f'  WARN downloadCurrentFile not matched in {path}')

    # C) Fix printCurrentFile: handle PPTX crash (iframe empty)
    OLD_PRINT = "  window.printCurrentFile = function() {\n    if (!window._currentViewerDoc || !window._currentViewerDoc.url) return;\n    var iframe = document.getElementById('fileViewerIframe');\n    if (iframe && iframe.style.display === 'block') {\n      iframe.contentWindow.print();"
    NEW_PRINT = """  window.printCurrentFile = function() {
    if (!window._currentViewerDoc || !window._currentViewerDoc.url) return;
    var iframe = document.getElementById('fileViewerIframe');
    var doc2 = window._currentViewerDoc;
    if (doc2.ext === 'pptx' || doc2.ext === 'xlsx' || doc2.ext === 'csv') {
      if (typeof toast === 'function') toast('Téléchargez le fichier et imprimez depuis l\\'application correspondante.', 'info');
      return;
    }
    if (iframe && iframe.style.display === 'block') {
      try { iframe.contentWindow.print(); } catch(e) {
        var win = window.open(doc2.url, '_blank');
        if (win) { win.onload = function() { setTimeout(function(){ win.print(); }, 300); }; }
      }"""

    if OLD_PRINT in c:
        c = c.replace(OLD_PRINT, NEW_PRINT)
        changed.append('printCurrentFile crash fix')
    else:
        print(f'  WARN printCurrentFile not matched in {path}')

    # D) Update "Télécharger" button label for PDF viewer to "Enregistrer en PDF"
    # We'll add dynamic label change in openDocumentViewer for pdf ext
    OLD_VIEWER_PDF = "  if (doc.url) {\n    if (doc.ext === 'pdf') {\n      iframe.src = doc.url + '#toolbar=0';\n      iframe.style.display = 'block';"
    NEW_VIEWER_PDF = """  if (doc.url) {
    if (doc.ext === 'pdf') {
      iframe.src = doc.url + '#toolbar=0';
      iframe.style.display = 'block';
      /* Change download button label to indicate print-to-PDF flow */
      if (downloadBtn) { downloadBtn.title = 'Cliquez pour ouvrir la boîte de dialogue Imprimer — choisissez « Enregistrer en PDF »'; }"""

    if OLD_VIEWER_PDF in c:
        c = c.replace(OLD_VIEWER_PDF, NEW_VIEWER_PDF)
        changed.append('PDF download btn tooltip')
    else:
        print(f'  WARN PDF viewer btn not matched in {path}')

    with open(path, 'w', encoding='utf-8') as f:
        f.write(c)
    print(f'  core.js ({", ".join(changed)}): {path}')

print('\nAll patches applied')
