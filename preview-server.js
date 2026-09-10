/**
 * Serveur de PRÉVISUALISATION (démo) — frontend statique + proxy API.
 *
 *   node preview-server.js [port]
 *
 * Sert le build Angular (frontend/dist/fluidity) avec repli SPA et
 * relaie /api et /uploads vers l'API (127.0.0.1:3000). Le frontend
 * utilise des URL relatives — aucune dépendance à localhost côté
 * navigateur.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 8080);
const API_TARGET = process.env.API_TARGET || 'http://127.0.0.1:3000';
const DIST = path.join(__dirname, 'frontend', 'dist', 'fluidity');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
};

function proxy(req, res) {
  const target = new URL(API_TARGET);
  const options = {
    hostname: target.hostname,
    port: target.port,
    path: req.url,
    method: req.method,
    headers: { ...req.headers, host: target.host },
  };
  const upstream = http.request(options, (up) => {
    res.writeHead(up.statusCode || 502, up.headers);
    up.pipe(res);
  });
  upstream.on('error', () => {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'API injoignable.' }));
  });
  req.pipe(upstream);
}

function serveStatic(req, res) {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  let filePath = path.join(DIST, urlPath);
  if (!filePath.startsWith(DIST)) {
    res.writeHead(403);
    res.end();
    return;
  }
  fs.stat(filePath, (err, stat) => {
    if (!err && stat.isFile()) {
      res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream' });
      fs.createReadStream(filePath).pipe(res);
      return;
    }
    // Repli SPA : index.html (hors assets)
    const fallback = path.join(DIST, 'index.html');
    if (!urlPath.includes('.')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      fs.createReadStream(fallback).pipe(res);
      return;
    }
    res.writeHead(404);
    res.end('Not found');
  });
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/api') || req.url.startsWith('/uploads')) {
    proxy(req, res);
    return;
  }
  serveStatic(req, res);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Preview] Frontend servi sur http://0.0.0.0:${PORT} (API: ${API_TARGET})`);
});
