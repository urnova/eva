const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 5000;
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.json': 'application/json',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.ico':  'image/x-icon',
  '.mp3':  'audio/mpeg',
  '.wav':  'audio/wav',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
  '.glb':  'model/gltf-binary',
  '.vrm':  'model/gltf-binary',
};

const PAGE_ROUTES = {
  '/':            'index.html',
  '/index':       'index.html',
  '/index.html':  'index.html',
  '/login':       'login.html',
  '/login.html':  'login.html',
  '/chat':        'chat.html',
  '/chat.html':   'chat.html',
  '/onboarding':  'onboarding.html',
  '/onboarding.html': 'onboarding.html',
  '/conditions':  'conditions.html',
  '/conditions.html': 'conditions.html',
  '/privacy':     'privacy.html',
  '/privacy.html':'privacy.html',
  '/cookies':     'cookies.html',
  '/cookies.html':'cookies.html',
};

function serveFile(res, filePath) {
  fs.readFile(filePath, function(err, data) {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': mime,
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  });
}

const server = http.createServer(function(req, res) {
  const url = req.url.split('?')[0];

  if (PAGE_ROUTES[url]) {
    const filePath = path.join(ROOT, PAGE_ROUTES[url]);
    serveFile(res, filePath);
    return;
  }

  const filePath = path.join(ROOT, url);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    /* Cache immutable lib files for 1 year; everything else no-cache */
    if (url.startsWith('/js/lib/') || url.startsWith('/models/')) {
      const ext = path.extname(filePath).toLowerCase();
      const mime = MIME[ext] || 'application/octet-stream';
      fs.readFile(filePath, function(err, data) {
        if (err) { res.writeHead(404); res.end('Not Found'); return; }
        res.writeHead(200, {
          'Content-Type': mime,
          'Cache-Control': 'public, max-age=31536000, immutable'
        });
        res.end(data);
      });
      return;
    }
    serveFile(res, filePath);
    return;
  }

  /* ── URL shortener proxy (avoid CORS) ── */
  if (url === '/api/shorten') {
    var qs = req.url.split('?')[1] || '';
    var params = new URLSearchParams(qs);
    var longUrl = params.get('url');
    if (!longUrl) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing url parameter' }));
      return;
    }
    var https = require('https');
    var target = 'https://tinyurl.com/api-create.php?url=' + encodeURIComponent(longUrl);
    https.get(target, function (r) {
      var body = '';
      r.on('data', function (c) { body += c; });
      r.on('end', function () {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ short: body.trim() }));
      });
    }).on('error', function (e) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end('<h1>404 — Page non trouvée</h1>');
});

server.listen(PORT, '0.0.0.0', function() {
  console.log('EVA server running on port ' + PORT);
});
