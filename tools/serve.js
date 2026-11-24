// ローカルで確かめるためのサーバー：node tools/serve.js [ポート]（既定 8765）→ http://localhost:8765/
// GitHub Pages と同じように、.html なしの URL（/pll・/practice?set=oll）で pll.html などを返し、/ は index.html を返す。
// （python3 -m http.server は .html なしの URL を返せないので、こちらを使う）
//
// テストデータで動かす：node tools/serve.js --demo [ポート]（既定 8766）→ http://localhost:8766/stats
//   - 練習の記録（PLL・OLL・通し）・最近のタイム・習得状況にテストデータ（tools/demo-data.js）を入れた状態で開く
//     （ページを開いたときにまだ入れていなければ入れる。/__demo/reset で入れ直す。
//      tools/demo-data.js やそれが使う js を直したら、起動し直したあとに開いたときに入れ直す）
//   - ログインは使えなくする（js/firebase-config.js の代わりに FIREBASE_CONFIG = null を返す）。テストデータがアカウントに送られないように
//   - ポートを普段（8765）と分けるので、ブラウザの保存（localStorage）も普段のものとは別になる
//   - 画面の右下に「テストデータ」の印とリセットのリンクを出す
//
// 最大のデータで動かす：node tools/serve.js --demo --max [ポート]（既定 8767）→ http://localhost:8767/stats
//   - 保存できる上限いっぱいの記録（PLL・OLL 各 10000 件、ソルブ・LL 各 5000 件。過去 400 日）・全ケース習得済み・
//     全ケースの自分の手順・すべてのバッジ（隠しバッジも）を取った状態（tools/demo-data.js の buildMax）
//   - ポートを --demo と分けるので、ブラウザの保存も別になる
//   - データは大きい（約 2.5MB）ので、ページごとには埋め込まず、まだ入れていないときだけ /__demo/data.json を読んで入れる。
//     ブラウザの保存に入りきらなかったときは、右下の印にそう出す
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const args = process.argv.slice(2);
const DEMO = args.includes('--demo');
const MAX = DEMO && args.includes('--max');
const PORT = Number(args.find((a) => /^\d+$/.test(a))) || (MAX ? 8767 : DEMO ? 8766 : 8765);
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
// 入れるデータ（JSON の文字列）。--max はサーバーを起動したときの日時で 1 回だけ作る（大きいので毎回は作らない）
let maxJson = null;
function demoJson() {
  const D = require('./demo-data.js');
  if (!MAX) return JSON.stringify(D.build({ now: Date.now() }));
  if (!maxJson) maxJson = JSON.stringify(D.buildMax({ now: Date.now() }));
  return maxJson;
}
// データの版：作るのに使ったファイル（tools/demo-data.js と、それが読み込む js/ のファイル）の中身から決める。
// ブラウザに入れたときの印に残し、版が変わっていたら（作り方・手順の確かめ方などを直したら）次に開いたときに入れ直す
function demoVersion() {
  if (!DEMO) return '';
  demoJson(); // 読み込むファイルを require.cache に入れる
  const hash = crypto.createHash('sha1');
  Object.keys(require.cache)
    .filter((f) => f.startsWith(ROOT + path.sep))
    .sort()
    .forEach((f) => hash.update(f).update(fs.readFileSync(f)));
  return hash.digest('hex').slice(0, 12);
}
const VERSION = demoVersion();
const LABEL = MAX ? '最大のデータ（ログインしている扱い）' : 'テストデータ（ログインしている扱い）';

// 各ページの <head> の最初に入れるスクリプト：まだ入れていなければテストデータを入れ（/__demo/data.json を同期で読む）、右下に印を出す。
// 印には demo / max のどちらを入れたかとデータの版（VERSION）も残し、同じポートでモードを変えて起動し直したときや、
// データの作り方を直したときは、このサイトの保存を消して入れ直す（そのポートで変えた習得状況なども消える）
function demoScript() {
  return `(function () {
  var P = ${JSON.stringify(PREFIX)}, MARK = ${JSON.stringify(DEMO_MARK)}, MODE = ${JSON.stringify((MAX ? 'max' : 'demo') + '@' + VERSION)}, error = '';
  try {
    if (String(localStorage.getItem(MARK) || '').split(':')[0] !== MODE) {
      Object.keys(localStorage).forEach(function (k) { if (k.indexOf(P) === 0) localStorage.removeItem(k); });
      var xhr = new XMLHttpRequest();
      xhr.open('GET', '/__demo/data.json', false);
      xhr.send();
      var data = JSON.parse(xhr.responseText);
      Object.keys(data).forEach(function (k) { localStorage.setItem(P + k, JSON.stringify(data[k])); });
      localStorage.setItem(MARK, MODE + ':' + Date.now());
      localStorage.setItem(P + 'session', 'in'); // ログインしている扱い（称号とバッジはログイン中だけ。--demo ではログインを使わない）
    }
  } catch (e) {
    error = e && e.name === 'QuotaExceededError' ? '（ブラウザの保存に入りきりませんでした）' : '（入れられませんでした：' + (e && e.message) + '）';
  }
  document.addEventListener('DOMContentLoaded', function () {
    var b = document.createElement('div');
    b.style.cssText = 'position:fixed;right:8px;bottom:8px;z-index:9999;padding:4px 10px;border-radius:999px;background:#fff3cd;color:#664d03;border:1px solid #ffe69c;font:12px/1.4 system-ui,sans-serif;box-shadow:0 2px 6px rgba(0,0,0,.1)';
    b.innerHTML = ${JSON.stringify(LABEL)} + error + ' · <a href="/__demo/reset" style="color:inherit">入れ直す</a>';
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
  if (pathname === '/__demo/data.json') {
    res.writeHead(200, { 'Content-Type': TYPES['.json'], 'Cache-Control': 'no-store' });
    res.end(demoJson());
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
    if (MAX) console.log('最大のデータ（PLL・OLL 各 10000 件、ソルブ・LL 各 5000 件、すべてのバッジ）を入れます。');
    if (DEMO) console.log(`テストデータで動かしています（ログインは使わない）。記録のページ：http://localhost:${PORT}/stats　入れ直す：http://localhost:${PORT}/__demo/reset`);
  });
