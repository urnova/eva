import sys, re
sys.stdout.reconfigure(encoding='utf-8')

# ── 1. Fix PC file-gen.js A4 CSS ─────────────────────────────────────────
with open(r'f:\code\eva\evaprojectmultiplatforme\eva-pc\web\js\app\file-gen.js', 'r', encoding='utf-8') as f:
    c = f.read()

OLD_A4 = """    /* Inject A4 page-simulation CSS (viewer + print) */
    if (!htmlContent.includes('__eva_a4__')) {
      var a4css = '<style id="__eva_a4__">\\nhtml{background:#6b6b6b;padding:28px 16px;margin:0;min-height:100vh;box-sizing:border-box}\\nbody{background:white!important;max-width:794px;margin:0 auto 32px!important;padding:45px 60px!important;\\n  box-shadow:0 4px 24px rgba(0,0,0,.45);box-sizing:border-box;min-height:1123px;\\n  font-size:13.5px;line-height:1.75;position:relative}\\nbody::after{content:attr(data-page);position:absolute;bottom:18px;right:32px;\\n  font-size:11px;color:#aaa;font-family:sans-serif}\\n@page{size:A4 portrait;margin:20mm}\\n@media print{\\n  html{background:white!important;padding:0}\\n  body{box-shadow:none;margin:0!important;padding:0!important;max-width:none!important;min-height:auto;font-size:12px}\\n}\\n</style>';
      if (htmlContent.includes('</head>')) {
        htmlContent = htmlContent.replace('</head>', a4css + '</head>');
      } else if (htmlContent.includes('<body')) {
        htmlContent = htmlContent.replace('<body', a4css + '<body');
      } else {
        htmlContent = a4css + htmlContent;
      }
    }
    /* Inject print CSS if not already present */
    if (!htmlContent.includes('@media print')) {
      htmlContent = htmlContent.replace('</head>',
        '<style>@media print{body{margin:0}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}}' +
        'body{max-width:900px;margin:30px auto;font-family:Georgia,serif}</style></head>');
    }"""

NEW_A4 = """    /* Inject A4 page-simulation CSS — viewer shows white card on gray bg, print preserves all styling */
    if (!htmlContent.includes('__eva_a4__')) {
      var a4css = '<style id="__eva_a4__">html{background:#6b6b6b;padding:28px 16px;margin:0;min-height:100vh;box-sizing:border-box}body{background:white!important;max-width:794px;margin:0 auto 32px!important;padding:36px 56px!important;box-shadow:0 4px 24px rgba(0,0,0,.45);box-sizing:border-box;min-height:1123px;font-size:13.5px;line-height:1.75}@page{size:A4 portrait;margin:20mm 22mm}@media print{html{background:white!important;padding:0!important;margin:0!important}body{background:white!important;max-width:none!important;margin:0!important;padding:0!important;box-shadow:none!important;min-height:auto!important;font-size:12pt!important;line-height:1.65!important}*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}h1,h2,h3,h4{page-break-after:avoid}table{page-break-inside:avoid}tr{page-break-inside:avoid}}</style>';
      if (htmlContent.includes('</head>')) {
        htmlContent = htmlContent.replace('</head>', a4css + '</head>');
      } else if (htmlContent.includes('<body')) {
        htmlContent = htmlContent.replace('<body', a4css + '<body');
      } else {
        htmlContent = a4css + htmlContent;
      }
    }"""

if OLD_A4 in c:
    c = c.replace(OLD_A4, NEW_A4)
    print('OK: PC A4 CSS fixed')
else:
    print('WARN: PC A4 CSS not matched')

with open(r'f:\code\eva\evaprojectmultiplatforme\eva-pc\web\js\app\file-gen.js', 'w', encoding='utf-8') as f:
    f.write(c)

