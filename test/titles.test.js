// 実行: node --test test/*.test.js
// js/titles.js（称号の段位とバッジ）と、store.js でのバッジの合わせ方
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../js/titles.js');
const Store = require('../js/store.js');

function withStorage(initial, fn) {
  const map = new Map(Object.entries(initial || {}));
  global.localStorage = {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
  try {
    return fn();
  } finally {
    delete global.localStorage;
  }
}

// PLL を p ケース、OLL を o ケース習得した progress（ほかに練習中のケースも混ぜる）
function progressOf(p, o) {
  const pll = {};
  const oll = {};
  for (let i = 0; i < p; i++) pll['P' + i] = 'learned';
  for (let i = 0; i < o; i++) oll['O' + i] = 'learned';
  pll.X = 'learning';
  oll.Y = 'learning';
  return { pll, oll };
}

test('TOTALS はケースのデータの数と同じ', () => {
  assert.equal(T.TOTALS.pll, require('../js/pll-data.js').length);
  assert.equal(T.TOTALS.oll, require('../js/oll-data.js').length);
  assert.equal(T.TOTALS.all, T.TOTALS.pll + T.TOTALS.oll);
});

test('段位の境目：PLL と OLL を合わせた習得済みの数で決まる（ちょうどで上がり、1 つ手前では上がらない）', () => {
  const expected = {
    bookmark: 1,
    catching: 20,
    lookalikes: 40,
    faces: 76,
    autopilot: 114,
    done: 151,
    hums: 180,
    names: 205,
    bag: 246,
    family: 287,
    dreams: 328,
    pentagon: 369,
    whisperer: 390,
    walking: 410,
  };
  assert.deepEqual(
    T.RANKS.slice(1).map((r) => [r.id, r.need]),
    Object.entries(expected)
  );
  const ids = T.RANKS.map((r) => r.id);
  Object.entries(expected).forEach(([id, n]) => {
    const p = Math.min(n, T.TOTALS.pll);
    assert.equal(T.rankOf(progressOf(p, n - p)).id, id, `${n} ケースで ${id}`);
    const before = T.rankOf(progressOf(Math.min(n - 1, T.TOTALS.pll), n - 1 - Math.min(n - 1, T.TOTALS.pll)));
    assert.equal(before.id, ids[ids.indexOf(id) - 1], `${n - 1} ケースではその手前`);
  });
});

test('rankOf：数え方・次の段位までの数・何も無いとき', () => {
  const r = T.rankOf(progressOf(76, 130));
  assert.equal(r.id, 'names');
  assert.deepEqual(r.learned, { pll: 76, oll: 130, all: 206 });
  assert.deepEqual(r.next, { id: 'bag', need: 40 });
  assert.equal(T.rankOf(null).id, 'none');
  assert.deepEqual(T.rankOf(null).next, { id: 'bookmark', need: 1 });
  assert.equal(T.rankOf(progressOf(151, 259)).next, null);
});

test('tierOf：銅・銀・金・虹', () => {
  assert.equal(T.tierOf('none'), null);
  assert.equal(T.tierOf('bookmark'), 'bronze');
  assert.equal(T.tierOf('autopilot'), 'bronze');
  assert.equal(T.tierOf('done'), 'silver');
  assert.equal(T.tierOf('hums'), 'silver');
  assert.equal(T.tierOf('family'), 'silver');
  assert.equal(T.tierOf('dreams'), 'gold');
  assert.equal(T.tierOf('whisperer'), 'gold');
  assert.equal(T.tierOf('walking'), 'rainbow');
});

// その日の d 日目（端末の時刻）の正午
// 2 月 1 日から数える（元日の「回し初め」にならないように）
const dayAt = (d, h) => new Date(2026, 1, 1 + d, h == null ? 12 : h).getTime();
// 既定は目安より遅い回（練習中）。続けて目安以内のバッジにならないように
const caseEntry = (at, extra) => Object.assign({ at, set: 'pll', name: 'A1+', sec: 9, status: 'learning' }, extra);
const caseEntries = (n, at) => Array.from({ length: n }, (_, i) => caseEntry(at(i)));
// 記録は新しい順に並ぶ
const newestFirst = (list) => list.slice().sort((a, b) => b.at - a.at);
// 1 分（「集中タイム」＝30 分のうちに 50 回、にならないよう、記録の間をあける）
const MIN = 60000;

test('バッジは 40 個（習得 5・練習 10・継続 5・速さ 5・通し 15）で、id は重ならない', () => {
  assert.equal(T.BADGES.length, 40);
  assert.equal(new Set(T.BADGES.map((b) => b.id)).size, 40);
  const count = {};
  T.BADGES.forEach((b) => {
    assert.ok(T.GROUPS.includes(b.group), b.id);
    count[b.group] = (count[b.group] || 0) + 1;
  });
  assert.deepEqual(count, { learn: 5, reps: 10, streak: 5, speed: 5, full: 15 });
});

test('バッジ：習得', () => {
  assert.deepEqual(T.evaluate({ progress: null, practice: null }, {}), []);
  assert.deepEqual(T.evaluate({ progress: progressOf(1, 0) }, {}), ['first']);
  assert.deepEqual(T.evaluate({ progress: progressOf(75, 129) }, {}), ['first']);
  assert.deepEqual(T.evaluate({ progress: progressOf(76, 130) }, {}), ['first', 'pllHalf', 'ollHalf']);
  assert.deepEqual(T.evaluate({ progress: progressOf(151, 259) }, {}), ['first', 'pllHalf', 'pllAll', 'ollHalf', 'ollAll']);
  // 取ったものは返さない
  assert.deepEqual(T.evaluate({ progress: progressOf(151, 0) }, { first: 1, pllHalf: 1 }), ['pllAll']);
});

test('バッジ：練習の回数（記録の数と累計の大きい方）・1 日の回数', () => {
  const ids = (practice, stats) => T.evaluate({ practice, stats }, {});
  assert.deepEqual(ids({ log: caseEntries(299, (i) => dayAt(i % 4) + i * MIN) }), []);
  assert.deepEqual(ids({ log: caseEntries(300, (i) => dayAt(i % 4) + i * MIN) }), ['reps300']);
  assert.deepEqual(ids({ log: caseEntries(100, (i) => dayAt(0, 9) + i * MIN) }), ['day100']);
  assert.deepEqual(ids({ log: caseEntries(300, (i) => dayAt(0, 9) + i * MIN) }), ['reps300', 'day100']); // PLL・OLL は 300 回でも「気づけば朝」にならない
  // 通しの記録も 1 日の回数に数える
  const full = { log: Array.from({ length: 50 }, () => ({ at: dayAt(0, 9), sec: 200, penalty: '' })) };
  assert.ok(ids({ log: caseEntries(50, (i) => dayAt(0, 10) + i * MIN), full }).includes('day100'));
  // 記録（最新 2000 件まで）を超える回数は累計で
  assert.deepEqual(ids({}, { reps: 4999 }), ['reps300', 'reps1000']);
  assert.deepEqual(ids({}, { reps: 10000 }), ['reps300', 'reps1000', 'reps5000', 'reps10000']);
});

test('バッジ：7 日間で 1000 回（暦の 7 日。8 日にまたがると数えない）', () => {
  const ids = (days) => T.evaluate({ practice: { log: caseEntries(1000, (i) => dayAt(days[i % days.length])) } }, {});
  assert.ok(ids([0, 6]).includes('week1000'));
  assert.ok(!ids([0, 7]).includes('week1000'));
  assert.ok(!ids([0, 2, 4, 6, 8, 10, 12, 14]).includes('week1000'));
});

test('バッジ：気づけば朝・通し漬けの一日（通しだけを数え、どの時点からでも 24 時間のうちに 300 回・50 回。日付の区切りは使わない）', () => {
  const HOUR = 3600000;
  // start から step ごとに n 回（新しい順に並べる）
  const solves = (n, start, step) => ({ full: { log: newestFirst(Array.from({ length: n }, (_, i) => ({ at: start + i * step, sec: 200, penalty: '' }))) } });
  const has = (practice) => T.evaluate({ practice }, {}).includes('day300');
  // 夜 20 時から 4 分ごとに 300 回（日付をまたいで 19.9 時間）
  assert.equal(has(solves(300, dayAt(0, 20), 4 * 60000)), true);
  assert.equal(has(solves(299, dayAt(0, 20), 4 * 60000)), false);
  // 300 回目が 24 時間ちょうど以降になれば数えない
  assert.equal(has(solves(300, dayAt(0), (24 * HOUR) / 299)), false);
  assert.equal(has(solves(300, dayAt(0), (24 * HOUR - 1) / 299)), true);
  // DNF も 1 回に数える
  const dnf = solves(300, dayAt(0), 60000);
  dnf.full.log = dnf.full.log.map((r) => Object.assign({}, r, { penalty: 'DNF' }));
  assert.equal(has(dnf), true);
  // 通し漬けの一日：同じ数え方で 50 回
  const has50 = (practice) => T.evaluate({ practice }, {}).includes('day50');
  assert.equal(has50(solves(50, dayAt(0, 22), 5 * 60000)), true); // 夜 22 時から 4 時間ほど（日付をまたぐ）
  assert.equal(has50(solves(49, dayAt(0, 22), 5 * 60000)), false);
  assert.equal(has50(solves(50, dayAt(0), (24 * HOUR) / 49)), false);
  // PLL・OLL は数えない
  assert.equal(T.evaluate({ practice: { log: Array.from({ length: 60 }, (_, i) => caseEntry(dayAt(0, 9) + i * MIN)) } }, {}).includes('day50'), false);
});

test('バッジ：週末キューバー（同じ週末の土曜と日曜に、どちらも 20 回以上）・PLL 総当たり', () => {
  // 日（その日の 10 時から 1 分おき）と回数の組から記録を作る
  const ids = (plan) =>
    T.evaluate({ practice: { log: plan.flatMap(([d, n]) => Array.from({ length: n }, (_, i) => caseEntry(new Date(2026, 1, d, 10).getTime() + i * MIN))) } }, {});
  // 2026-02-07 は土曜、02-08 は日曜
  assert.deepEqual(ids([[7, 20], [8, 20]]), ['weekend']);
  assert.deepEqual(ids([[7, 20], [8, 19]]), []);
  assert.deepEqual(ids([[7, 19], [8, 40]]), []);
  assert.deepEqual(ids([[8, 20], [14, 20]]), []); // 日曜と次の土曜は別の週末
  assert.deepEqual(ids([[6, 20], [7, 20]]), []); // 金曜と土曜
  // 練習した PLL の種類（OLL は数えない）
  const cases = (n, set) => Array.from({ length: n }, (_, i) => caseEntry(dayAt(0) + i, { set, name: 'C' + i }));
  const pll = (log) => T.evaluate({ practice: { log } }, {}).includes('pllRoundRobin');
  assert.equal(pll(cases(150, 'pll')), false);
  assert.equal(pll(cases(151, 'pll')), true);
  assert.equal(pll(cases(150, 'pll').concat(cases(150, 'pll'))), false); // 同じケースは 1 回
  assert.equal(pll(cases(259, 'oll')), false);
});

test('バッジ：朝練（同じ日の 5〜7 時に 10 回）・一期一会（「すべて」で 410 ケースに出会う）', () => {
  const morning = (n, h, day = 0) => Array.from({ length: n }, (_, i) => caseEntry(dayAt(day, h) + i * 1000));
  const early = (log, full) => T.evaluate({ practice: { log, full: { log: full || [] } } }, {}).includes('earlyBird');
  assert.equal(early(morning(9, 5)), false);
  assert.equal(early(morning(10, 5)), true);
  assert.equal(early(morning(5, 5).concat(morning(5, 6))), true);
  assert.equal(early(morning(5, 6).concat(morning(5, 6, 1))), false); // 別の日
  assert.equal(early(morning(10, 7)), false);
  assert.equal(early(morning(10, 4)), false);
  assert.equal(early(morning(9, 6), [{ at: dayAt(0, 6) + 50000, sec: 200, penalty: '' }]), true); // 通しも数える
  // 一期一会：stats.met（track の meet）で数える
  const names = (n) => Array.from({ length: n }, (_, i) => 'C' + i);
  const met = (pll, oll) => T.evaluate({ stats: { met: { pll, oll } } }, {}).includes('allMet');
  assert.equal(met(names(151), names(258)), false);
  assert.equal(met(names(151), names(259)), true);
  assert.equal(met(names(151).concat(names(151)), names(258)), false); // 重なりは 1 回
  let s = T.track(null, 'case', dayAt(0), { set: 'pll', name: 'Aa' });
  s = T.track(s, 'case', dayAt(0), { set: 'pll', name: 'Aa' });
  s = T.track(s, 'case', dayAt(0), { set: 'oll', name: 'OLL 1' });
  s = T.track(s, 'case', dayAt(0), null);
  assert.deepEqual(s.met, { pll: ['Aa'], oll: ['OLL 1'] });
  assert.equal(s.reps, 4);
});

test('バッジ：続けて練習した日数（記録から・累計から）・通算の日数', () => {
  const ids = (days) => T.evaluate({ practice: { log: days.map((d) => caseEntry(dayAt(d))) } }, {});
  assert.deepEqual(ids([0, 1, 2, 3, 4, 5]), []);
  assert.deepEqual(ids([0, 1, 2, 3, 4, 5, 6]), ['streak7']);
  assert.deepEqual(ids([0, 1, 2, 4, 5, 6, 7]), []); // 2/7（土）・2/8（日）を含むが、1 回ずつなので週末キューバーにはならない
  assert.deepEqual(ids([0, 0, 1, 2, 3, 4, 5]), []); // 同じ日に何回あっても 1 日
  assert.deepEqual(ids(Array.from({ length: 30 }, (_, i) => i)), ['streak7', 'streak30']);
  const byStats = (stats) => T.evaluate({ stats }, {});
  assert.deepEqual(byStats({ bestRun: 100 }), ['streak7', 'streak30', 'streak100']);
  assert.deepEqual(byStats({ bestRun: 365 }), ['streak7', 'streak30', 'streak100', 'streak365']);
  assert.deepEqual(byStats({ days: 99 }), []);
  assert.deepEqual(byStats({ days: 100 }), ['days100']);
  assert.deepEqual(ids(Array.from({ length: 100 }, (_, i) => i * 2)), ['days100']);
});

test('track：回数・日数・続けた日数を数える（同じ日は 1 日、1 日空くと 1 から、時計が戻ったら日数は数えない）', () => {
  let s = T.track(null, 'case', dayAt(0));
  assert.deepEqual(s, { reps: 1, days: 1, lastDay: '2026-02-01', run: 1, bestRun: 1, met: { pll: [], oll: [] } });
  s = T.track(s, 'case', dayAt(0, 20));
  s = T.track(s, 'full', dayAt(0, 21)); // 通しは回数に入れないが、練習した日には入れる
  assert.deepEqual(s, { reps: 2, days: 1, lastDay: '2026-02-01', run: 1, bestRun: 1, met: { pll: [], oll: [] } });
  s = T.track(s, 'full', dayAt(1));
  s = T.track(s, 'case', dayAt(2));
  assert.deepEqual(s, { reps: 3, days: 3, lastDay: '2026-02-03', run: 3, bestRun: 3, met: { pll: [], oll: [] } });
  s = T.track(s, 'case', dayAt(4));
  assert.deepEqual(s, { reps: 4, days: 4, lastDay: '2026-02-05', run: 1, bestRun: 3, met: { pll: [], oll: [] } });
  const back = T.track(s, 'case', dayAt(1));
  assert.deepEqual(back, Object.assign({}, s, { reps: 5 }));
});

test('バッジ：PLL・OLL の速さ（ヒントを見た回は数えない）・集中タイム・続けて目安以内', () => {
  const ids = (log) => T.evaluate({ practice: { log } }, {});
  assert.deepEqual(ids([caseEntry(dayAt(0), { sec: 2.01 })]), []);
  assert.deepEqual(ids([caseEntry(dayAt(0), { sec: 2 })]), ['sub2']);
  assert.deepEqual(ids([caseEntry(dayAt(0), { sec: 1, hint: true, status: 'learning' })]), []);
  assert.deepEqual(ids([caseEntry(dayAt(0), { sec: 0.98 })]), ['sub2']);
  // 集中タイム：どの時点からでも 30 分のうちに 50 回（タイム・判定は問わない。日付の区切りは使わない）
  const every = (n, gap, from) => Array.from({ length: n }, (_, i) => caseEntry((from == null ? dayAt(0) : from) + i * gap));
  assert.deepEqual(ids(newestFirst(every(49, 1000))), []);
  assert.deepEqual(ids(newestFirst(every(50, 36000))), ['focus']); // 49 × 36 秒 ＝ 29 分 24 秒
  assert.deepEqual(ids(newestFirst(every(50, 37000))), []); // 49 × 37 秒 ＝ 30 分 13 秒
  assert.deepEqual(ids(newestFirst(every(50, 36000, dayAt(1, 0) - 15 * MIN))), ['focus']); // 夜中の 0 時をまたいでもよい
  assert.deepEqual(ids(newestFirst(every(25, 1000).concat(every(25, 1000, dayAt(0) + 31 * MIN)))), []);
  const run = (n) => Array.from({ length: n }, (_, i) => caseEntry(dayAt(0, 9) + i * MIN, { sec: 5, status: 'learned' }));
  assert.deepEqual(ids(newestFirst(run(9))), []);
  assert.deepEqual(ids(newestFirst(run(10))), ['perfect10']);
  // 途中に練習中（目安より遅い・解けなかった）やヒントがあれば数え直す
  const broken = run(10);
  broken[4] = caseEntry(broken[4].at, { sec: null, status: 'learning' });
  assert.deepEqual(ids(newestFirst(broken)), []);
  const hinted = run(10);
  hinted[9] = caseEntry(hinted[9].at, { sec: 3, status: 'learned', hint: true });
  assert.deepEqual(ids(newestFirst(hinted)), []);
  assert.deepEqual(ids(newestFirst(run(50))), ['perfect10', 'perfect50']);
  assert.deepEqual(ids(newestFirst(run(99))), ['perfect10', 'perfect50']);
  assert.deepEqual(ids(newestFirst(run(100))), ['day100', 'perfect10', 'perfect50', 'perfect100']); // 1 日に 100 回なので「指が温まってきた」も
});

test('バッジ：通しのタイム（未満。+2 を含める）と ao（DNF が除く回数より多ければ出たことにしない）', () => {
  let k = 0;
  // 1 日の回数・続けた日数のバッジにならないよう、日をあけて散らす
  const rec = (penalty, sec) => ({ at: dayAt(2 * (k++ % 10)), sec: sec == null ? 200 : sec, penalty });
  // Array(n).fill(rec(…)) は同じ記録が並ぶので、並びの順に日と時刻を振り直す（10 日に散らし、同じ日は 1 分おき）。
  // 100 回なら 1 日 10 回で「通し漬けの一日」（24 時間に 50 回）にならない
  const ids = (log) =>
    T.evaluate({ practice: { full: { log: log.map((r, i) => Object.assign({}, r, { at: dayAt(2 * (i % 10)) + Math.floor(i / 10) * MIN })) } } }, {});
  assert.deepEqual(ids([]), []);
  assert.deepEqual(ids([rec('')]), ['fullFirst']);
  assert.deepEqual(ids([rec('', 180)]), ['fullFirst']);
  assert.deepEqual(ids([rec('', 119.99)]), ['fullFirst', 'fullSub120']);
  assert.deepEqual(ids([rec('+2', 118.5)]), ['fullFirst']); // +2 を含めて 120.5 秒
  assert.deepEqual(ids([rec('', 59.99)]), ['fullFirst', 'fullSub120', 'fullSub60']);
  assert.deepEqual(ids([rec('DNF', 30)]), ['fullFirst']);
  assert.deepEqual(ids([rec('', 44)]), ['fullFirst', 'fullSub120', 'fullSub60', 'fullSub45']);
  assert.deepEqual(ids([rec('', 29.99)]), ['fullFirst', 'fullSub120', 'fullSub60', 'fullSub45', 'fullSub30']);
  assert.ok(!ids(Array(99).fill(rec(''))).includes('full100'));
  assert.ok(ids(Array(100).fill(rec('DNF'))).includes('full100')); // DNF も 1 回に数える
  assert.deepEqual(ids(Array(11).fill(rec(''))), ['fullFirst']);
  assert.deepEqual(ids(Array(12).fill(rec('+2'))), ['fullFirst', 'fullAo12']);
  assert.deepEqual(ids([rec('DNF'), rec('DNF')].concat(Array(10).fill(rec('')))), ['fullFirst']);
  assert.deepEqual(ids([rec('DNF')].concat(Array(11).fill(rec('')))), ['fullFirst', 'fullAo12']);
  assert.deepEqual(ids(Array(3).fill(rec('DNF')).concat(Array(12).fill(rec('')))), ['fullFirst', 'fullAo12']);
  assert.deepEqual(ids(Array(5).fill(rec('DNF')).concat(Array(95).fill(rec('')))), ['fullFirst', 'fullAo12', 'clean50', 'full100']);
  assert.deepEqual(ids(Array(6).fill(rec('DNF')).concat(Array(94).fill(rec('')))), ['fullFirst', 'fullAo12', 'clean50', 'full100']);
  // 1000 回・自己ベストの更新・DNF なしで続けた回数
  assert.ok(ids(Array(1000).fill(rec('DNF'))).includes('full1000'));
  assert.ok(!ids(Array(999).fill(rec('DNF'))).includes('full1000'));
  const pb = (secs) => ids(newestFirst(secs.map((t, i) => (t === 'DNF' ? { at: i, sec: 1, penalty: 'DNF' } : { at: i, sec: t, penalty: '' })))).includes('pb10');
  const falling = (n) => Array.from({ length: n }, (_, i) => 300 - i); // 古い方から速くなる
  assert.equal(pb(falling(10)), false); // 最初の 1 回は更新に数えない
  assert.equal(pb(falling(11)), true);
  assert.equal(pb([300, 'DNF', 310].concat(falling(10).map((t) => t - 10))), true);
  assert.equal(pb(falling(10).concat([295, 'DNF', 291, 400])), false); // 遅い回・同じタイム・DNF は更新しない
  const clean50 = (log) => ids(log).includes('clean50');
  assert.equal(clean50(Array(50).fill(rec('+2'))), true);
  assert.equal(clean50(Array(49).fill(rec('')).concat([rec('DNF')], Array(49).fill(rec('')))), false);
  const clean = (log) => ids(log).includes('clean100');
  assert.equal(clean(Array(100).fill(rec(''))), true);
  assert.equal(clean(Array(100).fill(rec('+2'))), true);
  assert.equal(clean(Array(50).fill(rec('')).concat([rec('DNF')], Array(60).fill(rec('')))), false);
  // ao12：速い方・遅い方を 1 回ずつ除いた 10 回の平均が 1:00 未満（DNF 1 回までは除ける）
  const ao12 = (secs) => ids(secs.map((t) => (t === 'DNF' ? rec('DNF') : rec('', t)))).includes('ao12Sub60');
  assert.equal(ao12(Array(10).fill(59).concat([30, 'DNF'])), true);
  assert.equal(ao12(Array(11).fill(60).concat([30])), false);
  assert.equal(ao12(Array(10).fill(59).concat(['DNF', 'DNF'])), false);
  assert.equal(ao12(Array(5).fill(59).concat([30, 'DNF'])), false); // 12 回に足りない
  // ao100：速い方・遅い方を 5 回ずつ除いた 90 回の平均が 1:00 未満（DNF 5 回までは除ける）
  const ao100 = (secs) => ids(secs.map((t) => (t === 'DNF' ? rec('DNF') : rec('', t)))).includes('ao100Sub60');
  assert.equal(ao100(Array(95).fill(59.9).concat(Array(5).fill('DNF'))), true);
  assert.equal(ao100(Array(94).fill(59.9).concat(Array(6).fill('DNF'))), false);
  assert.equal(ao100(Array(100).fill(60)), false); // ちょうど 1:00 は切っていない
  assert.equal(ao100(Array(99).fill(59.9)), false); // 100 回に足りない

});

test('update / record / setShown / read：取ったバッジと累計を保存し、表示するバッジを選べる', () => {
  withStorage({}, () => {
    Store.set('progress', progressOf(1, 0));
    assert.deepEqual(T.update(5), ['first']);
    assert.deepEqual(T.read().earned, { first: 5 });
    assert.equal(T.read().shown, null);
    assert.deepEqual(T.update(6), []); // もう一度は付けない
    // 習得を戻してもバッジは残る
    Store.set('progress', {});
    assert.deepEqual(T.update(7), []);
    assert.deepEqual(T.read().earned, { first: 5 });
    T.setShown('first');
    assert.equal(T.read().shown, 'first');
    T.setShown('pllAll'); // 取っていないものは選べない
    assert.equal(T.read().shown, null);
    // 累計
    T.record('case', dayAt(0));
    T.record('full', dayAt(1));
    assert.deepEqual(T.read().stats, { reps: 1, days: 2, lastDay: '2026-02-02', run: 2, bestRun: 2, met: { pll: [], oll: [] } });
    assert.deepEqual(T.read().earned, { first: 5 }); // 累計を書いてもバッジは消えない
    // 知らない id・壊れた値は読み飛ばす
    Store.set('titles', { earned: { first: 1, nope: 2, pllAll: 'x' }, shown: 'nope', stats: { reps: 'x', lastDay: 'bad' } });
    assert.deepEqual(T.read(), { earned: { first: 1 }, shown: null, stats: { reps: 0, days: 0, lastDay: null, run: 0, bestRun: 0, met: { pll: [], oll: [] } }, seenAt: 0 });
  });
});

test('markSeen / unseenCount：一覧で見たことにしたより後に取ったバッジが NEW。新しいものが無ければ書かない', () => {
  withStorage({}, () => {
    Store.set('titles', { earned: { first: 10, reps300: 30 } });
    assert.equal(T.unseenCount(), 2); // まだ一度も見ていなければすべて
    T.markSeen();
    assert.equal(T.read().seenAt, 30); // 今の時刻ではなく、いちばん新しく取った日時
    assert.equal(T.unseenCount(), 0);
    // もう一度呼んでも書かない（store-change が出ない。別のタブとのあいだで書き合いにならない）
    let writes = 0;
    const setItem = localStorage.setItem;
    localStorage.setItem = (k, v) => {
      writes++;
      setItem(k, v);
    };
    T.markSeen();
    T.markSeen();
    assert.equal(writes, 0);
    localStorage.setItem = setItem;
    // 新しく取ったものだけ NEW
    Store.set('titles', Object.assign(T.read(), { earned: { first: 10, reps300: 30, streak7: 50 } }));
    assert.equal(T.unseenCount(), 1);
    T.markSeen();
    assert.equal(T.read().seenAt, 50);
    T.setShown('first'); // ほかの保存で seenAt は消えない
    assert.equal(T.read().seenAt, 50);
  });
});

test('Store.merge：取ったバッジは両方を合わせ（日時は早い方、shown は新しい方）、累計は大きい方・新しい日の方、met は和集合', () => {
  const local = {
    data: { titles: { earned: { first: 10, reps100: 30 }, shown: 'first', stats: { reps: 500, days: 20, lastDay: '2026-01-10', run: 3, bestRun: 9, met: { pll: ['Aa'], oll: ['OLL 1'] } } } },
    updated: { titles: 200 },
  };
  const remote = {
    data: { titles: { earned: { first: 5, streak7: 20 }, shown: 'streak7', stats: { reps: 800, days: 15, lastDay: '2026-01-12', run: 5, bestRun: 7, met: { pll: ['Aa', 'Ab'] } } } },
    updated: { titles: 100 },
  };
  const out = Store.merge(local, remote);
  assert.deepEqual(out.data.titles, {
    earned: { first: 5, streak7: 20, reps100: 30 },
    shown: 'first',
    stats: { reps: 800, days: 20, lastDay: '2026-01-12', run: 5, bestRun: 9, met: { pll: ['Aa', 'Ab'], oll: ['OLL 1'] } },
  });
  assert.equal(out.updated.titles, 200);
  assert.deepEqual(Store.merge(remote, local).data.titles.shown, 'first');
  // 一覧を見た日時（NEW の印）は遅い方
  const seen = (a, b) => Store.merge({ data: { titles: { earned: {}, seenAt: a } }, updated: { titles: 2 } }, { data: { titles: { earned: {}, seenAt: b } }, updated: { titles: 1 } }).data.titles.seenAt;
  assert.equal(seen(10, 30), 30);
  assert.equal(seen(30, 10), 30);
  // 片方にしか無ければそのまま
  assert.deepEqual(Store.merge(local, { data: {}, updated: {} }).data.titles, local.data.titles);
});

test('streakOf：今続けている日数（今日か昨日まで）といちばん長い日数', () => {
  const log = (days) => days.map((d) => caseEntry(dayAt(d)));
  const now = dayAt(10, 20);
  assert.deepEqual(T.streakOf({ practice: { log: log([8, 9, 10]) } }, now), { current: 3, best: 3 });
  assert.deepEqual(T.streakOf({ practice: { log: log([7, 8, 9]) } }, now), { current: 3, best: 3 }); // 今日まだでも昨日まで続いていれば数える
  assert.deepEqual(T.streakOf({ practice: { log: log([1, 2, 3, 4, 7, 8]) } }, now), { current: 0, best: 4 }); // 途切れた
  assert.deepEqual(T.streakOf({ practice: { log: [], full: { log: [{ at: dayAt(10), sec: 200, penalty: '' }] } } }, now), { current: 1, best: 1 }); // 通しも
  assert.deepEqual(T.streakOf({}, now), { current: 0, best: 0 });
  // 累計（stats）の方が長ければそちら（記録が 2000 件を超えて古い日が消えたとき）
  const stats = { reps: 0, days: 40, lastDay: '2026-02-10', run: 40, bestRun: 50 };
  assert.deepEqual(T.streakOf({ practice: { log: log([9, 10]) }, stats }, now), { current: 40, best: 50 });
  assert.deepEqual(T.streakOf({ practice: { log: log([9, 10]) }, stats }, dayAt(12)), { current: 0, best: 50 }); // 2 日空いた
});
