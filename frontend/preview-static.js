/**
 * Serveur statique de DÉMONSTRATION (preview) : distribue dist/fluidity et
 * proxifie /api et /uploads vers l'API locale (127.0.0.1:3000).
 * Usage : node preview-static.js [port]
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const port = parseInt(process.argv[2], 10) || 8080;
const DIST = path.join(__dirname, 'dist', 'fluidity');
const API = 'http://127.0.0.1:3000';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  // Proxy API + uploads → backend
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/uploads/')) {
    const target = API + req.url;
    const chunks = [];
    const upstream = http.request(
      target,
      {
        method: req.method,
        headers: { ...req.headers, host: '127.0.0.1:3000' },
      },
      (up) => {
        res.writeHead(up.statusCode || 502, up.headers);
        up.pipe(res);
      }
    );
    upstream.on('error', () => {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end('{"message":"API indisponible"}');
    });
    req.pipe(upstream);
    return;
  }
  // SPA : fichier statique, sinon index.html
  let filePath = path.join(DIST, decodeURIComponent(url.pathname));
  if (!filePath.startsWith(DIST)) filePath = DIST;
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) filePath = path.join(DIST, 'index.html');
    fs.readFile(filePath, (err2, data) => {
      if (err2) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
      res.end(data);
    });
  });
});

server.listen(port, '0.0.0.0', () => {
  console.log(`[Preview] Frontend servi sur http://0.0.0.0:${port} (proxy /api → ${API})`);
});
