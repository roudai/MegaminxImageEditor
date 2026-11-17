// ローカルで確かめるためのサーバー：node tools/serve.js [ポート]（既定 8765）→ http://localhost:8765/
// GitHub Pages と同じように、.html なしの URL（/pll・/practice?set=oll）で pll.html などを返し、/ は index.html を返す。
// （python3 -m http.server は .html なしの URL を返せないので、こちらを使う）
//
// テストデータで動かす：node tools/serve.js --demo [ポート]（既定 8766）→ http://localhost:8766/stats
//   - 練習の記録（PLL・OLL・通し）・最近のタイム・習得状況にテストデータ（tools/demo-data.js）を入れた状態で開く
//     （ページを開いたときにまだ入れていなければ入れる。/__demo/reset で入れ直す）
//   - ログインは使えなくする（js/firebase-config.js の代わりに FIREBASE_CONFIG = null を返す）。テストデータがアカウントに送られないように
//   - ポートを普段（8765）と分けるので、ブラウザの保存（localStorage）も普段のものとは別になる
//   - 画面の右下に「テストデータ」の印とリセットのリンクを出す
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const args = process.argv.slice(2);
const DEMO = args.includes('--demo');
const PORT = Number(args.find((a) => /^\d+$/.test(a))) || (DEMO ? 8766 : 8765);
const PREFIX = 'megaminx-image-editor:';
const DEMO_MARK = PREFIX + 'demo-seeded'; // テストデータを入れたか（store.js の名前ではないので保存の対象にならない）
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

// ---- テストデータ（--demo） ----
// 各ページの <head> の最初に入れるスクリプト：まだ入れていなければテストデータを入れ、右下に印を出す
function demoScript() {
  const data = require('./demo-data.js').build({ now: Date.now() });
  return `(function () {
  var P = ${JSON.stringify(PREFIX)}, MARK = ${JSON.stringify(DEMO_MARK)};
  try {
    if (!localStorage.getItem(MARK)) {
      var data = ${JSON.stringify(data)};
      Object.keys(data).forEach(function (k) { localStorage.setItem(P + k, JSON.stringify(data[k])); });
      localStorage.setItem(MARK, String(Date.now()));
    }
  } catch (e) {}
  document.addEventListener('DOMContentLoaded', function () {
    var b = document.createElement('div');
    b.style.cssText = 'position:fixed;right:8px;bottom:8px;z-index:9999;padding:4px 10px;border-radius:999px;background:#fff3cd;color:#664d03;border:1px solid #ffe69c;font:12px/1.4 system-ui,sans-serif;box-shadow:0 2px 6px rgba(0,0,0,.1)';
    b.innerHTML = 'テストデータ（ログインなし） · <a href="/__demo/reset" style="color:inherit">入れ直す</a>';
    document.body.appendChild(b);
  });
})();
`;
}

// /__demo/reset：このサイトの保存をすべて消してから、テストデータを入れ直して記録のページを開く
const DEMO_RESET = `<!DOCTYPE html><meta charset="utf-8"><script>
try {
  Object.keys(localStorage).forEach(function (k) { if (k.indexOf(${JSON.stringify(PREFIX)}) === 0) localStorage.removeItem(k); });
} catch (e) {}
location.replace('/stats');
</script>`;

function sendDemo(res, pathname, file) {
  if (pathname === '/__demo/seed.js') {
    res.writeHead(200, { 'Content-Type': TYPES['.js'], 'Cache-Control': 'no-store' });
    res.end(demoScript());
    return true;
  }
  if (pathname === '/__demo/reset') {
    res.writeHead(200, { 'Content-Type': TYPES['.html'], 'Cache-Control': 'no-store' });
    res.end(DEMO_RESET);
    return true;
  }
  if (file && path.relative(ROOT, file) === path.join('js', 'firebase-config.js')) {
    res.writeHead(200, { 'Content-Type': TYPES['.js'], 'Cache-Control': 'no-store' });
    res.end('window.FIREBASE_CONFIG = null; // node tools/serve.js --demo：ログインは使わない\n');
    return true;
  }
  if (file && path.extname(file) === '.html') {
    const html = fs.readFileSync(file, 'utf8').replace(/<head>/i, '<head>\n  <script src="/__demo/seed.js"></script>');
    res.writeHead(200, { 'Content-Type': TYPES['.html'], 'Cache-Control': 'no-store' });
    res.end(html);
    return true;
  }
  return false;
}

http
  .createServer((req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const file = resolve(pathname);
    if (DEMO && sendDemo(res, pathname, file)) return;
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
    if (DEMO) console.log(`テストデータで動かしています（ログインなし）。記録のページ：http://localhost:${PORT}/stats　入れ直す：http://localhost:${PORT}/__demo/reset`);
  });
