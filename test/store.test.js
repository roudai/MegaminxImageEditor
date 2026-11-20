// 実行: node --test test/*.test.js
// js/store.js（保存の窓口と、手元・クラウドのデータの合わせ方）
const test = require('node:test');
const assert = require('node:assert/strict');
const Store = require('../js/store.js');

// メモリ上の localStorage
function memoryStorage(initial) {
  const map = new Map(Object.entries(initial || {}));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    map: map,
  };
}
function withStorage(initial, fn) {
  global.localStorage = memoryStorage(initial);
  try {
    return fn(global.localStorage);
  } finally {
    delete global.localStorage;
  }
}

test('get / set：JSON と文字列を読み書きし、更新時刻を記録する。同じ値なら時刻を変えない', () => {
  withStorage({}, (ls) => {
    Store.set('settings', { preset: 'oll' });
    Store.set('lang', 'ja');
    assert.deepEqual(Store.get('settings'), { preset: 'oll' });
    assert.equal(Store.get('lang'), 'ja');
    assert.equal(ls.getItem('megaminx-image-editor:lang'), 'ja'); // 言語は今までどおり文字列のまま
    const t = JSON.parse(ls.getItem('megaminx-image-editor:updated')).settings;
    assert.equal(typeof t, 'number');
    ls.setItem('megaminx-image-editor:updated', JSON.stringify({ settings: 1 }));
    Store.set('settings', { preset: 'oll' });
    assert.equal(JSON.parse(ls.getItem('megaminx-image-editor:updated')).settings, 1);
    assert.equal(Store.get('progress'), null);
  });
});

test('今までに保存されたデータ（更新時刻なし）もそのまま読め、snapshot では時刻 0 になる', () => {
  withStorage({ 'megaminx-image-editor:progress': '{"pll":{"A1+":"learned"}}', 'megaminx-image-editor:lang': 'en' }, () => {
    assert.deepEqual(Store.snapshot(), {
      data: { progress: { pll: { 'A1+': 'learned' } }, lang: 'en' },
      updated: { progress: 0, lang: 0 },
    });
  });
});

test('replace：snapshot の内容で書き換え、無い名前は消す', () => {
  withStorage({ 'megaminx-image-editor:lang': 'en', 'megaminx-image-editor:list-filter': '{"pll":"all"}' }, () => {
    Store.replace({ data: { lang: 'ja', settings: { preset: 'standard' } }, updated: { lang: 5, settings: 6 } });
    assert.deepEqual(Store.snapshot(), { data: { settings: { preset: 'standard' }, lang: 'ja' }, updated: { settings: 6, lang: 5 } });
  });
});

test('merge：名前ごとに新しい方を使う（片方にしかない名前は残す）', () => {
  const local = { data: { settings: { a: 1 }, lang: 'en' }, updated: { settings: 10, lang: 1 } };
  const remote = { data: { settings: { a: 2 }, lang: 'ja', progress: { pll: {} } }, updated: { settings: 5, lang: 9, progress: 3 } };
  assert.deepEqual(Store.merge(local, remote), {
    data: { settings: { a: 1 }, progress: { pll: {} }, lang: 'ja' },
    updated: { settings: 10, progress: 3, lang: 9 },
  });
});

test('merge：union なら覚えた度・自分の手順をケースごとに合わせる（両方にあれば新しい方）', () => {
  const local = {
    data: { progress: { pll: { 'A1+': 'learned', 'A1-': 'learning' } }, 'custom-algs': { oll: { '1A': { alg: 'x', setup: 'y' } } } },
    updated: { progress: 20, 'custom-algs': 1 },
  };
  const remote = {
    data: { progress: { pll: { 'A1-': 'learned' }, oll: { '2A': 'learned' } }, 'custom-algs': { pll: { 'J3+': { alg: 'a', setup: 's' } } } },
    updated: { progress: 10, 'custom-algs': 2 },
  };
  const merged = Store.merge(local, remote, { union: true });
  assert.deepEqual(merged.data.progress, { pll: { 'A1+': 'learned', 'A1-': 'learning' }, oll: { '2A': 'learned' } });
  assert.deepEqual(merged.data['custom-algs'], { oll: { '1A': { alg: 'x', setup: 'y' } }, pll: { 'J3+': { alg: 'a', setup: 's' } } });
  assert.equal(merged.updated.progress, 20);
  // union でなければ新しい方をそのまま使う（片方で消したケースが戻らない）
  assert.deepEqual(Store.merge(local, remote).data.progress, local.data.progress);
});

test('merge：初めてのログイン（クラウドが空）は手元のまま。壊れた値でも落ちない', () => {
  const local = { data: { lang: 'ja' }, updated: { lang: 3 } };
  assert.deepEqual(Store.merge(local, null, { union: true }), local);
  assert.deepEqual(Store.merge(local, { data: { progress: 'broken' }, updated: {} }, { union: true }).data, { progress: 'broken', lang: 'ja' });
  assert.deepEqual(
    Store.merge({ data: { progress: 'broken' }, updated: { progress: 1 } }, { data: { progress: { pll: { x: 'learned' } } }, updated: { progress: 2 } }, { union: true }).data.progress,
    { pll: { x: 'learned' } }
  );
});

