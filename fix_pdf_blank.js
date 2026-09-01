const fs = require('fs');

function fixBugs() {
  const fgPaths = [
    'f:/code/eva/evaprojectmultiplatforme/EVA_V4_fixed_v4/js/app/file-gen.js',
    'f:/code/eva/evaprojectmultiplatforme/eva-pc/web/js/app/file-gen.js'
  ];
  
  fgPaths.forEach(p => {
    if (fs.existsSync(p)) {
      let code = fs.readFileSync(p, 'utf8');
      
      // Fix html2pdf blank issue by passing HTML string directly instead of DOM element
      let containerPart = `
    var container = document.createElement('div');
    container.innerHTML = fullHtml;
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    document.body.appendChild(container);`;
      
      if(code.includes(containerPart)) {
         code = code.replace(containerPart, `
    // Use string directly for html2pdf
    var container = fullHtml;
    // But for pptx export we need DOM to extract standaloneHtml?
    // Actually standaloneHtml uses css and html strings directly.
    var tmpContainerForPptx = document.createElement('div');
    tmpContainerForPptx.innerHTML = fullHtml;
    // We only need it appended if we needed it visually. We don't append it for pdf rendering.
    `);
      }
      
      let cleanupPart = `document.body.removeChild(container);`;
      if(code.includes(cleanupPart)) {
         code = code.replace(cleanupPart, `// cleanup removed`);
      }
      
      let fromContainer = `html2pdf().set(opt).from(container).output`;
      if(code.includes(fromContainer)) {
         code = code.replace(fromContainer, `html2pdf().set(opt).from(fullHtml).output`);
      }
      
      fs.writeFileSync(p, code, 'utf8');
      console.log('Fixed file-gen in ' + p);
    }
  });

  const mPaths = [
    'f:/code/eva/evaprojectmultiplatforme/EVA_V4_fixed_v4/js/app/messages.js',
    'f:/code/eva/evaprojectmultiplatforme/eva-pc/web/js/app/messages.js'
  ];
  
  mPaths.forEach(p => {
    if (fs.existsSync(p)) {
      let code = fs.readFileSync(p, 'utf8');
      
      // Fix prompt for filenames
      code = code.replace(/"type":"marp_pdf","filename":"doc.pdf"/g, `"type":"marp_pdf","filename":"NOM_DOCUMENT.pdf"`);
      code = code.replace(/"type":"marp_pptx","filename":"p.pptx"/g, `"type":"marp_pptx","filename":"NOM_PRESENTATION.pptx"`);
      
      // Tell her to choose a descriptive name
      code = code.replace(`'- PDF (Marp)`, `'- RÈGLE PDF/PPTX : Remplace NOM_DOCUMENT par un nom de fichier pertinent (ex: synthese_reunion.pdf).\\n' +\n          '- PDF (Marp)`);
      
      fs.writeFileSync(p, code, 'utf8');
      console.log('Fixed messages in ' + p);
    }
  });
}

fixBugs();
