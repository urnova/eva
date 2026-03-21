/* ═══════════════════════════════════════════════════════════════════════════
   EVA TOOL INTENTS — Capacités d'EVA intégrées dans le chat
   Détecte l'intention de l'utilisateur, traite en local, répond dans le chat
   ═══════════════════════════════════════════════════════════════════════════ */

(function () {
'use strict';

/* ── Patterns de détection ── */
var INTENTS = {
  bgRemoval: {
    needsImage: true,
    patterns: [
      /supprimer?\s*(le\s*)?fond/i, /enl[eè]ve\s*(le\s*)?fond/i,
      /retire\s*(le\s*)?fond/i, /efface\s*(le\s*)?fond/i,
      /sans\s*fond/i, /arri[eè]re[\s-]plan/i,
      /supprime\s*(l\'?\s*)?arri[eè]re/i,
      /fond\s*(blanc|transparent|retiré)/i,
      /remove\s*(bg|background)/i, /d[eé]tourer/i, /d[eé]tourage/i
    ]
  },
  compress: {
    needsImage: true,
    patterns: [
      /compresse\s*(cette\s*)?image/i, /optimi[sz](e|er)\s*(cette\s*)?image/i,
      /r[eé]dui[st]\s*(le\s*)?poid/i, /all[eè]ge\s*(cette\s*)?image/i,
      /compresser\s*(l['a]\s*)?image/i
    ]
  },
  colorExtract: {
    needsImage: true,
    patterns: [
      /couleurs?\s*(de\s*|d[eu]\s*|dans\s*)?(cette\s*)?image/i,
      /palette\s*(de\s*)?couleurs?/i,
      /extraire?\s*(les\s*)?couleurs?/i,
      /couleur[s]?\s*dominant/i,
      /quelles?\s*(sont\s*(les\s*)?)?couleurs?/i,
      /d[eé]tect(e|er)\s*(les\s*)?couleurs?/i
    ]
  },
  qrCode: {
    needsImage: false,
    patterns: [
      /qr[\s-]?code\s+(pour|de|du|avec)\s+\S+/i,
      /g[eé]n[eè]re\s+(un\s+)?qr/i,
      /cr[eé]er?\s+(un\s+)?qr[\s-]?code/i,
      /code\s+qr\s+(pour|de)\s+\S+/i,
      /faire\s+(un\s+)?qr/i
    ]
  },
  shorten: {
    needsImage: false,
    patterns: [
      /raccourcis?\s+(cette\s+)?(url|lien|http)/i,
      /raccourcir\s+(cette\s+)?(url|lien)/i,
      /url\s+court/i, /lien\s+court/i,
      /shorten\s+(this\s+)?(url|link)/i
    ]
  }
};

/* ── Extraction d'URL depuis un texte ── */
function extractUrl(text) {
  var m = text.match(/https?:\/\/[^\s"'<>]+/i);
  if (m) return m[0];
  var m2 = text.match(/\b(www\.[^\s]+\.[a-z]{2,}[^\s]*)/i);
  if (m2) return 'https://' + m2[1];
  return null;
}

/* ── Extraction du contenu QR (URL ou texte après le mot-clé) ── */
function extractQrContent(text) {
  var url = extractUrl(text);
  if (url) return url;
  var m = text.match(/qr[\s-]?code\s+(pour|de|du|avec)\s+(.+)/i);
  if (m) return m[2].trim();
  m = text.match(/cr[eé]er?\s+(?:un\s+)?qr[\s-]?code\s+(.+)/i);
  if (m) return m[1].trim();
  return null;
}

/* ── Blob → data URL ── */
function blobToDataUrl(blob) {
  return new Promise(function (res, rej) {
    var reader = new FileReader();
    reader.onload = function (e) { res(e.target.result); };
    reader.onerror = rej;
    reader.readAsDataURL(blob);
  });
}

/* ── Lazy CDN script loader ── */
var _loaded = {};
function loadScript(url) {
  if (_loaded[url]) return Promise.resolve();
  return new Promise(function (res, rej) {
    var s = document.createElement('script');
    s.src = url;
    s.onload = function () { _loaded[url] = true; res(); };
    s.onerror = function () { rej(new Error('Impossible de charger ' + url)); };
    document.head.appendChild(s);
  });
}

/* ── Bouton téléchargement inline ── */
window._evaDlBlob = {};
window._evaDownload = function (key) {
  var entry = window._evaDlBlob[key];
  if (!entry) return;
  var a = document.createElement('a');
  a.href = URL.createObjectURL(entry.blob);
  a.download = entry.name;
  a.click();
  setTimeout(function () { URL.revokeObjectURL(a.href); }, 3000);
};

function makeDlBtn(blob, filename, label) {
  var key = 'dl_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  window._evaDlBlob[key] = { blob: blob, name: filename };
  return '<button onclick="window._evaDownload(\'' + key + '\')" style="' +
    'display:inline-flex;align-items:center;gap:6px;padding:8px 16px;' +
    'background:linear-gradient(135deg,rgba(0,212,255,0.15),rgba(161,0,255,0.1));' +
    'border:1px solid rgba(0,212,255,0.35);border-radius:8px;color:var(--cyan);' +
    'font-family:\'Orbitron\',monospace;font-size:0.68em;letter-spacing:1px;' +
    'cursor:pointer;margin-top:10px;transition:all 0.15s" ' +
    'onmouseover="this.style.background=\'rgba(0,212,255,0.22)\'" ' +
    'onmouseout="this.style.background=\'linear-gradient(135deg,rgba(0,212,255,0.15),rgba(161,0,255,0.1))\'">' +
    '⬇ ' + (label || 'Télécharger') + '</button>';
}

/* ══════════════════════════════════════════════════════════════════════
   TRAITEMENT : SUPPRESSION DE FOND
══════════════════════════════════════════════════════════════════════ */
async function runBgRemoval(imageFile, statusCb) {
  statusCb('⏳ Chargement du modèle IA…');

  if (!window._bgRemovalLib) {
    statusCb('📡 Téléchargement du modèle (première fois, ~90 Mo)…');
    var mod = await import(
      'https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.4.5/dist/browser.mjs'
    );
    window._bgRemovalLib = mod;
  }

  statusCb('🔬 Analyse et découpe de l\'image…');
  var { removeBackground } = window._bgRemovalLib;
  var resultBlob = await removeBackground(imageFile, {
    publicPath: 'https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.4.5/dist/'
  });

  var origUrl   = URL.createObjectURL(imageFile);
  var resultUrl = URL.createObjectURL(resultBlob);

  var html =
    '<p style="margin:0 0 10px">C\'est fait ! J\'ai supprimé l\'arrière-plan de votre image. ✨</p>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">' +
      '<div>' +
        '<div style="font-size:0.62em;letter-spacing:1px;color:var(--text-muted);margin-bottom:4px">ORIGINAL</div>' +
        '<img src="' + origUrl + '" style="width:100%;border-radius:8px;object-fit:contain;max-height:180px">' +
      '</div>' +
      '<div>' +
        '<div style="font-size:0.62em;letter-spacing:1px;color:var(--text-muted);margin-bottom:4px">SANS FOND</div>' +
        '<img src="' + resultUrl + '" style="width:100%;border-radius:8px;object-fit:contain;max-height:180px;' +
          'background:repeating-conic-gradient(#2a2a2a 0% 25%,#1a1a1a 0% 50%) 0 0/14px 14px">' +
      '</div>' +
    '</div>' +
    makeDlBtn(resultBlob, 'eva-sans-fond.png', 'Télécharger PNG sans fond');

  return { html: html, speak: 'J\'ai supprimé l\'arrière-plan de votre image. Vous pouvez la télécharger.' };
}

/* ══════════════════════════════════════════════════════════════════════
   TRAITEMENT : COMPRESSION D'IMAGE
══════════════════════════════════════════════════════════════════════ */
async function runCompress(imageFile, statusCb) {
  statusCb('🗜️ Compression en cours…');
  return new Promise(function (resolve, reject) {
    var img = new Image();
    var url = URL.createObjectURL(imageFile);
    img.onload = function () {
      var canvas = document.createElement('canvas');
      canvas.width  = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext('2d').drawImage(img, 0, 0);
      URL.revokeObjectURL(url);

      var quality = imageFile.type === 'image/png' ? 1 : 0.82;
      var outType = imageFile.type === 'image/png' ? 'image/png' : 'image/jpeg';

      canvas.toBlob(function (blob) {
        var savedPct = Math.round((1 - blob.size / imageFile.size) * 100);
        var fmt = function (b) {
          return b < 1048576 ? (b / 1024).toFixed(0) + ' Ko' : (b / 1048576).toFixed(2) + ' Mo';
        };
        var preview = URL.createObjectURL(blob);

        var html =
          '<p style="margin:0 0 10px">Image compressée avec succès ! 🗜️</p>' +
          '<div style="display:flex;gap:16px;font-size:0.74em;margin-bottom:10px;color:var(--text-muted)">' +
            '<span>Avant : <strong style="color:var(--text)">' + fmt(imageFile.size) + '</strong></span>' +
            '<span>Après : <strong style="color:var(--cyan)">' + fmt(blob.size) + '</strong></span>' +
            '<span style="color:#4ade80">↓ ' + (savedPct > 0 ? savedPct + '% gagné' : 'même taille') + '</span>' +
          '</div>' +
          '<img src="' + preview + '" style="width:100%;border-radius:8px;max-height:200px;object-fit:contain;margin-bottom:4px">' +
          makeDlBtn(blob, 'eva-compressed' + (outType === 'image/png' ? '.png' : '.jpg'), 'Télécharger l\'image compressée');

        resolve({ html: html, speak: 'Votre image a été compressée. Elle pèse maintenant ' + fmt(blob.size) + '.' });
      }, outType, quality);
    };
    img.onerror = reject;
    img.src = url;
  });
}

/* ══════════════════════════════════════════════════════════════════════
   TRAITEMENT : EXTRACTION DE COULEURS
══════════════════════════════════════════════════════════════════════ */
async function runColorExtract(imageFile, statusCb) {
  statusCb('🎨 Analyse de la palette…');
  return new Promise(function (resolve, reject) {
    var img = new Image();
    var url = URL.createObjectURL(imageFile);
    img.onload = function () {
      var scale = Math.min(1, 180 / Math.max(img.naturalWidth, img.naturalHeight));
      var canvas = document.createElement('canvas');
      canvas.width  = Math.round(img.naturalWidth  * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);

      var data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      var buckets = {};
      for (var i = 0; i < data.length; i += 12) {
        if (data[i + 3] < 128) continue;
        var r = Math.round(data[i]     / 32) * 32;
        var g = Math.round(data[i + 1] / 32) * 32;
        var b = Math.round(data[i + 2] / 32) * 32;
        var k = r + ',' + g + ',' + b;
        buckets[k] = (buckets[k] || 0) + 1;
      }
      var top8 = Object.keys(buckets)
        .sort(function (a, b) { return buckets[b] - buckets[a]; })
        .slice(0, 8);

      var hexList = top8.map(function (k) {
        return '#' + k.split(',').map(function (v) {
          return ('0' + parseInt(v).toString(16)).slice(-2);
        }).join('');
      });

      var swatches = hexList.map(function (hex) {
        return '<div style="text-align:center;cursor:pointer" title="' + hex + '" onclick="navigator.clipboard.writeText(\'' + hex + '\').then(function(){window.toast&&toast(\'Copié : ' + hex + '\',\'success\')})">' +
          '<div style="width:48px;height:48px;border-radius:10px;background:' + hex + ';border:2px solid rgba(255,255,255,0.1);transition:transform 0.15s" ' +
          'onmouseover="this.style.transform=\'scale(1.1)\'" onmouseout="this.style.transform=\'\'">' +
          '</div>' +
          '<div style="font-size:0.6em;color:var(--text-muted);margin-top:3px;font-family:monospace">' + hex.toUpperCase() + '</div>' +
        '</div>';
      }).join('');

      var imgPreview = URL.createObjectURL(imageFile);
      var html =
        '<p style="margin:0 0 10px">Voici les ' + top8.length + ' couleurs dominantes de votre image ! 🎨</p>' +
        '<img src="' + imgPreview + '" style="width:100%;border-radius:8px;max-height:140px;object-fit:contain;margin-bottom:12px">' +
        '<div style="display:flex;flex-wrap:wrap;gap:10px">' + swatches + '</div>' +
        '<p style="margin:10px 0 0;font-size:0.72em;color:var(--text-muted)">Cliquez sur une couleur pour copier le code HEX.</p>';

      resolve({
        html: html,
        speak: 'J\'ai extrait les ' + top8.length + ' couleurs dominantes de votre image. Cliquez sur une couleur pour copier le code.'
      });
    };
    img.onerror = reject;
    img.src = url;
  });
}

/* ══════════════════════════════════════════════════════════════════════
   TRAITEMENT : QR CODE
══════════════════════════════════════════════════════════════════════ */
async function runQrCode(content, statusCb) {
  statusCb('🔲 Génération du QR code…');
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js');

  return new Promise(function (resolve, reject) {
    var uid = 'qrchat_' + Date.now();
    var container = document.createElement('div');
    container.id = uid;

    try {
      new QRCode(container, {
        text: content, width: 220, height: 220,
        colorDark: '#00d4ff', colorLight: '#060b12',
        correctLevel: QRCode.CorrectLevel.H
      });

      setTimeout(function () {
        var qrCanvas = container.querySelector('canvas');
        if (!qrCanvas) { reject(new Error('QR canvas non trouvé')); return; }
        qrCanvas.toBlob(function (blob) {
          var previewUrl = URL.createObjectURL(blob);
          var html =
            '<p style="margin:0 0 10px">QR code généré pour : <code style="color:var(--cyan);font-size:0.8em">' + content + '</code> 🔲</p>' +
            '<div style="display:flex;justify-content:center;margin:10px 0">' +
              '<img src="' + previewUrl + '" style="border-radius:10px;border:2px solid rgba(0,212,255,0.2);max-width:200px">' +
            '</div>' +
            makeDlBtn(blob, 'eva-qrcode.png', 'Télécharger le QR code');
          resolve({ html: html, speak: 'Voici votre QR code. Vous pouvez le télécharger.' });
        });
      }, 200);
    } catch (e) { reject(e); }
  });
}

/* ══════════════════════════════════════════════════════════════════════
   TRAITEMENT : RACCOURCIR URL
══════════════════════════════════════════════════════════════════════ */
async function runShorten(url, statusCb) {
  statusCb('✂️ Raccourcissement de l\'URL…');
  var resp = await fetch('/api/shorten?url=' + encodeURIComponent(url));
  if (!resp.ok) throw new Error('Erreur ' + resp.status);
  var data = await resp.json();
  var short = data.short;

  var uid = 'sc_' + Date.now();
  var html =
    '<p style="margin:0 0 10px">Voici votre lien raccourci ✂️</p>' +
    '<div style="display:flex;gap:8px;align-items:center;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:10px 12px">' +
      '<code id="' + uid + '" style="flex:1;font-size:0.88em;color:var(--cyan);word-break:break-all">' + short + '</code>' +
      '<button onclick="navigator.clipboard.writeText(document.getElementById(\'' + uid + '\').textContent).then(function(){window.toast&&toast(\'Lien copié !\',\'success\')})" ' +
        'style="padding:6px 12px;background:rgba(0,212,255,0.12);border:1px solid rgba(0,212,255,0.3);border-radius:6px;color:var(--cyan);cursor:pointer;font-size:0.75em;flex-shrink:0">' +
        '📋 Copier' +
      '</button>' +
    '</div>' +
    '<p style="margin:8px 0 0;font-size:0.7em;color:var(--text-muted)">URL originale : <span style="color:var(--text-muted)">' + url + '</span></p>';

  return { html: html, speak: 'Voici votre lien raccourci : ' + short };
}

/* ══════════════════════════════════════════════════════════════════════
   DÉTECTION & DISPATCH PRINCIPAL
══════════════════════════════════════════════════════════════════════ */
async function detect(text, imageFile, statusCb) {
  statusCb = statusCb || function () {};
  var t = (text || '').toLowerCase();

  /* ── Outils avec image ── */
  if (imageFile) {
    for (var p of INTENTS.bgRemoval.patterns) {
      if (p.test(text)) return await runBgRemoval(imageFile, statusCb);
    }
    for (var p of INTENTS.compress.patterns) {
      if (p.test(text)) return await runCompress(imageFile, statusCb);
    }
    for (var p of INTENTS.colorExtract.patterns) {
      if (p.test(text)) return await runColorExtract(imageFile, statusCb);
    }
  }

  /* ── QR code ── */
  for (var p of INTENTS.qrCode.patterns) {
    if (p.test(text)) {
      var qrContent = extractQrContent(text);
      if (qrContent) return await runQrCode(qrContent, statusCb);
    }
  }

  /* ── Raccourcir URL ── */
  for (var p of INTENTS.shorten.patterns) {
    if (p.test(text)) {
      var urlFound = extractUrl(text);
      if (urlFound) return await runShorten(urlFound, statusCb);
    }
  }

  return null; // Aucun intent détecté → flux IA normal
}

/* ── Export global ── */
window.EVAToolIntents = { detect: detect };

})();
