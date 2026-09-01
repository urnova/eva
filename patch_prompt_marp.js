const fs = require('fs');

function patchPrompt(targetPath) {
  if (!fs.existsSync(targetPath)) return;
  let code = fs.readFileSync(targetPath, 'utf8');

  // Replace old PDF/PPTX instructions with Marp instructions
  let targetOld = \`---
- POUR LES DOCUMENTS (PDF/PPTX) : 
  - Produis toujours le r\\u00e9sultat final du document.
  - Tu as 3 th\\u00e8mes \`;
  
  let newInstr = \`---
- POUR LES PRÉSENTATIONS ET PDF (MARP) : 
  - Tu utilises désormais le moteur MARP pour générer des PDF et des diaporamas professionnels.
  - Utilise le format Markdown compatible Marp. Ajoute le frontmatter suivant au début :
    ---
    marp: true
    theme: default
    paginate: true
    backgroundColor: #ffffff
    ---
  - Sépare tes diapositives (ou pages) avec \`---\`.
  - Utilise les balises Markdown pour les titres (#), les images, les listes, etc.
  - Produis toujours le résultat final du document, prêt à être affiché, encapsulé dans un bloc \\\`\\\`\\\`pdf ... \\\`\\\`\\\`. (Ou pptx).
  - Sois extrêmement soigné sur la mise en page. Tu peux utiliser des balises HTML si nécessaire.
\`;

  // We need a smart replace because the old text might have accents encoded differently
  code = code.replace(/- POUR LES DOCUMENTS \(PDF\/PPTX\) :[\\s\\S]*?(?=- POUR L'UI)/, newInstr);

  fs.writeFileSync(targetPath, code, 'utf8');
}

patchPrompt('f:/code/eva/evaprojectmultiplatforme/EVA_V4_fixed_v4/js/ai/providers.js');
patchPrompt('f:/code/eva/evaprojectmultiplatforme/eva-pc/web/js/ai/providers.js');
