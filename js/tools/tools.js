(function () {
'use strict';

/* ═══════════════════════════════════════════════════════════════════════
   EVA TOOLS ENGINE — 8 outils gratuits, 100% client-side
   ═══════════════════════════════════════════════════════════════════════ */

/* ── Active panel tracker ── */
var activePanel = null;

function openTool(id) {
  if (activePanel) closeToolPanel(activePanel);
  var p = document.getElementById('tp-' + id);
  if (!p) return;
  p.classList.add('open');
  activePanel = id;
}
function closeToolPanel(id) {
  var p = document.getElementById('tp-' + (id || activePanel));
  if (p) p.classList.remove('open');
  if (!id || id === activePanel) activePanel = null;
}
window.openTool = openTool;
window.closeToolPanel = closeToolPanel;

/* ── Utility: download blob ── */
function downloadBlob(blob, filename) {
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
}

/* ── Utility: readable bytes ── */
function fmtBytes(b) {
  if (b < 1024) return b + ' o';
  if (b < 1048576) return (b / 1024).toFixed(1) + ' Ko';
  return (b / 1048576).toFixed(2) + ' Mo';
}

/* ── Utility: copy to clipboard ── */
function copyText(text, btn) {
  navigator.clipboard.writeText(text).then(function () {
    var orig = btn.textContent;
    btn.textContent = '✓ Copié !';
    setTimeout(function () { btn.textContent = orig; }, 1800);
  });
}

/* ── CDN loader (lazy) ── */
var _loaded = {};
function loadScript(url) {
  if (_loaded[url]) return Promise.resolve();
  return new Promise(function (res, rej) {
    var s = document.createElement('script');
    s.src = url; s.onload = function () { _loaded[url] = true; res(); };
    s.onerror = rej; document.head.appendChild(s);
  });
}

/* ═══════════════════════════════════════════════════════════════════════
   1. SUPPRESSION DE FOND
   ═══════════════════════════════════════════════════════════════════════ */
function initBgRemover() {
  var dz  = document.getElementById('bgDrop');
  var inp = document.getElementById('bgInput');
  var res = document.getElementById('bgResult');

  if (!dz || !inp) return;

  dz.addEventListener('dragover', function (e) { e.preventDefault(); dz.classList.add('dragover'); });
  dz.addEventListener('dragleave', function () { dz.classList.remove('dragover'); });
  dz.addEventListener('drop', function (e) {
    e.preventDefault(); dz.classList.remove('dragover');
    var f = e.dataTransfer.files[0];
    if (f && f.type.startsWith('image/')) processBgRemoval(f);
  });
  dz.addEventListener('click', function () { inp.click(); });
  inp.addEventListener('change', function () {
    if (inp.files[0]) processBgRemoval(inp.files[0]);
  });
}

async function processBgRemoval(file) {
  var res = document.getElementById('bgResult');
  var status = document.getElementById('bgStatus');
  res.style.display = 'none';
  status.style.display = 'block';
  status.innerHTML = '<div class="tool-spin"></div> Chargement du modèle IA (première utilisation ~30s)…';

  try {
    /* Lazy-load @imgly/background-removal as ESM */
    if (!window._bgRemovalLib) {
      status.innerHTML = '<div class="tool-spin"></div> Téléchargement du modèle de suppression de fond…';
      var mod = await import('https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.4.5/dist/browser.mjs');
      window._bgRemovalLib = mod;
    }
    var { removeBackground } = window._bgRemovalLib;

    status.innerHTML = '<div class="tool-spin"></div> Analyse de l\'image en cours…';
    var blob = await removeBackground(file, {
      publicPath: 'https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.4.5/dist/'
    });

    var url = URL.createObjectURL(blob);
    res.innerHTML =
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">' +
        '<div><div style="font-size:0.7em;color:var(--text-muted);margin-bottom:6px">ORIGINAL</div>' +
          '<img id="bgOrig" style="width:100%;border-radius:8px;object-fit:contain;max-height:200px"></div>' +
        '<div><div style="font-size:0.7em;color:var(--text-muted);margin-bottom:6px">SANS FOND</div>' +
          '<img id="bgOut" style="width:100%;border-radius:8px;object-fit:contain;max-height:200px;background:repeating-conic-gradient(#333 0% 25%,#222 0% 50%) 0 0/20px 20px"></div>' +
      '</div>' +
      '<button class="btn btn-primary" id="bgDlBtn" style="width:100%">⬇ Télécharger PNG sans fond</button>';
    res.style.display = 'block';

    var origUrl = URL.createObjectURL(file);
    document.getElementById('bgOrig').src = origUrl;
    document.getElementById('bgOut').src  = url;
    document.getElementById('bgDlBtn').onclick = function () {
      downloadBlob(blob, 'eva-sans-fond.png');
    };
    status.style.display = 'none';
  } catch (e) {
    console.error('[Tools/BgRemove]', e);
    status.innerHTML = '<span style="color:#ff4d6d">Erreur : ' + (e.message || 'Échec du traitement') + '</span>' +
      '<br><small style="color:var(--text-muted)">Vérifiez la connexion internet (modèle IA chargé depuis CDN)</small>';
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   2. CRÉER UN PDF
   ═══════════════════════════════════════════════════════════════════════ */
async function generatePDF() {
  var title   = document.getElementById('pdfTitle').value.trim() || 'Document';
  var content = document.getElementById('pdfContent').value.trim();
  var author  = document.getElementById('pdfAuthor').value.trim() || 'EVA';
  if (!content) { showToolToast('Ajoutez du contenu au PDF', 'warn'); return; }

  var btn = document.getElementById('pdfGenBtn');
  btn.disabled = true; btn.textContent = 'Génération…';

  try {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
    var { jsPDF } = window.jspdf;
    var doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });

    /* Header */
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(0, 180, 220);
    doc.text(title, 20, 30);

    /* Author + Date */
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(120, 130, 140);
    doc.text('Par : ' + author + '  —  ' + new Date().toLocaleDateString('fr-FR', { year:'numeric', month:'long', day:'numeric' }), 20, 40);

    /* Separator */
    doc.setDrawColor(0, 180, 220);
    doc.setLineWidth(0.5);
    doc.line(20, 44, 190, 44);

    /* Content */
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(30, 30, 30);
    var lines = doc.splitTextToSize(content, 170);
    doc.text(lines, 20, 54);

    /* Footer */
    var pageH = doc.internal.pageSize.height;
    doc.setFontSize(8);
    doc.setTextColor(160, 160, 160);
    doc.text('Généré par EVA — Evolutionary Virtual Assistant', 20, pageH - 12);

    doc.save(title.replace(/\s+/g, '_') + '.pdf');
    showToolToast('PDF téléchargé !', 'success');
  } catch (e) {
    showToolToast('Erreur PDF : ' + e.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = '⬇ Générer le PDF';
  }
}
window.generatePDF = generatePDF;

/* ═══════════════════════════════════════════════════════════════════════
   3. EXCEL / CSV → XLSX
   ═══════════════════════════════════════════════════════════════════════ */
async function generateExcel() {
  var csv     = document.getElementById('excelData').value.trim();
  var name    = document.getElementById('excelName').value.trim() || 'Feuille1';
  var sep     = document.getElementById('excelSep').value || ',';
  if (!csv)   { showToolToast('Collez des données CSV', 'warn'); return; }

  var btn = document.getElementById('excelGenBtn');
  btn.disabled = true; btn.textContent = 'Génération…';

  try {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
    var rows = csv.split('\n').map(function (r) { return r.split(sep); });
    var wb = XLSX.utils.book_new();
    var ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, name);
    XLSX.writeFile(wb, name.replace(/\s+/g, '_') + '.xlsx');
    showToolToast('Fichier Excel téléchargé !', 'success');
  } catch (e) {
    showToolToast('Erreur Excel : ' + e.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = '⬇ Télécharger Excel';
  }
}
window.generateExcel = generateExcel;

/* ═══════════════════════════════════════════════════════════════════════
   4. QR CODE
   ═══════════════════════════════════════════════════════════════════════ */
async function generateQR() {
  var text = document.getElementById('qrInput').value.trim();
  var size = parseInt(document.getElementById('qrSize').value) || 256;
  var fg   = document.getElementById('qrFg').value || '#00d4ff';
  var bg   = document.getElementById('qrBg').value || '#060b12';
  if (!text) { showToolToast('Entrez une URL ou du texte', 'warn'); return; }

  try {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js');
    var container = document.getElementById('qrPreview');
    container.innerHTML = '';
    new QRCode(container, {
      text: text, width: size, height: size,
      colorDark: fg, colorLight: bg,
      correctLevel: QRCode.CorrectLevel.H
    });
    document.getElementById('qrActions').style.display = 'flex';
    document.getElementById('qrDlBtn').onclick = function () {
      var canvas = container.querySelector('canvas');
      if (!canvas) return;
      canvas.toBlob(function (b) { downloadBlob(b, 'qr-code.png'); });
    };
  } catch (e) {
    showToolToast('Erreur QR : ' + e.message, 'error');
  }
}
window.generateQR = generateQR;

/* ═══════════════════════════════════════════════════════════════════════
   5. COMPRESSER IMAGE
   ═══════════════════════════════════════════════════════════════════════ */
function initImgCompressor() {
  var dz  = document.getElementById('imgcDrop');
  var inp = document.getElementById('imgcInput');
  if (!dz || !inp) return;
  dz.addEventListener('click', function () { inp.click(); });
  dz.addEventListener('dragover', function (e) { e.preventDefault(); dz.classList.add('dragover'); });
  dz.addEventListener('dragleave', function () { dz.classList.remove('dragover'); });
  dz.addEventListener('drop', function (e) {
    e.preventDefault(); dz.classList.remove('dragover');
    var f = e.dataTransfer.files[0];
    if (f && f.type.startsWith('image/')) loadImgForCompression(f);
  });
  inp.addEventListener('change', function () {
    if (inp.files[0]) loadImgForCompression(inp.files[0]);
  });
  var ql = document.getElementById('imgcQuality');
  var qv = document.getElementById('imgcQualityVal');
  if (ql && qv) ql.oninput = function () { qv.textContent = ql.value + '%'; };
}

var _imgcFile = null;
function loadImgForCompression(file) {
  _imgcFile = file;
  var info = document.getElementById('imgcOrigInfo');
  if (info) info.textContent = file.name + ' — ' + fmtBytes(file.size);
  document.getElementById('imgcControls').style.display = 'block';
  document.getElementById('imgcResult').style.display = 'none';
}

function compressImage() {
  if (!_imgcFile) return;
  var quality = (parseInt(document.getElementById('imgcQuality').value) || 85) / 100;
  var maxW    = parseInt(document.getElementById('imgcMaxW').value) || 0;

  var img = new Image();
  var url = URL.createObjectURL(_imgcFile);
  img.onload = function () {
    var w = img.naturalWidth, h = img.naturalHeight;
    if (maxW && w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
    var canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
    URL.revokeObjectURL(url);

    canvas.toBlob(function (blob) {
      var outUrl = URL.createObjectURL(blob);
      var res = document.getElementById('imgcResult');
      res.innerHTML =
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;font-size:0.72em;color:var(--text-muted)">' +
          '<div>Avant : ' + fmtBytes(_imgcFile.size) + '</div>' +
          '<div>Après : ' + fmtBytes(blob.size) + ' (' + Math.round((1 - blob.size/_imgcFile.size)*100) + '% gagné)</div>' +
        '</div>' +
        '<img src="' + outUrl + '" style="width:100%;border-radius:8px;max-height:220px;object-fit:contain;margin-bottom:12px">' +
        '<button class="btn btn-primary" style="width:100%" id="imgcDlBtn">⬇ Télécharger (' + fmtBytes(blob.size) + ')</button>';
      res.style.display = 'block';
      document.getElementById('imgcDlBtn').onclick = function () {
        var ext = _imgcFile.type === 'image/png' ? '.png' : '.jpg';
        downloadBlob(blob, 'compressed' + ext);
      };
    }, _imgcFile.type === 'image/png' ? 'image/png' : 'image/jpeg', quality);
  };
  img.src = url;
}
window.compressImage = compressImage;

/* ═══════════════════════════════════════════════════════════════════════
   6. CONVERTISSEUR D'UNITÉS
   ═══════════════════════════════════════════════════════════════════════ */
var CONVERSIONS = {
  length: {
    label: 'Longueur',
    units: { 'mm':0.001, 'cm':0.01, 'm':1, 'km':1000, 'in':0.0254, 'ft':0.3048, 'yd':0.9144, 'mi':1609.344 }
  },
  weight: {
    label: 'Masse',
    units: { 'mg':0.000001, 'g':0.001, 'kg':1, 't':1000, 'lb':0.453592, 'oz':0.028349 }
  },
  temp: {
    label: 'Température',
    units: { '°C': null, '°F': null, 'K': null }
  },
  area: {
    label: 'Surface',
    units: { 'mm²':0.000001, 'cm²':0.0001, 'm²':1, 'km²':1e6, 'ha':10000, 'ac':4046.86, 'ft²':0.092903 }
  },
  volume: {
    label: 'Volume',
    units: { 'ml':0.001, 'cl':0.01, 'dl':0.1, 'L':1, 'm³':1000, 'gal':3.78541, 'fl oz':0.0295735 }
  },
  speed: {
    label: 'Vitesse',
    units: { 'm/s':1, 'km/h':0.277778, 'mph':0.44704, 'knot':0.514444 }
  }
};

function updateUnitSelects() {
  var cat = document.getElementById('convCat').value;
  var fromSel = document.getElementById('convFrom');
  var toSel   = document.getElementById('convTo');
  if (!fromSel || !toSel) return;
  var units = Object.keys(CONVERSIONS[cat].units);
  var opts = units.map(function (u) { return '<option value="' + u + '">' + u + '</option>'; }).join('');
  fromSel.innerHTML = opts; toSel.innerHTML = opts;
  if (toSel.options[1]) toSel.selectedIndex = 1;
  convertUnits();
}

function convertUnits() {
  var cat = document.getElementById('convCat').value;
  var fromU = document.getElementById('convFrom').value;
  var toU   = document.getElementById('convTo').value;
  var val   = parseFloat(document.getElementById('convInput').value);
  var out   = document.getElementById('convOutput');
  if (!out) return;
  if (isNaN(val)) { out.value = ''; return; }

  var result;
  if (cat === 'temp') {
    var inC;
    if (fromU === '°C') inC = val;
    else if (fromU === '°F') inC = (val - 32) * 5/9;
    else inC = val - 273.15;
    if (toU === '°C') result = inC;
    else if (toU === '°F') result = inC * 9/5 + 32;
    else result = inC + 273.15;
  } else {
    var baseVal = val * CONVERSIONS[cat].units[fromU];
    result = baseVal / CONVERSIONS[cat].units[toU];
  }
  out.value = parseFloat(result.toPrecision(7));
}
window.updateUnitSelects = updateUnitSelects;
window.convertUnits = convertUnits;

/* ═══════════════════════════════════════════════════════════════════════
   7. EXTRACTEUR DE COULEURS
   ═══════════════════════════════════════════════════════════════════════ */
function initColorExtractor() {
  var dz  = document.getElementById('colorDrop');
  var inp = document.getElementById('colorInput');
  if (!dz || !inp) return;
  dz.addEventListener('click', function () { inp.click(); });
  dz.addEventListener('dragover', function (e) { e.preventDefault(); dz.classList.add('dragover'); });
  dz.addEventListener('dragleave', function () { dz.classList.remove('dragover'); });
  dz.addEventListener('drop', function (e) {
    e.preventDefault(); dz.classList.remove('dragover');
    var f = e.dataTransfer.files[0];
    if (f && f.type.startsWith('image/')) extractColors(f);
  });
  inp.addEventListener('change', function () {
    if (inp.files[0]) extractColors(inp.files[0]);
  });
}

function extractColors(file) {
  var img = new Image();
  var url = URL.createObjectURL(file);
  img.onload = function () {
    var canvas = document.createElement('canvas');
    var scale  = Math.min(1, 200 / Math.max(img.naturalWidth, img.naturalHeight));
    canvas.width  = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    var ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);

    var data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    /* Quantize into buckets */
    var buckets = {};
    for (var i = 0; i < data.length; i += 16) {
      var r = Math.round(data[i]   / 32) * 32;
      var g = Math.round(data[i+1] / 32) * 32;
      var b = Math.round(data[i+2] / 32) * 32;
      if (data[i+3] < 128) continue;
      var key = r + ',' + g + ',' + b;
      buckets[key] = (buckets[key] || 0) + 1;
    }
    /* Top 8 colors */
    var sorted = Object.keys(buckets).sort(function (a, b) { return buckets[b] - buckets[a]; }).slice(0, 8);
    var res = document.getElementById('colorResult');
    res.innerHTML = '<div class="img-preview" style="margin-bottom:12px"><img src="' + URL.createObjectURL(file) + '" style="width:100%;border-radius:8px;max-height:160px;object-fit:contain"></div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:10px">' +
      sorted.map(function (k) {
        var parts = k.split(',');
        var hex = '#' + parts.map(function (v) { return ('0' + parseInt(v).toString(16)).slice(-2); }).join('');
        return '<div style="text-align:center">' +
          '<div class="color-swatch" style="background:' + hex + ';width:52px;height:52px;border-radius:10px;cursor:pointer;border:2px solid rgba(255,255,255,0.1)" onclick="copyText(\'' + hex + '\',this)"></div>' +
          '<div style="font-size:0.65em;color:var(--text-muted);margin-top:4px;font-family:monospace">' + hex.toUpperCase() + '</div>' +
          '</div>';
      }).join('') +
      '</div>';
    res.style.display = 'block';
  };
  img.src = url;
}
window.extractColors = extractColors;

/* ═══════════════════════════════════════════════════════════════════════
   8. RACCOURCIR URL
   ═══════════════════════════════════════════════════════════════════════ */
async function shortenURL() {
  var url    = document.getElementById('shortenInput').value.trim();
  var output = document.getElementById('shortenOutput');
  var btn    = document.getElementById('shortenBtn');
  if (!url) { showToolToast('Entrez une URL', 'warn'); return; }
  if (!url.startsWith('http')) url = 'https://' + url;

  btn.disabled = true; btn.textContent = 'Raccourcissement…';
  output.style.display = 'none';
  try {
    /* Server proxy to avoid CORS */
    var resp = await fetch('/api/shorten?url=' + encodeURIComponent(url));
    if (!resp.ok) throw new Error('Erreur ' + resp.status);
    var data = await resp.json();
    var short = data.short;
    output.innerHTML =
      '<div style="display:flex;gap:8px;align-items:center">' +
        '<input class="form-input" readonly value="' + short + '" id="shortenOut" style="flex:1;font-family:monospace;font-size:0.85em">' +
        '<button class="btn btn-primary" onclick="copyText(document.getElementById(\'shortenOut\').value,this)">Copier</button>' +
      '</div>';
    output.style.display = 'block';
  } catch (e) {
    showToolToast('Erreur : ' + (e.message || 'Service indisponible'), 'error');
  } finally {
    btn.disabled = false; btn.textContent = '✂️ Raccourcir';
  }
}
window.shortenURL = shortenURL;

/* ═══════════════════════════════════════════════════════════════════════
   TOAST helper (tool-level)
   ═══════════════════════════════════════════════════════════════════════ */
function showToolToast(msg, type) {
  if (window.toast) window.toast(msg, type || 'info');
  else console.log('[Tool]', msg);
}

/* ═══════════════════════════════════════════════════════════════════════
   ABOUT MODAL
   ═══════════════════════════════════════════════════════════════════════ */
function openAbout() {
  var m = document.getElementById('aboutModal');
  if (m) m.classList.add('open');
}
function closeAbout() {
  var m = document.getElementById('aboutModal');
  if (m) m.classList.remove('open');
}
window.openAbout  = openAbout;
window.closeAbout = closeAbout;

/* ═══════════════════════════════════════════════════════════════════════
   INIT
   ═══════════════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', function () {
  /* Close on overlay click */
  document.addEventListener('click', function (e) {
    if (e.target.classList.contains('about-modal')) closeAbout();
  });

  /* Init drop zones when tool panels open */
  /* Each panel initialises its drag zone on first open */
  window._toolInited = {};

  var origOpenTool = window.openTool;
  window.openTool = function (id) {
    origOpenTool(id);
    if (!window._toolInited[id]) {
      window._toolInited[id] = true;
      if (id === 'bg')    initBgRemover();
      if (id === 'imgc')  initImgCompressor();
      if (id === 'color') initColorExtractor();
      if (id === 'conv')  updateUnitSelects();
    }
  };
});

window.copyText = copyText;
window.fmtBytes = fmtBytes;

})();