# ── 2. Add _downloadHtmlAsPdf to BOTH file-gen.js files ──────────────────
DOWNLOAD_FN = """
/* ── Téléchargement PDF via html2pdf.js (rendu identique au viewer) ── */
async function _downloadHtmlAsPdf(blobUrl, filename) {
  if (typeof toast === 'function') toast('Génération du PDF en cours…', 'info');
  var pdfIframe;
  try {
    if (!window.html2pdf) {
      await _loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js', 'html2pdf');
    }
    /* Render the HTML at A4 width in a hidden iframe */
    pdfIframe = document.createElement('iframe');
    pdfIframe.setAttribute('data-eva-pdf', '1');
    pdfIframe.style.cssText = 'position:fixed;top:0;left:0;width:794px;height:1px;opacity:0.001;pointer-events:none;z-index:-99999;border:none;overflow:hidden;';
    document.body.appendChild(pdfIframe);
    pdfIframe.src = blobUrl;
    await new Promise(function(resolve) {
      pdfIframe.onload = function() { setTimeout(resolve, 700); };
    });
    var body = pdfIframe.contentDocument && pdfIframe.contentDocument.body;
    if (!body) throw new Error('iframe body inaccessible');
    /* Match viewer dimensions */
    pdfIframe.style.height = Math.max(body.scrollHeight, 1123) + 'px';
    await new Promise(function(r){ setTimeout(r, 200); });
    var opt = {
      margin: 0,
      filename: filename || 'document.pdf',
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 2, useCORS: true, allowTaint: false,
        backgroundColor: '#ffffff', width: 794, windowWidth: 794,
        scrollX: 0, scrollY: -window.scrollY
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['css', 'legacy'], avoid: ['tr', 'h2', 'h3', 'h4'] }
    };
    await html2pdf().set(opt).from(body).save();
    if (typeof toast === 'function') toast('PDF téléchargé : ' + filename, 'success');
  } catch(e) {
    console.error('[EVA PDF Download]', e);
    /* Fallback: open in new tab + auto-print */
    var w = window.open(blobUrl, '_blank');
    if (w) { w.onload = function() { setTimeout(function(){ w.print(); }, 500); }; }
    if (typeof toast === 'function') toast("Astuce : dans la boîte d'impression, choisissez « Enregistrer en PDF »", 'info');
  } finally {
    if (pdfIframe && pdfIframe.parentNode) pdfIframe.parentNode.removeChild(pdfIframe);
  }
}

"""

for path in [
    r'f:\code\eva\evaprojectmultiplatforme\EVA_V4_fixed_v4\js\app\file-gen.js',
    r'f:\code\eva\evaprojectmultiplatforme\eva-pc\web\js\app\file-gen.js',
]:
    with open(path, 'r', encoding='utf-8') as f:
        c = f.read()
    if '_downloadHtmlAsPdf' not in c:
        anchor = 'function _evaGenerateHtmlPdf(action) {'
        if anchor in c:
            c = c.replace(anchor, DOWNLOAD_FN + anchor, 1)
            print('OK: _downloadHtmlAsPdf added to', path[-50:])
        else:
            print('WARN: anchor not found in', path[-50:])
    else:
        print('OK: already has _downloadHtmlAsPdf in', path[-50:])
    with open(path, 'w', encoding='utf-8') as f:
        f.write(c)

# ── 3. Fix downloadCurrentFile in BOTH core.js files ─────────────────────
for path in [
    r'f:\code\eva\evaprojectmultiplatforme\EVA_V4_fixed_v4\js\app\core.js',
    r'f:\code\eva\evaprojectmultiplatforme\eva-pc\web\js\app\core.js',
]:
    with open(path, 'r', encoding='utf-8') as f:
        c = f.read()

    OLD_DL_PDF = """  if (doc2.ext === 'pdf') {
    /* PDF stored as HTML blob — trigger print dialog to save as real PDF */
    var iframe = document.getElementById('fileViewerIframe');
    if (iframe && iframe.contentWindow && iframe.src !== 'about:blank') {
      try { iframe.contentWindow.print(); return; } catch(e) {}
    }
    var win = window.open(doc2.url, '_blank');
    if (win) { win.onload = function() { setTimeout(function(){ win.print(); }, 400); }; }
    return;
  }"""

    NEW_DL_PDF = """  if (doc2.ext === 'pdf') {
    /* Use html2pdf.js to generate a true PDF matching the viewer */
    if (typeof _downloadHtmlAsPdf === 'function') {
      _downloadHtmlAsPdf(doc2.url, doc2.name);
    } else {
      var w = window.open(doc2.url, '_blank');
      if (w) { w.onload = function() { setTimeout(function(){ w.print(); }, 400); }; }
    }
    return;
  }"""

    if OLD_DL_PDF in c:
        c = c.replace(OLD_DL_PDF, NEW_DL_PDF)
        print('OK: core.js download fixed in', path[-50:])
    else:
        print('WARN: download branch not matched in', path[-50:])

    with open(path, 'w', encoding='utf-8') as f:
        f.write(c)

print('\nAll done')
