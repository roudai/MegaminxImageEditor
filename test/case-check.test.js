// 実行: node --test test/*.test.js
// js/case-check.js（手順の確認）と js/custom-algs.js の validate（自分の手順の確認）
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/case-check.js');
const CA = require('../js/custom-algs.js');
const PLL = require('../js/pll-data.js');
const OLL = require('../js/oll-data.js');

const pll = (name) => PLL.find((c) => c.name === name);
const oll = (name) => OLL.find((c) => c.name === name);

test('既定の全ケースが確認を通る', () => {
  PLL.forEach((c) => assert.equal(C.check('pll', c.alg, c.setup), null, c.name));
  OLL.forEach((c) => assert.equal(C.check('oll', c.alg, c.setup), null, c.name));
});

test('記法を読み替える', () => {
  assert.equal(C.convert("Br Bl' Dfr2"), "BR BL' DR2");
});

test('PLL：前の AUF が違う正しい手順でも、setup の AUF を付け直して確認を通る', () => {
  const c = pll('J3+');
  ['', 'U', 'U2', "U2'", "U'"].forEach((u) => {
    const a = u ? `(${u}) ${c.alg}` : c.alg;
    const fit = C.fitSetup('pll', a, c.setup);
    assert.ok(fit, u);
    assert.equal(C.check('pll', fit.a, fit.s), null, u);
  });
});

test('最後の AUF・持ち替えは外される', () => {
  const c = pll('A1+');
  const fit = C.fitSetup('pll', `${c.alg} (U2) y`, c.setup);
  assert.equal(fit.a, c.alg);
  const r = CA.validate('pll', c, `${c.alg} U'`, PLL);
  assert.ok(r.ok);
  assert.equal(r.alg, c.alg);
  assert.deepEqual(r.notes, ['stripped']);
});

test('別のケースの手順はエラーになり、実際に解けるケースを示す', () => {
  const r = CA.validate('pll', pll('J3+'), `(U2) ${pll('C2+').alg}`, PLL);
  assert.equal(r.ok, false);
  assert.match(r.error, /does not solve J3\+ \(it solves C2\+\)/);
  assert.equal(C.findCase('pll', pll('C2+').alg, PLL).name, 'C2+');
  assert.equal(C.findCase('oll', oll('3A+').alg, OLL).name, '3A+');
});

test('記法の誤り・空の入力はエラー', () => {
  assert.match(CA.validate('pll', pll('A1+'), 'R X', PLL).error, /Invalid move/);
  assert.equal(CA.validate('pll', pll('A1+'), '   ', PLL).ok, false);
});

test('OLL：別の正しい手順は保存でき、向きは揃っても F2L を崩す手順はエラー', () => {
  const c = oll('3A+');
  const r = CA.validate('oll', c, "U2 R U R' U R U2' R'", OLL);
  assert.ok(r.ok);
  assert.equal(C.check('oll', r.alg, r.setup), null);
  // 正しい手順のあとに F2L を崩して戻さない手順を足すと、向きが揃っても F2L が崩れる
  assert.equal(CA.validate('oll', c, `${c.alg} R`, OLL).ok, false);
});

test('既定と同じ手順は isDefault になる（空白・括弧・書き方の違いも同じとみなす）', () => {
  const c = pll('A1+');
  assert.equal(CA.validate('pll', c, c.alg, PLL).isDefault, true);
  assert.equal(CA.validate('pll', c, '  ' + c.alg.replace(/ /g, '  ') + ' (U)', PLL).isDefault, true);
  const o = oll('2B'); // 既定の手順の書き方を変えたもの（R → R6 は同じ回し方）
  assert.equal(CA.validate('oll', o, o.alg.replace(/^F /, 'F6 '), OLL).isDefault, true);
  assert.equal(CA.validate('pll', pll('J3+'), "R2 U R2' U' R2 U2' R2' U2 R2 U' R2' U2 R2 U2 R2'", PLL).isDefault, undefined);
});

test('merged：保存値が無ければ既定のまま。既定と同じ手順の保存値も既定として扱う', () => {
  assert.deepEqual(CA.merged('pll', PLL), PLL);
  const j3 = CA.validate('pll', pll('J3+'), "R2 U R2' U' R2 U2' R2' U2 R2 U' R2' U2 R2 U2 R2'", PLL);
  const saved = {
    pll: { 'A1-': { alg: pll('A1-').alg, setup: pll('A1-').setup }, 'J3+': { alg: j3.alg, setup: j3.setup } },
  };
  global.localStorage = { getItem: () => JSON.stringify(saved), setItem() {} };
  try {
    const merged = CA.merged('pll', PLL);
    assert.equal(merged.find((c) => c.name === 'A1-').custom, undefined);
    assert.equal(merged.find((c) => c.name === 'J3+').custom, true); // 別の手順は自分の手順になる
  } finally {
    delete global.localStorage;
  }
});

test('自分の手順：小文字で入力しても正しい表記にして保存する', () => {
  const c = pll('J3+');
  const r = CA.validate('pll', c, "r2 u r2' u' r2 u2' r2' u2 r2 u' r2' u2 r2 u2 r2'", PLL);
  assert.ok(r.ok);
  assert.equal(r.alg, "R2 U R2' U' R2 U2' R2' U2 R2 U' R2' U2 R2 U2 R2'");
  assert.equal(CA.validate('pll', c, c.alg.toLowerCase(), PLL).isDefault, true);
});

test('pllAfter：PLL のスクランブルに OLL のスクランブルをつなぎ、OLL の手順を当てたあとの PLL が分かる', () => {
  const P_SCR = require('../js/pll-scrambles.js');
  const O_SCR = require('../js/oll-scrambles.js');
  const o = oll('1A');
  // OLL のスクランブルだけ：上面が揃う AUF は 1 つで、出てくる PLL は 1 つ
  const alone = C.pllAfter(O_SCR['1A'][0], o.alg, PLL);
  assert.equal(alone.length, 1);
  assert.ok(alone[0] && alone[0].name);
  // その PLL の逆（setup の逆＝解く手順）を前に付けると、OLL のあとは PLL スキップ
  const p = alone[0];
  const undo = C.pllAfter(`${p.alg} ${O_SCR['1A'][0]}`, o.alg, PLL);
  assert.ok(undo.includes('skip'));
  // PLL のスクランブルをつないでも、上面が揃う AUF があり PLL が決まる
  Object.keys(P_SCR).slice(0, 10).forEach((name) => {
    const r = C.pllAfter(`${P_SCR[name][0]} U ${O_SCR['1A'][0]}`, o.alg, PLL);
    assert.ok(r.length >= 1, name);
    r.forEach((x) => assert.ok(x === 'skip' || (x && x.name), name));
  });
  // OLL の手順が違えば上面が揃わない
  assert.deepEqual(C.pllAfter(O_SCR['1A'][0], 'R', PLL), []);
});

test('pllAfter：全 OLL ケースで、スクランブルに手順を当てると PLL が決まる', () => {
  const O_SCR = require('../js/oll-scrambles.js');
  OLL.forEach((c) => {
    O_SCR[c.name].slice(0, 3).forEach((scramble) => {
      const r = C.pllAfter(scramble, c.alg, PLL);
      assert.ok(r.length >= 1, c.name);
      r.forEach((x) => assert.ok(x === 'skip' || (x && x.name), c.name));
    });
  });
});
