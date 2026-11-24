// 実行: node --test test/
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../js/megaminx-state.js');

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
  // 小文字は大文字と同じに読む（r = R）ので、読めない記号の例は x・z など
  ['R X', 'x', 'z2', '(R U', 'R U)', "R2'2"].forEach((alg) => assert.throws(() => M.parseAlg(alg), SyntaxError, alg));
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

test('cancelRotation：手順中の持ち替え（y）の合計を打ち消す', () => {
  const same = (a, b) => a.every((x, i) => x === b[i]);
  // 持ち替えだけなら揃った状態のまま
  assert.ok(same(M.applyAlg("y y2'", { cancelRotation: true }), SOLVED));
  assert.ok(same(M.applyAlg('y', { inverse: true, cancelRotation: true }), SOLVED));
  // 最後に持ち替えを戻した手順と同じ結果になる
  const alg = "R U y' R U' R'";
  assert.ok(same(M.applyAlg(alg, { cancelRotation: true }), M.applyAlg(alg + ' y')));
  assert.ok(same(M.applyAlg(alg, { inverse: true, cancelRotation: true }), M.applyAlg(alg + ' y', { inverse: true })));
  // 持ち替えが無ければ変わらない
  assert.ok(same(M.applyAlg("R U R'", { cancelRotation: true }), M.applyAlg("R U R'")));
});

test('記号の大文字・小文字は区別しない（br = BR、Y = y）。DFR・DFL は DR・DL の別名', () => {
  const same = (a, b) => assert.deepEqual(M.parseAlg(a), M.parseAlg(b));
  same("r u r' bR2 dbl' f2 b d", "R U R' BR2 DBL' F2 B D");
  same("Y U y'", "y U y'");
  same("Dfr dfl'", "DR DL'");
  assert.deepEqual(M.applyAlg("bR u' Br"), M.applyAlg("BR U' BR"));
});

test('canonicalAlg：記号を正しい表記に書き直し、空白・括弧・回数はそのまま', () => {
  assert.equal(M.canonicalAlg("(u') r u bR' Y dbr2 Dfr"), "(U') R U BR' y DBR2 DR");
  assert.equal(M.canonicalAlg("(R U R' U')2 F’"), "(R U R' U')2 F'");
});

test('simplifyAlg：続けて並んだ同じ面をまとめ、打ち消し合う手順を消す（括弧はまたがない）', () => {
  const S = (alg) => M.simplifyAlg(alg);
  assert.deepEqual(S("R R'"), { alg: '', changed: true });
  assert.deepEqual(S('R R'), { alg: 'R2', changed: true });
  assert.deepEqual(S('R2 R'), { alg: "R2'", changed: true }); // 3 回は R2'
  assert.deepEqual(S("R2' R'"), { alg: 'R2', changed: true }); // 4 + 3 = 7 → 2 回
  assert.deepEqual(S("R U U' R'"), { alg: '', changed: true }); // 消えたあとに並んだ R・R' もまとめる
  assert.deepEqual(S("y y'"), { alg: '', changed: true });
  assert.deepEqual(S('F6 R5 U'), { alg: 'F6 U', changed: true }); // 回さないのと同じ R5 は消す。F6 単独はそのまま
  assert.deepEqual(S("(R R')2 U"), { alg: 'U', changed: true }); // 空になった括弧は回数ごと消す
  assert.deepEqual(S('(R R) U2'), { alg: '(R2) U2', changed: true });
  // まとめるものが無ければそのまま（括弧・回数・書き方は変えない。記号は正しい表記、空白は 1 つに）
  assert.deepEqual(S("R U R' U'"), { alg: "R U R' U'", changed: false });
  assert.deepEqual(S("(R U) U'"), { alg: "(R U) U'", changed: false });
  assert.deepEqual(S("(U) R  U R' U' (R U R')'2"), { alg: "(U) R U R' U' (R U R')'2", changed: false });
  assert.deepEqual(S('R3'), { alg: 'R3', changed: false });
  assert.deepEqual(S("r bR'"), { alg: "R BR'", changed: false });
  // まとめても回し方は同じ
  const alg = "R U U2 R' F F' DBR (L L)2 y y U";
  assert.deepEqual(M.applyAlg(S(alg).alg), M.applyAlg(alg));
  assert.throws(() => S('R X'), /Invalid move/);
});
