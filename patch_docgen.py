import sys
sys.stdout.reconfigure(encoding='utf-8')
import os

def patch_file_gen(path):
    with open(path, 'r', encoding='utf-8-sig') as f:
        c = f.read()

    # ── 1. Add 'pdf' type to executeEvaAction ──────────────────────────────
    old_exec = "    } else if (action.type === 'marp_pdf') {\r\n      _evaGeneratePdf(action);\r\n\r\n    } else if (action.type === 'pptx') {"
    new_exec = "    } else if (action.type === 'marp_pdf') {\r\n      _evaGeneratePdf(action);\r\n\r\n    } else if (action.type === 'pdf') {\r\n      _evaGenerateHtmlPdf(action);\r\n\r\n    } else if (action.type === 'pptx') {"

    if old_exec in c:
        c = c.replace(old_exec, new_exec)
        print('  OK: added pdf type to executeEvaAction')
    else:
        print('  WARN: pdf type injection not matched, trying LF version')
        old_exec2 = "    } else if (action.type === 'marp_pdf') {\n      _evaGeneratePdf(action);\n\n    } else if (action.type === 'pptx') {"
        new_exec2 = "    } else if (action.type === 'marp_pdf') {\n      _evaGeneratePdf(action);\n\n    } else if (action.type === 'pdf') {\n      _evaGenerateHtmlPdf(action);\n\n    } else if (action.type === 'pptx') {"
        if old_exec2 in c:
            c = c.replace(old_exec2, new_exec2)
            print('  OK: added pdf type to executeEvaAction (LF)')
        else:
            print('  ERROR: could not inject pdf type')

    # ── 2. Rewrite _evaGeneratePptx to use PptxGenJS ──────────────────────
    old_pptx = "async function _evaGeneratePptx(action) {\r\n  action.type = 'marp_pptx';\r\n  return _evaGeneratePdf(action);\r\n}"
    if old_pptx not in c:
        old_pptx = "async function _evaGeneratePptx(action) {\n  action.type = 'marp_pptx';\n  return _evaGeneratePdf(action);\n}"

    new_pptx = r"""async function _evaGeneratePptx(action) {
  setEvaStatus('GÉNÉRATION POWERPOINT…', 'action');
  var filename = action.filename || 'presentation.pptx';
  if (!filename.toLowerCase().endsWith('.pptx')) filename += '.pptx';
  var card = _evaGenCard('pptx', filename);
  try {
    if (typeof PptxGenJS === 'undefined') {
      await _loadScript('./js/lib/pptxgen.bundle.js', 'PptxGenJS');
    }
    var pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_16x9';
    pptx.author = 'EVA Assistant';
    pptx.title = action.title || filename.replace('.pptx','');

    var slides = action.slides || [];
    if (!slides.length) slides = [{title: action.title || 'Présentation', points: []}];

    slides.forEach(function(s, idx) {
      var slide = pptx.addSlide();

      /* Fond sombre EVA */
      slide.addShape(pptx.ShapeType.rect, { x:0, y:0, w:'100%', h:'100%', fill:{color:'0d0d1a'} });
      /* Barre d'accent cyan */
      slide.addShape(pptx.ShapeType.rect, { x:0, y:0, w:0.07, h:'100%', fill:{color:'00d4ff'} });
      /* Ligne séparatrice sous le titre */
      slide.addShape(pptx.ShapeType.rect, { x:0.3, y:1.3, w:9.2, h:0.025, fill:{color:'1e3a5f'} });

      /* Titre */
      if (s.title) {
        slide.addText(s.title, {
          x:0.3, y:0.2, w:9.2, h:1.0,
          fontSize: idx===0 ? 34 : 26, bold:true,
          color:'00d4ff', fontFace:'Calibri Light', valign:'middle'
        });
      }

      /* Contenu / bullet points */
      var yContent = 1.45, hContent = 3.15;
      if (s.subtitle) {
        slide.addText(s.subtitle, {
          x:0.3, y:1.4, w:9.2, h:0.5,
          fontSize:16, color:'9999cc', italic:true, fontFace:'Calibri'
        });
        yContent = 2.0; hContent = 2.6;
      }

      if (s.points && s.points.length) {
        var lines = s.points.map(function(p) {
          return {
            text: p,
            options: {
              bullet: {indent:15, color:'00d4ff'},
              paraSpaceAfter: 7,
              color: 'dde0f5',
              fontSize: 17,
              fontFace: 'Calibri'
            }
          };
        });
        slide.addText(lines, { x:0.3, y:yContent, w:9.2, h:hContent, valign:'top' });
      } else if (s.content) {
        slide.addText(s.content, {
          x:0.3, y:yContent, w:9.2, h:hContent,
          fontSize:17, color:'dde0f5', fontFace:'Calibri', valign:'top', wrap:true
        });
      }

      /* Numéro de slide */
      slide.addText(String(idx+1)+'/'+slides.length, {
        x:8.8, y:4.82, w:0.7, h:0.22,
        fontSize:9, color:'445577', align:'right'
      });
    });

    pptx.write({outputType:'blob'}).then(function(blob) {
      var url = URL.createObjectURL(blob);
      toast('PowerPoint prêt : '+filename, 'success');
      setEvaStatus('PPTX CRÉÉ', 'action');
      setTimeout(function(){ setEvaStatus(null); }, 3000);
      _evaCardReady(card, 'pptx', filename, url);
    }).catch(function(err) {
      console.error('[EVA PPTX]', err);
      if (card) card.innerHTML = '<span style="color:#ff6b6b;font-size:0.75em;">❌ Erreur PPTX : '+err.message+'</span>';
      setEvaStatus(null);
    });
  } catch(e) {
    console.error('[EVA PPTX]', e);
    toast('Erreur génération PowerPoint : '+e.message, 'error');
    if (card) card.innerHTML = '<span style="color:#ff6b6b;font-size:0.75em;">❌ Erreur : '+e.message+'</span>';
    setEvaStatus(null);
  }
}"""

    if old_pptx in c:
        c = c.replace(old_pptx, new_pptx)
        print('  OK: _evaGeneratePptx rewritten with PptxGenJS')
    else:
        print('  ERROR: _evaGeneratePptx old pattern not found')

    # ── 3. Add _evaGenerateHtmlPdf BEFORE _evaGenerateExcel ───────────────
    anchor = "function _evaGenerateExcel(action) {"
    new_html_pdf = r"""function _evaGenerateHtmlPdf(action) {
  setEvaStatus('GÉNÉRATION PDF…', 'action');
  var filename = action.filename || 'document.pdf';
  if (!filename.toLowerCase().endsWith('.pdf')) filename += '.pdf';
  var card = _evaGenCard('pdf', filename);
  try {
    var htmlContent = action.content || '';
    /* Strip possible code fences */
    htmlContent = htmlContent.replace(/^```[a-z]*\n?/i,'').replace(/\n?```$/,'');
    if (!htmlContent.trim()) {
      if (card) card.innerHTML = '<span style="color:#ff6b6b;font-size:0.75em;">❌ Contenu HTML manquant</span>';
      setEvaStatus(null); return;
    }
    /* Inject print CSS if not already present */
    if (!htmlContent.includes('@media print')) {
      htmlContent = htmlContent.replace('</head>',
        '<style>@media print{body{margin:0}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}}' +
        'body{max-width:900px;margin:30px auto;font-family:Georgia,serif}</style></head>');
    }
    var blob = new Blob([htmlContent], {type:'text/html;charset=utf-8'});
    var url = URL.createObjectURL(blob);
    toast('PDF prêt : '+filename, 'success');
    setEvaStatus('PDF CRÉÉ', 'action');
    setTimeout(function(){ setEvaStatus(null); }, 3000);
    /* Store as html ext so the viewer uses iframe */
    _evaCardReady(card, 'pdf', filename, url);
    /* Override: mark internally so viewer uses iframe */
    window._lastPdfUrl = url;
  } catch(e) {
    console.error('[EVA PDF]', e);
    toast('Erreur génération PDF : '+e.message, 'error');
    if (card) card.innerHTML = '<span style="color:#ff6b6b;font-size:0.75em;">❌ Erreur : '+e.message+'</span>';
    setEvaStatus(null);
  }
}

"""
    if anchor in c:
        c = c.replace(anchor, new_html_pdf + anchor)
        print('  OK: _evaGenerateHtmlPdf added before _evaGenerateExcel')
    else:
        print('  ERROR: anchor _evaGenerateExcel not found')

    with open(path, 'w', encoding='utf-8') as f:
        f.write(c)
    print('  Saved:', path)


