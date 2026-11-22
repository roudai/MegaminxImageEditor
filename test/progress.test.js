// 実行: node --test test/*.test.js
// js/progress.js（覚えた度・練習の判定と記録・画像の配色）
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../js/progress.js');
const M = require('../js/megaminx-state.js');

function withStorage(initial, fn) {
  const map = new Map(Object.entries(initial || {}));
  global.localStorage = {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
  try {
    return fn(map);
  } finally {
    delete global.localStorage;
  }
}

test('thresholdOf：PLL・OLL それぞれの目安。無ければ以前の共通の threshold、それも無ければ PLL 8 秒・OLL 5 秒', () => {
  assert.equal(P.thresholdOf({ thresholds: { pll: 8, oll: 5 } }, 'pll'), 8);
  assert.equal(P.thresholdOf({ thresholds: { pll: 8, oll: 5 } }, 'oll'), 5);
  assert.equal(P.thresholdOf({ threshold: 10, thresholds: { pll: 6 } }, 'oll'), 10);
  assert.equal(P.thresholdOf({ threshold: 10 }, 'pll'), 10);
  assert.equal(P.thresholdOf({}, 'pll'), 8);
  assert.equal(P.thresholdOf(null, 'oll'), 5);
  assert.equal(P.thresholdOf({ thresholds: { pll: 10 } }, 'oll'), 5);
  assert.equal(P.thresholdOf({ thresholds: { pll: 0, oll: 'x' }, threshold: 500 }, 'pll'), 8);
  // 2〜20 秒・0.5 秒刻みにそろえる（以前は 120 秒まで選べた）
  assert.equal(P.thresholdOf({ thresholds: { pll: 30 } }, 'pll'), 20);
  assert.equal(P.thresholdOf({ threshold: 120 }, 'oll'), 20);
  assert.equal(P.thresholdOf({ thresholds: { pll: 1 } }, 'pll'), 2);
  assert.equal(P.thresholdOf({ thresholds: { pll: 6.3 } }, 'pll'), 6.5);
  assert.equal(P.clampThreshold(5.5), 5.5);
  assert.equal(P.clampThreshold(25), 20);
  assert.equal(P.clampThreshold(0.5), 2);
});

test('judge：しきい値以内なら習得済み、超えた・解けなかった（null）なら練習中', () => {
  assert.equal(P.judge(4.99, 5), 'learned');
  assert.equal(P.judge(5, 5), 'learned');
  assert.equal(P.judge(5.01, 5), 'learning');
  assert.equal(P.judge(null, 8), 'learning');
});

test('addTime：新しい順に足し、最大件数を超えた古いものは捨てる', () => {
  assert.deepEqual(P.addTime(undefined, 3.2), [3.2]);
  assert.deepEqual(P.addTime([2, 1], 3, 3), [3, 2, 1]);
  assert.deepEqual(P.addTime([3, 2, 1], 4, 3), [4, 3, 2]);
  assert.equal(P.addTime(new Array(10).fill(1), 2).length, 10);
});

test('statusOf / setStatus：覚えた度を読み書きし、未着手は保存しない（ほかの種類は消さない）', () => {
  withStorage({ 'megaminx-image-editor:progress': '{"oll":{"1A":"learned"}}' }, (map) => {
    assert.equal(P.statusOf('pll', 'A1+'), 'new');
    P.setStatus('pll', 'A1+', 'learned');
    assert.equal(P.statusOf('pll', 'A1+'), 'learned');
    P.setStatus('pll', 'A1+', 'new');
    const saved = JSON.parse(map.get('megaminx-image-editor:progress'));
    assert.equal(typeof saved._at.pll['A1+'], 'number'); // 変えたケースの時刻（端末どうしでケースごとに合わせるため。store.js）
    delete saved._at;
    assert.deepEqual(saved, { oll: { '1A': 'learned' }, pll: {} });
  });
});

test('displaySettings：PLL は OLL 配色のとき OLL を選ぶ前の配色、OLL は U の色だけを残す', () => {
  const settings = {
    preset: 'oll',
    faceColors: Object.assign({}, ...M.FACES.map((f) => ({ [f]: '#696969' })), { U: '#ffffff' }),
    beforeOll: { preset: 'custom', scheme: Object.assign({}, ...M.FACES.map((f) => ({ [f]: '#123456' }))) },
    imageSize: '5000',
  };
  withStorage({ 'megaminx-image-editor:settings': JSON.stringify(settings) }, () => {
    const pll = P.displaySettings('pll');
    assert.equal(pll.scheme.F, '#123456');
    assert.equal(pll.size, 1000);
    const oll = P.displaySettings('oll');
    assert.equal(oll.scheme.U, '#ffffff');
    assert.equal(oll.scheme.F, 'd');
  });
  withStorage({}, () => assert.equal(P.displaySettings('pll').scheme.F, M.DEFAULT_SCHEME.F));
});

test('isInverseOf：手順をそのまま逆にしたスクランブルか（前後の U・括弧・書き方の違いを除く）', () => {
  const alg = "R2 U2 R2' U R2 U2 R2'"; // F1+
  assert.equal(P.isInverseOf("R2 U2' R2' U' R2 U2' R2'", alg), true);
  assert.equal(P.isInverseOf("U R2 U2' R2' U' R2 U2' R2' U2", alg), true); // 前後の AUF は除く
  assert.equal(P.isInverseOf("R2 U2' R2' U' R2 U2' R2'", '(U2) ' + alg), true); // 手順の括弧・頭の U
  assert.equal(P.isInverseOf("R2 U'2 R'2 U' R2 U'2 R'2", alg), true); // U'2・R'2 は U2'・R2'
  assert.equal(P.isInverseOf("R2' U2' R2 U' R2' U2' R2", alg), false); // 別の手順（F1+ の別のスクランブル）
  assert.equal(P.isInverseOf("R U2 R2 U2' R2' U' R2 U2' R2' U2 R'", alg), false);
  assert.equal(P.isInverseOf('U2', 'U2'), false); // U だけのものは比べない
  assert.equal(P.isInverseOf('', alg), false);
});

test('practiceScrambles：逆の手順と短すぎるもの（PLL 10 手以下・OLL 7 手以下）を除き、どのケースにも残る', () => {
  [['pll', require('../js/pll-data.js'), require('../js/pll-scrambles.js')], ['oll', require('../js/oll-data.js'), require('../js/oll-scrambles.js')]].forEach(([set, data, scrambles]) => {
    data.forEach((c) => {
      const list = scrambles[c.name] || [];
      const used = P.practiceScrambles(set, list, c.alg);
      assert.ok(used.length > 0, `${set} ${c.name}`);
      used.forEach((s) => {
        assert.equal(P.isInverseOf(s, c.alg), false, `${set} ${c.name}: ${s}`);
        assert.ok(s.split(/\s+/).length >= P.SCRAMBLE_MIN_MOVES[set], `${set} ${c.name}: ${s}`);
      });
    });
  });
  // F1± の 7 手（既定の手順の逆と、R2 と R2' を入れ替えた形）は出さない
  const pll = require('../js/pll-scrambles.js');
  const f1 = require('../js/pll-data.js').find((c) => c.name === 'F1+');
  assert.equal(P.practiceScrambles('pll', pll['F1+'], f1.alg).length, pll['F1+'].length - 2);
  // 除くと残らないときは逆の手順だけを除き、それでも残らなければそのまま
  assert.deepEqual(P.practiceScrambles('pll', ["R U R'", "R U' R'"], "R U R'"), ["R U R'"]);
  assert.deepEqual(P.practiceScrambles('pll', ["R U' R'"], "R U R'"), ["R U' R'"]);
});

test('wrapAuf：前後に AUF を足し、もともと前後にある U とまとめる', () => {
  assert.equal(P.wrapAuf("R U R'", 0, 0), "R U R'");
  assert.equal(P.wrapAuf("R U R'", 1, 4), "U R U R' U'");
  assert.equal(P.wrapAuf("U R U'", 1, 1), 'U2 R');
  assert.equal(P.wrapAuf("U2' R U2", 2, 3), 'R');
});

test('wrapAuf：全スクランブルで、前後に AUF を足しても同じケースのまま', () => {
  const C = require('../js/case-check.js');
  for (const set of ['pll', 'oll']) {
    const data = require(`../js/${set}-data.js`);
    const scrambles = require(`../js/${set}-scrambles.js`);
    data.forEach((c, i) => {
      const list = scrambles[c.name];
      const s = list[i % list.length];
      const wrapped = P.wrapAuf(s, (i * 3) % 5, (i * 7 + 1) % 5);
      assert.ok(C.fitSetup(set, c.alg, wrapped), `${set} ${c.name}: ${wrapped}`);
    });
  }
});

test('addLog：新しい順に足し、種類ごとの最大件数（既定 10000）を超えた古いものは捨てる', () => {
  const e = (i, set) => ({ at: i, set: set || 'pll', name: 'A1+', sec: 1, status: 'learned' });
  assert.deepEqual(P.addLog(undefined, e(1)), [e(1)]);
  assert.deepEqual(P.addLog([e(2), e(1)], e(3), 2), [e(3), e(2)]);
  // PLL をたくさん足しても OLL の記録は押し出されない
  assert.deepEqual(P.addLog([e(3), e(2, 'oll'), e(1)], e(4), 2), [e(4), e(3), e(2, 'oll')]);
  let log = [];
  for (let i = 0; i < 10005; i++) log = P.addLog(log, e(i));
  log = P.addLog(log, e(10005, 'oll'));
  assert.equal(log.length, 10001);
  assert.equal(log[1].at, 10004);
  assert.equal(log[log.length - 1].at, 5);
});

test('summarize / perCase：種類・期間で絞って集計し、解けなかった（null）は平均に入れない', () => {
  const log = [
    { at: 300, set: 'pll', name: 'A1+', sec: 4, status: 'learned' },
    { at: 200, set: 'pll', name: 'A1+', sec: null, status: 'learning' },
    { at: 150, set: 'pll', name: 'J3+', sec: 10, status: 'learning' },
    { at: 100, set: 'oll', name: '1A', sec: 2, status: 'learned' },
    { broken: true },
  ];
  assert.deepEqual(P.summarize(log, { set: 'pll' }), { count: 3, solved: 2, dnf: 1, avg: 7, best: 4 });
  assert.deepEqual(P.summarize(log, { set: 'pll', from: 160 }), { count: 2, solved: 1, dnf: 1, avg: 4, best: 4 });
  assert.deepEqual(P.summarize([], {}), { count: 0, solved: 0, dnf: 0, avg: null, best: null });
  assert.deepEqual(P.perCase(log, { set: 'pll' }), {
    'A1+': { count: 2, solved: 1, dnf: 1, best: 4, avg: 4, last: 300 },
    'J3+': { count: 1, solved: 1, dnf: 0, best: 10, avg: 10, last: 150 },
  });
});

test('recentPerCase：ケースごとの直近 n 回。解けなかった回は平均に入れず、score では dnfAs 秒として数える', () => {
  const log = [
    { at: 100, set: 'pll', name: 'A1+', sec: 20 }, // 直近 3 回から外れる
    { at: 200, set: 'pll', name: 'A1+', sec: 6 },
    { at: 400, set: 'pll', name: 'A1+', sec: 4 },
    { at: 300, set: 'pll', name: 'A1+', sec: null },
    { at: 250, set: 'pll', name: 'J3+', sec: null },
    { at: 260, set: 'oll', name: 'A1+', sec: 1 }, // 種類が違う
    { at: 50, set: 'pll', name: 'Z1', sec: 3 }, // 期間外
  ];
  assert.deepEqual(P.recentPerCase(log, { set: 'pll', from: 60, n: 3, dnfAs: 16 }), {
    'A1+': { attempts: 3, avg: 5, dnf: 1, score: 26 / 3 },
    'J3+': { attempts: 1, avg: null, dnf: 1, score: 16 },
  });
});

test('daily：直近の日ごとの回数と平均（練習していない日は 0）', () => {
  const now = new Date(2026, 10, 16, 15).getTime();
  const at = (d, h) => new Date(2026, 10, d, h).getTime();
  const log = [
    { at: at(16, 9), set: 'pll', name: 'A1+', sec: 4 },
    { at: at(16, 10), set: 'pll', name: 'A1+', sec: 6 },
    { at: at(14, 23), set: 'pll', name: 'A1+', sec: null },
    { at: at(1, 9), set: 'pll', name: 'A1+', sec: 1 }, // 範囲外
  ];
  assert.deepEqual(P.daily(log, { set: 'pll', days: 3, now }), [
    { day: '2026-11-14', count: 1, avg: null },
    { day: '2026-11-15', count: 0, avg: null },
    { day: '2026-11-16', count: 2, avg: 5 },
  ]);
});

test('rollingAverages：各記録の時点の n 回平均（足りなければ undefined、DNF 2つで null）', () => {
  const r = (sec, penalty) => ({ sec, penalty: penalty || '' });
  const recs = [r(5), r(1), r(3), r(0, 'DNF'), r(2), r(4), r(0, 'DNF')]; // 新しい順
  assert.deepEqual(P.rollingAverages(recs, 5), [P.average(recs, 5), P.average(recs.slice(1), 5), null, undefined, undefined, undefined, undefined]);
  assert.equal(P.rollingAverages(recs, 5)[0], 3.33);
  assert.deepEqual(P.rollingAverages([], 5), []);
});

test('effectiveTime：+2 を足し、DNF は null', () => {
  assert.equal(P.effectiveTime({ sec: 50.1, penalty: '' }), 50.1);
  assert.equal(P.effectiveTime({ sec: 50.1, penalty: '+2' }), 52.1);
  assert.equal(P.effectiveTime({ sec: 50.1, penalty: 'DNF' }), null);
});

test('average（WCA 式）：最速と最遅を除く。DNF 1つは最遅、2つ以上は DNF。足りなければ undefined', () => {
  const r = (sec, penalty) => ({ sec, penalty: penalty || '' });
  assert.equal(P.average([r(50), r(60), r(55), r(40), r(70)], 5), 55); // (50+60+55)/3
  assert.equal(P.average([r(50), r(60), r(55), r(40), r(70, 'DNF')], 5), 55); // DNF が最遅で除かれる → 50,60,55
  assert.equal(P.average([r(50, '+2'), r(60), r(55), r(40), r(70)], 5), 55.67); // 52,60,55
  assert.equal(P.average([r(50, 'DNF'), r(60), r(55), r(40, 'DNF'), r(70)], 5), null);
  assert.equal(P.average([r(50), r(60)], 5), undefined);
  // 直近の n 回だけを使う（新しい順）
  assert.equal(P.average([r(10), r(10), r(10), r(10), r(10), r(99)], 5), 10);
});

test('average：ao100 は速い方・遅い方を 5 回ずつ除く。DNF 5 回までは最遅として除き、6 回で DNF', () => {
  const r = (sec, penalty) => ({ sec, penalty: penalty || '' });
  // 1..100 秒：6..95 の平均 = 50.5
  const recs = Array.from({ length: 100 }, (_, i) => r(i + 1));
  assert.equal(P.average(recs, 100), 50.5);
  // 遅い 5 回を DNF にしても同じ
  const dnf5 = recs.map((x, i) => (i >= 95 ? r(0, 'DNF') : x));
  assert.equal(P.average(dnf5, 100), 50.5);
  const dnf6 = recs.map((x, i) => (i >= 94 ? r(0, 'DNF') : x));
  assert.equal(P.average(dnf6, 100), null);
  assert.equal(P.average(recs.slice(0, 99), 100), undefined);
});

test('meanTime：DNF を除いたタイムの平均（+2 は足す）。解けた記録が無ければ null', () => {
  const r = (sec, penalty) => ({ sec, penalty: penalty || '' });
  assert.equal(P.meanTime([r(50), r(60, 'DNF'), r(55, '+2')]), 53.5); // (50 + 57) / 2
  assert.equal(P.meanTime([r(10), r(10), r(11)]), 10.33);
  assert.equal(P.meanTime([r(50, 'DNF')]), null);
  assert.equal(P.meanTime([]), null);
});

test('bestAverage / bestSingle：これまでで最も速い平均と1回（DNF は除く）', () => {
  const r = (sec, penalty) => ({ sec, penalty: penalty || '' });
  const recs = [r(70), r(50), r(51), r(52), r(53), r(54), r(40, 'DNF')];
  assert.equal(P.bestSingle(recs), 50);
  assert.equal(P.bestAverage(recs, 5), 52); // 50..54 の窓：(51+52+53)/3
  assert.equal(P.bestAverage(recs, 12), undefined);
  assert.equal(P.bestSingle([r(1, 'DNF')]), null);
});

test('formatTime：60 秒未満は秒、60 秒以上は分表記（丸めてから分ける）', () => {
  assert.equal(P.formatTime(5.2), '5.20');
  assert.equal(P.formatTime(59.994), '59.99');
  assert.equal(P.formatTime(59.996), '1:00.00');
  assert.equal(P.formatTime(65.234), '1:05.23');
  assert.equal(P.formatTime(600), '10:00.00');
  assert.equal(P.formatTime(70.4, 0), '1:10');
  assert.equal(P.formatTime(0), '0.00');
});

test('weakScores：回数の少ないケースを全体の平均に寄せる。解けなかった回は dnfAs として数える', () => {
  const log = [
    { at: 1, set: 'pll', name: 'A', sec: 4 },
    { at: 2, set: 'pll', name: 'A', sec: 4 },
    { at: 3, set: 'pll', name: 'A', sec: 4 },
    { at: 4, set: 'pll', name: 'A', sec: 4 },
    { at: 5, set: 'pll', name: 'B', sec: null },
    { at: 6, set: 'oll', name: 'X', sec: 30 },
  ];
  const w = P.weakScores(log, { set: 'pll', dnfAs: 16 });
  assert.equal(w.overall, (4 * 4 + 16) / 5);
  assert.equal(w.scores.A, (4 * 4 + w.overall * 2) / 6);
  assert.equal(w.scores.B, (16 + w.overall * 2) / 3);
  assert.ok(!('X' in w.scores));
  assert.deepEqual(P.weakScores([], {}), { scores: {}, overall: 0 });
  // prior: 0 なら寄せない
  assert.equal(P.weakScores(log, { set: 'pll', dnfAs: 16, prior: 0 }).scores.B, 16);
});

test('pickWeighted：重みに比例して選ぶ。重みがすべて 0 なら一様', () => {
  const seq = (values) => {
    let i = 0;
    return () => values[i++ % values.length];
  };
  const list = ['a', 'b', 'c'];
  const weight = (x) => ({ a: 1, b: 0, c: 3 })[x];
  // 合計 4：[0,1) → a、[1,4) → c（b は重み 0 なので選ばれない）
  assert.equal(P.pickWeighted(list, weight, seq([0.2])), 'a');
  assert.equal(P.pickWeighted(list, weight, seq([0.3])), 'c');
  assert.equal(P.pickWeighted(list, weight, seq([0.99])), 'c');
  assert.equal(P.pickWeighted(list, () => 0, seq([0.5])), 'b');
  assert.equal(P.pickWeighted([], weight), undefined);
  let r = 0;
  const counts = { a: 0, b: 0, c: 0 };
  for (let i = 0; i < 4000; i++) counts[P.pickWeighted(list, weight, () => ((r = (r + 0.6180339887) % 1)))]++;
  assert.equal(counts.b, 0);
  assert.ok(Math.abs(counts.c / counts.a - 3) < 0.1);
});

test('joinMoves：手順をつなぎ、となり合う同じ面の回転をまとめる', () => {
  assert.equal(P.joinMoves("F R2'", "R U"), "F R' U");
  assert.equal(P.joinMoves("F R U2", "U2' R' F'"), '');
  assert.equal(P.joinMoves("R U", "U' R'"), '');
  assert.equal(P.joinMoves('R U', "U F"), 'R U2 F');
  assert.equal(P.joinMoves("R2 U'", "U2' R"), "R2 U2 R");
  assert.equal(P.joinMoves("R U'2", 'U'), "R U'");
  assert.equal(P.joinMoves('R U', 'F'), 'R U F');
});
