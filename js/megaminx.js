// メガミンクス上面（U面11枚＋側面上段15枚）の画像を canvas に描く。
// 外から使う関数（index.html と他のスクリプト）: imageChange, downloadImage, renderImage, color_convert
//
// 描画の座標：頂点 k（0..4）は上から反時計回り、辺 k は頂点 k と k+1 の間（辺2が下＝F）。
//   ucolor[0]        U中心
//   ucolor[1 + 2k]   U面の角（頂点 k）
//   ucolor[2 + 2k]   U面の辺（辺 k）
//   scolor[3k..3k+2] 辺 k の側面上段（左の角・辺・右の角）
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  // 描画先（renderImage の間だけ別の canvas に差し替える）
  let canvas = $('canvas');
  let ctx = canvas.getContext('2d');

  // 色コード → CSSの色。'#' で始まる値（任意色）はそのまま使う
  const COLORS = {
    d: 'dimgray', u: 'lightgray', p: 'pink', c: 'lemonchiffon', a: 'aqua', o: 'orange', l: 'lawngreen',
    b: 'dodgerblue', y: 'yellow', s: 'darkviolet', g: 'seagreen', r: 'red', w: 'white', x: 'black', z: '#1b1b1b',
  };
  function color_convert(color) {
    return typeof color === 'string' && color[0] === '#' ? color : COLORS[color];
  }

  // ---- 描画の状態（初期値は canvas の属性）----
  let origin = canvas.width / 2; // 画像サイズの半分
  let ucolor = canvas.getAttribute('ucolor');
  let scolor = canvas.getAttribute('scolor');
  let R; // 半径（render で origin から計算）

  // ---- 座標 ----
  // 頂点 k の方向にある半径 r の点
  function corner(r, k) {
    const t = (2 * Math.PI * k) / 5 + Math.PI / 2;
    return [origin + r * Math.cos(t), origin - r * Math.sin(t) + origin / 12];
  }

  // 辺 k の中央付近の点。side: 'in'（U面との境）/ 'out'（外周）、l: 0（頂点 k 側）/ 1（頂点 k+1 側）
  function edge(side, k, l) {
    const r = side === 'in' ? R.in : R.out;
    const gap = side === 'in' ? 0.043 : 0.081;
    const angle = l === 0 ? 0.4 * k + 0.2 - gap : 0.4 * k + 0.2 + gap;
    const t = angle * Math.PI + Math.PI / 2;
    return [origin + r * Math.cos(t), origin - r * Math.sin(t) + origin / 12];
  }

  const prev = (k) => (k + 4) % 5;
  const pentagonPoints = (r) => [0, 1, 2, 3, 4].map((k) => corner(r, k));

  // ---- 図形 ----
  // 多角形を描く（color を渡したときだけ塗る）。線は現在の lineWidth / strokeStyle
  function polygon(points, color) {
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    points.slice(1).forEach((p) => ctx.lineTo(p[0], p[1]));
    ctx.closePath();
    if (color != null) {
      ctx.fillStyle = color;
      ctx.fill();
    }
    ctx.stroke();
  }

  const upCorner = (k) => [corner(R.center, k), edge('in', prev(k), 1), corner(R.inner, k), edge('in', k, 0)];
  const upEdge = (k) => [corner(R.center, k), edge('in', k, 0), edge('in', k, 1), corner(R.center, k + 1)];
  const sideCornerLeft = (k) => [corner(R.inner, k), corner(R.outer, k), edge('out', k, 0), edge('in', k, 0)];
  const sideCornerRight = (k) => [corner(R.inner, k), corner(R.outer, k), edge('out', prev(k), 1), edge('in', prev(k), 1)];
  const sideEdge = (k) => [edge('in', k, 0), edge('out', k, 0), edge('out', k, 1), edge('in', k, 1)];

  // ---- 描画 ----
  function render() {
    R = {
      center: (origin * 35) / 105, // U中心の五角形
      inner: (origin * 80) / 105, // U面の外周
      outer: (origin * 100) / 105, // 側面の外周
      in: (origin * 65) / 105, // 辺の点（U面側）
      out: (origin * 84) / 105, // 辺の点（外周側）
    };

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if ($('bg').value === 'n') {
      ctx.fillStyle = $('bgColor').value;
      ctx.fillRect(0, 0, origin * 2, origin * 2);
    }

    // ステッカー（線の太さは画像サイズに比例。200px のとき 2px）
    ctx.lineWidth = (2 * origin) / 100;
    ctx.strokeStyle = color_convert($('border').value);

    polygon(pentagonPoints(R.center), color_convert(ucolor[0]));
    for (let k = 0; k < 5; k++) {
      polygon(upCorner(k), color_convert(ucolor[1 + 2 * k]));
      polygon(upEdge(k), color_convert(ucolor[2 + 2 * k]));
    }
    for (let k = 0; k < 5; k++) {
      polygon(sideCornerLeft(k), color_convert(scolor[3 * k]));
      polygon(sideEdge(k), color_convert(scolor[3 * k + 1]));
      polygon(sideCornerRight((k + 1) % 5), color_convert(scolor[3 * k + 2]));
    }

    // 輪郭（200px のとき 4px）：U面の外周、側面の外周、側面の区切り5本
    ctx.lineWidth = (4 * origin) / 100;
    polygon(pentagonPoints(R.inner));
    polygon(pentagonPoints(R.outer));
    for (let k = 0; k < 5; k++) {
      const [x1, y1] = corner(R.inner, k);
      const [x2, y2] = corner(R.outer, k);
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
    }
    ctx.stroke();
  }

  // ---- 外から呼ぶ関数 ----
  // 入力欄（サイズ・各ステッカーの色）を読み直して描き直す
  function imageChange() {
    sizecheck();
    const size = $('imageSize').value;
    canvas.width = size;
    canvas.height = size;
    origin = size / 2;

    ucolor = [];
    for (let i = 0; i <= 10; i++) ucolor.push($('uface' + i).value);
    scolor = [];
    for (let i = 1; i <= 15; i++) scolor.push($('sface' + i).value);

    render();
  }

  // PNG で保存する。ファイル名が .png で終わらなければ付け足す（空欄なら megaminx.png）
  function downloadImage() {
    render();
    const name = $('fname').value.trim() || 'megaminx';
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = /\.png$/i.test(name) ? name : name + '.png';
    link.click();
  }

  // 画面の canvas は変えずに、今の設定（サイズ・Body Color・Background）で
  // 指定した色の画像を新しい canvas に描いて返す（一括ダウンロード用）
  function renderImage(uc, sc) {
    sizecheck();
    const size = Number($('imageSize').value);
    const target = document.createElement('canvas');
    target.width = size;
    target.height = size;
    const saved = [canvas, ctx, origin, ucolor, scolor];
    canvas = target;
    ctx = target.getContext('2d');
    origin = size / 2;
    ucolor = uc;
    scolor = sc;
    try {
      render();
    } finally {
      [canvas, ctx, origin, ucolor, scolor] = saved;
    }
    return target;
  }

  // 画像サイズを 100〜1000 に収める（空欄なら 200）
  function sizecheck() {
    const size = $('imageSize').value;
    if (size === '') $('imageSize').value = 200;
    else if (size < 100) $('imageSize').value = 100;
    else if (size > 1000) $('imageSize').value = 1000;
  }

  window.imageChange = imageChange;
  window.downloadImage = downloadImage;
  window.renderImage = renderImage;
  window.color_convert = color_convert;

  render();
})();
