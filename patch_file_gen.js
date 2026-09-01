const fs = require('fs');
let js = fs.readFileSync('EVA_V4_fixed_v4/js/app/file-gen.js', 'utf8');

// Replace the download link with a clickable area that opens the viewer
let oldHtml = `    '<a href="' + blobUrl + '" download="' + filename + '" style="display:flex;align-items:center;justify-content:center;gap:8px;background:'+color+';color:#0a0a0c;text-decoration:none;font-size:0.75em;font-weight:700;border-radius:8px;padding:9px 16px;letter-spacing:0.03em;transition:opacity .15s;width:100%;box-sizing:border-box;" onmouseover="this.style.opacity=\\'0.85\\'" onmouseout="this.style.opacity=\\'1\\'">' +
      '<svg viewBox="0 0 24 24" style="width:13px;height:13px;fill:none;stroke:#0a0a0c;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round;flex-shrink:0;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>' +
      'Télécharger' +
    '</a>';`;

let newHtml = `    '<button onclick="window.openDocumentViewer({name: \\''+esc(filename)+'\\', ext: \\''+ext+'\\', url: \\''+blobUrl+'\\'})" style="display:flex;align-items:center;justify-content:center;gap:8px;background:'+color+';border:none;cursor:pointer;color:#0a0a0c;text-decoration:none;font-size:0.75em;font-weight:700;border-radius:8px;padding:9px 16px;letter-spacing:0.03em;transition:opacity .15s;width:100%;box-sizing:border-box;" onmouseover="this.style.opacity=\\'0.85\\'" onmouseout="this.style.opacity=\\'1\\'">' +
      '<svg viewBox="0 0 24 24" style="width:13px;height:13px;fill:none;stroke:#0a0a0c;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round;flex-shrink:0;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>' +
      'Visualiser' +
    '</button>';`;

if (js.includes(oldHtml)) {
  js = js.replace(oldHtml, newHtml);
  fs.writeFileSync('EVA_V4_fixed_v4/js/app/file-gen.js', js, 'utf8');
}
