// メガミンクス上面（U面11枚＋側面上段15枚）の画像を canvas に描く（入力欄に依存しない描画だけ）。
// index.html（megaminx.js 経由）と一覧ページ（pll.html）で使う。
//
//   MegaminxDraw.draw(canvas, ucolor, scolor, { border, background })
//     canvas の幅を画像サイズとして描く。border は線の色（省略時は黒）、
//     background は背景色（省略・null なら透明）
//   MegaminxDraw.colorConvert(color) … 色コード（d u p …）または #rrggbb → CSS の色
//
// 描画の座標：頂点 k（0..4）は上から反時計回り、辺 k は頂点 k と k+1 の間（辺2が下＝F）。
//   ucolor[0]        U中心
//   ucolor[1 + 2k]   U面の角（頂点 k）
//   ucolor[2 + 2k]   U面の辺（辺 k）
//   scolor[3k..3k+2] 辺 k の側面上段（左の角・辺・右の角）
(function () {
  'use strict';

  // 色コード → CSSの色。'#' で始まる値（任意色）はそのまま使う
  const COLORS = {
    d: 'dimgray', u: 'lightgray', p: 'pink', c: 'lemonchiffon', a: 'aqua', o: 'orange', l: 'lawngreen',
    b: 'dodgerblue', y: 'yellow', s: 'darkviolet', g: 'seagreen', r: 'red', w: 'white', x: 'black', z: '#1b1b1b',
  };
  function colorConvert(color) {
    return typeof color === 'string' && color[0] === '#' ? color : COLORS[color];
  }

  function draw(canvas, ucolor, scolor, options) {
    const opts = options || {};
    const ctx = canvas.getContext('2d');
    const origin = canvas.width / 2; // 画像サイズの半分
    const R = {
      center: (origin * 35) / 105, // U中心の五角形
      inner: (origin * 80) / 105, // U面の外周
      outer: (origin * 100) / 105, // 側面の外周
      in: (origin * 65) / 105, // 辺の点（U面側）
      out: (origin * 84) / 105, // 辺の点（外周側）
    };

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

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (opts.background) {
      ctx.fillStyle = opts.background;
      ctx.fillRect(0, 0, origin * 2, origin * 2);
    }

    // ステッカー（線の太さは画像サイズに比例。200px のとき 2px）
    ctx.lineWidth = (2 * origin) / 100;
    ctx.strokeStyle = colorConvert(opts.border || '#000000');

    polygon(pentagonPoints(R.center), colorConvert(ucolor[0]));
    for (let k = 0; k < 5; k++) {
      polygon(upCorner(k), colorConvert(ucolor[1 + 2 * k]));
      polygon(upEdge(k), colorConvert(ucolor[2 + 2 * k]));
    }
    for (let k = 0; k < 5; k++) {
      polygon(sideCornerLeft(k), colorConvert(scolor[3 * k]));
      polygon(sideEdge(k), colorConvert(scolor[3 * k + 1]));
      polygon(sideCornerRight((k + 1) % 5), colorConvert(scolor[3 * k + 2]));
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

  window.MegaminxDraw = { draw: draw, colorConvert: colorConvert };
})();
