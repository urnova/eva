const fs = require('fs');

function patchFileGen(targetPath) {
  if (!fs.existsSync(targetPath)) return;
  let code = fs.readFileSync(targetPath, 'utf8');

  let pdfStart = code.indexOf('async function _evaGeneratePdf(action) {');
  let excelStart = code.indexOf('function _evaGenerateExcel(action) {');
  
  if (pdfStart !== -1 && excelStart !== -1) {
    let newPdf = `async function _evaGeneratePdf(action) {
  setEvaStatus('GÉNÉRATION PDF/SLIDES (MARP)...', 'action');
  var filename = action.filename || 'document.pdf';
  var card = _evaGenCard('pdf', filename);
  try {
    if (!window.html2pdf) {
      await _loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js', 'html2pdf');
    }
    if (!window.MarpBundle) {
      await _loadScript('./js/lib/marp.bundle.min.js', 'marp');
    }

    var content = action.content || '';
    content = content.replace(/^\\s*\`\`\`(html|pdf|markdown|marp)\\s*/i, '').replace(/\\s*\`\`\`\\s*$/i, '');

    if (!content.includes('marp: true')) {
      content = "---\\nmarp: true\\ntheme: default\\npaginate: true\\n---\\n\\n" + content;
    }
    
    const marp = new window.MarpBundle.Marp({ html: true });
    const { html, css } = marp.render(content);

    var fullHtml = \`
      <style>
        \${css}
        section { page-break-after: always; box-shadow: none !important; margin: 0 !important; }
      </style>
      <div class="marpit" style="width: 100%; height: auto; min-width: 800px;">
        \${html}
      </div>
    \`;

    var container = document.createElement('div');
    container.innerHTML = fullHtml;
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    document.body.appendChild(container);
    
    if (action.type === 'marp_pptx' || action.type === 'pptx') {
      var standaloneHtml = \`<!DOCTYPE html><html><head><meta charset="utf-8"><title>\${filename}</title><style>\${css} body { margin: 0; padding: 0; display: flex; flex-direction: column; align-items: center; background: #333; } section { margin: 20px 0; box-shadow: 0 4px 10px rgba(0,0,0,0.5); }</style></head><body><div class="marpit">\${html}</div></body></html>\`;
      
      var blob = new Blob([standaloneHtml], { type: 'text/html' });
      var reader = new FileReader();
      reader.onloadend = function() {
        document.body.removeChild(container);
        var realFilename = filename.replace('.pptx', '.html');
        _evaFinalizeCard(card, 'code', reader.result, realFilename);
        setEvaStatus('Prêt', 'idle');
      };
      reader.readAsDataURL(blob);
      return;
    }

    var opt = {
      margin:       0,
      filename:     filename,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true },
      jsPDF:        { unit: 'in', format: 'letter', orientation: 'landscape' }
    };

    html2pdf().set(opt).from(container).output('datauristring').then(function(pdfAsString) {
      document.body.removeChild(container);
      _evaFinalizeCard(card, 'pdf', pdfAsString, filename);
      setEvaStatus('Prêt', 'idle');
    }).catch(function(err) {
      if(container.parentNode) document.body.removeChild(container);
      _evaFinalizeCard(card, 'pdf', null, filename, err.toString());
      setEvaStatus('Prêt', 'idle');
    });
  } catch (err) {
    _evaFinalizeCard(card, 'pdf', null, filename, err.toString());
    setEvaStatus('Prêt', 'idle');
  }
}

`;
    code = code.substring(0, pdfStart) + newPdf + code.substring(excelStart);
  }
  
  let pptxStart = code.indexOf('function _evaGeneratePptx(action) {');
  let txtStart = code.indexOf('function _evaGenerateTxt(action) {');
  if (pptxStart !== -1 && txtStart !== -1) {
    let newPptx = `async function _evaGeneratePptx(action) {
  action.type = 'marp_pptx';
  return _evaGeneratePdf(action);
}

`;
    code = code.substring(0, pptxStart) + newPptx + code.substring(txtStart);
  }
  
  fs.writeFileSync(targetPath, code, 'utf8');
}

patchFileGen('f:/code/eva/evaprojectmultiplatforme/EVA_V4_fixed_v4/js/app/file-gen.js');
patchFileGen('f:/code/eva/evaprojectmultiplatforme/eva-pc/web/js/app/file-gen.js');