test('resolveLogin：手元のデータの持ち主によって合わせ方を変える', () => {
  const local = { data: { settings: { preset: 'custom' }, progress: { pll: { 'A1+': 'learned' } } }, updated: { settings: 50, progress: 50 } };
  const remote = { data: { settings: { preset: 'standard' }, progress: { pll: { 'B1+': 'learned' } } }, updated: { settings: 10, progress: 10 } };
  // 同じアカウント：新しい方
  assert.deepEqual(Store.resolveLogin(local, remote, { owner: 'A', uid: 'A' }).data, local.data);
  // まだどのアカウントとも合わせていない：ケースごとに合わせて持ち込む
  assert.deepEqual(Store.resolveLogin(local, remote, { owner: null, uid: 'A' }).data.progress, { pll: { 'B1+': 'learned', 'A1+': 'learned' } });
  // 別のアカウントのデータ：持ち込まず、アカウントの内容だけ（アカウントが空なら初期状態）
  assert.deepEqual(Store.resolveLogin(local, remote, { owner: 'A', uid: 'B' }), remote);
  assert.deepEqual(Store.resolveLogin(local, null, { owner: 'A', uid: 'B' }), { data: {}, updated: {} });
});

test('merge：外したバッジ（titles.revoked）は、それより前に取った別の端末のバッジで戻らない。後で取り直したものは残す', () => {
  const local = { data: { titles: { earned: { first: 1, fullSub30: 50 }, revoked: { fullSub60: 40 } } }, updated: { titles: 60 } };
  const remote = { data: { titles: { earned: { first: 2, fullSub60: 10, fullSub30: 10 }, revoked: { fullSub30: 30 } } }, updated: { titles: 20 } };
  const t = Store.merge(local, remote).data.titles;
  // fullSub60：10 に取ったが 40 に外した → 戻らない。fullSub30：30 に外したが 50 に取り直した → 残す
  assert.deepEqual(t.earned, { first: 1, fullSub30: 50 });
  assert.deepEqual(t.revoked, { fullSub60: 40, fullSub30: 30 });
});

test('toCloud / fromCloud：PLL・OLL の記録を種類ごとの短い形に分け、読んだら元に戻す', () => {
  const log = [
    { at: 5, set: 'oll', name: '16B+', sec: 12.34, status: 'learned', hint: false },
    { at: 4, set: 'pll', name: 'A1+', sec: null, status: 'learning', hint: true },
    { at: 3, set: 'pll', name: 'H1-', sec: 7.28, status: 'learned', hint: false },
  ];
  const snap = { data: { practice: { set: 'pll', log: log, full: { log: [{ at: 1, sec: 50, penalty: '', s: 'x' }] } }, lang: 'ja' }, updated: { practice: 9, lang: 1 } };
  const cloud = Store.toCloud(snap);
  // 本体には記録を入れない（ソルブの記録は本体のまま）
  assert.equal(cloud.main.logsSplit, true);
  assert.equal('log' in cloud.main.data.practice, false);
  assert.deepEqual(cloud.main.data.practice.full, snap.data.practice.full);
  assert.deepEqual(cloud.logs.pll, [[4, 'A1+', null, 1, 1], [3, 'H1-', 7.28, 2]]);
  assert.deepEqual(cloud.logs.oll, [[5, '16B+', 12.34, 2]]);
  // 手元の snapshot は変えない
  assert.equal(snap.data.practice.log.length, 3);
  // JSON を通して読み戻すと同じ
  const back = Store.fromCloud(JSON.parse(JSON.stringify(cloud.main)), JSON.parse(JSON.stringify(cloud.logs)));
  assert.deepEqual(back, snap);
});

test('fromCloud：以前の形（logsSplit の無い本体）はそのまま。種類ごとの文書が無ければ記録は空', () => {
  const old = { data: { practice: { log: [{ at: 1, set: 'pll', name: 'A1+', sec: 3, status: 'learned', hint: false }] } }, updated: { practice: 1 } };
  assert.deepEqual(Store.fromCloud(old, { pll: [[9, 'Z', 1, 2]] }), old);
  const split = { data: { practice: { set: 'oll' } }, updated: { practice: 2 }, logsSplit: true };
  assert.deepEqual(Store.fromCloud(split, {}).data.practice, { set: 'oll', log: [] });
  assert.equal(Store.fromCloud(null, {}), null);
});

test('toCloud：記録が多いときも 1 文書の上限に収める。本体だけに書く以前の形（inline）は最新 2000 件', () => {
  const log = [];
  for (let i = 0; i < 10000; i++) log.push({ at: 1795158456787 - i * 1000, set: i % 2 ? 'pll' : 'oll', name: '16B+', sec: 12.34, status: 'learned', hint: false });
  const cloud = Store.toCloud({ data: { practice: { log: log } }, updated: {} });
  assert.equal(cloud.logs.pll.length, 5000);
  assert.ok(JSON.stringify({ rows: cloud.logs.pll }).length < 500000);
  assert.equal(cloud.inline.data.practice.log.length, 2000);
  assert.equal(cloud.inline.data.practice.log[0].at, log[0].at);
  // 知らない項目のある記録はそのまま残す
  const odd = { at: 1, set: 'pll', name: 'A1+', sec: 1, status: 'learned', extra: 1 };
  assert.deepEqual(Store.toCloud({ data: { practice: { log: [odd] } }, updated: {} }).logs.pll, [odd]);
});
