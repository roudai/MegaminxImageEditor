/*
 * メガミンクスの状態計算（DOM非依存）
 *
 * 回転記号の列から132ステッカーの状態を求め、画像用の色コード
 * （上面11枚＋側面上段15枚）に変換する。
 * 参考実装: reference/megaminx_top.py
 *
 * 記法:
 *   X   = 面Xを外側から見て時計回りに72°   (X = U F R L BR BL DR DL DBR DBL B D)
 *   X'  = 反時計回り72°
 *   X2  = 時計回り144°,  X2' = 反時計回り144°（'2 も可）
 *   y   = 全体をU軸まわりに回転（Uと同じ向き）。y' y2 y2' も可
 *   ( ... )  = グループ。直後に回数（例: (R U R' U')2）や ' （逆手順）を付けられる
 *   全角アポストロフィ ’ や全角括弧（）も可
 *
 * 面の配置（上から見て反時計回り）:
 *   上段: F, R, BR, BL, L    下段: DR, DBR, B, DBL, DL    底: D
 *
 * ブラウザでは window.MegaminxState、node では module.exports として公開する。
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.MegaminxState = api;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---- 幾何 ----
  const SQ5 = Math.sqrt(5);
  const C = 1 / SQ5; // 隣接面の法線の内積
  const S = 2 / SQ5;
  const T = 0.6; // ステッカー位置の内側への寄せ係数

  const UPPER = ['F', 'R', 'BR', 'BL', 'L'];
  const LOWER = ['DR', 'DBR', 'B', 'DBL', 'DL'];
  const FACES = ['U'].concat(UPPER, LOWER, ['D']);

  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const add = (...vs) => [0, 1, 2].map((i) => vs.reduce((s, v) => s + v[i], 0));
  const mul = (v, k) => v.map((x) => x * k);
  const rad = (deg) => (deg * Math.PI) / 180;

  const N = { U: [0, 0, 1], D: [0, 0, -1] };
  UPPER.forEach((name, i) => {
    const th = rad(270 + 72 * i); // F=270°, 反時計回りに+72°ずつ
    N[name] = [S * Math.cos(th), S * Math.sin(th), C];
  });
  LOWER.forEach((name, i) => {
    const th = rad(270 + 36 + 72 * i);
    N[name] = [S * Math.cos(th), S * Math.sin(th), -C];
  });

  const adjacent = (a, b) => Math.abs(dot(N[a], N[b]) - C) < 1e-9;
  const pieceKey = (faces) => faces.slice().sort().join(',');

  // ---- ステッカー生成（面ごとに 中心1 + 辺5 + 角5 = 11枚）----
  // key: 'c'（中心）または そのピースが接する面名をソートして ',' で連結したもの
  const STICKERS = [];
  FACES.forEach((f) => {
    STICKERS.push({ face: f, key: 'c', pos: N[f] });
    FACES.forEach((g) => {
      if (g === f || !adjacent(f, g)) return;
      const m = mul(add(N[f], N[g]), 1 / (1 + C)); // 辺の中点
      STICKERS.push({ face: f, key: pieceKey([f, g]), pos: add(mul(N[f], 1 - T), mul(m, T)) });
      FACES.forEach((h) => {
        if (h > g && h !== f && adjacent(f, h) && adjacent(g, h)) {
          const v = mul(add(N[f], N[g], N[h]), 1 / (1 + 2 * C)); // 頂点
          STICKERS.push({ face: f, key: pieceKey([f, g, h]), pos: add(mul(N[f], 1 - T), mul(v, T)) });
        }
      });
    });
  });
  if (STICKERS.length !== 132) throw new Error('sticker count: ' + STICKERS.length);

  const LOOKUP = {};
  STICKERS.forEach((s, i) => {
    LOOKUP[s.face + '|' + s.key] = i;
  });
  const at = (state, face, faces) => state[LOOKUP[face + '|' + (faces === 'c' ? 'c' : pieceKey(faces))]];

  function rotate(p, axis, ang) {
    const k = mul(axis, 1 / Math.sqrt(dot(axis, axis)));
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    const kxp = [k[1] * p[2] - k[2] * p[1], k[2] * p[0] - k[0] * p[2], k[0] * p[1] - k[1] * p[0]];
    return add(mul(p, c), mul(kxp, s), mul(k, dot(k, p) * (1 - c)));
  }

  function indexOfPos(p) {
    for (let i = 0; i < STICKERS.length; i++) {
      const q = STICKERS[i].pos;
      if (Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) + Math.abs(p[2] - q[2]) < 1e-6) return i;
    }
    throw new Error('position not found');
  }

  // 時計回り72°の置換 perm[元の位置] = 移動先。layerOnly=false なら全体回転
  function makeMove(axisFace, layerOnly) {
    const axis = N[axisFace];
    return STICKERS.map((s, i) =>
      !layerOnly || dot(s.pos, axis) > 0.7 ? indexOfPos(rotate(s.pos, axis, -rad(72))) : i
    );
  }

  const MOVES = {};
  FACES.forEach((f) => {
    MOVES[f] = makeMove(f, true);
  });
  MOVES.y = makeMove('U', false);

  // ---- 記号の解析 ----
  const FACE_RE = /DBR|DBL|BR|BL|DR|DL|U|F|R|L|B|D|y/y;
  const AMOUNT_RE = /(\d*)(')?(\d*)/y;

  function normalize(alg) {
    return String(alg)
      .replace(/[’‘′`´]/g, "'")
      .replace(/（/g, '(')
      .replace(/）/g, ')')
      .replace(/[\s　,、]+/g, ' ');
  }

  function invertMoves(moves) {
    return moves
      .slice()
      .reverse()
      .map((m) => ({ face: m.face, turns: (5 - m.turns) % 5 }));
  }

  // 回数と ' を読む。戻り値 { n, prime, end }。start は記号の先頭（エラー表示用）
  function readAmount(src, pos, start) {
    AMOUNT_RE.lastIndex = pos;
    const m = AMOUNT_RE.exec(src);
    if (m[1] && m[3]) throw new SyntaxError('Invalid move: ' + JSON.stringify(src.slice(start, pos + m[0].length)));
    const digits = m[1] || m[3];
    return { n: digits ? parseInt(digits, 10) : 1, prime: !!m[2], end: pos + m[0].length };
  }

  /** 手順文字列を [{face, turns}] に変換する（turns は時計回り72°単位で 0..4） */
  function parseAlg(alg) {
    const src = normalize(alg);
    let pos = 0;

    function seq(depth) {
      let out = [];
      for (;;) {
        while (src[pos] === ' ') pos++;
        if (pos >= src.length) {
          if (depth > 0) throw new SyntaxError('Missing closing parenthesis');
          return out;
        }
        const ch = src[pos];
        if (ch === ')') {
          if (depth === 0) throw new SyntaxError('Unmatched ")"');
          pos++;
          return out;
        }
        if (ch === '(') {
          const start = pos;
          pos++;
          const inner = seq(depth + 1);
          const a = readAmount(src, pos, start);
          pos = a.end;
          let group = [];
          for (let i = 0; i < a.n; i++) group = group.concat(inner);
          out = out.concat(a.prime ? invertMoves(group) : group);
          continue;
        }
        FACE_RE.lastIndex = pos;
        const fm = FACE_RE.exec(src);
        if (!fm) {
          const rest = src.slice(pos).split(' ')[0];
          throw new SyntaxError('Invalid move: ' + JSON.stringify(rest));
        }
        const a = readAmount(src, pos + fm[0].length, pos);
        pos = a.end;
        const n = a.prime ? -a.n : a.n;
        out.push({ face: fm[0], turns: ((n % 5) + 5) % 5 });
      }
    }

    return seq(0);
  }

  // ---- 状態 ----
  /** 揃った状態（各位置の色 = 初期の面名） */
  function solved() {
    return STICKERS.map((s) => s.face);
  }

  function applyMoves(state, moves) {
    let st = state.slice();
    moves.forEach((m) => {
      const perm = MOVES[m.face];
      for (let t = 0; t < m.turns; t++) {
        const next = st.slice();
        for (let i = 0; i < perm.length; i++) next[perm[i]] = st[i];
        st = next;
      }
    });
    return st;
  }

  /**
   * 手順を適用した状態を返す。
   * options.inverse: true なら逆手順を適用（＝その手順で解けるケースの状態）
   * options.state:   開始状態（省略時は揃った状態）
   * options.cancelRotation: true なら手順中の持ち替え（y）の合計を打ち消し、向きを元に戻した状態を返す。
   *   手順の最後に持ち替えを書かなくても、完成後の向きの違いを気にせず扱える（PLL の case 表示などに使う）
   */
  function applyAlg(alg, options) {
    const opts = options || {};
    let moves = parseAlg(alg);
    if (opts.inverse) moves = invertMoves(moves);
    if (opts.cancelRotation) {
      const fix = { face: 'y', turns: (5 - netRotation(moves)) % 5 };
      // 逆手順は「持ち替えを戻してから」、通常の手順は「最後に」打ち消す
      moves = opts.inverse ? [fix].concat(moves) : moves.concat([fix]);
    }
    return applyMoves(opts.state || solved(), moves);
  }

  /** 手順中の持ち替え（y）の合計（時計回り72°単位で 0..4） */
  function netRotation(moves) {
    return moves.reduce((sum, m) => (m.face === 'y' ? (sum + m.turns) % 5 : sum), 0);
  }

  /** 上面と側面上段を面名で返す（reference/megaminx_top.py の top_view と同じ形） */
  function topView(state) {
    const n = UPPER.length;
    const sides = {};
    UPPER.forEach((g, i) => {
      const prev = UPPER[(i + n - 1) % n];
      const next = UPPER[(i + 1) % n];
      sides[g] = [at(state, g, ['U', g, prev]), at(state, g, ['U', g]), at(state, g, ['U', g, next])];
    });
    return {
      center: at(state, 'U', 'c'),
      edges: UPPER.map((g) => at(state, 'U', ['U', g])), // F,R,BR,BL,L の隣
      corners: UPPER.map((g, i) => at(state, 'U', ['U', g, UPPER[(i + 1) % n]])), // F-R, R-BR, ...
      sides: sides,
    };
  }

  // ---- 色 ----
  // 既存の色コード: d u p c a o l b y s g r w z
  // 上段は index.html の初期表示（scolor="pppcccaaaooolll"）に合わせる。
  const DEFAULT_SCHEME = {
    U: 'u', // lightgray
    F: 'a', // aqua
    R: 'o', // orange
    BR: 'l', // lawngreen
    BL: 'p', // pink
    L: 'c', // lemonchiffon
    DR: 's', // darkviolet (BLの反対)
    DBR: 'y', // yellow     (Lの反対)
    B: 'b', // dodgerblue (Fの反対)
    DBL: 'r', // red        (Rの反対)
    DL: 'g', // seagreen   (BRの反対)
    D: 'w', // white
  };

  /** OLL用マスク：U面の色だけ残し、他は gray にする（既定 dimgray。U の lightgray と区別するため） */
  function ollMask(scheme, gray) {
    const base = scheme || DEFAULT_SCHEME;
    const g = gray || 'd';
    const out = {};
    FACES.forEach((f) => {
      out[f] = f === 'U' ? base.U : g;
    });
    return out;
  }

  /**
   * 状態を画像用の色コードに変換する。
   * 描画は頂点0が上・反時計回り、辺2が下（=F）。
   *   ucolor[0]       : U中心
   *   ucolor[1+2k]    : 角k = UPPER[(k+2)%5] と UPPER[(k+3)%5] の間
   *   ucolor[2+2k]    : 辺k = UPPER[(k+3)%5] 側
   *   scolor[3k..3k+2]: 面 UPPER[(k+3)%5] の上段（外から見て左→中→右）
   */
  function toImageColors(state, faceColors) {
    const scheme = faceColors || DEFAULT_SCHEME;
    const color = (face) => {
      if (!(face in scheme)) throw new Error('No color set for face: ' + face);
      return scheme[face];
    };
    const v = topView(state);
    const ucolor = [color(v.center)];
    const scolor = [];
    for (let k = 0; k < 5; k++) {
      const j = (k + 3) % 5; // 辺kに接する面 UPPER[j]
      ucolor.push(color(v.corners[(k + 2) % 5])); // UPPER[(k+2)%5]-UPPER[(k+3)%5] の角
      ucolor.push(color(v.edges[j]));
      v.sides[UPPER[j]].forEach((f) => scolor.push(color(f)));
    }
    return { ucolor: ucolor, scolor: scolor };
  }

  return {
    UPPER: UPPER,
    LOWER: LOWER,
    FACES: FACES,
    DEFAULT_SCHEME: DEFAULT_SCHEME,
    solved: solved,
    parseAlg: parseAlg,
    invertMoves: invertMoves,
    applyMoves: applyMoves,
    applyAlg: applyAlg,
    topView: topView,
    toImageColors: toImageColors,
    ollMask: ollMask,
  };
});
