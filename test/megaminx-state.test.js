// 実行: node --test test/
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../megaminx-state.js');

const SOLVED = M.solved();
const ALL_MOVES = M.FACES.concat(['y']);

function order(alg) {
  const moves = M.parseAlg(alg);
  let st = SOLVED;
  for (let n = 1; n <= 10000; n++) {
    st = M.applyMoves(st, moves);
    if (st.every((c, i) => c === SOLVED[i])) return n;
  }
  return Infinity;
}

// 乱数（再現性のため固定シード）
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

function randomAlg(rand, len) {
  const suf = ['', "'", '2', "2'"];
  return Array.from({ length: len }, () => ALL_MOVES[Math.floor(rand() * ALL_MOVES.length)] + suf[Math.floor(rand() * 4)]).join(' ');
}

test('132ステッカー、各面12色×11枚', () => {
  assert.equal(SOLVED.length, 132);
  M.FACES.forEach((f) => assert.equal(SOLVED.filter((c) => c === f).length, 11));
});

test('各面（とy）を5回で元に戻る、1〜4回では戻らない', () => {
  ALL_MOVES.forEach((f) => assert.equal(order(f), 5, f));
});

test('手順＋逆手順で元に戻る', () => {
  const rand = rng(42);
  for (let i = 0; i < 50; i++) {
    const alg = randomAlg(rand, 20);
    const st = M.applyAlg(alg);
    assert.deepEqual(M.applyAlg(alg, { inverse: true, state: st }), SOLVED, alg);
  }
});

test("R U R' U' の位数は6", () => {
  assert.equal(order("R U R' U'"), 6);
});

test("Python版と一致（R U R' U' 適用後）", () => {
  const v = M.topView(M.applyAlg("R U R' U'"));
  assert.equal(v.center, 'U');
  assert.deepEqual(v.edges, ['U', 'F', 'U', 'U', 'U']);
  assert.deepEqual(v.corners, ['F', 'BL', 'U', 'U', 'U']);
  assert.deepEqual(v.sides, {
    F: ['F', 'F', 'DR'],
    R: ['R', 'R', 'U'],
    BR: ['BR', 'R', 'R'],
    BL: ['BR', 'BL', 'BL'],
    L: ['L', 'L', 'L'],
  });
});

test('記法：X2 = X X、X2\' = X\' X\'、X\' = X X X X', () => {
  assert.deepEqual(M.applyAlg('R2'), M.applyAlg('R R'));
  assert.deepEqual(M.applyAlg("R2'"), M.applyAlg("R' R'"));
  assert.deepEqual(M.applyAlg("R'2"), M.applyAlg("R2'"));
  assert.deepEqual(M.applyAlg("R'"), M.applyAlg('R R R R'));
});

test('記法：全角アポストロフィ・括弧・回数・区切りなし', () => {
  assert.deepEqual(M.applyAlg('R U’ R’'), M.applyAlg("R U' R'"));
  assert.deepEqual(M.applyAlg("(R U R' U')2"), M.applyAlg("R U R' U' R U R' U'"));
  assert.deepEqual(M.applyAlg("F (R U R' U') F'"), M.applyAlg("F R U R' U' F'"));
  assert.deepEqual(M.applyAlg("（R U）'"), M.applyAlg("U' R'"));
  assert.deepEqual(M.applyAlg("RU2'DBR"), M.applyAlg("R U2' DBR"));
  assert.deepEqual(M.applyAlg('DBL DL B'), M.applyAlg('DBL  DL\tB'));
  assert.deepEqual(M.applyAlg(''), SOLVED);
});

test('記法：不正な入力はエラー', () => {
  ['R X', 'r', '(R U', 'R U)', "R2'2"].forEach((alg) => assert.throws(() => M.parseAlg(alg), SyntaxError, alg));
});

test("全体回転 y：y R y' = BR、y U y' = U", () => {
  assert.deepEqual(M.applyAlg("y R y'"), M.applyAlg('BR'));
  assert.deepEqual(M.applyAlg("y U y'"), M.applyAlg('U'));
  // y 後は R の色が正面（F）に来る
  assert.deepEqual(M.topView(M.applyAlg('y')).sides.F, ['R', 'R', 'R']);
});

test('inverse オプション = 逆手順の適用', () => {
  assert.deepEqual(M.applyAlg("R U R' U'", { inverse: true }), M.applyAlg("U R U' R'"));
});

test('toImageColors：揃った状態', () => {
  const { ucolor, scolor } = M.toImageColors(SOLVED, M.DEFAULT_SCHEME);
  assert.equal(ucolor.length, 11);
  assert.equal(scolor.length, 15);
  assert.deepEqual(ucolor, Array(11).fill('u'));
  // 辺0=BL、辺1=L、辺2=F、辺3=R、辺4=BR
  assert.equal(scolor.join(''), 'pppcccaaaooolll'); // index.html の初期表示と同じ
});

test("toImageColors：R U R' U' の配置（描画位置との対応）", () => {
  const names = Object.fromEntries(M.FACES.map((f) => [f, f]));
  const { ucolor, scolor } = M.toImageColors(M.applyAlg("R U R' U'"), names);
  // U角(F-R,R-BR,BR-BL,BL-L,L-F) = F BL U U U、U辺(F,R,BR,BL,L) = U F U U U
  assert.deepEqual(ucolor, [
    'U',
    'U', 'U', // 角0(BR-BL) 辺0(BL)
    'U', 'U', // 角1(BL-L)  辺1(L)
    'U', 'U', // 角2(L-F)   辺2(F)
    'F', 'F', // 角3(F-R)   辺3(R)
    'BL', 'U', // 角4(R-BR) 辺4(BR)
  ]);
  assert.deepEqual(scolor, ['BR', 'BL', 'BL', 'L', 'L', 'L', 'F', 'F', 'DR', 'R', 'R', 'U', 'BR', 'R', 'R']);
});

test('ollMask：U色以外は灰色', () => {
  const mask = M.ollMask(M.DEFAULT_SCHEME);
  const { ucolor, scolor } = M.toImageColors(M.applyAlg("R U R' U'"), mask);
  assert.deepEqual(ucolor, ['u', 'u', 'u', 'u', 'u', 'u', 'u', 'd', 'd', 'd', 'u']);
  assert.deepEqual(scolor.map((c) => (c === 'u' ? 'u' : '.')).join(''), '...........u...');
  assert.ok(scolor.filter((c) => c !== 'u').every((c) => c === 'd'));
});

test('未設定の面があればエラー', () => {
  assert.throws(() => M.toImageColors(SOLVED, { U: 'w' }), /No color set for face/);
});
