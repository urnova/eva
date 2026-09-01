const fs = require('fs');

function fixFileGen(targetPath) {
  if (!fs.existsSync(targetPath)) return;
  let code = fs.readFileSync(targetPath, 'utf8');

  // Replace _evaFinalizeCard with _evaCardReady or error handling
  code = code.replace(/_evaFinalizeCard\(card, 'code', reader\.result, realFilename\);/g, 
    "_evaCardReady(card, 'html', realFilename, reader.result);");
    
  code = code.replace(/_evaFinalizeCard\(card, 'pdf', pdfAsString, filename\);/g, 
    "_evaCardReady(card, 'pdf', filename, pdfAsString);");
    
  code = code.replace(/_evaFinalizeCard\(card, 'pdf', null, filename, err\.toString\(\)\);/g, 
    "if (card) card.innerHTML = '<span style=\"color:#ff6b6b;font-size:0.75em;\"> Erreur : ' + err.toString() + '</span>';");

  fs.writeFileSync(targetPath, code, 'utf8');
}

fixFileGen('f:/code/eva/evaprojectmultiplatforme/EVA_V4_fixed_v4/js/app/file-gen.js');
fixFileGen('f:/code/eva/evaprojectmultiplatforme/eva-pc/web/js/app/file-gen.js');
