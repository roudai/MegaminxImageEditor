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
    assert.deepEqual(JSON.parse(map.get('megaminx-image-editor:progress')), { oll: { '1A': 'learned' }, pll: {} });
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

test('addLog：新しい順に足し、最大件数（既定 2000）を超えた古いものは捨てる', () => {
  const e = (i) => ({ at: i, set: 'pll', name: 'A1+', sec: 1, status: 'learned' });
  assert.deepEqual(P.addLog(undefined, e(1)), [e(1)]);
  assert.deepEqual(P.addLog([e(2), e(1)], e(3), 2), [e(3), e(2)]);
  let log = [];
  for (let i = 0; i < 2005; i++) log = P.addLog(log, e(i));
  assert.equal(log.length, 2000);
  assert.equal(log[0].at, 2004);
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
