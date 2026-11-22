// 一覧ページ（pll.html / oll.html）：全ケースの画像と手順をグループごとに並べる。
// <body data-set="pll|oll"> の種類のデータ（pll-data.js / oll-data.js）とグループ名（case-groups.js）を使い、
// 画像は megaminx-draw.js で描く。仕様: reference/PLL_SPEC.md・reference/OLL_SPEC.md「一覧ページ」
//   - 画像は solve case（alg の逆手順を適用し、持ち替え y の合計を打ち消す）の状態
//   - Body Color はエディタで保存した設定（localStorage）を使う。配色は
//       PLL: 保存した配色。OLL 配色のときは OLL を選ぶ前の配色、それも無いときは Standard
//       OLL: 保存した U の色だけを残した OLL 配色（他の面は dimgray）
//   - ケースをクリックすると、そのケースを選んだ状態でエディタ（./?pll=… / ?oll=…）を開く
//   - 習得状況：各カード右上のバッジをタップで 未着手 → 練習中 → 覚えた と切り替え、localStorage に保存する。
//     上部に進み具合（積み上げバー・件数）と絞り込みチップ、グループ見出しに「覚えた数 / 全体」を出す
//   - PLL は「グループ順 / 覚える順」を切り替えられる。覚える順は data/pll/learn_order.json の段階（27）ごとの見出しで、
//     段階の中も覚える順（区切りは case-sections.js。選んだ並びは 'list-filter' の pllOrder に保存し、練習ページと共通）
//   - 上のグループ（覚える順なら段階）のボタンは、押すとそのグループだけを表示する（複数選べる。もう一度押すと外す。
//     1つも選んでいなければすべて。「選択を解除」で戻す）。選んだものは 'list-filter' の <set>Groups（覚える順は <set>Stages）に保存
//   - OLL は No Dot（algset ND、1〜37）と Dot（algset D、1C・38〜53）を切り替えて表示する（All も選べる）。
//     件数・進捗バー・絞り込み・一括ダウンロードは選んだ範囲だけで数える（習得状況の保存はケースごとで共通）
//   - エディタで保存した自分の手順があれば、そのケースはその手順（と画像）で表示し、名前の横に「custom」を付ける
//   - ZIP でダウンロード（Download ZIP）：全ケースを一覧と同じ配色で PNG にし、zip（megaminx-<pll|oll>.zip）にまとめる。
//     押してすぐにはダウンロードせず、件数・画像の大きさ・背景を書いた確認の行を出し、「ダウンロード」で始める。
//     画像サイズ・Body Color・背景はエディタで保存した設定（zip-store.js で無圧縮の zip を作る）
(function () {
  'use strict';
  const M = window.MegaminxState;
  const D = window.MegaminxDraw;
  const $ = (id) => document.getElementById(id);
  const I = window.I18N; // 日本語・英語の切り替え（i18n.js）

  const SET = document.body.dataset.set;
  const BASE = { pll: window.PLL_DATA, oll: window.OLL_DATA }[SET] || [];
  // 自分の手順（エディタの My algorithm で保存したもの）を重ねる。手順・画像・一括ダウンロードはこちらを使う
  const DATA = window.CustomAlgs ? window.CustomAlgs.merged(SET, BASE) : BASE;
  const NOTES = (window.CASE_GROUP_NOTES || {})[SET] || {};
  const IMAGE_SIZE = 120; // 表示サイズ（px）。高解像度の画面では devicePixelRatio 倍で描く

  const P = window.Progress; // 習得状況・画像の色（progress.js。練習ページと共通）
  // エディタで保存した設定から、画像の配色・線の色・背景・サイズを決める
  const savedSettings = () => P.displaySettings(SET);
  let zipConfirming = false; // ZIP でダウンロードの確認を出しているか（renderZipConfirm）

  const groupLabel = (g) => (NOTES[g] ? `${g} (${NOTES[g]})` : g);
  const el = (tag, className, text) => {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text != null) e.textContent = text;
    return e;
  };

  // solve case（alg の逆手順を適用、持ち替え y は打ち消す）の状態の画像の色
  const caseColors = (c, settings) => P.caseColors(c, settings.scheme);

  // ---- 習得状況 ----
  // { pll: { 'A1+': 'learning', ... }, oll: { ... } }。未着手（new）は保存しない
  // 保存は store.js 経由（ログイン中はクラウドにも）
  const FILTER_KEY = 'list-filter';
  const STATUSES = P.STATUSES;
  // 表示名（保存する値は new / learning / learned のまま）
  const statusLabel = (status) => I.t('status.' + status);

  const readJSON = (name) => {
    const value = window.Store.get(name);
    return value && typeof value === 'object' ? value : {};
  };
  const writeJSON = (name, value) => window.Store.set(name, value);

  // 表示中は習得状況を手元に持っておき（件数を数えるたびに読み直さないように）、変えるときは progress.js で保存する
  let progress = P.statuses(SET);
  const statusOf = (c) => (STATUSES.includes(progress[c.name]) ? progress[c.name] : 'new');
  function setStatus(c, status) {
    P.setStatus(SET, c.name, status);
    progress = P.statuses(SET);
  }

  const ICONS =
    // 練習中：進捗リング（薄い円の上に 3/4 の弧）
    '<svg class="icon-learning" viewBox="0 0 16 16" aria-hidden="true">' +
    '<circle cx="8" cy="8" r="5" fill="none" stroke="currentColor" stroke-width="2" opacity=".28"/>' +
    '<path d="M8 3a5 5 0 1 1-5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' +
    // 覚えた：チェック
    '<svg class="icon-learned" viewBox="0 0 16 16" aria-hidden="true" style="position:absolute">' +
    '<path d="M3.5 8.5l3 3 6-6.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function caseCard(c, settings) {
    const col = el('div', 'col');
    col.dataset.name = c.name;
    const card = el('div', 'card h-100 case-card');
    const link = el('a', 'case-link d-block h-100');
    link.href = `./?${SET}=${encodeURIComponent(c.name)}`;
    I.set(link, 'list.openTitle', { name: c.name }, 'title');

    // 描く解像度は IMAGE_SIZE × devicePixelRatio。表示の大きさは CSS（.case-image：カードの幅に合わせて縮み、最大 IMAGE_SIZE）
    const canvas = el('canvas', 'case-image mx-auto mt-2 d-block');
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(IMAGE_SIZE * ratio);
    canvas.height = canvas.width;
    const colors = caseColors(c, settings);
    D.draw(canvas, colors.ucolor, colors.scolor, { border: settings.border });

    const body = el('div', 'card-body p-2 text-center');
    // 名前の行：ケース名をカードの左右の真ん中に置き、カスタムの札は左、逆手順は右に寄せる（3 列のグリッド。css/cases.css）
    const name = el('div', 'fw-bold case-name');
    const left = el('span', 'case-name-side left');
    const right = el('span', 'case-name-side right');
    name.append(left, el('span', 'case-name-text', c.name), right);
    if (c.custom) {
      const tag = el('span', 'custom-tag');
      I.set(tag, 'list.customTag');
      I.set(tag, 'list.customTitle', null, 'title');
      left.append(tag);
    }
    // 逆手順のケース（PLL。pll-data.js の inverse。自分の手順にしても組は変わらない）：名前の右に小さく「⇄ A1-」。
    // 自分自身が逆手順のケースは出さない
    if (c.inverse && c.inverse !== c.name) {
      const inv = el('span', 'case-inverse');
      const shown = el('span');
      shown.setAttribute('aria-hidden', 'true');
      I.set(shown, 'list.inverse', { name: c.inverse });
      const spoken = el('span', 'visually-hidden'); // 読み上げは「逆手順：A1-」（⇄ を読ませない）
      I.set(spoken, 'list.inverseTitle', { name: c.inverse });
      I.set(inv, 'list.inverseTitle', { name: c.inverse }, 'title');
      inv.append(shown, spoken);
      right.append(inv);
    }
    body.append(name, el('div', 'small font-monospace text-break', c.alg));
    link.append(canvas, body);

    const badge = el('button', 'status-badge');
    badge.type = 'button';
    badge.innerHTML = ICONS;
    const show = (status) => {
      card.dataset.status = status;
      badge.dataset.status = status;
      col.dataset.status = status;
      badge.title = I.t('status.badgeTitle', { status: statusLabel(status) });
      badge.setAttribute('aria-label', I.t('status.badgeAria', { name: c.name, status: statusLabel(status) }));
    };
    show(statusOf(c));
    badge.addEventListener('relabel', () => show(statusOf(c)));
    badge.addEventListener('click', () => {
      const next = STATUSES[(STATUSES.indexOf(statusOf(c)) + 1) % STATUSES.length];
      setStatus(c, next);
      show(next);
      badge.classList.remove('pop');
      void badge.offsetWidth; // アニメーションをやり直す
      badge.classList.add('pop');
      if (resetState && !resetState.confirming) resetState = null; // 1枚変えたら「元に戻す」は消す
      updateSummary();
      renderReset();
    });

    card.append(link, badge);
    col.append(card);
    return col;
  }

  // ---- 表示する範囲（OLL の No Dot / Dot）----
  const SCOPES =
    SET === 'oll'
      ? [
          { key: 'nd', label: 'list.scopeNd', title: 'list.scopeNdTitle', test: (c) => c.algset === 'ND' },
          { key: 'd', label: 'list.scopeD', title: 'list.scopeDTitle', test: (c) => c.algset === 'D' },
          { key: 'all', label: 'list.scopeAll', title: 'list.scopeAllTitle', test: () => true },
        ]
      : [{ key: 'all', label: 'list.scopeAll', test: () => true }];
  let scope = SCOPES[0];
  const inScope = (c) => scope.test(c);
  const scoped = () => DATA.filter(inScope);

  // ---- 並び（グループ順 / 覚える順）----
  const CS = window.CaseSections;
  const HAS_STAGES = CS.hasStages(DATA);
  let byStage = false;
  let sections = []; // 今の並びの区切り（CaseSections.list）

  // ---- 表示するグループ（覚える順なら段階）の選択 ----
  let chosen = new Set(); // 区切りの key。空ならすべて
  const chosenKey = () => SET + (byStage ? 'Stages' : 'Groups');
  const loadChosen = () => {
    const list = readJSON(FILTER_KEY)[chosenKey()];
    const keys = new Set(sections.map((s) => s.key));
    chosen = new Set(Array.isArray(list) ? list.filter((k) => keys.has(k)) : []);
  };
  function setChosen(next) {
    chosen = next;
    // 並びの順で保存する
    writeJSON(FILTER_KEY, Object.assign(readJSON(FILTER_KEY), { [chosenKey()]: sections.map((s) => s.key).filter((k) => chosen.has(k)) }));
    applyFilter();
  }

  // ---- 進み具合・絞り込み ----
  let filter = 'all';
  const counts = (list) => {
    const n = { all: list.length, new: 0, learning: 0, learned: 0 };
    list.forEach((c) => n[statusOf(c)]++);
    return n;
  };

  function buildSummary() {
    const box = $('progressBox');
    box.className = 'progress-summary mb-3';
    box.innerHTML = '';
    if (SCOPES.length > 1) {
      const sw = el('div', 'scope-switch mb-2');
      sw.setAttribute('role', 'group');
      I.set(sw, 'list.scopeAria', null, 'aria-label');
      SCOPES.forEach((sc) => {
        const b = el('button', 'scope-option');
        b.type = 'button';
        b.dataset.scope = sc.key;
        const label = el('span');
        I.set(label, sc.label);
        I.set(b, sc.title, null, 'title');
        b.append(label, el('span', 'scope-count', String(DATA.filter(sc.test).length)));
        b.addEventListener('click', () => {
          scope = sc;
          writeJSON(FILTER_KEY, Object.assign(readJSON(FILTER_KEY), { [SET + 'Scope']: sc.key }));
          updateSummary();
          applyFilter();
        });
        sw.append(b);
      });
      box.append(sw);
    }
    if (HAS_STAGES) {
      const sw = el('div', 'scope-switch mb-2');
      sw.setAttribute('role', 'group');
      I.set(sw, 'list.orderAria', null, 'aria-label');
      [
        { value: false, label: 'list.orderGroup', title: 'list.orderGroupTitle' },
        { value: true, label: 'list.orderLearn', title: 'list.orderLearnTitle' },
      ].forEach((o) => {
        const b = el('button', 'scope-option');
        b.type = 'button';
        b.dataset.order = String(o.value);
        I.set(b, o.label);
        I.set(b, o.title, null, 'title');
        b.addEventListener('click', () => {
          if (byStage === o.value) return;
          byStage = o.value;
          writeJSON(FILTER_KEY, Object.assign(readJSON(FILTER_KEY), { [SET + 'Order']: byStage ? 'learn' : 'group' }));
          buildSections();
          loadChosen();
          updateSummary();
          applyFilter();
        });
        sw.append(b);
      });
      box.append(' ', sw);
    }
    const bar = el('div', 'progress-stacked mb-2');
    I.set(bar, 'list.progressAria', null, 'aria-label');
    ['learned', 'learning'].forEach((s) => {
      const seg = el('div', 'progress');
      seg.setAttribute('role', 'progressbar');
      seg.dataset.segment = s;
      seg.append(el('div', `progress-bar bar-${s}`));
      bar.append(seg);
    });
    // バーの色の凡例は、下の絞り込みのボタン（未習得・練習中・習得済み）の色の点で兼ねる
    // （件数もボタンに出ているので、バーの下に同じ数を並べない）
    const chips = el('div', 'filter-chips d-flex flex-wrap gap-1');
    chips.setAttribute('role', 'group');
    I.set(chips, 'list.filterAria', null, 'aria-label');
    // 並びはバーの色と同じ順（左から習得済み・練習中・未習得）
    ['all', 'learned', 'learning', 'new'].forEach((f) => {
      const b = el('button', 'btn btn-sm btn-outline-secondary');
      b.type = 'button';
      b.dataset.filter = f;
      const label = el('span');
      I.set(label, f === 'all' ? 'list.filterAll' : 'status.' + f);
      if (f !== 'all') b.append(el('span', `legend-dot ${f}`));
      b.append(label, el('span', 'chip-count'));
      b.addEventListener('click', () => {
        filter = f;
        writeJSON(FILTER_KEY, Object.assign(readJSON(FILTER_KEY), { [SET]: f }));
        applyFilter();
      });
      chips.append(b);
    });
    // 絞り込みチップの右に「すべて未習得に戻す」。押すと確認を出し、戻したあとは「元に戻す」を出す
    const row = el('div', 'd-flex flex-wrap align-items-center gap-2');
    const reset = el('button', 'btn btn-link btn-sm p-0 ms-auto reset-progress');
    reset.type = 'button';
    reset.id = 'resetProgress';
    I.set(reset, 'list.resetAll');
    I.set(reset, 'list.resetAllTitle', { set: SET.toUpperCase() }, 'title');
    reset.addEventListener('click', () => {
      resetState = { confirming: true };
      renderReset();
    });
    row.append(chips, reset);
    const resetBar = el('div', 'reset-bar');
    resetBar.id = 'resetBar';
    resetBar.setAttribute('role', 'status');
    box.append(bar, row, resetBar);
  }

  // ---- すべて未習得に戻す ----
  // 範囲（No Dot / Dot）・グループの選択に関係なく、この種類（PLL / OLL）のケースすべての習得状況を消す。
  // 間違って押しても困らないよう、押したらまず確認を出し、戻したあとも「元に戻す」で戻せるようにする（ブラウザの確認ダイアログは使わない）
  let resetState = null; // null / { confirming: true } / { done: n, undo: 関数 } / { restored: n }

  function resetAll() {
    // まとめて1回で保存する（ケースごとに保存すると、ログイン中はそのたびにクラウドへ送るので）
    const writeSet = (mine) => {
      const all = window.Store.get('progress');
      window.Store.set('progress', Object.assign({}, all && typeof all === 'object' ? all : {}, { [SET]: mine }));
      progress = P.statuses(SET);
    };
    const before = Object.assign({}, P.statuses(SET));
    const n = Object.keys(before).length;
    writeSet({});
    const undo = () => {
      // 戻したあとに付けた習得状況は残し、消したものだけを戻す
      writeSet(Object.assign({}, before, P.statuses(SET)));
      resetState = { restored: n };
      refreshStatuses();
    };
    resetState = { done: n, undo: undo };
    refreshStatuses();
  }

  // 全カードのバッジ・件数・絞り込みを今の習得状況に合わせる
  function refreshStatuses() {
    document.querySelectorAll('#caseList .status-badge').forEach((b) => b.dispatchEvent(new Event('relabel')));
    updateSummary();
    applyFilter();
    renderReset();
  }

  function renderReset() {
    const bar = $('resetBar');
    const button = $('resetProgress');
    const n = counts(DATA);
    const marked = n.learned + n.learning;
    button.disabled = !marked;
    bar.replaceChildren();
    bar.hidden = !resetState;
    if (!resetState) return;
    if (resetState.confirming) {
      if (!marked) {
        resetState = null;
        bar.hidden = true;
        return;
      }
      const text = el('span', 'reset-confirm');
      I.set(text, 'list.resetConfirm', { set: SET.toUpperCase(), learned: n.learned, learning: n.learning });
      const yes = el('button', 'btn btn-danger btn-sm');
      yes.type = 'button';
      I.set(yes, 'list.resetYes');
      yes.addEventListener('click', resetAll);
      const no = el('button', 'btn btn-outline-secondary btn-sm');
      no.type = 'button';
      I.set(no, 'stats.cancel');
      no.addEventListener('click', () => {
        resetState = null;
        renderReset();
      });
      bar.append(text, yes, no);
      no.focus();
      return;
    }
    const msg = el('span', 'text-muted');
    if (resetState.undo) {
      I.set(msg, 'list.resetDone', { n: resetState.done });
      const undo = el('button', 'btn btn-link btn-sm p-0');
      undo.type = 'button';
      I.set(undo, 'stats.undo');
      undo.addEventListener('click', resetState.undo);
      bar.append(msg, undo);
    } else {
      I.set(msg, 'list.resetRestored', { n: resetState.restored });
      bar.append(msg);
    }
  }

  // 件数・バー・グループの「覚えた数 / 全体」を今の状態に合わせる（絞り込みはやり直さない。
  // 絞り込み中に状態を変えたカードがすぐ消えると落ち着かないので、チップを押したときに反映する）
  function updateSummary() {
    updatePracticeLink();
    const n = counts(scoped());
    ['learned', 'learning'].forEach((s) => {
      const seg = document.querySelector(`#progressBox [data-segment="${s}"]`);
      const pct = n.all ? (n[s] / n.all) * 100 : 0;
      seg.style.width = pct + '%';
      seg.setAttribute('aria-valuenow', String(n[s]));
      seg.setAttribute('aria-valuemin', '0');
      seg.setAttribute('aria-valuemax', String(n.all));
      seg.setAttribute('aria-label', `${statusLabel(s)}: ${n[s]}`);
    });
    document.querySelectorAll('#progressBox [data-filter]').forEach((b) => {
      b.querySelector('.chip-count').textContent = n[b.dataset.filter];
    });
    sections.forEach((s) => {
      const list = s.cases;
      const learned = list.filter((c) => statusOf(c) === 'learned').length;
      const label = document.querySelector(`#group-${CSS.escape(s.key)} .group-count`);
      label.textContent = `${learned}/${list.length}`;
      label.classList.toggle('complete', learned === list.length);
      document.querySelector(`#groupNav [data-group="${CSS.escape(s.key)}"]`).classList.toggle('group-nav-complete', learned === list.length);
    });
  }

  // 今の範囲・絞り込みのまま練習ページを開くボタン（習得状況を変えたときも直す。updateSummary からも呼ぶ）。
  // 対象は絞り込みのチップを引き継ぐ。ただしチップが「すべて」でグループも選んでいないときは、未習得にする
  // （とりあえず押したときに、習得済みまで混ぜた全ケースより、まだ覚えていないケースを練習するように。
  // 練習ページを直接開いたときの既定とも同じ）。範囲に未習得が 1 つも無ければ「すべて」のまま
  function updatePracticeLink() {
    const practice = $('practiceLink');
    if (!practice) return;
    const picked = sections.filter((s) => chosen.has(s.key));
    const target = filter === 'all' && !picked.length && scoped().some((c) => statusOf(c) === 'new') ? 'new' : filter;
    const q = new URLSearchParams({ set: SET, filter: target });
    if (SET === 'oll') q.set('scope', scope.key);
    // 選んだグループ（覚える順なら段階の番号）も渡す。空ならすべて
    if (HAS_STAGES) q.set('order', byStage ? 'learn' : 'group');
    q.set('groups', picked.map((s) => (byStage ? s.stage : s.key)).join(','));
    practice.href = 'practice?' + q.toString();
  }

  // 選んだ範囲・状態のカードだけを表示し、1枚も無いグループは見出しごと隠す
  function applyFilter() {
    document.querySelectorAll('#progressBox [data-scope]').forEach((b) => {
      const on = b.dataset.scope === scope.key;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', String(on));
    });
    document.querySelectorAll('#progressBox [data-order]').forEach((b) => {
      const on = b.dataset.order === String(byStage);
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', String(on));
    });
    document.querySelectorAll('#groupNav [data-group]').forEach((b) => {
      const on = chosen.has(b.dataset.group);
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', String(on));
    });
    $('groupClear').disabled = !chosen.size;
    // 見出しの横の数は全ケースの数で固定（範囲ごとの数は No Dot / Dot / All のボタンに出ているので繰り返さない）
    I.set($('caseCount'), 'list.count', { n: DATA.length });
    updatePracticeLink();
    const zip = $('downloadZip');
    if (!zip.disabled) {
      I.set(zip, 'list.download');
    }
    if (zipConfirming) renderZipConfirm(); // 範囲（OLL の No Dot / Dot）を変えたら件数を直す
    zip.title = I.t('list.downloadTitle', { n: scoped().length }); // ZIP は選んでいる範囲だけなので、範囲の数
    document.querySelectorAll('#progressBox [data-filter]').forEach((b) => {
      const on = b.dataset.filter === filter;
      b.classList.toggle('btn-secondary', on);
      b.classList.toggle('btn-outline-secondary', !on);
      b.setAttribute('aria-pressed', String(on));
    });
    document.querySelectorAll('#caseList section').forEach((section) => {
      let visible = 0;
      section.querySelectorAll('.col[data-name]').forEach((col) => {
        col.dataset.inScope = String(inScope(BY_NAME[col.dataset.name]));
        const show = col.dataset.inScope === 'true' && (filter === 'all' || col.dataset.status === filter);
        col.hidden = !show;
        if (show) visible++;
      });
      const g = section.dataset.group;
      section.hidden = visible === 0 || (chosen.size > 0 && !chosen.has(g));
      // ボタンは選んでいれば（外せるように）カードが無くても出す
      document.querySelector(`#groupNav [data-group="${CSS.escape(g)}"]`).hidden = visible === 0 && !chosen.has(g);
    });
    $('emptyMessage').hidden = !!document.querySelector('#caseList section:not([hidden])');
  }

  const BY_NAME = {};
  DATA.forEach((c) => {
    BY_NAME[c.name] = c;
  });
  // カードは1回だけ作り、並びを変えたら見出しの下に入れ直す（画像を描き直さない）
  const CARDS = {};

  // 見出し（グループ：「A (3 corner CP)」、段階：「2. A1–2」）
  const sectionTitle = (s) => (s.stage ? `${s.stage}. ${s.label}` : groupLabel(s.key));

  // 今の並びで、ジャンプのボタンと見出しごとのカードを作り直す
  function buildSections() {
    sections = CS.list(DATA, byStage);
    const nav = $('groupNav');
    nav.replaceChildren();
    // 2 文字の名前（OLL の 10〜53・1C、段階の F1 など）があるか。スマホではそれに合わせてそろえる幅を決める（css/cases.css）
    nav.classList.toggle('two-char', sections.some((s) => s.label.length === 2));
    sections.forEach((s) => {
      const b = el('button', 'btn btn-outline-secondary btn-sm group-nav-btn', s.label);
      b.type = 'button';
      b.dataset.group = s.key;
      b.title = sectionTitle(s);
      b.addEventListener('click', () => {
        const next = new Set(chosen);
        if (next.has(s.key)) next.delete(s.key);
        else next.add(s.key);
        setChosen(next);
      });
      nav.append(b);
    });

    const list = $('caseList');
    list.querySelectorAll('section').forEach((section) => section.remove());
    const empty = $('emptyMessage');
    sections.forEach((s) => {
      const section = el('section', 'mb-4');
      section.id = 'group-' + s.key;
      section.dataset.group = s.key;
      const heading = el('h2', 'h5 border-bottom pb-1 d-flex justify-content-between align-items-baseline', sectionTitle(s));
      heading.append(el('span', 'group-count'));
      section.append(heading);
      const row = el('div', 'row row-cols-3 row-cols-md-4 row-cols-lg-6 g-2'); // スマホでも 1 行 3 枚
      s.cases.forEach((c) => row.append(CARDS[c.name]));
      section.append(row);
      list.insertBefore(section, empty);
    });
  }

  function render() {
    const settings = savedSettings();
    DATA.forEach((c) => {
      CARDS[c.name] = caseCard(c, settings);
    });
    // グループのボタンの下：「選択を解除」
    const foot = el('div', 'group-nav-foot d-flex align-items-center gap-2 mb-3');
    const clear = el('button', 'btn btn-link btn-sm p-0');
    clear.type = 'button';
    clear.id = 'groupClear';
    I.set(clear, 'practice.groupsClear');
    clear.addEventListener('click', () => setChosen(new Set()));
    foot.append(clear);
    $('groupNav').after(foot);

    const list = $('caseList');
    const empty = el('p', 'text-muted text-center py-5');
    I.set(empty, 'list.empty');
    empty.id = 'emptyMessage';
    empty.hidden = true;
    list.append(empty);

    const savedFilter = readJSON(FILTER_KEY);
    scope = SCOPES.find((sc) => sc.key === savedFilter[SET + 'Scope']) || SCOPES[0];
    filter = ['all'].concat(STATUSES).includes(savedFilter[SET]) ? savedFilter[SET] : 'all';
    byStage = HAS_STAGES && savedFilter[SET + 'Order'] === 'learn';
    buildSections();
    loadChosen();
    buildSummary();
    updateSummary();
    applyFilter();
    renderReset();
  }

  // 全ケースを PNG にして zip にまとめ、ダウンロードする。ファイル名は <pll|oll>-<名前>.png
  async function downloadAll(button) {
    button.disabled = true;
    try {
      const settings = savedSettings(); // ダウンロードの時点の設定を読み直す
      const list = scoped(); // 選んでいる範囲（OLL の No Dot / Dot / All）
      const files = [];
      for (let i = 0; i < list.length; i++) {
        const c = list[i];
        button.textContent = I.t('list.creating', { i: i + 1, n: list.length });
        const canvas = document.createElement('canvas');
        canvas.width = settings.size;
        canvas.height = settings.size;
        const colors = caseColors(c, settings);
        D.draw(canvas, colors.ucolor, colors.scolor, { border: settings.border, background: settings.background });
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
        files.push({ name: `${SET}-${c.name}.png`, data: new Uint8Array(await blob.arrayBuffer()) });
      }
      const zip = new Blob([window.ZipStore.create(files)], { type: 'application/zip' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(zip);
      link.download = scope.key === 'all' ? `megaminx-${SET}.zip` : `megaminx-${SET}-${scope.key}.zip`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 10000);
    } finally {
      button.disabled = false;
      applyFilter(); // ボタンの文を（今の言語・範囲で）戻す
    }
  }

  render();
  // 言語を切り替えたら、その場で作る文（件数・バッジの説明など）を作り直す
  I.onChange(() => {
    document.querySelectorAll('.status-badge').forEach((b) => b.dispatchEvent(new CustomEvent('relabel')));
    updateSummary();
    applyFilter();
  });
  // ZIP でダウンロード：押したら確認の行を出す（もう一度押すと閉じる）
  function renderZipConfirm() {
    const box = $('zipConfirm');
    const button = $('downloadZip');
    box.replaceChildren();
    box.hidden = !zipConfirming;
    button.setAttribute('aria-expanded', String(zipConfirming));
    if (!zipConfirming) return;
    const settings = savedSettings(); // 今の設定（ダウンロードのときにも読み直す）
    const text = el('span', 'zip-confirm-text');
    I.set(text, settings.background ? 'list.downloadConfirmBg' : 'list.downloadConfirm', {
      set: SET.toUpperCase(),
      n: scoped().length,
      size: settings.size,
      bg: settings.background || '',
    });
    const yes = el('button', 'btn btn-primary btn-sm');
    yes.type = 'button';
    I.set(yes, 'list.downloadYes');
    yes.addEventListener('click', () => {
      zipConfirming = false;
      renderZipConfirm();
      downloadAll(button);
    });
    const no = el('button', 'btn btn-outline-secondary btn-sm');
    no.type = 'button';
    I.set(no, 'stats.cancel');
    no.addEventListener('click', () => {
      zipConfirming = false;
      renderZipConfirm();
      button.focus();
    });
    const note = el('span', 'zip-confirm-note');
    I.set(note, 'list.downloadNote');
    box.append(text, yes, no, note);
    yes.focus();
  }
  $('downloadZip').addEventListener('click', () => {
    zipConfirming = !zipConfirming;
    renderZipConfirm();
  });
})();
