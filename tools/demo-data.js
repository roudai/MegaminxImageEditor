// 動作確認用のテストデータ（node tools/serve.js --demo で使う。本番のページは読まない）
// 練習の記録（PLL・OLL・通し）・ケースごとの最近のタイム・習得状況を、今から過去 60 日ぶん作る。
// 乱数は種を固定しているので、同じ日時なら毎回同じデータになる（日時は今に合わせてずらす）。
//
//   build({ now })  → { practice, progress }（store.js の 'practice'・'progress' にそのまま入れる形）
'use strict';
const PLL = require('../js/pll-data.js');
const OLL = require('../js/oll-data.js');
const W = require('../js/wca-scramble.js');

const DAY = 24 * 60 * 60 * 1000;
const THRESHOLDS = { pll: 8, oll: 5 }; // 習得の目安（秒）。PLL・OLL で別々

// 種を固定した乱数（mulberry32）
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const round2 = (x) => Math.round(x * 100) / 100;

// count 回の練習の日時（古い順）。days 日前から今まで、練習する日と1日の中の時刻をばらつかせる
function sessions(random, count, days, now) {
  const out = [];
  let t = now - days * DAY;
  const step = (days * DAY) / count;
  for (let i = 0; i < count; i++) {
    // ときどき数日あける（練習しない日）。それ以外は数分おき
    t += random() < 0.04 ? step * (8 + random() * 20) : step * (0.2 + random() * 0.6);
    if (t > now - 60 * 1000) break;
    out.push(Math.round(t));
  }
  return out;
}

// PLL・OLL：覚える順の前の方のケースほど多く、速く解けるようにする
function caseLog(random, set, cases, count, days, now) {
  const log = [];
  sessions(random, count, days, now).forEach((at, i, all) => {
    const progress = i / all.length; // 0 → 1 で全体に速くなる
    // 前の方のケースを選びやすくする
    const k = Math.floor(Math.pow(random(), 1.6) * cases.length);
    const c = cases[k];
    const skill = 1 - k / cases.length; // 前の方のケースほど慣れている
    const hint = random() < 0.04;
    let sec = null;
    if (random() > 0.05 + (1 - skill) * 0.06) {
      sec = round2(Math.max(2.5, 16 - progress * 6 - skill * 5 + (random() - 0.4) * 6));
    }
    const status = !hint && sec !== null && sec <= THRESHOLDS[set] ? 'learned' : 'learning';
    log.push({ at: at, set: set, name: c.name, sec: sec, status: status, hint: hint });
  });
  return log;
}

// 通し：95 秒前後から 60 秒前後へ。+2 と DNF をときどき
function fullLog(random, count, days, now) {
  return sessions(random, count, days, now).map((at, i, all) => {
    const base = 95 - (i / all.length) * 35;
    const r = random();
    const sec = round2(base + (random() - 0.45) * 16 + (random() < 0.03 ? 25 : 0));
    return { at: at, sec: sec, penalty: r < 0.025 ? 'DNF' : r < 0.06 ? '+2' : '', s: W.encode(W.megaminx(random)) };
  });
}

function build(opts) {
  const now = (opts && opts.now) || Date.now();
  const random = rng(20261117);
  const pllCases = PLL.slice().sort((a, b) => a.order - b.order).slice(0, 70);
  const ollCases = OLL.filter((c) => c.algset === 'ND').slice(0, 60);
  const caseRecords = caseLog(random, 'pll', pllCases, 420, 45, now)
    .concat(caseLog(random, 'oll', ollCases, 260, 30, now))
    .sort((a, b) => b.at - a.at) // 新しい順
    .slice(0, 2000);

  // ケースごとの最近のタイム（新しい順、最大 10 件。解けなかった・ヒントを見たものは入れない）と、習得状況（最後の判定）
  const times = { pll: {}, oll: {} };
  const progress = { pll: {}, oll: {} };
  caseRecords.forEach((e) => {
    if (!progress[e.set][e.name]) progress[e.set][e.name] = e.status;
    if (e.sec === null || e.hint) return;
    const list = times[e.set][e.name] || (times[e.set][e.name] = []);
    if (list.length < 10) list.push(e.sec);
  });

  const practice = {
    set: 'pll',
    scope: 'nd',
    filter: 'all',
    thresholds: THRESHOLDS,
    log: caseRecords,
    times: times,
    full: { inspection: true, log: fullLog(random, 260, 60, now).reverse() }, // 新しい順
    stats: { set: 'full', scope: 'nd', period: 'all', sort: 'avg', desc: true, tab: 'cases' },
  };
  return { practice: practice, progress: progress };
}

