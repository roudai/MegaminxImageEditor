// 練習ページ（practice.html）：スクランブルを出し、手元のパズルで解くタイムを測って覚えた度を自動で変える。
// 仕様: reference/PRACTICE_SPEC.md
//   - 出題：選んだ種類（PLL / OLL）・範囲（OLL の No Dot / Dot / All）・グループ（選んでいなければすべて）・
//     対象（覚えた度）に当てはまるケースからランダム
//     （直前と同じケースは避ける）、そのケースのスクランブル（js/<pll|oll>-scrambles.js）からランダムに選び、
//     前後にランダムな AUF を足す（progress.js の wrapAuf）。
//     ケースの名前と画像は解き終わるまで出さない
//   - タイマー：スペースを押す（画面ではタイマーをタップする）とスタート。何かのキー（タップ）でストップ。
//     計測中の Esc は中止（記録しない）。計測中に「スキップ」「解けなかった」を押してもタイムは記録しない。
//     押しっぱなしの繰り返しは無視する
//   - ヒント：ケースの名前と解く手順の最初の3手を出す（もう一度押すと消す）。ヒントを見た問題は目安以内でも練習中にし、タイムを最近の記録に入れない
//   - 判定（progress.js の judge）：しきい値以内 → 習得済み、超えた・「解けなかった」→ 練習中。「スキップ」は記録しない。
//     結果の「取り消す」で直前の判定とタイムを戻す
//   - 設定（種類・範囲・グループ・対象・しきい値）と各ケースの最近のタイム（最大10件）は store.js の 'practice' に保存
//     （ログイン中はクラウドにも）。判定ごとに日時付きの記録 log（最大2000件）も足す（記録のページ stats.html で使う）。
//     URL ?set=oll&scope=nd&filter=new で初期値を指定できる。?case=J3%2B なら最初の1問はそのケース
//   - 通し（set: 'full'）：WCA 形式のスクランブル（wca-scramble.js）で通しで解く。15秒のインスペクション（オン・オフ）、
//     +2 / DNF（インスペクションの超過で自動、結果からも変えられる）、ao5・ao12・ベスト（progress.js の average など）。
//     記録は practice.full = { inspection, log: [{ at, sec, penalty, s }] }（s はスクランブルの短い形）。覚えた度は変えない。
//     通しのタイマーは長押し（0.3 秒で準備完了）して離したときにスタートする
(function () {
  'use strict';
  const S = window.Store;
  const I = window.I18N;
  const P = window.Progress;
  const D = window.MegaminxDraw;
  const CA = window.CustomAlgs;
  const $ = (id) => document.getElementById(id);
  const el = (tag, className, text) => {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text != null) e.textContent = text;
    return e;
  };

  const DATA = {
    pll: CA ? CA.merged('pll', window.PLL_DATA || []) : window.PLL_DATA || [],
    oll: CA ? CA.merged('oll', window.OLL_DATA || []) : window.OLL_DATA || [],
  };
  const SCRAMBLES = { pll: window.PLL_SCRAMBLES || {}, oll: window.OLL_SCRAMBLES || {} };
  const SCOPES = {
    nd: (c) => c.algset === 'ND',
    d: (c) => c.algset === 'D',
    all: () => true,
  };
  const FILTERS = ['new', 'learning', 'learned', 'all'];
  const THRESHOLDS = [5, 8, 10, 15];
  const MAX_TIMES = 10;
  const HISTORY = 12;

  // ---- 設定 ----
  const saved = S.get('practice');
  const prefs = Object.assign({ set: 'pll', scope: 'nd', filter: 'new', threshold: 8, times: {} }, saved && typeof saved === 'object' ? saved : {});
  const params = new URLSearchParams(location.search);
  const SETS = ['pll', 'oll', 'full'];
  if (SETS.includes(params.get('set'))) prefs.set = params.get('set');
  if (SCOPES[params.get('scope')]) prefs.scope = params.get('scope');
  if (FILTERS.includes(params.get('filter'))) prefs.filter = params.get('filter');
  if (!SETS.includes(prefs.set)) prefs.set = 'pll';
  const isFull = () => prefs.set === 'full';
  // 通しの練習の設定と記録
  const fullPrefs = () => {
    const f = (S.get('practice') || {}).full;
    return Object.assign({ inspection: true, log: [] }, f && typeof f === 'object' ? f : {});
  };
  const saveFull = (change) => savePrefs({ full: Object.assign(fullPrefs(), change) });
  if (!SCOPES[prefs.scope]) prefs.scope = 'nd';
  if (!FILTERS.includes(prefs.filter)) prefs.filter = 'new';
  if (!(prefs.threshold > 0 && prefs.threshold <= 120)) prefs.threshold = 8;

  // 練習の設定・タイムは保存し直す前に読み直す（一覧など別のページでの変更を消さないように）
  function savePrefs(change) {
    const current = S.get('practice');
    const next = Object.assign({}, current && typeof current === 'object' ? current : {}, change);
    S.set('practice', next);
    Object.assign(prefs, next);
  }

  const scopeOf = (set) => (set === 'oll' ? prefs.scope : 'all');
  const inScope = (set) => DATA[set].filter(SCOPES[scopeOf(set)]);
  // グループの絞り込み：prefs.groups[set] に選んだグループ（1つも選んでいなければすべて）
  const NOTES = window.CASE_GROUP_NOTES || {};
  const chosenGroups = (set) => {
    const list = prefs.groups && Array.isArray(prefs.groups[set]) ? prefs.groups[set] : [];
    return list.length ? new Set(list) : null;
  };
  const inSelection = (set) => {
    const chosen = chosenGroups(set);
    return inScope(set).filter((c) => !chosen || chosen.has(c.group));
  };
  const pool = () => inSelection(prefs.set).filter((c) => prefs.filter === 'all' || P.statusOf(prefs.set, c.name) === prefs.filter);
  let groupsOpen = false; // グループを選ぶ欄を開いているか

  // ---- 設定の表示 ----
  function segment(items, current, onPick) {
    const box = el('div', 'practice-segment');
    box.setAttribute('role', 'group');
    items.forEach((item) => {
      const b = el('button');
      b.type = 'button';
      const label = el('span');
      if (item.key) I.set(label, item.key, item.params);
      else label.textContent = item.text;
      b.append(label);
      if (item.count != null) b.append(el('span', 'count', String(item.count)));
      b.classList.toggle('active', item.value === current);
      b.setAttribute('aria-pressed', String(item.value === current));
      b.addEventListener('click', () => onPick(item.value));
      box.append(b);
    });
    return box;
  }

  function field(labelKey, control) {
    const f = el('div', 'practice-field');
    const label = el('span', 'practice-field-label');
    I.set(label, labelKey);
    f.append(label, control);
    return f;
  }

  function renderSettings() {
    // 種類と範囲は見出しの横に置く（設定の行を1行に収めるため）
    const setBox = $('practiceSetBox');
    setBox.replaceChildren();
    setBox.append(
      segment(
        [
          { value: 'pll', text: 'PLL' },
          { value: 'oll', text: 'OLL' },
          { value: 'full', key: 'practice.full' },
        ],
        prefs.set,
        (v) => changeSettings({ set: v })
      )
    );
    if (prefs.set === 'oll') {
      setBox.append(
        segment(
          [
            { value: 'nd', key: 'list.scopeNd', count: DATA.oll.filter(SCOPES.nd).length },
            { value: 'd', key: 'list.scopeD', count: DATA.oll.filter(SCOPES.d).length },
            { value: 'all', key: 'list.scopeAll', count: DATA.oll.length },
          ],
          prefs.scope,
          (v) => changeSettings({ scope: v })
        )
      );
    }
    const box = $('practiceSettings');
    box.replaceChildren();
    document.body.classList.toggle('practice-full', isFull());
    // 操作の説明：通しでインスペクションがオンのときはその手順
    I.set($('timerHint'), isFull() ? (fullPrefs().inspection ? 'practice.hintInspection' : 'practice.hintFull') : 'practice.hint');
    if (isFull()) {
      // 通し：インスペクションのオン・オフだけ
      box.append(
        field(
          'practice.inspection',
          segment(
            [
              { value: true, key: 'practice.on' },
              { value: false, key: 'practice.off' },
            ],
            fullPrefs().inspection,
            (v) => {
              saveFull({ inspection: v });
              renderSettings();
              resetTimer();
            }
          )
        )
      );
      return;
    }
    box.append(field('practice.groups', groupSummary()));
    const cases = inSelection(prefs.set);
    const count = (f) => (f === 'all' ? cases.length : cases.filter((c) => P.statusOf(prefs.set, c.name) === f).length);
    box.append(
      field(
        'practice.target',
        segment(
          FILTERS.map((f) => ({ value: f, key: f === 'all' ? 'list.filterAll' : 'status.' + f, count: count(f) })),
          prefs.filter,
          (v) => changeSettings({ filter: v })
        )
      )
    );
    // 目安：よく使う秒数のボタンと、任意の秒数の入力欄（任意の秒数はボタンには足さず、入力欄を強調する）
    const thresholds = THRESHOLDS;
    const custom = el('input', 'form-control form-control-sm practice-seconds' + (THRESHOLDS.includes(prefs.threshold) ? '' : ' active'));
    custom.type = 'number';
    custom.min = '1';
    custom.max = '120';
    custom.step = '0.5';
    custom.value = String(prefs.threshold);
    I.set(custom, 'practice.customSeconds', null, 'aria-label');
    custom.addEventListener('change', () => {
      const v = Number(custom.value);
      if (v > 0 && v <= 120) changeSettings({ threshold: v }, false);
      else custom.value = String(prefs.threshold);
    });
    const thresholdBox = el('div', 'd-flex align-items-center gap-2');
    thresholdBox.append(
      segment(
        thresholds.map((t) => ({ value: t, key: 'practice.seconds', params: { n: t } })),
        prefs.threshold,
        (v) => changeSettings({ threshold: v }, false)
      ),
      custom
    );
    box.append(field('practice.threshold', thresholdBox));
    if (groupsOpen) box.append(groupPicker());
  }

  // 選んでいるグループの要約（押すとグループを選ぶ欄を開く・閉じる）
  function groupSummary() {
    const chosen = chosenGroups(prefs.set);
    const button = el('button', 'practice-groups-toggle');
    button.type = 'button';
    button.setAttribute('aria-expanded', String(groupsOpen));
    const label = el('span');
    if (!chosen) I.set(label, 'practice.groupsAll');
    else {
      const names = [...chosen];
      label.textContent = names.length <= 4 ? names.join(', ') : `${names.slice(0, 4).join(', ')} … (${names.length})`;
    }
    button.append(label, el('span', 'practice-groups-caret', groupsOpen ? '▴' : '▾'));
    button.addEventListener('click', () => {
      groupsOpen = !groupsOpen;
      renderSettings();
    });
    return button;
  }

  // グループを選ぶ欄：押したグループだけを出題する（1つも選んでいなければすべて）
  function groupPicker() {
    const set = prefs.set;
    const chosen = chosenGroups(set) || new Set();
    const scoped = inScope(set);
    const groups = scoped.map((c) => c.group).filter((g, i, all) => all.indexOf(g) === i);
    const box = el('div', 'practice-groups');
    const chips = el('div', 'practice-group-chips');
    groups.forEach((g) => {
      const b = el('button', 'practice-group-chip' + (chosen.has(g) ? ' active' : ''));
      b.type = 'button';
      b.textContent = g;
      const note = (NOTES[set] || {})[g];
      const n = scoped.filter((c) => c.group === g).length;
      b.title = note ? `${g} (${note}) · ${n}` : `${g} · ${n}`;
      b.setAttribute('aria-pressed', String(chosen.has(g)));
      b.addEventListener('click', () => {
        const next = new Set(chosen);
        if (next.has(g)) next.delete(g);
        else next.add(g);
        setGroups(set, groups.filter((x) => next.has(x))); // データの並び順で保存する
      });
      chips.append(b);
    });
    const help = el('div', 'practice-groups-help');
    I.set(help, 'practice.groupsHelp');
    const clear = el('button', 'btn btn-link btn-sm practice-groups-clear');
    clear.type = 'button';
    I.set(clear, 'practice.groupsClear');
    clear.disabled = !chosen.size;
    clear.addEventListener('click', () => setGroups(set, []));
    const foot = el('div', 'd-flex align-items-center gap-2 mt-1');
    foot.append(help, clear);
    box.append(chips, foot);
    return box;
  }

  function setGroups(set, list) {
    const groups = Object.assign({}, prefs.groups, { [set]: list });
    changeSettings({ groups: groups });
  }

  // 設定を変えたら保存し、（しきい値以外なら）次の問題を出し直す
  function changeSettings(change, renew) {
    savePrefs(change);
    if (change.set) $('practiceResult').hidden = true; // 種類を変えたら前の結果は消す
    renderSettings();
    if (renew !== false) next();
    renderHistory();
  }

  // ---- 出題 ----
  let current = null; // { set, c, scramble }
  let hintUsed = false; // この問題でヒントを見たか（見たら習得済みにはしない）
  let lastName = null;

  // ?case=J3%2B で開いたときは、最初の1問だけそのケースを出す（記録のページから「このケースを練習」）
  let forcedName = params.get('case');

  function next() {
    resetTimer();
    if (isFull()) {
      // 通し：毎回 WCA 形式のスクランブルを作る
      $('practiceEmpty').hidden = true;
      ['timer', 'dnfButton', 'skipButton'].forEach((id) => {
        $(id).disabled = false;
      });
      hintUsed = false;
      showHint(false);
      current = { set: 'full', scramble: window.WcaScramble.megaminx() };
      window.WcaScramble.render($('scramble'), current.scramble); // 1行ずつ（1行おきのストライプ）
      $('scramble').classList.add('full');
      return;
    }
    $('scramble').classList.remove('full');
    const forced = forcedName ? DATA[prefs.set].find((x) => x.name === forcedName) : null;
    forcedName = null;
    const list = forced ? [forced] : pool();
    $('practiceEmpty').hidden = list.length > 0;
    $('timer').disabled = !list.length;
    $('dnfButton').disabled = !list.length;
    $('skipButton').disabled = !list.length;
    $('hintButton').disabled = !list.length;
    hintUsed = false;
    showHint(false);
    if (!list.length) {
      current = null;
      $('scramble').textContent = '';
      return;
    }
    const candidates = list.length > 1 ? list.filter((c) => c.name !== lastName) : list;
    const c = candidates[Math.floor(Math.random() * candidates.length)];
    const scrambles = SCRAMBLES[prefs.set][c.name] || [];
    // 前後にランダムな AUF（0〜4 回）を足して、同じスクランブルでも崩れ方（向き）が変わるようにする
    const base = scrambles[Math.floor(Math.random() * scrambles.length)] || '';
    const scramble = base ? P.wrapAuf(base, Math.floor(Math.random() * 5), Math.floor(Math.random() * 5)) : '';
    current = { set: prefs.set, c: c, scramble: scramble };
    lastName = c.name;
    $('scramble').textContent = scramble;
  }

  // ---- タイマー ----
  // idle → running（スペースを押した瞬間・タイマーをタップした瞬間にスタート）→ idle
  // 通しでインスペクションがオンのとき：idle → inspecting（15 秒のカウントダウン）→ running → idle
  let state = 'idle';
  let inspectAt = 0;
  let penalty = ''; // インスペクションの超過によるペナルティ（'' / '+2' / 'DNF'）
  let startAt = 0;
  let frame = null;
  const timerEl = $('timer');
  const format = (sec) => P.formatTime(sec); // 60 秒以上は分表記（1:05.23）

  function setState(next) {
    state = next;
    $('practiceStage').classList.toggle('running', next === 'running');
    $('practiceStage').classList.toggle('inspecting', next === 'inspecting');
    if (next !== 'inspecting') timerEl.classList.remove('warn8', 'warn12', 'over');
  }

  function resetTimer() {
    cancelAnimationFrame(frame);
    clearHold();
    setState('idle');
    timerEl.textContent = format(0);
  }

  // スペース・タップ：止まっていればスタート、計測中ならストップ
  function press() {
    if (!current) return;
    if (state === 'running') stop();
    else if (state === 'idle' && isFull() && fullPrefs().inspection) inspect();
    else start();
  }

  // ---- 通し：長押しして離すとスタート ----
  // スペース（タイマーの長押し）を 0.3 秒押すと準備完了（緑。押しはじめは赤）、離すとスタート。短く押しただけでは始まらない。
  // インスペクションありのときは、最初の1回はインスペクションを始めるだけ（その押した指を離してもスタートしない）
  const HOLD_MS = 300;
  let holding = false;
  let ready = false;
  let holdTimer = null;
  let ignoreRelease = false;

  function clearHold() {
    clearTimeout(holdTimer);
    holding = false;
    ready = false;
    timerEl.classList.remove('holding', 'ready');
  }

  function fullDown() {
    if (!current) return;
    if (state === 'running') {
      stop();
      return;
    }
    if (state === 'idle' && fullPrefs().inspection) {
      inspect();
      ignoreRelease = true;
      return;
    }
    if (holding) return;
    holding = true;
    timerEl.classList.add('holding');
    holdTimer = setTimeout(() => {
      ready = true;
      timerEl.classList.remove('holding');
      timerEl.classList.add('ready');
    }, HOLD_MS);
  }

  function fullUp() {
    if (ignoreRelease) {
      ignoreRelease = false;
      return;
    }
    if (!holding) return;
    const go = ready;
    clearHold();
    if (go) start();
  }

  // インスペクション：15 秒のカウントダウン（WCA：8 秒・12 秒で知らせる。15 秒を超えて 17 秒までに始めたら +2、超えたら DNF）
  function inspect() {
    setState('inspecting');
    inspectAt = performance.now();
    const tick = () => {
      const t = (performance.now() - inspectAt) / 1000;
      timerEl.classList.toggle('warn8', t >= 8 && t < 12);
      timerEl.classList.toggle('warn12', t >= 12 && t < 15);
      timerEl.classList.toggle('over', t >= 15);
      timerEl.textContent = t < 15 ? String(Math.ceil(15 - t)) : t < 17 ? '+2' : 'DNF';
      frame = requestAnimationFrame(tick);
    };
    tick();
  }

  function start() {
    if (state === 'inspecting') {
      cancelAnimationFrame(frame);
      const t = (performance.now() - inspectAt) / 1000;
      penalty = t < 15 ? '' : t < 17 ? '+2' : 'DNF';
    } else {
      penalty = '';
    }
    setState('running');
    startAt = performance.now();
    const tick = () => {
      timerEl.textContent = format((performance.now() - startAt) / 1000);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
  }

  // 止めたタップ（クリック）で、そのままボタンまで押してしまわないように少しの間ボタンを無視する
  let ignoreClicksUntil = 0;

  function stop() {
    ignoreClicksUntil = performance.now() + 400;
    cancelAnimationFrame(frame);
    const sec = Math.round((performance.now() - startAt) / 10) / 100; // 0.01 秒単位
    timerEl.textContent = format(sec);
    setState('idle');
    if (isFull()) recordFull(sec, penalty);
    else record(sec);
  }

  // ---- 記録と判定 ----
  const sessionHistory = [];

  function record(sec) {
    const { set, c } = current;
    const hinted = hintUsed;
    // ヒントを見たときは、目安以内でも習得済みにはしない（練習中）。タイムも最近の記録に入れない
    const status = hinted ? 'learning' : P.judge(sec, prefs.threshold);
    const beforeStatus = P.statusOf(set, c.name);
    const times = (prefs.times && prefs.times[set]) || {};
    const beforeTimes = times[c.name];
    P.setStatus(set, c.name, status);
    if (sec !== null && !hinted) {
      const allTimes = Object.assign({}, prefs.times);
      allTimes[set] = Object.assign({}, allTimes[set], { [c.name]: P.addTime(beforeTimes, sec, MAX_TIMES) });
      savePrefs({ times: allTimes });
    }
    // 日時付きの記録（記録のページ stats.html で使う）。ヒントを見たものも残す（hint: true）
    const logEntry = { at: Date.now(), set: set, name: c.name, sec: sec, status: status, hint: hinted };
    savePrefs({ log: P.addLog((S.get('practice') || {}).log, logEntry) });
    const entry = { set, c, sec, status, threshold: prefs.threshold, hinted };
    sessionHistory.unshift(entry);
    sessionHistory.length = Math.min(sessionHistory.length, HISTORY);
    showResult(entry, () => {
      P.setStatus(set, c.name, beforeStatus);
      const allTimes = Object.assign({}, S.get('practice') && S.get('practice').times);
      allTimes[set] = Object.assign({}, allTimes[set]);
      if (beforeTimes) allTimes[set][c.name] = beforeTimes;
      else delete allTimes[set][c.name];
      const log = ((S.get('practice') || {}).log || []).filter((e) => e.at !== logEntry.at || e.name !== logEntry.name);
      savePrefs({ times: allTimes, log: log });
      sessionHistory.splice(sessionHistory.indexOf(entry), 1);
      renderHistory();
      renderSettings();
      const result = $('practiceResult');
      result.replaceChildren(el('div', 'text-muted small', I.t('practice.undone')));
    });
    renderHistory();
    renderSettings(); // 対象の件数を更新
    next();
  }

  function showResult(entry, undo) {
    const { set, c, sec, status, threshold, hinted } = entry;
    const result = $('practiceResult');
    result.hidden = false;
    result.replaceChildren();

    const display = P.displaySettings(set);
    const canvas = el('canvas');
    const ratio = window.devicePixelRatio || 1;
    canvas.width = canvas.height = Math.round(96 * ratio);
    canvas.style.width = canvas.style.height = '96px';
    const colors = P.caseColors(c, display.scheme);
    D.draw(canvas, colors.ucolor, colors.scolor, { border: display.border });

    const body = el('div', 'practice-result-body');
    const head = el('div', 'd-flex flex-wrap align-items-baseline gap-2');
    head.append(el('span', 'practice-result-time', sec === null ? 'DNF' : `${format(sec)}`));
    const verdict = el('span', 'practice-verdict ' + status);
    verdict.textContent =
      sec === null
        ? I.t('practice.verdict.dnf')
        : hinted
          ? I.t('practice.verdict.hint')
          : I.t('practice.verdict.' + status, { t: threshold });
    const undoButton = el('button', 'btn btn-link practice-undo');
    undoButton.type = 'button';
    undoButton.textContent = I.t('practice.undo');
    undoButton.addEventListener('click', undo);
    head.append(verdict, undoButton);

    const name = el('div', 'practice-case-name mt-1', `${set.toUpperCase()} ${c.name}`);
    const alg = el('div', 'practice-case-alg', c.alg);
    const times = (prefs.times && prefs.times[set] && prefs.times[set][c.name]) || [];
    const stats = el('div', 'practice-case-stats mt-1');
    if (times.length) {
      const best = Math.min(...times);
      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      stats.textContent = I.t('practice.caseStats', { best: format(best), avg: format(avg), n: times.length });
    }
    body.append(head, name, alg, stats);
    result.append(canvas, body);
  }

  // ---- 通しの記録 ----
  const fullLog = () => (Array.isArray(fullPrefs().log) ? fullPrefs().log : []);
  const showTime = (rec) => {
    const t = P.effectiveTime(rec);
    return t === null ? 'DNF' : format(t) + (rec.penalty === '+2' ? '+' : '');
  };
  const showAvg = (a) => (a === undefined ? '–' : a === null ? 'DNF' : format(a));

  function recordFull(sec, pen) {
    // スクランブルは短い形（wca-scramble.js の encode。13 文字）で記録する。形式が違うときだけ全文
    const code = window.WcaScramble.encode(current.scramble);
    const rec = code
      ? { at: Date.now(), sec: sec, penalty: pen || '', s: code }
      : { at: Date.now(), sec: sec, penalty: pen || '', scramble: current.scramble };
    saveFull({ log: P.addLog(fullLog(), rec) });
    showFullResult(rec);
    renderHistory();
    next();
  }

  function updateFull(rec, change) {
    const log = fullLog().map((r) => (r.at === rec.at ? Object.assign({}, r, change) : r));
    saveFull({ log: log });
    return log.find((r) => r.at === rec.at);
  }

  function showFullResult(rec) {
    const result = $('practiceResult');
    result.hidden = false;
    result.replaceChildren();
    const body = el('div', 'practice-result-body w-100');
    const head = el('div', 'd-flex flex-wrap align-items-center gap-2');
    head.append(el('span', 'practice-result-time', showTime(rec)));
    // ペナルティの切り替え（OK / +2 / DNF）。あとから変えられる
    const seg = el('div', 'practice-segment');
    [
      ['', 'practice.penaltyOk'],
      ['+2', null],
      ['DNF', null],
    ].forEach(([value, key]) => {
      const b = el('button');
      b.type = 'button';
      if (key) I.set(b, key);
      else b.textContent = value;
      b.classList.toggle('active', rec.penalty === value);
      b.addEventListener('click', () => {
        const updated = updateFull(rec, { penalty: value });
        if (updated) showFullResult(updated);
        renderHistory();
      });
      seg.append(b);
    });
    const del = el('button', 'btn btn-link practice-undo');
    del.type = 'button';
    I.set(del, 'practice.delete');
    del.addEventListener('click', () => {
      saveFull({ log: fullLog().filter((r) => r.at !== rec.at) });
      result.replaceChildren(el('div', 'text-muted small', I.t('practice.deleted')));
      renderHistory();
    });
    head.append(seg, del);
    const scramble = el('div', 'practice-case-alg practice-full-scramble mt-1');
    window.WcaScramble.render(scramble, window.WcaScramble.textOf(rec));
    body.append(head, scramble);
    result.append(body);
  }

  // 通しの ao5・ao12・ベスト（直近の記録の上）
  function renderFullStats() {
    const box = $('practiceFullStats');
    if (!isFull()) {
      box.hidden = true;
      return;
    }
    const log = fullLog();
    box.hidden = false;
    const item = (key, value) => {
      const d = el('div', 'practice-stat');
      const label = el('span', 'practice-stat-label');
      I.set(label, key);
      d.append(label, el('span', 'practice-stat-value', value));
      return d;
    };
    box.replaceChildren(
      item('practice.ao5', showAvg(P.average(log, 5))),
      item('practice.ao12', showAvg(P.average(log, 12))),
      item('practice.bestSingle', P.bestSingle(log) == null ? '–' : format(P.bestSingle(log))),
      item('practice.bestAo5', showAvg(P.bestAverage(log, 5))),
      item('practice.bestAo12', showAvg(P.bestAverage(log, 12)))
    );
  }

  function renderHistory() {
    renderFullStats();
    if (isFull()) {
      // 通し：保存してある直近の記録（ページを開き直しても出る）
      $('practiceHistory').replaceChildren(...fullLog().slice(0, HISTORY).map((r) => el('li', P.effectiveTime(r) === null ? 'learning' : '', showTime(r))));
      return;
    }
    const list = $('practiceHistory');
    list.replaceChildren(
      ...sessionHistory.map((h) => {
        const li = el('li', h.status, `${h.c.name} ${h.sec === null ? 'DNF' : format(h.sec)}`);
        return li;
      })
    );
  }

  // ---- 操作 ----
  const typing = (e) => /^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || '');

  document.addEventListener('keydown', (e) => {
    if (typing(e) || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.repeat) {
      // 押しっぱなしの繰り返し（スタートしたスペースを押し続けているときなど）で止めたり始めたりしない
      if (e.code === 'Space' || state === 'running') e.preventDefault();
      return;
    }
    if (state === 'running') {
      e.preventDefault();
      if (e.key === 'Escape') resetTimer();
      else stop();
      return;
    }
    if (state === 'inspecting' && e.key === 'Escape') {
      e.preventDefault();
      resetTimer();
      return;
    }
    if (e.code === 'Space' || e.key === ' ') {
      e.preventDefault();
      if (isFull()) fullDown();
      else press();
    }
  });
  document.addEventListener('keyup', (e) => {
    if (!typing(e) && (e.code === 'Space' || e.key === ' ')) {
      e.preventDefault();
      if (isFull()) fullUp();
    }
  });
  // 画面ではタイマーをタップするとスタート（通しは長押しして離すとスタート）、計測中はどこをタップしても止まる
  timerEl.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (isFull()) fullDown();
    else press();
  });
  timerEl.addEventListener('pointerup', () => {
    if (isFull()) fullUp();
  });
  timerEl.addEventListener('pointercancel', () => {
    if (isFull()) clearHold();
  });
  timerEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') e.preventDefault(); // ボタンの Enter で押した扱いにしない
  });
  document.addEventListener('pointerdown', (e) => {
    if (state !== 'running' || e.target === timerEl) return;
    // 計測中に「スキップ」「解けなかった」を押したときは、タイムを記録せずに止める
    // （そのあとのクリックで、スキップ＝記録せず次へ、解けなかった＝練習中、になる）
    if (e.target.closest('#skipButton, #dnfButton')) {
      resetTimer();
      return;
    }
    stop();
  });

  $('dnfButton').addEventListener('click', () => {
    if (!current || performance.now() < ignoreClicksUntil) return;
    resetTimer();
    if (isFull()) recordFull(0, 'DNF');
    else record(null);
  });
  // ヒント：ケースの名前と、解く手順の最初の3手（前の AUF は出題の向きで変わるので出さない）
  function firstMoves(alg, n) {
    return alg
      .replace(/^(\s*\(U[0-9']*\))+\s*/, '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, n)
      .join(' ');
  }
  $('hintButton').addEventListener('click', () => {
    if (!current || state === 'running' || performance.now() < ignoreClicksUntil) return;
    const box = $('practiceHintText');
    // もう一度押すと消す（一度見たので、この問題は練習中の扱いのまま）
    if (box.childElementCount) {
      showHint(false);
      return;
    }
    hintUsed = true;
    box.replaceChildren(el('span', 'practice-hint-name', current.c.name), el('span', 'practice-hint-moves', firstMoves(current.c.alg, 3) + ' …'));
    showHint(true);
  });
  // ヒントのボタンの文：出しているときは「ヒントを隠す」
  function showHint(shown) {
    if (!shown) $('practiceHintText').replaceChildren();
    I.set($('hintButton'), shown ? 'practice.hintHide' : 'practice.hintButton');
    $('hintButton').setAttribute('aria-pressed', String(shown));
  }
  $('skipButton').addEventListener('click', () => {
    if (performance.now() < ignoreClicksUntil) return;
    next();
  });

  I.onChange(() => {
    renderSettings();
  });

  savePrefs({ set: prefs.set, scope: prefs.scope, filter: prefs.filter, threshold: prefs.threshold });
  // 以前の形（スクランブルの全文 rec.scramble）の通しの記録は、短い形（rec.s）に直して保存し直す（アカウントの容量を節約）
  (function shrinkFullLog() {
    const log = fullLog();
    if (!log.some((r) => typeof r.scramble === 'string')) return;
    saveFull({
      log: log.map((r) => {
        if (typeof r.scramble !== 'string') return r;
        const code = window.WcaScramble.encode(r.scramble);
        if (!code) return r;
        const out = Object.assign({}, r, { s: code });
        delete out.scramble;
        return out;
      }),
    });
  })();

  renderSettings();
  next();
  renderHistory();
})();
