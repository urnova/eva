const fs = require('fs');

function patchFileGen(targetPath) {
  if (!fs.existsSync(targetPath)) return;
  let code = fs.readFileSync(targetPath, 'utf8');

  // Replace PDF generation body to use Marp
  let pdfStart = code.indexOf('async function _evaGeneratePdf(action) {');
  let pdfEnd = code.indexOf('async function _evaGenerateCode(action) {');
  
  if (pdfStart !== -1 && pdfEnd !== -1) {
    let newPdf = `async function _evaGeneratePdf(action) {
  setEvaStatus('GÉNÉRATION PDF...', 'action');
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

    // Render with Marp
    const marp = new window.MarpBundle.Marp({ html: true });
    
    // Check if it has Marp frontmatter, if not, add it
    if (!content.includes('marp: true')) {
      content = "---\\nmarp: true\\ntheme: default\\n---\\n\\n" + content;
    }
    
    const { html, css } = marp.render(content);

    var fullHtml = \`
      <style>\${css}</style>
      <div class="marpit" style="width: 100%; height: auto;">
        \${html}
      </div>
    \`;

    var container = document.createElement('div');
    container.innerHTML = fullHtml;
    // Marp generates <svg> slides, html2pdf will render them.
    
    var opt = {
      margin:       0,
      filename:     filename,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true },
      jsPDF:        { unit: 'in', format: 'letter', orientation: 'landscape' }
    };

    html2pdf().set(opt).from(container).output('datauristring').then(function(pdfAsString) {
      _evaFinalizeCard(card, 'pdf', pdfAsString, filename);
      setEvaStatus('Prêt', 'idle');
    }).catch(function(err) {
      _evaFinalizeCard(card, 'pdf', null, filename, err.toString());
      setEvaStatus('Prêt', 'idle');
    });
  } catch (err) {
    _evaFinalizeCard(card, 'pdf', null, filename, err.toString());
    setEvaStatus('Prêt', 'idle');
  }
}
`;
    code = code.substring(0, pdfStart) + newPdf + '\\n' + code.substring(pdfEnd);
  }
  
  // Replace PPTX generation body to use Marp (HTML) or tell the user it's an HTML presentation
  // Actually, for PPTX, PptxGenJS can't easily parse Marp. But since they want Marp, we can save Marp as an HTML Presentation for them?
  // Wait, the user specifically wants PPTX! "PowerPoint visuellement soignées... PPTX".
  // What if we generate Marp HTML, and save it as an HTML file but with PPTX extension? Windows will reject it.
  // We can't generate native PPTX from Marp in the browser. 
  // Let's implement Presenton for PPTX and Marp for PDF! 
  
  fs.writeFileSync(targetPath, code, 'utf8');
}

patchFileGen('f:/code/eva/evaprojectmultiplatforme/EVA_V4_fixed_v4/js/app/file-gen.js');
patchFileGen('f:/code/eva/evaprojectmultiplatforme/eva-pc/web/js/app/file-gen.js');