// ---- 最大のデータ（node tools/serve.js --demo --max）----
// 保存できる上限いっぱいの記録と、すべてのバッジ（隠しバッジも）を取った状態。画面が重くならないか・収まるかの確認用
//   - 記録：PLL・OLL それぞれ 10000 件（Progress.addLog の上限）、ソルブ・LL それぞれ 5000 件（FULL_LOG_MAX・LL_LOG_MAX）。
//     過去 400 日、毎日練習したことにする（今日まで続いている）
//   - 習得状況：すべて習得済み（最上位の称号）。最近のタイムは全ケース 10 件ずつ
//   - 自分の手順：全ケース（既定の手順の前に R R' を足したもの。CustomAlgs.validate を通した形）
//   - 称号とバッジ：すべて取った状態（titles.earned）。累計（stats）も上限に見合う数。新しく取った 3 つだけ NEW
//   - 記録のタイム・判定で決まるバッジ（瞬殺・続けて正解・DNF なし・自己ベスト・タイム）は、記録そのものでも満たす
//     （記録を消して判定し直しても外れないように）
const MAX_DAYS = 400;

// days 日前から今まで、毎日 count / days 回前後の日時（古い順）。朝 5〜7 時の練習も混ぜる
function dailyTimes(random, count, days, now) {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const out = [];
  for (let d = days - 1; d >= 0; d--) {
    const left = count - out.length;
    const n = d === 0 ? left : Math.max(1, Math.round((left / (d + 1)) * (0.6 + random() * 0.8)));
    const start = today.getTime() - d * DAY;
    for (let i = 0; i < n && out.length < count; i++) {
      // 1 日の中の時刻：たまに朝 5〜7 時、ほかは 7〜23 時
      const hour = random() < 0.05 ? 5 + random() * 2 : 7 + random() * 16;
      let at = start + Math.floor(hour * 3600000);
      if (at > now - 60 * 1000) at = now - 60 * 1000 - Math.floor(random() * 3600000);
      out.push(at);
    }
  }
  // 同じ日時が重ならないように 1 ms ずつずらす（記録は日時で見分ける）
  out.sort((a, b) => a - b);
  for (let i = 1; i < out.length; i++) if (out[i] <= out[i - 1]) out[i] = out[i - 1] + 1;
  return out.slice(0, count);
}

