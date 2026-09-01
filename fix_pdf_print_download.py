import sys, re
sys.stdout.reconfigure(encoding='utf-8')

# ── New A4 CSS : viewer looks good AND print matches viewer ──────────────
NEW_A4_CSS = (
    '<style id=\\"__eva_a4__\\">'
    'html{background:#6b6b6b;padding:28px 16px;margin:0;min-height:100vh;box-sizing:border-box}'
    'body{background:white!important;max-width:794px;margin:0 auto 32px!important;padding:36px 56px!important;'
    'box-shadow:0 4px 24px rgba(0,0,0,.45);box-sizing:border-box;min-height:1123px;'
    'font-size:13.5px;line-height:1.75}'
    '@page{size:A4 portrait;margin:20mm 22mm}'
    '@media print{'
    'html{background:white!important;padding:0!important;margin:0!important}'
    'body{background:white!important;max-width:none!important;margin:0!important;padding:0!important;'
    'box-shadow:none!important;min-height:auto!important;font-size:12pt!important;line-height:1.65!important}'
    '*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}'
    'h1,h2,h3,h4{page-break-after:avoid}'
    'table{page-break-inside:avoid}'
    'tr{page-break-inside:avoid}'
    '}'
    '</style>'
)

# ── _downloadHtmlAsPdf using html2pdf.js ─────────────────────────────────
DOWNLOAD_PDF_FN = r"""
/* ── Téléchargement PDF via html2pdf.js ── */
async function _downloadHtmlAsPdf(blobUrl, filename) {
  if (typeof toast === 'function') toast('Génération du PDF…', 'info');
  try {
    if (!window.html2pdf) {
      await _loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js', 'html2pdf');
    }
    /* Create a hidden iframe to render the HTML at A4 width */
    var pdfIframe = document.createElement('iframe');
    pdfIframe.style.cssText = 'position:fixed;top:0;left:0;width:794px;height:1200px;opacity:0.001;pointer-events:none;z-index:-9999;border:none;';
    document.body.appendChild(pdfIframe);
    pdfIframe.src = blobUrl;
    await new Promise(function(resolve) {
      pdfIframe.onload = function() { setTimeout(resolve, 600); };
    });
    var opt = {
      margin: 0,
      filename: filename || 'document.pdf',
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#ffffff',
        width: 794,
        windowWidth: 794,
        scrollX: 0,
        scrollY: 0
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['css', 'legacy'], before: '.page-break', avoid: ['tr', 'td', 'h2', 'h3'] }
    };
    var body = pdfIframe.contentDocument && pdfIframe.contentDocument.body;
    if (!body) throw new Error('iframe body not accessible');
    await html2pdf().set(opt).from(body).save();
    if (typeof toast === 'function') toast('PDF téléchargé : ' + filename, 'success');
  } catch(e) {
    console.error('[EVA PDF Download]', e);
    /* Fallback: open in new tab and trigger print */
    var w = window.open(blobUrl, '_blank');
    if (w) { w.onload = function() { setTimeout(function(){ w.print(); }, 400); }; }
    if (typeof toast === 'function') toast('Ouvrez la boîte d\'impression et choisissez « Enregistrer en PDF »', 'info');
  } finally {
    var fr = document.querySelector('iframe[src="'+blobUrl+'"]');
    if (fr && fr.style.opacity === '0.001') document.body.removeChild(fr);
  }
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
# 1. Update A4 CSS in _evaGenerateHtmlPdf (file-gen.js)
# ═══════════════════════════════════════════════════════════════════════
# The old A4 CSS was injected inline. We'll replace it via regex.
A4_CSS_PAT = re.compile(
    r"var a4css = '(<style id=\\\\"__eva_a4__\\\\">.*?</style>)';",
    re.DOTALL
)

for path in files_fg:
    with open(path, 'r', encoding='utf-8') as f:
        c = f.read()
    changed = []

    # Replace old A4 CSS definition inside the injection block
    old_a4 = re.search(r"var a4css = '(<style id=\\'__eva_a4__\\'>.*?</style>)';", c, re.DOTALL)
    if old_a4:
        old_str = old_a4.group(0)
        # Build new replacement - the css is JS string so we need it escaped for JS
        new_css_js = "var a4css = '" + NEW_A4_CSS + "';"
        c = c.replace(old_str, new_css_js)
        changed.append('A4 CSS updated')
    else:
        print('  WARN A4 css var not found in', path[-40:])

    # Add _downloadHtmlAsPdf before _evaGenerateHtmlPdf
    anchor = 'function _evaGenerateHtmlPdf(action) {'
    if anchor in c and '_downloadHtmlAsPdf' not in c:
        c = c.replace(anchor, DOWNLOAD_PDF_FN + anchor, 1)
        changed.append('_downloadHtmlAsPdf added')

    with open(path, 'w', encoding='utf-8') as f:
        f.write(c)
    print('OK file-gen.js', changed, path[-50:])

# ═══════════════════════════════════════════════════════════════════════
# 2. Update downloadCurrentFile to call _downloadHtmlAsPdf (core.js)
# ═══════════════════════════════════════════════════════════════════════
for path in files_core:
    with open(path, 'r', encoding='utf-8') as f:
        c = f.read()
    changed = []

    # Replace the pdf branch inside downloadCurrentFile
    OLD_PDF_DL = """  if (doc2.ext === 'pdf') {
    /* PDF stored as HTML blob — trigger print dialog to save as real PDF */
    var iframe = document.getElementById('fileViewerIframe');
    if (iframe && iframe.contentWindow && iframe.src !== 'about:blank') {
      try { iframe.contentWindow.print(); return; } catch(e) {}
    }
    var win = window.open(doc2.url, '_blank');
    if (win) { win.onload = function() { setTimeout(function(){ win.print(); }, 400); }; }
    return;
  }"""

    NEW_PDF_DL = """  if (doc2.ext === 'pdf') {
    /* Use html2pdf.js to generate a real PDF matching the viewer */
    if (typeof _downloadHtmlAsPdf === 'function') {
      _downloadHtmlAsPdf(doc2.url, doc2.name);
    } else {
      /* Fallback: print dialog */
      var iframe = document.getElementById('fileViewerIframe');
      if (iframe && iframe.contentWindow) { try { iframe.contentWindow.print(); return; } catch(e) {} }
      var win = window.open(doc2.url, '_blank');
      if (win) { win.onload = function() { setTimeout(function(){ win.print(); }, 400); }; }
    }
    return;
  }"""

    if OLD_PDF_DL in c:
        c = c.replace(OLD_PDF_DL, NEW_PDF_DL)
        changed.append('pdf download -> html2pdf')
    else:
        print('  WARN pdf download branch not matched in', path[-40:])

    with open(path, 'w', encoding='utf-8') as f:
        f.write(c)
    print('OK core.js', changed, path[-50:])

print('\nAll done')
