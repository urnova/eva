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
    serveFile(res, filePath);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end('<h1>404 — Page non trouvée</h1>');
});

server.listen(PORT, '0.0.0.0', function() {
  console.log('EVA server running on port ' + PORT);
});
