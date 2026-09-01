const fs = require('fs');

function patchFileGen() {
  const paths = [
    'f:/code/eva/evaprojectmultiplatforme/EVA_V4_fixed_v4/js/app/file-gen.js',
    'f:/code/eva/evaprojectmultiplatforme/eva-pc/web/js/app/file-gen.js'
  ];
  
  const pptxLogicNew = `    var mainTitle = action.title || filename.replace(/\\.pptx$/i, '');
    var slides = action.slides || [];
    if (!Array.isArray(slides) || !slides.length) {
      slides = [{ title: mainTitle, points: action.content ? action.content.split('\\n').filter(function(l){ return l.trim(); }) : ['Contenu'] }];
    }
    
    var theme = action.theme || 'corporate';
    
    // Themes definition
    var themes = {
      corporate: { bgCover: 'FFFFFF', bgSlide: 'F8F9FA', accent: '0056B3', text: '333333', dim: '6C757D', font: 'Helvetica' },
      minimal: { bgCover: 'FFFFFF', bgSlide: 'FFFFFF', accent: '000000', text: '000000', dim: '888888', font: 'Arial' },
      modern: { bgCover: '0E0E12', bgSlide: '111113', accent: '7B8BF5', text: 'D8D9E8', dim: '5A5A72', font: 'Calibri' }
    };
    var t = themes[theme] || themes['corporate'];

    pptx.defineSlideMaster({
      title: "MASTER_COVER",
      background: { color: t.bgCover },
      objects: [
        { rect: { x:0, y:0, w:0.18, h:7.5, fill:{ color: t.accent } } },
        { rect: { x:0, y:7.22, w:13.33, h:0.28, fill:{ color: t.accent } } },
        { placeholder: { options: { name: "title", type: "title", x:0.48, y:2.0, w:12.3, h:2.2, fontSize:42, bold:true, color: t.accent, fontFace: t.font, align:'left' }, text: "" } },
        { placeholder: { options: { name: "subtitle", type: "body", x:0.48, y:4.3, w:12.3, h:1.0, fontSize:20, color: t.dim, fontFace: t.font, align:'left' }, text: "" } }
      ]
    });

    pptx.defineSlideMaster({
      title: "MASTER_SLIDE",
      background: { color: t.bgSlide },
      objects: [
        { rect: { x:0, y:0, w:13.33, h:0.08, fill:{ color: t.accent } } },
        { placeholder: { options: { name: "title", type: "title", x:0.5, y:0.4, w:12.3, h:0.8, fontSize:32, bold:true, color: t.accent, fontFace: t.font }, text: "" } },
        { placeholder: { options: { name: "body", type: "body", x:0.5, y:1.5, w:12.3, h:5.5, fontSize:18, color: t.text, fontFace: t.font, valign:'top' }, text: "" } }
      ]
    });

    if (slides.length > 1) {
      var cover = pptx.addSlide({ masterName: "MASTER_COVER" });
      cover.addText([{text: mainTitle}], { placeholder: "title" });
      cover.addText([{text: 'Présenté par E.V.A - Astral Technologie'}], { placeholder: "subtitle" });
    }

    slides.forEach(function(sData, i) {
      var s = pptx.addSlide({ masterName: "MASTER_SLIDE" });
      if (sData.title) s.addText([{text: sData.title}], { placeholder: "title" });
      
      var content = sData.content || (sData.points && sData.points.join('\\n')) || '';
      if (content) {
        var lines = content.split('\\n');
        var textObjs = lines.map(function(l) {
          var isBullet = l.trim().startsWith('-') || l.trim().startsWith('*');
          var txt = l.replace(/^[-*]\\s*/, '').trim();
          return { text: txt, options: { bullet: isBullet } };
        });
        s.addText(textObjs, { placeholder: "body" });
      }
    });

`;

    paths.forEach(p => {
      if (fs.existsSync(p)) {
        let code = fs.readFileSync(p, 'utf8');
        
        let startIdx = code.indexOf(`var mainTitle = action.title || filename.replace(/\\.pptx$/i, '');`);
        let endIdx = code.indexOf(`/* %criture */`);
        if (endIdx === -1) endIdx = code.indexOf(`/* \u00C9criture */`);
        if (endIdx === -1) endIdx = code.indexOf(`var writeResult = pptx.write`);
        
        if (startIdx !== -1 && endIdx !== -1) {
          code = code.substring(0, startIdx) + pptxLogicNew + "      " + code.substring(endIdx);
          fs.writeFileSync(p, code, 'utf8');
          console.log('Patched PPTX in ' + p);
        } else {
          console.log('Failed to patch PPTX in ' + p);
        }
      }
    });
}

patchFileGen();
