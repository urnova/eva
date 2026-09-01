const fs = require('fs');

function patchMessages(filePath) {
  if (!fs.existsSync(filePath)) return;
  let js = fs.readFileSync(filePath, 'utf8');

  // Add docs and images to msg
  let pushTarget = `var msg = {role: role, content: content, time: time};
    if (!S.messages) S.messages = [];
    S.messages.push(msg);`;
  let pushReplace = `var msg = {role: role, content: content, time: time};
    var images = Array.isArray(imgUrlOrArr) ? imgUrlOrArr : (imgUrlOrArr ? [{ url: imgUrlOrArr, name: 'image' }] : []);
    var docs = Array.isArray(docOrArr) ? docOrArr.filter(function(d){ return d && d.name; }) : (docOrArr && docOrArr.name ? [docOrArr] : []);
    if (images.length) msg.images = images;
    if (docs.length) msg.docs = docs;
    if (!S.messages) S.messages = [];
    S.messages.push(msg);`;
  
  if (js.includes("var msg = {role: role, content: content, time: time};")) {
    js = js.replace(pushTarget, pushReplace);
  }

  // Update docs rendering to add onclick
  let docsRenderTarget = `var chip = document.createElement('div');
          chip.className = 'msg-doc-multi';
          chip.innerHTML =
            '<span style="font-size:1.3em;flex-shrink:0;">' + icon + '</span>' +
            '<div style="display:flex;flex-direction:column;min-width:0;">' +
              '<span style="font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:180px;">' + esc(doc.name) + '</span>' +
              (doc.ext ? '<span style="font-size:0.68em;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;">' + doc.ext + (doc.size ? ' · ' + (doc.size > 1024*1024 ? (doc.size/(1024*1024)).toFixed(1)+' Mo' : Math.round(doc.size/1024)+' Ko') : '') + '</span>' : '') +
            '</div>';`;
  
  let docsRenderReplace = `var chip = document.createElement('div');
          chip.className = 'msg-doc-multi';
          chip.style.cursor = 'pointer';
          chip.onclick = function() { window.openDocumentViewer(doc); };
          chip.innerHTML =
            '<span style="font-size:1.3em;flex-shrink:0;">' + icon + '</span>' +
            '<div style="display:flex;flex-direction:column;min-width:0;">' +
              '<span style="font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:180px;">' + esc(doc.name) + '</span>' +
              (doc.ext ? '<span style="font-size:0.68em;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;">' + doc.ext + (doc.size ? ' · ' + (doc.size > 1024*1024 ? (doc.size/(1024*1024)).toFixed(1)+' Mo' : Math.round(doc.size/1024)+' Ko') : '') + '</span>' : '') +
            '</div>';`;
  
  // Also images onclick
  let imgTarget = `im.src = images[0].url || images[0]; im.className = 'msg-image'; im.alt = images[0].name || 'Image';`;
  let imgReplace = `im.src = images[0].url || images[0]; im.className = 'msg-image'; im.alt = images[0].name || 'Image';
        im.style.cursor = 'pointer';
        im.onclick = function() { window.openImageViewer(images[0].url || images[0]); };`;
  
  let imgsTarget = `var m = document.createElement('img');
          m.src = im.url || im; m.className = 'msg-image'; m.alt = im.name || 'Image';`;
  let imgsReplace = `var m = document.createElement('img');
          m.src = im.url || im; m.className = 'msg-image'; m.alt = im.name || 'Image';
          m.style.cursor = 'pointer';
          m.onclick = function() { window.openImageViewer(im.url || im); };`;
  
  // Simple regex for docRenderTarget because whitespace might differ
  js = js.replace(/var chip = document\.createElement\('div'\);\s*chip\.className = 'msg-doc-multi';\s*chip\.innerHTML =[\s\S]*?'<\/div>';/, docsRenderReplace);
  js = js.replace(imgTarget, imgReplace);
  js = js.replace(imgsTarget, imgsReplace);

  fs.writeFileSync(filePath, js, 'utf8');
}

patchMessages('EVA_V4_fixed_v4/js/app/messages.js');
