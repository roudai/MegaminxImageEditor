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
  // union でなく、ケースごとの時刻も無ければ（この仕組みより前のデータ）新しい方をそのまま使う（片方で消したケースが戻らない）
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

test('resolveLogin：新しいログインはアカウントの内容で上書き（合算しない）。アカウントが空なら手元を入れる。ログインしたままなら新しい方', () => {
  const log = (name, at) => ({ at: at, set: 'pll', name: name, sec: 5, status: 'learned' });
  const local = {
    data: { settings: { preset: 'custom' }, progress: { pll: { 'A1+': 'learned' } }, practice: { log: [log('A1+', 300)] }, lang: 'en' },
    updated: { settings: 50, progress: 300, practice: 300, lang: 5 },
  };
  const remote = {
    data: { settings: { preset: 'standard' }, progress: { pll: { 'B1+': 'learned' } }, practice: { log: [log('B1+', 2), log('B2+', 1)] }, lang: 'ja' },
    updated: { settings: 10, progress: 10, practice: 10, lang: 1 },
  };
  const fromRemote = { data: Object.assign({}, remote.data, { lang: 'en' }), updated: Object.assign({}, remote.updated, { lang: 5 }) };
  // ログインしたままページを開き直した：設定などは新しい方、練習の記録は両方（同じアカウントの別の端末の記録を消さない）
  const cont = Store.resolveLogin(local, remote, { owner: 'A', uid: 'A' }).data;
  assert.deepEqual(cont.settings, local.data.settings);
  assert.deepEqual(cont.progress, local.data.progress);
  assert.deepEqual(cont.practice.log.map((e) => e.name), ['A1+', 'B1+', 'B2+']);
  assert.equal(Store.discardsLocal(local, remote, { owner: 'A', uid: 'A' }), false);
  // 新しいログイン（ログインせずに使っていた・同じアカウントに戻った・別のアカウント）：アカウントの内容で上書き。言語だけ手元
  [{ owner: null, uid: 'A', fresh: true }, { owner: 'A', uid: 'A', fresh: true }, { owner: 'B', uid: 'A', fresh: true }, { owner: 'B', uid: 'A' }].forEach((who) => {
    assert.deepEqual(Store.resolveLogin(local, remote, who), fromRemote);
    assert.equal(Store.discardsLocal(local, remote, who), true); // ログイン前の記録・習得状況を捨てる
  });
  // アカウントの記録が手元より多くても、手元で数件練習しただけで消えない（以前の合わせ方の不具合）
  assert.equal(Store.resolveLogin(local, remote, { owner: 'A', uid: 'A', fresh: true }).data.practice.log.length, 2);
  // アカウントが空（初めてのログイン・アカウントを削除して作り直した）：手元の内容をそのまま入れる
  assert.deepEqual(Store.resolveLogin(local, null, { owner: null, uid: 'A', fresh: true }), local);
  assert.deepEqual(Store.resolveLogin(local, { data: { lang: 'ja' }, updated: { lang: 1 } }, { owner: null, uid: 'A', fresh: true }), local);
  assert.equal(Store.discardsLocal(local, null, { owner: null, uid: 'A', fresh: true }), false);
  // アカウントが空でも、手元が別のアカウントのものなら持ち込まない（言語だけ残す）
  assert.deepEqual(Store.resolveLogin(local, null, { owner: 'B', uid: 'A', fresh: true }), { data: { lang: 'en' }, updated: { lang: 5 } });
  assert.equal(Store.discardsLocal(local, null, { owner: 'B', uid: 'A', fresh: true }), true);
  // 手元に使った跡が無い（設定・言語だけ）、または手元がアカウントと同じなら、捨てたことにしない
  const blank = { data: { settings: { preset: 'custom' }, lang: 'en' }, updated: { settings: 50, lang: 5 } };
  assert.equal(Store.discardsLocal(blank, remote, { owner: null, uid: 'A', fresh: true }), false);
  assert.equal(Store.discardsLocal(remote, remote, { owner: 'A', uid: 'A', fresh: true }), false);
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

test('withTombstones：消した記録に印を付ける（上限で押し出したものには付けない。戻したら外す。1000 件より多くをすべて削除したときだけ日時 1 つ）', () => {
  const e = (set, at) => ({ at: at, set: set, name: 'A1+', sec: 5, status: 'learned' });
  const prev = { log: [e('pll', 5), e('pll', 4), e('oll', 3)], full: { log: [{ at: 9, sec: 60, penalty: '' }, { at: 8, sec: 61, penalty: '' }] } };
  // 1 件消す
  let next = Store.withTombstones(prev, Object.assign({}, prev, { log: [e('pll', 5), e('oll', 3)] }));
  assert.deepEqual(next.removed, { pll: [4] });
  // 戻す（元に戻す）と印を外す
  next = Store.withTombstones(next, Object.assign({}, next, { log: prev.log }));
  assert.equal(next.removed, undefined);
  // ソルブをすべて削除（1000 件以下）：1 件ずつの印。戻せば外す
  next = Store.withTombstones(prev, Object.assign({}, prev, { full: { log: [] } }));
  assert.deepEqual(next.removed, { full: [9, 8] });
  assert.equal(next.cleared, undefined);
  next = Store.withTombstones(next, Object.assign({}, next, { full: prev.full }));
  assert.equal(next.removed, undefined);
  // 1000 件より多くをすべて削除：日時 1 つ（cleared）。戻せば外す
  const big = { log: Array.from({ length: 1500 }, (_, i) => e('oll', 5000 - i)) };
  next = Store.withTombstones(big, { log: [] });
  assert.deepEqual(next.cleared, { oll: 5000 });
  assert.equal(next.removed, undefined);
  next = Store.withTombstones(next, Object.assign({}, next, { log: big.log }));
  assert.equal(next.cleared, undefined);
  // 上限（10000 件）で押し出された古い記録には付けない
  const many = Array.from({ length: 10000 }, (_, i) => e('pll', 20000 - i));
  const pushed = [e('pll', 30000)].concat(many.slice(0, 9999));
  next = Store.withTombstones({ log: many }, { log: pushed });
  assert.equal(next.removed, undefined);
});

test('merge：同じアカウントの 2 つの端末の練習の記録を合わせる（消した記録は戻らない。最近のタイムは作り直す。設定は新しい方）', () => {
  const e = (set, name, at, sec, extra) => Object.assign({ at: at, set: set, name: name, sec: sec, status: 'learned' }, extra);
  // パソコン（クラウド）：PLL を 3 回、そのうち 1 回（at 2）をスマホが前に見ていた
  const pc = {
    set: 'pll',
    thresholds: { pll: 8 },
    log: [e('pll', 'A1+', 30, 3), e('pll', 'A1+', 20, 4), e('pll', 'H+', 2, 9)],
    times: { pll: { 'A1+': [3, 4], 'H+': [9] } },
    full: { inspection: true, log: [{ at: 50, sec: 70, penalty: '' }] },
  };
  // スマホ：あとから OLL を 1 回と PLL を 1 回。at 2 の記録は消した（印）。設定も変えた
  const phone = Store.withTombstones(
    { log: [e('pll', 'H+', 2, 9)] },
    {
      set: 'oll',
      thresholds: { pll: 6 },
      log: [e('oll', '1A', 40, 5), e('pll', 'A1+', 35, 2, { hint: true })],
      times: { oll: { '1A': [5] }, pll: {} },
      full: { inspection: false, log: [{ at: 45, sec: 80, penalty: 'DNF' }] },
    }
  );
  const local = { data: { practice: phone }, updated: { practice: 200 } };
  const remote = { data: { practice: pc }, updated: { practice: 100 } };
  const m = Store.merge(local, remote).data.practice;
  assert.deepEqual(m.log.map((x) => x.at), [40, 35, 30, 20]); // at 2 は消した印があるので戻らない
  assert.deepEqual(m.full.log.map((x) => x.at), [50, 45]);
  assert.equal(m.set, 'oll'); // 設定は新しい方
  assert.deepEqual(m.thresholds, { pll: 6 });
  assert.equal(m.full.inspection, false);
  // 最近のタイム：合わせた記録から（ヒントを見た回は入れない）
  assert.deepEqual(m.times.pll['A1+'], [3, 4]);
  assert.deepEqual(m.times.oll['1A'], [5]);
  assert.deepEqual(m.removed, { pll: [2] });
  // 逆向き（クラウドの方が新しい）でも記録は同じ
  const m2 = Store.merge({ data: { practice: phone }, updated: { practice: 100 } }, { data: { practice: pc }, updated: { practice: 200 } }).data.practice;
  assert.deepEqual(m2.log.map((x) => x.at), [40, 35, 30, 20]);
  assert.equal(m2.set, 'pll');
  // すべて削除（cleared）した種類は、その日時以前の記録を戻さない
  const cleared = Object.assign({}, phone, { cleared: { full: 60 }, full: { inspection: false, log: [] } });
  const m3 = Store.merge({ data: { practice: cleared }, updated: { practice: 200 } }, remote).data.practice;
  assert.deepEqual(m3.full.log, []);
});

test('習得状況・自分の手順：変えたケースに時刻を付け、端末どうしではケースごとにあとで変えた方を使う（未習得に戻したケースも戻らない）', () => {
  // 時刻を付ける（未着手に戻した＝値を消したケースにも付ける。変えていないケースはそのまま）
  let pc = Store.withCaseStamps({ pll: { 'A1+': 'learning' } }, { pll: { 'A1+': 'learned', 'B1+': 'learning' } }, 100);
  assert.deepEqual(pc._at, { pll: { 'A1+': 100, 'B1+': 100 } });
  pc = Store.withCaseStamps(pc, Object.assign({}, pc, { pll: { 'A1+': 'learned' } }), 150); // B1+ を未着手に
  assert.deepEqual(pc._at, { pll: { 'A1+': 100, 'B1+': 150 } });
  // _at を付けずに書いても前の時刻を引き継ぐ（cases.js の「すべて未習得に戻す」など）
  const reset = Store.withCaseStamps(pc, { pll: {} }, 300);
  assert.deepEqual(reset._at, { pll: { 'A1+': 300, 'B1+': 150 } });
  // スマホ：前のデータ（A1+ 習得済み、B1+ 練習中）のまま、OLL の 1A と PLL の H+ を変えた
  const phone = Store.withCaseStamps(
    { pll: { 'A1+': 'learned', 'B1+': 'learning' }, _at: { pll: { 'A1+': 100, 'B1+': 100 } } },
    { pll: { 'A1+': 'learned', 'B1+': 'learning', 'H+': 'learned' }, oll: { '1A': 'learning' }, _at: { pll: { 'A1+': 100, 'B1+': 100 } } },
    200
  );
  // パソコンで「すべて未習得に戻す」（300）をしたあと、スマホのデータと合わせる（スマホの方が新しく更新されていても）
  const m = Store.merge({ data: { progress: phone }, updated: { progress: 400 } }, { data: { progress: reset }, updated: { progress: 300 } }).data.progress;
  // A1+・B1+ はパソコンで戻した方があと → 戻ったまま。H+・1A はスマホで変えた → 残る
  assert.deepEqual(m.pll, { 'H+': 'learned' });
  assert.deepEqual(m.oll, { '1A': 'learning' });
  assert.deepEqual(m._at, { pll: { 'A1+': 300, 'B1+': 150, 'H+': 200 }, oll: { '1A': 200 } });
  // 自分の手順も同じ
  const a = Store.withCaseStamps({}, { pll: { 'J3+': { alg: 'a', setup: 's' } } }, 10);
  const b = Store.withCaseStamps({}, { oll: { '1A': { alg: 'x', setup: 'y' } } }, 20);
  const algs = Store.merge({ data: { 'custom-algs': a }, updated: { 'custom-algs': 1 } }, { data: { 'custom-algs': b }, updated: { 'custom-algs': 2 } }).data['custom-algs'];
  assert.deepEqual([algs.pll, algs.oll], [{ 'J3+': { alg: 'a', setup: 's' } }, { '1A': { alg: 'x', setup: 'y' } }]);
});

test('merge：手元に 1 件だけの種類の記録を取り消しても、別の端末のその種類の記録は消えない（PLL・OLL・ソルブ）', () => {
  ['pll', 'oll', 'full'].forEach((kind) => {
    const row = (at) => (kind === 'full' ? { at: at, sec: 60, penalty: '' } : { at: at, set: kind, name: String(at), sec: 3, status: 'learned', hint: false });
    const wrap = (rows) => (kind === 'full' ? { full: { log: rows } } : { log: rows });
    const remote = { data: { practice: wrap([3, 2, 1].map((i) => row(1000 + i))) }, updated: { practice: 50 } };
    const next = Store.withTombstones(wrap([row(2000)]), wrap([]));
    assert.equal(next.cleared, undefined, kind);
    const m = Store.merge({ data: { practice: next }, updated: { practice: 60 } }, remote).data.practice;
    const rows = kind === 'full' ? m.full.log : m.log;
    assert.deepEqual(rows.map((x) => x.at), [1003, 1002, 1001], kind);
  });
});

test('discardsLocal：練習の記録は日時ごとに比べる（キーの順の違い・hint の無い古い記録では捨てたことにしない）', () => {
  const who = { owner: 'A', uid: 'A', fresh: true };
  const local = { data: { practice: { log: [{ set: 'pll', at: 5, name: 'A1+', sec: 3, status: 'learned' }] } }, updated: { practice: 1 } };
  const remote = { data: { practice: { log: [{ at: 5, set: 'pll', name: 'A1+', sec: 3, status: 'learned', hint: false }] } }, updated: { practice: 2 } };
  assert.equal(Store.discardsLocal(local, remote, who), false);
  const other = { data: { practice: { log: [{ at: 6, set: 'pll', name: 'A1+', sec: 3, status: 'learned', hint: false }] } }, updated: { practice: 2 } };
  assert.equal(Store.discardsLocal(local, other, who), true);
});