function buildMax(opts) {
  const now = (opts && opts.now) || Date.now();
  const random = rng(20261122);
  const P = require('../js/progress.js');
  const T = require('../js/titles.js');
  const CA = require('../js/custom-algs.js');
  const pick = (list) => list[Math.floor(random() * list.length)];

  // PLL・OLL：全ケースを順にまわしながら（PLL 総当たり・一期一会）、古いほど遅く、新しいほど速く
  function caseRecords(set, cases) {
    const ats = dailyTimes(random, 10000, MAX_DAYS, now); // Progress.addLog の上限（種類ごと）
    return ats.map((at, i) => {
      const progress = i / ats.length;
      const c = i < cases.length ? cases[i] : pick(cases);
      const recent = i >= ats.length - 150; // 最新 150 件は、ヒントなしで目安以内（続けて正解 100 回）
      const hint = !recent && random() < 0.03;
      const sec = !recent && random() < 0.04 ? null : round2(Math.max(1.6, (recent ? 0.55 : 1.4 - progress * 0.7) * THRESHOLDS[set] * (0.7 + random() * 0.6)));
      const status = !hint && sec !== null && sec <= THRESHOLDS[set] ? 'learned' : 'learning';
      return { at: at, set: set, name: c.name, sec: sec, status: status, hint: hint };
    });
  }
  const pllLog = caseRecords('pll', PLL);
  const ollLog = caseRecords('oll', OLL);
  pllLog[pllLog.length - 200].sec = 1.42; // 瞬殺（1.5 秒以内。ヒントなし）
  pllLog[pllLog.length - 200].hint = false;
  pllLog[pllLog.length - 200].status = 'learned';
  const caseLog = pllLog.concat(ollLog).sort((a, b) => b.at - a.at); // 新しい順

  // ソルブ：95 秒前後から 40 秒前後へ（自己ベストを何度も更新）。最新 150 回は DNF なし。1 回だけ 30 秒未満
  const fullAts = dailyTimes(random, P.FULL_LOG_MAX, MAX_DAYS, now);
  const full = fullAts.map((at, i) => {
    const progress = i / fullAts.length;
    const recent = i >= fullAts.length - 150;
    const r = random();
    const sec = round2(Math.max(31, 95 - progress * 55 + (random() - 0.5) * 12));
    const penalty = recent ? '' : r < 0.02 ? 'DNF' : r < 0.05 ? '+2' : '';
    return { at: at, sec: sec, penalty: penalty, s: W.encode(W.megaminx(random)) };
  });
  full[full.length - 40].sec = 29.87;
  full[full.length - 40].penalty = '';

  // LL：OLL → PLL（PLL スキップもある）。4% は DNF（sec: null）
  const llAts = dailyTimes(random, P.LL_LOG_MAX, MAX_DAYS, now);
  const ll = llAts.map((at, i) => {
    const progress = i / llAts.length;
    const rec = { at: at, sec: random() < 0.04 ? null : round2(Math.max(6, 30 - progress * 14 + (random() - 0.5) * 8)), o: pick(OLL).name };
    if (random() > 0.02) rec.p = pick(PLL).name;
    return rec;
  });

  // 習得状況はすべて習得済み、最近のタイムは各ケースの記録から 10 件（足りなければ目安以内のタイムで埋める）
  const progress = { pll: {}, oll: {} };
  const times = { pll: {}, oll: {} };
  [['pll', PLL], ['oll', OLL]].forEach(([set, cases]) => {
    cases.forEach((c) => {
      progress[set][c.name] = 'learned';
      times[set][c.name] = [];
    });
  });
  caseLog.forEach((e) => {
    const list = times[e.set][e.name];
    if (e.sec !== null && !e.hint && list.length < 10) list.push(e.sec);
  });
  Object.keys(times).forEach((set) => {
    Object.keys(times[set]).forEach((name) => {
      const list = times[set][name];
      while (list.length < 10) list.push(round2(THRESHOLDS[set] * (0.5 + random() * 0.4)));
    });
  });

  // 自分の手順：全ケース
  const customAlgs = { pll: {}, oll: {} };
  [['pll', PLL], ['oll', OLL]].forEach(([set, cases]) => {
    cases.forEach((c) => {
      const v = CA.validate(set, c, "R R' " + c.alg, cases);
      if (v.ok && !v.isDefault) customAlgs[set][c.name] = { alg: v.alg, setup: v.setup };
    });
  });

  // 称号とバッジ：すべて取った状態。取った日時は古い方から並べ、新しい 3 つだけ NEW（seenAt より後）
  const ids = T.BADGES.map((b) => b.id);
  const earned = {};
  ids.forEach((id, i) => {
    earned[id] = now - (ids.length - i) * 3 * DAY;
  });
  const seenAt = earned[ids[ids.length - 4]];
  const today = new Date(now);
  const pad = (n) => String(n).padStart(2, '0');
  const titles = {
    earned: earned,
    shown: null,
    seenAt: seenAt,
    stats: {
      reps: caseLog.length + ll.length,
      days: MAX_DAYS,
      lastDay: `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`,
      run: MAX_DAYS,
      bestRun: MAX_DAYS,
      met: { pll: PLL.map((c) => c.name), oll: OLL.map((c) => c.name) },
    },
  };

  const practice = {
    set: 'pll',
    scope: 'nd',
    filter: 'all',
    thresholds: THRESHOLDS,
    log: caseLog,
    times: times,
    full: { inspection: true, log: full.reverse() }, // 新しい順
    ll: { oll: 'all', pll: 'all', log: ll.reverse() },
    stats: { set: 'pll', scope: 'nd', period: 'all', sort: 'weak', desc: true, tab: 'cases', sortV: 2 },
  };
  return { practice: practice, progress: progress, 'custom-algs': customAlgs, titles: titles };
}

module.exports = { build: build, buildMax: buildMax };
