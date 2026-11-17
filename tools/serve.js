// ローカルで確かめるためのサーバー：node tools/serve.js [ポート]（既定 8765）→ http://localhost:8765/
// GitHub Pages と同じように、.html なしの URL（/pll・/practice?set=oll）で pll.html などを返し、/ は index.html を返す。
// （python3 -m http.server は .html なしの URL を返せないので、こちらを使う）
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.argv[2]) || 8765;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

const isFile = (p) => {
  try {
    return fs.statSync(p).isFile();
  } catch (e) {
    return false;
  }
};

// URL のパスから返すファイルを決める（ルートの外は返さない）
function resolve(urlPath) {
  let rel;
  try {
    rel = decodeURIComponent(urlPath);
  } catch (e) {
    return null;
  }
  const file = path.normalize(path.join(ROOT, rel));
  if (file !== ROOT && !file.startsWith(ROOT + path.sep)) return null;
  if (rel.endsWith('/')) return isFile(path.join(file, 'index.html')) ? path.join(file, 'index.html') : null;
  if (isFile(file)) return file;
  if (isFile(file + '.html')) return file + '.html';
  return null;
}

http
  .createServer((req, res) => {
    const file = resolve(new URL(req.url, 'http://localhost').pathname);
    if (!file) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  })
  .listen(PORT, '127.0.0.1', () => {
    console.log(`http://localhost:${PORT}/`);
  });
