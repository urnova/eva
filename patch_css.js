const fs = require('fs');

function updateCSS(filePath) {
  if (!fs.existsSync(filePath)) return;
  let css = fs.readFileSync(filePath, 'utf8');

  // Redesign doc card
  css = css.replace(/\.attach-doc-card\{[\s\S]*?\}\s*\.attach-doc-card \.attach-doc-icon\{[\s\S]*?\}\s*\.attach-doc-card \.attach-doc-info\{[\s\S]*?\}\s*\.attach-doc-card \.attach-doc-name\{[\s\S]*?\}\s*\.attach-doc-card \.attach-doc-meta\{[\s\S]*?\}\s*\.attach-doc-card \.attach-doc-ext\{[\s\S]*?\}\s*\.attach-doc-card \.attach-doc-size\{[\s\S]*?\}\s*\.attach-doc-card \.attach-doc-loading\{[\s\S]*?\}\s*\.attach-doc-card \.attach-remove\{[\s\S]*?\}/, 
  `.attach-doc-card{
    display:inline-flex;align-items:center;gap:10px;
    padding:8px 14px 8px 10px;border-radius:12px;
    background:var(--surface2);
    border:1px solid var(--border);
    position:relative;max-width:240px;
    box-shadow:0 4px 12px rgba(0,0,0,0.2);
    transition:transform 0.2s, border-color 0.2s;
  }
  .attach-doc-card:hover { transform: translateY(-2px); border-color: rgba(0,212,255,0.4); }
  .attach-doc-card .attach-doc-icon{font-size:1.8em;flex-shrink:0;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));}
  .attach-doc-card .attach-doc-info{display:flex;flex-direction:column;gap:2px;min-width:0;}
  .attach-doc-card .attach-doc-name{
    font-size:0.75em;font-weight:600;color:var(--text);
    overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:140px;
  }
  .attach-doc-card .attach-doc-meta{display:flex;align-items:center;gap:6px;}
  .attach-doc-card .attach-doc-ext{
    font-size:0.55em;text-transform:uppercase;letter-spacing:0.5px;
    padding:2px 5px;border-radius:4px;
    background:rgba(0,212,255,0.15);color:var(--cyan);font-weight:800;
  }
  .attach-doc-card .attach-doc-size{font-size:0.65em;color:var(--text-muted);}
  .attach-doc-card .attach-doc-loading{font-size:0.7em;color:var(--cyan);animation:dotBlink 1.2s ease-in-out infinite;}
  .attach-doc-card .attach-remove{
    position:absolute;top:-8px;right:-8px;
    background:var(--bg);border:1px solid var(--border);color:#aaa;
    border-radius:50%;width:22px;height:22px;
    display:flex;align-items:center;justify-content:center;
    font-size:12px;cursor:pointer;transition:all 0.2s;
    box-shadow:0 2px 5px rgba(0,0,0,0.5);
  }
  .attach-doc-card .attach-remove:hover { background: rgba(248,113,113,0.9); border-color: rgba(248,113,113,1); color: #fff; }`);

  // Redesign img card
  css = css.replace(/\.attach-img-card\{[\s\S]*?\}\s*\.attach-img-card img\{[\s\S]*?\}\s*\.attach-img-card \.attach-remove\{[\s\S]*?\}\s*\.attach-img-card \.attach-name\{[\s\S]*?\}/,
  `.attach-img-card{
    position:relative;display:inline-flex;flex-direction:column;align-items:center;gap:4px;
    width:70px;
  }
  .attach-img-card img{
    width:70px;height:70px;object-fit:cover;border-radius:12px;
    border:1px solid var(--border);
    box-shadow:0 4px 12px rgba(0,0,0,0.2);
    transition:transform 0.2s, border-color 0.2s;
  }
  .attach-img-card img:hover { transform: translateY(-2px); border-color: rgba(0,212,255,0.4); }
  .attach-img-card .attach-remove{
    position:absolute;top:-6px;right:-6px;
    background:var(--bg);border:1px solid var(--border);color:#aaa;
    border-radius:50%;width:20px;height:20px;
    display:flex;align-items:center;justify-content:center;
    font-size:10px;cursor:pointer;transition:all 0.2s;
    box-shadow:0 2px 5px rgba(0,0,0,0.5);
  }
  .attach-img-card .attach-remove:hover { background: rgba(248,113,113,0.9); border-color: rgba(248,113,113,1); color: #fff; }
  .attach-img-card .attach-name{
    font-size:0.6em;color:var(--text-muted);
    overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%;
  }`);

  fs.writeFileSync(filePath, css, 'utf8');
}

updateCSS('EVA_V4_fixed_v4/assets/styles/chat.css');
