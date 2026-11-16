/*
 * 覚えた度と練習の記録、ケースの画像の色（一覧ページ cases.js と練習ページ practice.js で共通）。
 * 保存は store.js 経由（ログイン中はクラウドにも）。仕様: reference/PLL_SPEC.md「一覧ページ」、reference/PRACTICE_SPEC.md
 *
 *   STATUSES                        ['new', 'learning', 'learned']（表示名は i18n.js の status.*）
 *   statuses(set)                   { ケース名: 'learning' | 'learned' }（未着手は入っていない）
 *   statusOf(set, name)             'new' | 'learning' | 'learned'
 *   setStatus(set, name, status)    覚えた度を書く（'new' なら消す）
 *   judge(time, threshold)          練習の判定：time（秒）がしきい値以内なら 'learned'、超えた・null（解けなかった）なら 'learning'
 *   addTime(list, time, max)        最近のタイムの配列に足した新しい配列（新しい順、最大 max 件）
 *   displaySettings(set)            エディタで保存した設定から、画像の配色・線の色・背景・サイズを決める
 *                                     PLL：保存した配色（OLL 配色のときは OLL を選ぶ前の配色、無ければ Standard）
 *                                     OLL：保存した U の色だけを残した OLL 配色
 *   caseColors(c, scheme)           solve case（alg の逆手順を適用、持ち替え y は打ち消す）の状態の画像の色
 *   addLog(log, entry, max)         練習の記録（日時付き）の配列に足した新しい配列（新しい順、最大 max 件。既定 2000）
 *                                     entry = { at: 日時(ms), set, name, sec(null=解けなかった), status, hint }
 *   summarize(log, { set, from })   期間（from 以降。無ければすべて）の集計 { count, solved, dnf, avg, best }
 *   daily(log, { set, days, now })  直近 days 日の日ごとの { day: 'YYYY-MM-DD', count, avg }（古い順。練習していない日も 0 で入る）
 *   perCase(log, { set, from })     ケースごとの { name: { count, solved, dnf, best, avg, last } }
 *   wrapAuf(scramble, pre, post)    スクランブルの前後に U を pre・post 回（72°単位 0〜4）足す。もともと前後にある U とはまとめる
 *                                     （例：wrapAuf("U R U'", 1, 1) → "U2 R"）。前後の AUF を足しても同じケースのまま（練習の出題用）
 *
 * ブラウザでは window.Progress、node では module.exports として公開する。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./megaminx-state.js'), require('./store.js'));
  } else {
    root.Progress = factory(root.MegaminxState, root.Store);
  }
})(typeof self !== 'undefined' ? self : this, function (M, S) {
  'use strict';

  const STATUSES = ['new', 'learning', 'learned'];
  const isObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

  function statuses(set) {
    const all = S.get('progress');
    return isObject(all) && isObject(all[set]) ? all[set] : {};
  }

  function statusOf(set, name) {
    const s = statuses(set)[name];
    return STATUSES.includes(s) ? s : 'new';
  }

  function setStatus(set, name, status) {
    const all = isObject(S.get('progress')) ? S.get('progress') : {}; // 別タブの変更を消さないように読み直してから書く
    const mine = isObject(all[set]) ? all[set] : {};
    if (status === 'new') delete mine[name];
    else mine[name] = status;
    all[set] = mine;
    S.set('progress', all);
  }

  const judge = (time, threshold) => (typeof time === 'number' && time <= threshold ? 'learned' : 'learning');

  function addTime(list, time, max) {
    const prev = Array.isArray(list) ? list.filter((t) => typeof t === 'number') : [];
    return [time].concat(prev).slice(0, max || 10);
  }

  const HEX = /^#[0-9a-f]{6}$/i;
  function displaySettings(set) {
    const saved = S.get('settings');
    const settings = isObject(saved) ? saved : null;
    // OLL 配色（U の色だけ）のままだと PLL が見分けられないので、そのときは OLL を選ぶ前の配色
    // （エディタが beforeOll に保存）を使い、それも無ければ Standard にする（エディタで PLL を選んだときと同じ）
    let faceColors = {};
    if (settings && settings.preset !== 'oll') faceColors = settings.faceColors || {};
    else if (settings && settings.beforeOll && settings.beforeOll.scheme) faceColors = settings.beforeOll.scheme;
    const scheme = {};
    M.FACES.forEach((face) => {
      scheme[face] = HEX.test(faceColors[face]) ? faceColors[face] : M.DEFAULT_SCHEME[face];
    });
    const size = settings && /^\d+$/.test(settings.imageSize) ? Math.min(1000, Math.max(100, Number(settings.imageSize))) : 200;
    const common = {
      border: settings && HEX.test(settings.border) ? settings.border : '#000000',
      background: settings && settings.bg === 'n' && HEX.test(settings.bgColor) ? settings.bgColor : null,
      size: size,
    };
    if (set === 'oll') {
      // U の色は OLL 配色のときも保存されている
      const u = settings && settings.faceColors && settings.faceColors.U;
      return Object.assign(common, { scheme: M.ollMask({ U: HEX.test(u) ? u : M.DEFAULT_SCHEME.U }, 'd') });
    }
    return Object.assign(common, { scheme: scheme });
  }

  function caseColors(c, scheme) {
    const state = M.applyAlg(c.alg, { inverse: true, cancelRotation: true });
    return M.toImageColors(state, scheme);
  }

  // ---- 練習の記録（日時付き） ----
  function addLog(log, entry, max) {
    const prev = Array.isArray(log) ? log : [];
    return [entry].concat(prev).slice(0, max || 2000);
  }

  // 記録を種類・期間で絞る（壊れた記録は除く）
  function pick(log, opts) {
    const o = opts || {};
    return (Array.isArray(log) ? log : []).filter(
      (e) =>
        e &&
        typeof e.at === 'number' &&
        typeof e.name === 'string' &&
        (!o.set || e.set === o.set) &&
        (!o.from || e.at >= o.from)
    );
  }
  const solvedTimes = (list) => list.map((e) => e.sec).filter((t) => typeof t === 'number');
  const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

  function summarize(log, opts) {
    const list = pick(log, opts);
    const times = solvedTimes(list);
    return {
      count: list.length,
      solved: times.length,
      dnf: list.length - times.length,
      avg: mean(times),
      best: times.length ? Math.min(...times) : null,
    };
  }

  // 日付のキー（その端末の時刻で 'YYYY-MM-DD'）
  const pad = (n) => String(n).padStart(2, '0');
  const dayKey = (ms) => {
    const d = new Date(ms);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  function daily(log, opts) {
    const o = opts || {};
    const days = o.days || 30;
    const now = o.now || Date.now();
    const out = [];
    const index = {};
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setHours(12, 0, 0, 0); // 夏時間などで日付がずれないよう昼で数える
      d.setDate(d.getDate() - i);
      const key = dayKey(d.getTime());
      index[key] = out.length;
      out.push({ day: key, count: 0, avg: null, times: [] });
    }
    pick(log, { set: o.set }).forEach((e) => {
      const i = index[dayKey(e.at)];
      if (i === undefined) return;
      out[i].count++;
      if (typeof e.sec === 'number') out[i].times.push(e.sec);
    });
    return out.map((d) => ({ day: d.day, count: d.count, avg: mean(d.times) }));
  }

  function perCase(log, opts) {
    const out = {};
    pick(log, opts).forEach((e) => {
      const c = out[e.name] || (out[e.name] = { count: 0, solved: 0, dnf: 0, best: null, avg: null, last: 0, times: [] });
      c.count++;
      if (typeof e.sec === 'number') c.times.push(e.sec);
      if (e.at > c.last) c.last = e.at;
    });
    Object.values(out).forEach((c) => {
      c.solved = c.times.length;
      c.dnf = c.count - c.solved;
      c.best = c.times.length ? Math.min(...c.times) : null;
      c.avg = mean(c.times);
      delete c.times;
    });
    return out;
  }

  // ---- 練習の出題 ----
  const U_AMOUNT = { U: 1, U2: 2, "U2'": 3, "U'": 4, "U'2": 3 };
  const U_TEXT = ['', 'U', 'U2', "U2'", "U'"];
  function wrapAuf(scramble, pre, post) {
    const tokens = String(scramble).trim().split(/\s+/).filter(Boolean);
    let head = pre % 5;
    let tail = post % 5;
    while (tokens.length && U_AMOUNT[tokens[0]] !== undefined) head = (head + U_AMOUNT[tokens.shift()]) % 5;
    while (tokens.length && U_AMOUNT[tokens[tokens.length - 1]] !== undefined) tail = (tail + U_AMOUNT[tokens.pop()]) % 5;
    if (!tokens.length) return U_TEXT[(head + tail) % 5];
    return [U_TEXT[head]].concat(tokens, [U_TEXT[tail]]).filter(Boolean).join(' ');
  }

  return {
    STATUSES: STATUSES,
    wrapAuf: wrapAuf,
    addLog: addLog,
    summarize: summarize,
    daily: daily,
    perCase: perCase,
    dayKey: dayKey,
    statuses: statuses,
    statusOf: statusOf,
    setStatus: setStatus,
    judge: judge,
    addTime: addTime,
    displaySettings: displaySettings,
    caseColors: caseColors,
  };
});
