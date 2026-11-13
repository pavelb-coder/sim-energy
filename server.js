// Локальный сервер виртуальной лаборатории «Энерджиквантум».
//   node server.js            → http://localhost:8082
//   PORT=9000 node server.js  → другой порт
// Без зависимостей: статика из корня репозитория, brotli/gzip, запрет выхода за пределы папки.

const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const PORT = Number(process.env.PORT) || 8082;
const HOST = process.env.HOST || '0.0.0.0';
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.md': 'text/markdown; charset=utf-8'
};

const COMPRESSIBLE = new Set(['.html', '.css', '.js', '.mjs', '.json', '.svg', '.md']);

// псевдонимы адресов: что открывать по «красивым» путям
const ALIAS = {
  '/': '/index.html',
  '/lab': '/index.html',
  '/lab.html': '/index.html',
  '/sim': '/index.html',
  '/dist': '/dist/lab.html',
  '/build': '/dist/lab.html'
};

const server = http.createServer((req, res) => {
  try {
    const parsed = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    let relPath = decodeURIComponent(parsed.pathname);
    if (ALIAS[relPath]) relPath = ALIAS[relPath];

    const safePath = path.normalize(path.join(ROOT, relPath));
    if (!safePath.startsWith(ROOT)) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Forbidden');
      return;
    }

    fs.stat(safePath, (err, stat) => {
      if (err || !stat.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not Found');
        return;
      }

      const ext = path.extname(safePath).toLowerCase();
      const headers = {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        // стенд собирается в один файл — кэшировать нечего, всегда свежая сборка
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      };

      const acceptEncoding = req.headers['accept-encoding'] || '';
      const rawStream = fs.createReadStream(safePath);

      if (COMPRESSIBLE.has(ext) && acceptEncoding.includes('br')) {
        headers['Content-Encoding'] = 'br';
        headers['Vary'] = 'Accept-Encoding';
        res.writeHead(200, headers);
        rawStream.pipe(zlib.createBrotliCompress({
          params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 4 }
        })).pipe(res);
      } else if (COMPRESSIBLE.has(ext) && acceptEncoding.includes('gzip')) {
        headers['Content-Encoding'] = 'gzip';
        headers['Vary'] = 'Accept-Encoding';
        res.writeHead(200, headers);
        rawStream.pipe(zlib.createGzip({ level: 6 })).pipe(res);
      } else {
        headers['Content-Length'] = stat.size;
        res.writeHead(200, headers);
        rawStream.pipe(res);
      }
    });
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Internal Server Error');
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Виртуальная лаборатория «Энерджиквантум»: http://localhost:${PORT}`);
  console.log(`(слушаем ${HOST}:${PORT}, отдаём ${ROOT})`);
});
