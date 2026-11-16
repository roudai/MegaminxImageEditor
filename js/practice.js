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
  if (['pll', 'oll'].includes(params.get('set'))) prefs.set = params.get('set');
  if (SCOPES[params.get('scope')]) prefs.scope = params.get('scope');
  if (FILTERS.includes(params.get('filter'))) prefs.filter = params.get('filter');
  if (!['pll', 'oll'].includes(prefs.set)) prefs.set = 'pll';
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
    renderSettings();
    if (renew !== false) next();
  }

  // ---- 出題 ----
  let current = null; // { set, c, scramble }
  let hintUsed = false; // この問題でヒントを見たか（見たら習得済みにはしない）
  let lastName = null;

  // ?case=J3%2B で開いたときは、最初の1問だけそのケースを出す（記録のページから「このケースを練習」）
  let forcedName = params.get('case');

  function next() {
    resetTimer();
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
  let state = 'idle';
  let startAt = 0;
  let frame = null;
  const timerEl = $('timer');
  const format = (sec) => sec.toFixed(2);

  function setState(next) {
    state = next;
    $('practiceStage').classList.toggle('running', next === 'running');
  }

  function resetTimer() {
    cancelAnimationFrame(frame);
    setState('idle');
    timerEl.textContent = format(0);
  }

  // スペース・タップ：止まっていればスタート、計測中ならストップ
  function press() {
    if (!current) return;
    if (state === 'running') stop();
    else start();
  }

  function start() {
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
    record(sec);
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

  function renderHistory() {
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
    if (e.code === 'Space' || e.key === ' ') {
      e.preventDefault();
      press();
    }
  });
  document.addEventListener('keyup', (e) => {
    if (!typing(e) && (e.code === 'Space' || e.key === ' ')) e.preventDefault();
  });
  // 画面ではタイマーをタップするとスタート、計測中はどこをタップしても止まる
  timerEl.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    press();
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
    record(null);
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
  renderSettings();
  next();
})();