def patch_core_js(path):
    with open(path, 'r', encoding='utf-8-sig') as f:
        c = f.read()

    # ── 4. Fix HTML viewer (use iframe) ──────────────────────────────────
    old_viewer = "    } else if (['js', 'html', 'css', 'json', 'txt', 'csv', 'md'].includes(doc.ext)) {\r\n      content.style.display = 'block';\r\n      content.style.fontFamily = \"'Space Mono', monospace\";\r\n      if (doc.text) {\r\n        content.textContent = doc.text;\r\n      } else {\r\n        // Fetch text from blob URL\r\n        fetch(doc.url).then(r => r.text()).then(t => { content.textContent = t; });\r\n      }"
    new_viewer = "    } else if (doc.ext === 'html') {\r\n      /* HTML → render in iframe so the user sees the actual page */\r\n      iframe.src = doc.url;\r\n      iframe.style.display = 'block';\r\n    } else if (['js', 'css', 'json', 'txt', 'csv', 'md'].includes(doc.ext)) {\r\n      content.style.display = 'block';\r\n      content.style.fontFamily = \"'Space Mono', monospace\";\r\n      if (doc.text) {\r\n        content.textContent = doc.text;\r\n      } else {\r\n        // Fetch text from blob URL\r\n        fetch(doc.url).then(r => r.text()).then(t => { content.textContent = t; });\r\n      }"

    if old_viewer in c:
        c = c.replace(old_viewer, new_viewer)
        print('  OK: HTML viewer fixed (iframe)')
    else:
        # LF fallback
        old_viewer2 = "    } else if (['js', 'html', 'css', 'json', 'txt', 'csv', 'md'].includes(doc.ext)) {\n      content.style.display = 'block';\n      content.style.fontFamily = \"'Space Mono', monospace\";\n      if (doc.text) {\n        content.textContent = doc.text;\n      } else {\n        // Fetch text from blob URL\n        fetch(doc.url).then(r => r.text()).then(t => { content.textContent = t; });\n      }"
        new_viewer2 = "    } else if (doc.ext === 'html') {\n      /* HTML → render in iframe so the user sees the actual page */\n      iframe.src = doc.url;\n      iframe.style.display = 'block';\n    } else if (['js', 'css', 'json', 'txt', 'csv', 'md'].includes(doc.ext)) {\n      content.style.display = 'block';\n      content.style.fontFamily = \"'Space Mono', monospace\";\n      if (doc.text) {\n        content.textContent = doc.text;\n      } else {\n        // Fetch text from blob URL\n        fetch(doc.url).then(r => r.text()).then(t => { content.textContent = t; });\n      }"
        if old_viewer2 in c:
            c = c.replace(old_viewer2, new_viewer2)
            print('  OK: HTML viewer fixed (iframe, LF)')
        else:
            print('  ERROR: HTML viewer old pattern not found')

    # ── 5. Fix system prompt: PDF and PPTX instructions ───────────────────
    # Replace the old contradictory PDF/PPTX instructions with clean ones
    old_prompt = "OUTILS DE CRÉATION DE FICHIERS — RÈGLES ABSOLUES :\r\n⚠️ INTERDIT : Ne génère JAMAIS de lien markdown de téléchargement tel que [Télécharger](sandbox:/...) ou (file://...) ou tout autre URL fictive.\r\n⚠️ INTERDIT : Ne mets JAMAIS le contenu d'un fichier dans un bloc de code (\\`\\`\\`pptx, \\`\\`\\`pdf, \\`\\`\\`xlsx, etc.). Ces blocs ne génèrent pas de fichiers.\r\n⚠️ OBLIGATOIRE : La SEULE façon valide de créer un fichier est le bloc [ACTION:{...}] ci-dessous."
    new_prompt = "OUTILS DE CRÉATION DE FICHIERS — RÈGLES ABSOLUES :\r\n⚠️ INTERDIT : Ne génère JAMAIS de lien markdown de téléchargement tel que [Télécharger](sandbox:/...) ou (file://...) ou toute autre URL fictive.\r\n⚠️ OBLIGATOIRE : La SEULE façon valide de créer un fichier est le bloc [ACTION:{...}] ci-dessous.\r\n⚠️ NOM DESCRIPTIF OBLIGATOIRE : Utilise TOUJOURS un nom de fichier descriptif lié au contenu (ex: \"rapport_ventes_2024.pdf\"). INTERDITS : \"document.pdf\", \"présentation-test.pptx\", \"fichier.txt\", etc."

    if old_prompt in c:
        c = c.replace(old_prompt, new_prompt)
        print('  OK: system prompt header updated')
    else:
        print('  WARN: old prompt header not found, trying alternative')

    # Replace the PDF + PPTX instruction lines
    old_pdf_inst = "- Pour un PDF : Pour créer un PDF, ne génère PAS de bloc ACTION JSON. Utilise simplement le bloc de code markdown suivant et écris dedans une page HTML complète, stylisée avec CSS inline, pensée pour un rendu A4. N'ajoute pas de texte avant ou après.\r\n\\`\\`\\`pdf\r\n<!DOCTYPE html>\r\n<html><head><style>body { font-family: sans-serif; color: #333; margin: 40px; } h1 { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; }</style></head>\r\n<body><h1>Titre</h1><p>Contenu magnifique ici...</p></body></html>\r\n\\`\\`\\`\r\n- Pour un fichier Excel : [ACTION:{\"type\":\"excel\",\"filename\":\"données.xlsx\",\"title\":\"Titre\",\"headers\":[\"Colonne1\",\"Colonne2\",\"Colonne3\"],\"rows\":[[\"val1\",\"val2\",\"val3\"],[\"val4\",\"val5\",\"val6\"]]}]\r\n- Pour un PowerPoint : [ACTION:{\"type\":\"pptx\",\"filename\":\"présentation.pptx\",\"title\":\"Titre\",\"slides\":[{\"title\":\"Titre diapo 1\",\"points\":[\"Point 1\",\"Point 2\",\"Point 3\"]},{\"title\":\"Titre diapo 2\",\"points\":[\"Élément A\",\"Élément B\"]}]}]\r\n- Pour un fichier texte : [ACTION:{\"type\":\"txt\",\"filename\":\"fichier.txt\",\"content\":\"Contenu texte du fichier\"}]\r\n- Pour un CSV : [ACTION:{\"type\":\"csv\",\"filename\":\"données.csv\",\"headers\":[\"Col1\",\"Col2\"],\"rows\":[[\"a\",\"b\"],[\"c\",\"d\"]]}]"
    new_pdf_inst = "- Pour un PDF (HTML stylisé) : [ACTION:{\"type\":\"pdf\",\"filename\":\"nom_descriptif.pdf\",\"content\":\"<!DOCTYPE html><html><head><style>body{font-family:Georgia,serif;color:#222;max-width:780px;margin:40px auto;line-height:1.7}h1{color:#1a2e5a;border-bottom:3px solid #3498db;padding-bottom:10px}h2{color:#2c3e50;margin-top:24px}p{margin:10px 0}ul{padding-left:20px}table{width:100%;border-collapse:collapse}th{background:#3498db;color:white;padding:10px;text-align:left}td{padding:8px;border:1px solid #ddd}</style></head><body><h1>Titre du document</h1><p>Contenu complet et détaillé ici. Utilise du HTML riche avec titres, listes, tableaux, couleurs CSS pour un rendu professionnel et beau.</p></body></html>\"}]\r\n- Pour un fichier Excel : [ACTION:{\"type\":\"excel\",\"filename\":\"données_descriptif.xlsx\",\"title\":\"Titre\",\"headers\":[\"Colonne1\",\"Colonne2\",\"Colonne3\"],\"rows\":[[\"val1\",\"val2\",\"val3\"],[\"val4\",\"val5\",\"val6\"]]}]\r\n- Pour un PowerPoint : [ACTION:{\"type\":\"pptx\",\"filename\":\"presentation_descriptif.pptx\",\"title\":\"Titre\",\"slides\":[{\"title\":\"Titre diapo 1\",\"points\":[\"Point 1\",\"Point 2\",\"Point 3\"]},{\"title\":\"Diapo 2\",\"content\":\"Texte libre pour cette diapositive\"},{\"title\":\"Conclusion\",\"subtitle\":\"Sous-titre optionnel\",\"points\":[\"Point A\",\"Point B\"]}]}]\r\n- Pour un fichier texte : [ACTION:{\"type\":\"txt\",\"filename\":\"fichier_descriptif.txt\",\"content\":\"Contenu texte du fichier\"}]\r\n- Pour un CSV : [ACTION:{\"type\":\"csv\",\"filename\":\"données_descriptif.csv\",\"headers\":[\"Col1\",\"Col2\"],\"rows\":[[\"a\",\"b\"],[\"c\",\"d\"]]}]"

    if old_pdf_inst in c:
        c = c.replace(old_pdf_inst, new_pdf_inst)
        print('  OK: PDF/PPTX system prompt updated')
    else:
        # Try without \r
        old_pdf_inst2 = old_pdf_inst.replace('\r\n', '\n')
        new_pdf_inst2 = new_pdf_inst.replace('\r\n', '\n')
        if old_pdf_inst2 in c:
            c = c.replace(old_pdf_inst2, new_pdf_inst2)
            print('  OK: PDF/PPTX system prompt updated (LF)')
        else:
            print('  ERROR: PDF/PPTX system prompt pattern not found — applying partial fix')
            # At minimum, fix the contradiction by updating the PDF line only
            c = c.replace(
                "- Pour un PowerPoint : [ACTION:{\"type\":\"pptx\",\"filename\":\"présentation.pptx\",\"title\":\"Titre\",\"slides\":[{\"title\":\"Titre diapo 1\",\"points\":[\"Point 1\",\"Point 2\",\"Point 3\"]},{\"title\":\"Titre diapo 2\",\"points\":[\"Élément A\",\"Élément B\"]}]}]",
                "- Pour un PowerPoint : [ACTION:{\"type\":\"pptx\",\"filename\":\"presentation_descriptif.pptx\",\"title\":\"Titre\",\"slides\":[{\"title\":\"Titre diapo 1\",\"points\":[\"Point 1\",\"Point 2\",\"Point 3\"]},{\"title\":\"Diapo 2\",\"content\":\"Texte libre\"},{\"title\":\"Conclusion\",\"points\":[\"Point A\",\"Point B\"]}]}]"
            )
            print('  partial PPTX instruction updated')

    with open(path, 'w', encoding='utf-8') as f:
        f.write(c)
    print('  Saved:', path)


# ── Apply to web files ────────────────────────────────────────────────────
web_root = r'f:\code\eva\evaprojectmultiplatforme\EVA_V4_fixed_v4'
pc_root  = r'f:\code\eva\evaprojectmultiplatforme\eva-pc\web'

print('\n=== Patching WEB file-gen.js ===')
patch_file_gen(os.path.join(web_root, 'js', 'app', 'file-gen.js'))

print('\n=== Patching PC file-gen.js ===')
patch_file_gen(os.path.join(pc_root, 'js', 'app', 'file-gen.js'))

print('\n=== Patching WEB core.js ===')
patch_core_js(os.path.join(web_root, 'js', 'app', 'core.js'))

print('\n=== Patching PC core.js ===')
patch_core_js(os.path.join(pc_root, 'js', 'app', 'core.js'))

print('\nDONE')
