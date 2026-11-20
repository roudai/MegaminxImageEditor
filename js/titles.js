/*
 * 称号（段位）とバッジ。アカウントメニュー（cloud-sync.js）・記録のページ（stats.js）・練習ページ（practice.js）で使う。
 * 仕様: reference/PRACTICE_SPEC.md「称号とバッジ」
 *
 *   TOTALS                          { pll: 151, oll: 259, all: 410 }（ケースのデータはページによって読み込まないので定数。テストで確かめる）
 *   RANKS                           段位の配列 [{ id, need }]（need は PLL・OLL を合わせて習得したケースの数。表示名は i18n.js の titles.rank.<id>）
 *   tierOf(id)                      札の色：'bronze' | 'silver' | 'gold' | 'rainbow'（none は null）
 *   rankOf(progress)                { id, index, learned: { pll, oll, all }, total, next: { id, need } | null }
 *                                     progress は store.js の 'progress'（{ pll: { ケース名: 'learning' | 'learned' }, oll: … }）
 *   GROUPS                          バッジの分類の並び（表示名は i18n.js の titles.group.<group>）
 *   BADGES                          バッジの配列 [{ id, group, test(data) }]。data = { progress, practice, stats }
 *                                     （store.js の 'progress'・'practice' と、'titles' の stats）
 *                                     表示名は i18n.js の titles.badge.<id>、条件の説明は titles.badge.<id>.desc
 *   evaluate(data, earned)          まだ取っていない（earned に無い）バッジのうち、条件を満たしたものの id の配列
 *   track(stats, kind, at, meet)    練習を 1 回記録したあとの stats（新しいオブジェクト）。kind: 'case'（PLL・OLL）| 'full'（通し）
 *                                     stats = { reps: PLL・OLL の累計の回数, days: 練習した日の累計, lastDay: 最後に練習した日,
 *                                               run: lastDay まで続けて練習した日数, bestRun: 続けて練習した日数のいちばん長いもの,
 *                                               met: 練習の対象「すべて」で出会ったケース { pll: [名前], oll: [名前] } }
 *                                     meet = { set, name }（練習の対象が「すべて」のときだけ渡す。ほかは null）
 *                                     （記録 practice.log は PLL・OLL それぞれ最新 10000 件までなので、それを超える回数・日数はここで数える）
 *   read()                          store.js の 'titles'（{ earned: { id: 日時(ms) }, shown: id | null, stats, seenAt }）を形を整えて読む
 *                                     seenAt は一覧で見たことにしたバッジのいちばん新しい取得日時（ms。それより後に取ったバッジが NEW）
 *   record(kind, at, meet)          （ブラウザ用）track した stats を 'titles' に保存する（練習ページで記録したとき）
 *   update(now)                     （ブラウザ用）新しく取ったバッジを 'titles' に足して保存し、その id の配列を返す
 *   setShown(id)                    （ブラウザ用）表示する称号にするバッジ（null なら段位を出す）
 *   markSeen()                      （ブラウザ用）バッジの一覧を見たことにする（取ったバッジのいちばん新しい日時を seenAt に保存。新しいものが無ければ書かない）
 *   unseenCount()                   （ブラウザ用）seenAt より後に取ったバッジの数（NEW の数）
 *   streakOf(data, now)             { current: 今続けて練習している日数（今日か昨日に練習していれば続いている）, best: いちばん長い日数 }
 *                                     data = { practice, stats }。記録から数えたものと stats の大きい方
 *   renderCard(I, options)          （ブラウザ用）称号の札の要素（I は I18N）。アカウントメニューと記録のページで使う
 *                                     options.streak なら続けて練習した日数の行も出す（記録のページ）
 *   renderBadges(I, onChange, options) （ブラウザ用）分類ごとのバッジの一覧の要素。取ったバッジを押すと表示する称号にして onChange() を呼ぶ
 *                                     options.newSince より後に取ったバッジに NEW の印を付ける
 *
 * ブラウザでは window.Titles、node では module.exports として公開する。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./store.js'));
  } else {
    root.Titles = factory(root.Store);
  }
})(typeof self !== 'undefined' ? self : this, function (S) {
  'use strict';

  const TOTALS = { pll: 151, oll: 259, all: 410 };

  // 全体の割合（切り上げ）
  const need = (ratio) => Math.ceil(TOTALS.all * ratio - 1e-9);
  // 前半は PLL を先に覚える人に合わせて、PLL の進み具合で区切る（151 ＝ PLL をすべて習得）。後半は全体の割合
  const RANKS = [
    { id: 'none', need: 0 },
    { id: 'eye', need: 1 },
    { id: 'sheet', need: 20 },
    { id: 'hooked', need: 40 },
    { id: 'faces', need: Math.ceil(TOTALS.pll / 2) }, // 76
    { id: 'autopilot', need: Math.ceil((TOTALS.pll * 3) / 4) }, // 114
    { id: 'done', need: TOTALS.pll }, // 151
    { id: 'hums', need: 180 },
    { id: 'names', need: need(0.5) },
    { id: 'bag', need: need(0.6) },
    { id: 'family', need: need(0.7) },
    { id: 'dreams', need: need(0.8) },
    { id: 'pentagon', need: need(0.9) },
    { id: 'whisperer', need: need(0.95) },
    { id: 'reborn', need: TOTALS.all },
  ];

  function tierOf(id) {
    const i = RANKS.findIndex((r) => r.id === id);
    if (i <= 0) return null;
    if (id === 'reborn') return 'rainbow';
    if (i <= 5) return 'bronze';
    if (i <= 10) return 'silver';
    return 'gold';
  }

  const isObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
  const num = (v) => (typeof v === 'number' && isFinite(v) ? v : 0);

  function learnedCount(progress, set) {
    const mine = isObject(progress) && isObject(progress[set]) ? progress[set] : {};
    return Object.keys(mine).filter((name) => mine[name] === 'learned').length;
  }

  function rankOf(progress) {
    const learned = { pll: learnedCount(progress, 'pll'), oll: learnedCount(progress, 'oll') };
    learned.all = learned.pll + learned.oll;
    let index = 0;
    RANKS.forEach((r, i) => {
      if (learned.all >= r.need) index = i;
    });
    const nextRank = RANKS[index + 1];
    return {
      id: RANKS[index].id,
      index: index,
      learned: learned,
      total: TOTALS.all,
      next: nextRank ? { id: nextRank.id, need: nextRank.need - learned.all } : null,
    };
  }

  // ---- 日付 ----
  const pad = (n) => String(n).padStart(2, '0');
  // その日の日付（端末の時刻で 'YYYY-MM-DD'）
  function dayOf(at) {
    const d = new Date(at);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  // 'YYYY-MM-DD' の日の通し番号（日の差を出すため）
  function dayNumber(key) {
    const [y, m, d] = String(key).split('-').map(Number);
    return Math.round(Date.UTC(y, m - 1, d) / 86400000);
  }

  // ---- 練習の累計（記録の上限を超えて数える） ----
  function normalizeStats(s) {
    const src = isObject(s) ? s : {};
    return {
      reps: num(src.reps),
      days: num(src.days),
      lastDay: typeof src.lastDay === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(src.lastDay) ? src.lastDay : null,
      run: num(src.run),
      bestRun: num(src.bestRun),
      met: normalizeMet(src.met),
    };
  }
  // 練習の対象「すべて」で出会った（記録した）ケース { pll: [名前], oll: [名前] }
  function normalizeMet(m) {
    const src = isObject(m) ? m : {};
    const out = {};
    ['pll', 'oll'].forEach((set) => {
      out[set] = Array.isArray(src[set]) ? [...new Set(src[set].filter((n) => typeof n === 'string'))] : [];
    });
    return out;
  }
  function track(stats, kind, at, meet) {
    const s = normalizeStats(stats);
    if (kind === 'case') s.reps += 1;
    if (isObject(meet) && (meet.set === 'pll' || meet.set === 'oll') && typeof meet.name === 'string' && !s.met[meet.set].includes(meet.name)) {
      s.met[meet.set].push(meet.name);
    }
    const today = dayOf(at);
    if (s.lastDay !== today) {
      const gap = s.lastDay ? dayNumber(today) - dayNumber(s.lastDay) : null;
      if (gap !== null && gap < 0) return s; // 端末の時計が戻ったときは日数を数えない
      s.run = gap === 1 ? s.run + 1 : 1;
      s.days += 1;
      s.lastDay = today;
    }
    s.bestRun = Math.max(s.bestRun, s.run);
    return s;
  }

  // ---- バッジの判定に使う集計 ----
  const caseLog = (practice) => (isObject(practice) && Array.isArray(practice.log) ? practice.log : []);
  // ソルブの最短（js/practice.js の MIN_FULL_SEC と同じ）。これ未満の記録（DNF 以外）は押し間違いとみなし、バッジの判定に数えない
  // （練習ページでは記録しないが、それより前に記録したものが残っていることがある）
  const MIN_FULL_SEC = 15;
  const fullLog = (practice) =>
    isObject(practice) && isObject(practice.full) && Array.isArray(practice.full.log)
      ? practice.full.log.filter((r) => !(r && r.penalty !== 'DNF' && typeof r.sec === 'number' && r.sec < MIN_FULL_SEC))
      : [];
  const allEntries = (practice) => caseLog(practice).concat(fullLog(practice)).filter((e) => e && typeof e.at === 'number');

  // 練習した日ごとの回数（PLL・OLL と通しを合わせる）
  function perDay(practice) {
    const days = {};
    allEntries(practice).forEach((e) => {
      const k = dayOf(e.at);
      days[k] = (days[k] || 0) + 1;
    });
    return days;
  }
  // 記録に残っている日だけで数えた、続けて練習した日数のいちばん長いもの
  function longestStreak(practice) {
    let best = 0;
    let run = 0;
    let prev = null;
    Object.keys(perDay(practice))
      .map(dayNumber)
      .sort((a, b) => a - b)
      .forEach((n) => {
        run = prev !== null && n - prev === 1 ? run + 1 : 1;
        best = Math.max(best, run);
        prev = n;
      });
    return best;
  }
  // 累計（stats）と、記録から数えたものの大きい方（stats を数え始める前の記録も数えるため）
  const reps = (d) => Math.max(num(d.stats && d.stats.reps), caseLog(d.practice).length);
  const totalDays = (d) => Math.max(num(d.stats && d.stats.days), Object.keys(perDay(d.practice)).length);
  const bestRun = (d) => Math.max(num(d.stats && d.stats.bestRun), longestStreak(d.practice));

  // 今続けて練習している日数と、いちばん長い日数。今日か昨日に練習していれば続いている（今日まだでも昨日までの数を出す）
  function streakOf(d, now) {
    const today = dayNumber(dayOf(typeof now === 'number' ? now : Date.now()));
    const days = new Set(Object.keys(perDay(d.practice)).map(dayNumber));
    let n = days.has(today) ? today : today - 1;
    let fromLog = 0;
    while (days.has(n)) {
      fromLog += 1;
      n -= 1;
    }
    const s = normalizeStats(d.stats);
    const gap = s.lastDay ? today - dayNumber(s.lastDay) : Infinity;
    const fromStats = gap === 0 || gap === 1 ? s.run : 0;
    const current = Math.max(fromLog, fromStats);
    return { current, best: Math.max(bestRun(d), current) };
  }

  // 同じ日の from〜to 時（to 時ちょうどは含まない）に練習した回数のいちばん多いもの（PLL・OLL と通しを合わせる）
  function bestHours(d, from, to) {
    const days = {};
    allEntries(d.practice).forEach((e) => {
      const h = new Date(e.at).getHours();
      if (h < from || h >= to) return;
      const k = dayOf(e.at);
      days[k] = (days[k] || 0) + 1;
    });
    return Math.max(0, ...Object.values(days));
  }
  // 練習の対象「すべて」で出会ったケースの数（PLL・OLL を合わせる。titles.stats.met）
  const metCount = (d) => {
    const m = normalizeMet(d.stats && d.stats.met);
    return m.pll.length + m.oll.length;
  };
  // PLL・OLL をヒントなしで sec 秒以内に解いたことがあるか
  const caseWithin = (d, sec) =>
    caseLog(d.practice).some((e) => e && !e.hint && typeof e.sec === 'number' && e.sec <= sec);
  // どの時点からでも span（ミリ秒）未満のうちに記録した回数のいちばん多いもの（日付の区切りは使わない）
  function maxWithin(log, span) {
    const times = log
      .filter((e) => e && typeof e.at === 'number')
      .map((e) => e.at)
      .sort((x, y) => x - y);
    let best = 0;
    let from = 0;
    times.forEach((at, i) => {
      while (at - times[from] >= span) from++;
      best = Math.max(best, i - from + 1);
    });
    return best;
  }
  // PLL・OLL を 30 分のうちに記録したいちばん多い回数
  const casesIn30min = (d) => maxWithin(caseLog(d.practice), 30 * 60000);
  // PLL・OLL で、ヒントなしで目安以内（習得済みの判定）に解いた回が続いたいちばん長い数
  function bestPerfectRun(practice) {
    let best = 0;
    let run = 0;
    caseLog(practice)
      .slice()
      .reverse()
      .forEach((e) => {
        run = e && e.status === 'learned' && !e.hint && typeof e.sec === 'number' ? run + 1 : 0;
        best = Math.max(best, run);
      });
    return best;
  }

  // 続けた 7 日間（暦の 7 日）の練習の回数のいちばん多いもの
  function bestWeek(practice) {
    const days = perDay(practice);
    const list = Object.keys(days)
      .map((k) => [dayNumber(k), days[k]])
      .sort((a, b) => a[0] - b[0]);
    let best = 0;
    let sum = 0;
    let from = 0;
    list.forEach(([n, count]) => {
      sum += count;
      while (list[from][0] <= n - 7) sum -= list[from++][1];
      best = Math.max(best, sum);
    });
    return best;
  }
  // 通しを 24 時間のうちに記録したいちばん多い回数
  const fullIn24h = (d) => maxWithin(fullLog(d.practice), 86400000);
  // 1 日の練習のいちばん多い回数（PLL・OLL と通しを合わせる）
  const bestDay = (d) => Math.max(0, ...Object.values(perDay(d.practice)));
  // 同じ週末の土曜と日曜の両方に練習したことがあるか（端末の時刻の日付）
  // 週末キューバー：同じ週末の土曜と日曜に、どちらも WEEKEND_REPS 回以上（PLL・OLL と通しを合わせる）
  const WEEKEND_REPS = 20;
  function practicedWeekend(d) {
    const counts = {};
    const days = perDay(d.practice);
    Object.keys(days).forEach((k) => {
      counts[dayNumber(k)] = days[k];
    });
    const enough = (n) => (counts[n] || 0) >= WEEKEND_REPS;
    return Object.keys(counts)
      .map(Number)
      .some((n) => new Date(Date.UTC(1970, 0, 1 + n)).getUTCDay() === 6 && enough(n) && enough(n + 1));
  }
  // PLL のケースを何種類練習したか
  const pllPracticed = (d) => new Set(caseLog(d.practice).filter((e) => e && e.set === 'pll').map((e) => e.name)).size;

  // 通し：ペナルティを含めたタイム（DNF は Infinity）
  const fullTime = (r) => (!r || r.penalty === 'DNF' || typeof r.sec !== 'number' ? Infinity : r.sec + (r.penalty === '+2' ? 2 : 0));
  const bestFullSingle = (d) => Math.min(Infinity, ...fullLog(d.practice).map(fullTime));
  // 通し：古い方から見て、自己ベスト（DNF を除く）を更新した回数（最初の 1 回は数えない）
  function pbCount(d) {
    let best = Infinity;
    let count = 0;
    fullLog(d.practice)
      .slice()
      .reverse()
      .forEach((r) => {
        const t = fullTime(r);
        if (t === Infinity || t >= best) return;
        if (best !== Infinity) count++;
        best = t;
      });
    return count;
  }
  // 通し：DNF なしで続いたいちばん長い回数
  function bestCleanRun(d) {
    let best = 0;
    let run = 0;
    fullLog(d.practice).forEach((r) => {
      run = fullTime(r) === Infinity ? 0 : run + 1;
      best = Math.max(best, run);
    });
    return best;
  }
  // 通しの n 回平均（progress.js の average と同じ：速い方・遅い方を ceil(n × 5%) 回ずつ除く。DNF は最遅、
  // DNF が除く回数より多ければ DNF）のいちばん速いもの。出たことがなければ Infinity
  function bestFullAverage(d, n) {
    const log = fullLog(d.practice);
    const trim = Math.ceil(n * 0.05);
    let best = Infinity;
    for (let i = 0; i + n <= log.length; i++) {
      const times = log
        .slice(i, i + n)
        .map(fullTime)
        .sort((a, b) => a - b)
        .slice(trim, n - trim);
      if (times.some((t) => t === Infinity)) continue;
      best = Math.min(best, times.reduce((a, b) => a + b, 0) / times.length);
    }
    return best;
  }

  const GROUPS = ['learn', 'reps', 'streak', 'speed', 'full'];
  // byLog：記録のタイム・判定・ペナルティだけで決まるバッジ（タイム・自己ベストの更新・続けて正解・DNF なしの連続）。
  // 記録を個別・選択して削除したり、取り消し・ペナルティを変えたりしたら判定し直し、満たさなくなっていれば外す（recheck）。
  // 回数・日数・出会ったケースは累計（stats）でも数えるので、記録を消しても外さない
  // 数えられるバッジは count（今の数）と goal（目標）を持ち、count >= goal で取る。
  // バッジの一覧では、まだ取っていないものに「count / goal」とバーを出す（badgeProgress）
  const counted = (id, group, count, goal, byLog) => ({ id, group, count, goal, byLog: !!byLog, test: (d) => count(d) >= goal });
  const learned = (set) => (d) => learnedCount(d.progress, set);
  const fullCount = (d) => fullLog(d.practice).length;
  const perfectRun = (d) => bestPerfectRun(d.practice);
  const BADGES = [
    // 習得
    { id: 'first', group: 'learn', test: (d) => learnedCount(d.progress, 'pll') + learnedCount(d.progress, 'oll') >= 1 },
    counted('pllHalf', 'learn', learned('pll'), Math.ceil(TOTALS.pll / 2)),
    counted('pllAll', 'learn', learned('pll'), TOTALS.pll),
    counted('ollHalf', 'learn', learned('oll'), Math.ceil(TOTALS.oll / 2)),
    counted('ollAll', 'learn', learned('oll'), TOTALS.oll),
    // 練習の量
    counted('reps300', 'reps', reps, 300),
    counted('earlyBird', 'reps', (d) => bestHours(d, 5, 7), 10),
    { id: 'weekend', group: 'reps', test: practicedWeekend },
    counted('day100', 'reps', bestDay, 100),
    counted('reps1000', 'reps', reps, 1000),
    counted('pllRoundRobin', 'reps', pllPracticed, TOTALS.pll),
    counted('reps5000', 'reps', reps, 5000),
    counted('week1000', 'reps', (d) => bestWeek(d.practice), 1000),
    counted('reps10000', 'reps', reps, 10000),
    counted('allMet', 'reps', metCount, TOTALS.all),
    // 続ける
    counted('streak7', 'streak', bestRun, 7),
    counted('streak30', 'streak', bestRun, 30),
    counted('days100', 'streak', totalDays, 100),
    counted('streak100', 'streak', bestRun, 100),
    counted('streak365', 'streak', bestRun, 365),
    // PLL・OLL の速さ・正確さ
    { id: 'sub2', byLog: true, group: 'speed', test: (d) => caseWithin(d, 2) },
    counted('perfect10', 'speed', perfectRun, 10, true),
    counted('focus', 'speed', casesIn30min, 50),
    counted('perfect50', 'speed', perfectRun, 50, true),
    counted('perfect100', 'speed', perfectRun, 100, true),
    // 通し
    { id: 'fullFirst', group: 'full', test: (d) => fullLog(d.practice).length >= 1 },
    { id: 'fullAo12', byLog: true, group: 'full', test: (d) => bestFullAverage(d, 12) < Infinity },
    counted('clean50', 'full', bestCleanRun, 50, true),
    counted('full100', 'full', fullCount, 100),
    { id: 'fullSub120', byLog: true, group: 'full', test: (d) => bestFullSingle(d) < 120 },
    counted('day50', 'full', fullIn24h, 50),
    counted('clean100', 'full', bestCleanRun, 100, true),
    counted('pb10', 'full', pbCount, 10, true),
    counted('full1000', 'full', fullCount, 1000),
    { id: 'fullSub60', byLog: true, group: 'full', test: (d) => bestFullSingle(d) < 60 },
    { id: 'ao12Sub60', byLog: true, group: 'full', test: (d) => bestFullAverage(d, 12) < 60 },
    { id: 'fullSub45', byLog: true, group: 'full', test: (d) => bestFullSingle(d) < 45 },
    { id: 'ao100Sub60', byLog: true, group: 'full', test: (d) => bestFullAverage(d, 100) < 60 },
    counted('day300', 'full', fullIn24h, 300),
    { id: 'fullSub30', byLog: true, group: 'full', test: (d) => bestFullSingle(d) < 30 },
  ];

  const dataOf = (data) => ({ progress: data && data.progress, practice: data && data.practice, stats: data && data.stats });
  function evaluate(data, earned) {
    const have = isObject(earned) ? earned : {};
    const d = dataOf(data);
    return BADGES.filter((b) => !have[b.id] && b.test(d)).map((b) => b.id);
  }
  // 数えられるバッジの達成状況 { id: { value, goal } }（value は goal で頭打ち。取ったかどうかには関係しない）。
  // 同じ数を使うバッジ（reps300 / 1000 …）は 1 回だけ数える
  function badgeProgress(data) {
    const d = dataOf(data);
    const cache = new Map();
    const out = {};
    BADGES.forEach((b) => {
      if (!b.count) return;
      if (!cache.has(b.count)) cache.set(b.count, b.count(d));
      out[b.id] = { value: Math.min(cache.get(b.count), b.goal), goal: b.goal };
    });
    return out;
  }

  function read() {
    const t = S ? S.get('titles') : null;
    // 外したバッジ { id: 外した日時 }（クラウドで別の端末の earned と合わせたときに戻ってこないように残す。store.js の mergeTitles）
    const revoked = {};
    if (isObject(t) && isObject(t.revoked)) {
      Object.keys(t.revoked).forEach((id) => {
        if (BADGES.some((b) => b.id === id) && typeof t.revoked[id] === 'number') revoked[id] = t.revoked[id];
      });
    }
    const earned = {};
    if (isObject(t) && isObject(t.earned)) {
      Object.keys(t.earned).forEach((id) => {
        const at = t.earned[id];
        if (BADGES.some((b) => b.id === id) && typeof at === 'number' && !(revoked[id] >= at)) earned[id] = at;
      });
    }
    const shown = isObject(t) && typeof t.shown === 'string' && earned[t.shown] ? t.shown : null;
    const seenAt = isObject(t) ? num(t.seenAt) : 0;
    return { earned: earned, shown: shown, stats: normalizeStats(isObject(t) ? t.stats : null), seenAt: seenAt, revoked: revoked };
  }

  function record(kind, at, meet) {
    const t = read();
    t.stats = track(t.stats, kind, typeof at === 'number' ? at : Date.now(), meet);
    S.set('titles', t);
  }

  function update(now) {
    const t = read();
    const got = evaluate({ progress: S.get('progress'), practice: S.get('practice'), stats: t.stats }, t.earned);
    if (!got.length) return [];
    const at = typeof now === 'number' ? now : Date.now();
    got.forEach((id) => {
      t.earned[id] = Math.max(at, (t.revoked[id] || 0) + 1); // 外した日時より後にする（read で外したままにならないように）
    });
    S.set('titles', t);
    return got;
  }

  // 記録を個別・選択して削除したあと（取り消し・ペナルティの変更も）、記録だけで決まるバッジ（byLog）を判定し直し、
  // 今の記録で条件を満たさなくなったものを外す。外したバッジの id を返す。
  // 「すべての記録を削除」では呼ばない（記録の整理とみなし、取ったバッジは残す）
  function recheck(now) {
    const t = read();
    const d = { progress: S.get('progress'), practice: S.get('practice'), stats: t.stats };
    const lost = BADGES.filter((b) => b.byLog && t.earned[b.id] && !b.test(d)).map((b) => b.id);
    if (!lost.length) return [];
    const at = Math.max(typeof now === 'number' ? now : Date.now(), ...lost.map((id) => t.earned[id]));
    lost.forEach((id) => {
      delete t.earned[id];
      t.revoked[id] = at;
      if (t.shown === id) t.shown = null;
    });
    S.set('titles', t);
    return lost;
  }

  // 「条件を満たさなくなったバッジを外しました：…」（練習ページの知らせ・記録のページの削除のメッセージ）
  function revokedText(I, ids) {
    return I.t('titles.badgeRevoked', { names: ids.map((id) => I.t('titles.badge.' + id)).join(I.t('titles.listSep')) });
  }

  // バッジの一覧を見たことにする（これより後に取ったバッジに NEW の印を付ける）。
  // 今の時刻ではなく、取ったバッジのいちばん新しい日時を seenAt にする。新しいバッジが無ければ何も書かないので、
  // 描き直すたびに呼んでも保存（store-change・別のタブの storage）が続かない
  function markSeen() {
    const t = read();
    const latest = Math.max(0, ...Object.values(t.earned));
    if (latest <= t.seenAt) return;
    t.seenAt = latest;
    S.set('titles', t);
  }
  // まだ一覧で見ていない（seenAt より後に取った）バッジの数
  function unseenCount() {
    const t = read();
    return Object.keys(t.earned).filter((id) => t.earned[id] > t.seenAt).length;
  }
  function setShown(id) {
    const t = read();
    t.shown = id && t.earned[id] ? id : null;
    S.set('titles', t);
  }

  // ---- 画面の部品（ブラウザ用。アカウントメニュー cloud-sync.js と記録のページ stats.js で共通）----
  const MEDAL =
    '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M4.6 1h2.6l1.4 4.2-2.4 1.1zM11.4 1H8.8l-.5 1.6 1.4 3.7z" fill="currentColor" opacity=".55"/>' +
    '<circle cx="8" cy="10.3" r="4.4" fill="currentColor"/><path d="m8 7.7.8 1.6 1.7.2-1.3 1.2.4 1.7L8 11.6l-1.6.8.4-1.7-1.3-1.2 1.7-.2z" fill="#fff"/></svg>';
  const FLAME =
    '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M8.6.5c.4 2.3-.6 3.6-1.7 4.9C5.7 6.8 4.5 8.2 4.5 10.3 4.5 13 6.3 15.5 8 15.5s3.5-2.2 3.5-5c0-1.3-.4-2.5-1.1-3.4.1 1.2-.3 2.2-1.2 2.6.5-2.6-.1-6.4-.6-9.2z" fill="currentColor"/></svg>';
  function make(tag, className, text) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text != null) e.textContent = text;
    return e;
  }
  // まだ取っていないバッジの達成状況：細いバーと「39 / 410」（バーは飾りで、読み上げは数の文字）
  function progressBar(p, I) {
    const row = make('span', 'title-badge-progress');
    const bar = make('span', 'title-badge-bar');
    bar.setAttribute('aria-hidden', 'true');
    const fill = make('span', 'title-badge-bar-fill');
    fill.style.width = (100 * p.value) / p.goal + '%';
    bar.append(fill);
    row.append(bar, make('span', 'title-badge-count', p.value.toLocaleString(I.lang) + ' / ' + p.goal.toLocaleString(I.lang)));
    return row;
  }
  function medal() {
    const span = make('span', 'title-medal');
    span.innerHTML = MEDAL;
    return span;
  }

  // 称号の札：称号（選んだバッジがあればその名前）・習得したケースの数のバー・PLL / OLL の内訳。
  // まだ 1 ケースも習得していなければ「ケースを習得すると称号がもらえます」。I は i18n.js の I18N
  // 続けて練習した日数の行（options.streak のとき。記録のページ）。まだ 1 日も練習していなければ出さない
  function streakLine(I) {
    const st = streakOf({ practice: S.get('practice'), stats: read().stats });
    if (!st.best) return null;
    const line = make('div', 'title-streak' + (st.current ? ' active' : ''));
    const icon = make('span', 'title-streak-icon');
    icon.innerHTML = FLAME;
    line.append(icon, make('span', null, I.t('titles.streak', { n: st.current, best: st.best })));
    return line;
  }
  function renderCard(I, options) {
    const rank = rankOf(S.get('progress'));
    const shown = read().shown;
    const streak = options && options.streak ? streakLine(I) : null;
    if (rank.id === 'none' && !shown) {
      const empty = make('div', 'title-empty', I.t('titles.empty'));
      if (streak) empty.append(streak);
      return empty;
    }
    const card = make('div', 'title-card tier-' + (tierOf(rank.id) || 'bronze'));
    const name = make('div', 'title-card-name');
    name.append(medal(), make('span', null, I.t(shown ? 'titles.badge.' + shown : 'titles.rank.' + rank.id)));
    const tip = rank.next
      ? I.t('titles.next', { n: rank.learned.all, total: rank.total, need: rank.next.need, next: I.t('titles.rank.' + rank.next.id) })
      : I.t('titles.max', { total: rank.total });
    card.title = tip;
    const bar = make('div', 'title-card-bar');
    const trackEl = make('div', 'title-card-track');
    const fill = make('div', 'title-card-fill');
    fill.style.width = (rank.learned.all / rank.total) * 100 + '%';
    trackEl.append(fill);
    trackEl.setAttribute('role', 'progressbar');
    trackEl.setAttribute('aria-valuemin', '0');
    trackEl.setAttribute('aria-valuemax', String(rank.total));
    trackEl.setAttribute('aria-valuenow', String(rank.learned.all));
    trackEl.setAttribute('aria-valuetext', tip);
    bar.append(trackEl, make('span', 'title-card-count', I.t('titles.count', { n: rank.learned.all, total: rank.total })));
    const breakdown = make(
      'div',
      'title-card-breakdown',
      I.t('titles.breakdown', { pll: rank.learned.pll, pllTotal: TOTALS.pll, oll: rank.learned.oll, ollTotal: TOTALS.oll })
    );
    card.append(name, bar, breakdown);
    if (streak) card.append(streak);
    return card;
  }

  // バッジの一覧（分類ごと）：取ったものは色つき（取った日付つき）、まだのものは灰色。取ったものを押すと称号として表示する
  // （もう一度押すと段位の表示に戻す）。押したあとに onChange() を呼ぶ
  function renderBadges(I, onChange, options) {
    const t = read();
    const newSince = options && typeof options.newSince === 'number' ? options.newSince : Infinity;
    const progress = badgeProgress({ progress: S.get('progress'), practice: S.get('practice'), stats: t.stats });
    const wrap = make('div', 'title-badge-groups');
    GROUPS.forEach((group) => {
      const badges = BADGES.filter((b) => b.group === group);
      const got = badges.filter((b) => t.earned[b.id]).length;
      const section = make('div', 'title-badge-group');
      section.append(make('h3', 'title-badge-group-name', I.t('titles.group.' + group) + ` ${got} / ${badges.length}`));
      const list = make('div', 'title-badges');
      badges.forEach((b) => {
        const at = t.earned[b.id];
        const chosen = t.shown === b.id;
        const isNew = !!at && at > newSince;
        const item = make('button', 'title-badge' + (at ? ' earned' : '') + (chosen ? ' chosen' : '') + (isNew ? ' new' : ''));
        item.type = 'button';
        item.disabled = !at;
        item.setAttribute('aria-pressed', String(chosen));
        const text = make('span', 'title-badge-text');
        const nameEl = make('span', 'title-badge-name', I.t('titles.badge.' + b.id));
        if (isNew) nameEl.append(make('span', 'title-badge-new', 'NEW'));
        text.append(nameEl, make('span', 'title-badge-desc', I.t('titles.badge.' + b.id + '.desc')));
        if (at) text.append(make('span', 'title-badge-date', I.t('titles.badgeDate', { date: new Date(at).toLocaleDateString(I.lang) })));
        else if (progress[b.id]) text.append(progressBar(progress[b.id], I));
        item.append(medal(), text);
        item.title = at ? I.t(chosen ? 'titles.badgeChosen' : 'titles.badgeChoose') : I.t('titles.badgeLocked');
        item.addEventListener('click', () => {
          setShown(chosen ? null : b.id);
          if (onChange) onChange();
        });
        list.append(item);
      });
      section.append(list);
      wrap.append(section);
    });
    return wrap;
  }

  return {
    TOTALS: TOTALS,
    RANKS: RANKS,
    tierOf: tierOf,
    rankOf: rankOf,
    GROUPS: GROUPS,
    BADGES: BADGES,
    evaluate: evaluate,
    badgeProgress: badgeProgress,
    track: track,
    read: read,
    record: record,
    update: update,
    recheck: recheck,
    revokedText: revokedText,
    setShown: setShown,
    markSeen: markSeen,
    unseenCount: unseenCount,
    streakOf: streakOf,
    renderCard: renderCard,
    renderBadges: renderBadges,
  };
});
