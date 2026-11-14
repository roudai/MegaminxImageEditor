// 一覧ページ（pll.html / oll.html）：全ケースの画像と手順をグループごとに並べる。
// <body data-set="pll|oll"> の種類のデータ（pll-data.js / oll-data.js）とグループ名（case-groups.js）を使い、
// 画像は megaminx-draw.js で描く。仕様: reference/PLL_SPEC.md・reference/OLL_SPEC.md「一覧ページ」
//   - 画像は solve case（alg の逆手順を適用し、持ち替え y の合計を打ち消す）の状態
//   - Body Color はエディタで保存した設定（localStorage）を使う。配色は
//       PLL: 保存した配色。OLL 配色のときは OLL を選ぶ前の配色、それも無いときは Standard
//       OLL: 保存した U の色だけを残した OLL 配色（他の面は dimgray）
//   - ケースをクリックすると、そのケースを選んだ状態でエディタ（index.html?pll=… / ?oll=…）を開く
//   - 覚えた度：各カード右上のバッジをタップで 未着手 → 練習中 → 覚えた と切り替え、localStorage に保存する。
//     上部に進み具合（積み上げバー・件数）と絞り込みチップ、グループ見出しに「覚えた数 / 全体」を出す
//   - Download all (.zip)：全ケースを一覧と同じ配色で PNG にし、zip（megaminx-<pll|oll>.zip）にまとめる。
//     画像サイズ・Body Color・背景はエディタで保存した設定（zip-store.js で無圧縮の zip を作る）
(function () {
  'use strict';
  const M = window.MegaminxState;
  const D = window.MegaminxDraw;
  const $ = (id) => document.getElementById(id);

  const SET = document.body.dataset.set;
  const DATA = { pll: window.PLL_DATA, oll: window.OLL_DATA }[SET] || [];
  const NOTES = (window.CASE_GROUP_NOTES || {})[SET] || {};
  const IMAGE_SIZE = 120; // 表示サイズ（px）。高解像度の画面では devicePixelRatio 倍で描く

  // エディタ（alg-input.js）が保存した設定のうち、配色と Body Color を読む
  const SETTINGS_KEY = 'megaminx-image-editor:settings';
  const HEX = /^#[0-9a-f]{6}$/i;
  function savedSettings() {
    let settings = null;
    try {
      settings = JSON.parse(localStorage.getItem(SETTINGS_KEY));
    } catch (e) {
      // 読めなければ初期値
    }
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
    if (SET === 'oll') {
      // U の色は OLL 配色のときも保存されている
      const u = settings && settings.faceColors && settings.faceColors.U;
      return Object.assign(common, { scheme: M.ollMask({ U: HEX.test(u) ? u : M.DEFAULT_SCHEME.U }, 'd') });
    }
    return Object.assign(common, { scheme: scheme });
  }

  const groupLabel = (g) => (NOTES[g] ? `${g} (${NOTES[g]})` : g);
  const el = (tag, className, text) => {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text != null) e.textContent = text;
    return e;
  };

  // solve case（alg の逆手順を適用、持ち替え y は打ち消す）の状態の画像の色
  function caseColors(c, settings) {
    const state = M.applyAlg(c.alg, { inverse: true, cancelRotation: true });
    return M.toImageColors(state, settings.scheme);
  }

  // ---- 覚えた度（localStorage）----
  // { pll: { 'A1+': 'learning', ... }, oll: { ... } }。未着手（new）は保存しない
  const PROGRESS_KEY = 'megaminx-image-editor:progress';
  const FILTER_KEY = 'megaminx-image-editor:list-filter';
  const STATUSES = ['new', 'learning', 'learned'];
  const STATUS_LABEL = { new: 'New', learning: 'Learning', learned: 'Learned' };

  const readJSON = (key) => {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value && typeof value === 'object' ? value : {};
    } catch (e) {
      return {};
    }
  };
  const writeJSON = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      // 保存できなくても表示は続ける
    }
  };

  const progress = readJSON(PROGRESS_KEY);
  const statusOf = (c) => {
    const s = (progress[SET] || {})[c.name];
    return STATUSES.includes(s) ? s : 'new';
  };
  function setStatus(c, status) {
    const all = readJSON(PROGRESS_KEY); // 別タブの変更を消さないように読み直してから書く
    const mine = all[SET] && typeof all[SET] === 'object' ? all[SET] : {};
    if (status === 'new') delete mine[c.name];
    else mine[c.name] = status;
    all[SET] = mine;
    progress[SET] = mine;
    writeJSON(PROGRESS_KEY, all);
  }

  const ICONS =
    '<svg class="icon-learning" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.5a5.5 5.5 0 0 1 0 11z" fill="currentColor"/>' +
    '<circle cx="8" cy="8" r="4.9" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>' +
    '<svg class="icon-learned" viewBox="0 0 16 16" aria-hidden="true" style="position:absolute">' +
    '<path d="M3.5 8.5l3 3 6-6.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function caseCard(c, settings) {
    const col = el('div', 'col');
    col.dataset.name = c.name;
    const card = el('div', 'card h-100 case-card');
    const link = el('a', 'case-link d-block h-100');
    link.href = `index.html?${SET}=${encodeURIComponent(c.name)}`;
    link.title = `Open ${c.name} in the editor`;

    const canvas = el('canvas', 'mx-auto mt-2 d-block');
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(IMAGE_SIZE * ratio);
    canvas.height = canvas.width;
    canvas.style.width = IMAGE_SIZE + 'px';
    canvas.style.height = IMAGE_SIZE + 'px';
    const colors = caseColors(c, settings);
    D.draw(canvas, colors.ucolor, colors.scolor, { border: settings.border });

    const body = el('div', 'card-body p-2 text-center');
    body.append(el('div', 'fw-bold', c.name), el('div', 'small font-monospace text-break', c.alg));
    link.append(canvas, body);

    const badge = el('button', 'status-badge');
    badge.type = 'button';
    badge.innerHTML = ICONS;
    const show = (status) => {
      card.dataset.status = status;
      badge.dataset.status = status;
      col.dataset.status = status;
      badge.title = `${STATUS_LABEL[status]} (click to change)`;
      badge.setAttribute('aria-label', `${c.name}: ${STATUS_LABEL[status]}. Click to change`);
    };
    show(statusOf(c));
    badge.addEventListener('click', () => {
      const next = STATUSES[(STATUSES.indexOf(statusOf(c)) + 1) % STATUSES.length];
      setStatus(c, next);
      show(next);
      badge.classList.remove('pop');
      void badge.offsetWidth; // アニメーションをやり直す
      badge.classList.add('pop');
      updateSummary();
    });

    card.append(link, badge);
    col.append(card);
    return col;
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
    const bar = el('div', 'progress-stacked mb-1');
    bar.setAttribute('aria-label', 'Learning progress');
    ['learned', 'learning'].forEach((s) => {
      const seg = el('div', 'progress');
      seg.setAttribute('role', 'progressbar');
      seg.dataset.segment = s;
      seg.append(el('div', `progress-bar bar-${s}`));
      bar.append(seg);
    });
    const legend = el('div', 'small text-muted mb-2');
    legend.id = 'progressLegend';
    const chips = el('div', 'filter-chips d-flex flex-wrap gap-1');
    chips.setAttribute('role', 'group');
    chips.setAttribute('aria-label', 'Filter by status');
    ['all'].concat(STATUSES).forEach((f) => {
      const b = el('button', 'btn btn-sm btn-outline-secondary');
      b.type = 'button';
      b.dataset.filter = f;
      b.append(document.createTextNode(f === 'all' ? 'All' : STATUS_LABEL[f]), el('span', 'chip-count'));
      b.addEventListener('click', () => {
        filter = f;
        writeJSON(FILTER_KEY, Object.assign(readJSON(FILTER_KEY), { [SET]: f }));
        applyFilter();
      });
      chips.append(b);
    });
    box.append(bar, legend, chips);
  }

  // 件数・バー・グループの「覚えた数 / 全体」を今の状態に合わせる（絞り込みはやり直さない。
  // 絞り込み中に状態を変えたカードがすぐ消えると落ち着かないので、チップを押したときに反映する）
  function updateSummary() {
    const n = counts(DATA);
    ['learned', 'learning'].forEach((s) => {
      const seg = document.querySelector(`#progressBox [data-segment="${s}"]`);
      const pct = n.all ? (n[s] / n.all) * 100 : 0;
      seg.style.width = pct + '%';
      seg.setAttribute('aria-valuenow', String(n[s]));
      seg.setAttribute('aria-valuemin', '0');
      seg.setAttribute('aria-valuemax', String(n.all));
      seg.setAttribute('aria-label', `${STATUS_LABEL[s]}: ${n[s]}`);
    });
    const legend = $('progressLegend');
    legend.innerHTML = '';
    STATUSES.slice().reverse().forEach((s, i) => {
      if (i) legend.append(document.createTextNode('  ·  '));
      legend.append(el('span', `legend-dot ${s}`), document.createTextNode(`${n[s]} ${s}`));
    });
    document.querySelectorAll('#progressBox [data-filter]').forEach((b) => {
      b.querySelector('.chip-count').textContent = n[b.dataset.filter];
    });
    groups().forEach((g) => {
      const list = DATA.filter((c) => c.group === g);
      const learned = list.filter((c) => statusOf(c) === 'learned').length;
      const label = document.querySelector(`#group-${CSS.escape(g)} .group-count`);
      label.textContent = `${learned}/${list.length}`;
      label.classList.toggle('complete', learned === list.length);
      document.querySelector(`#groupNav [data-group="${CSS.escape(g)}"]`).classList.toggle('group-nav-complete', learned === list.length);
    });
  }

  // 選んだ状態のカードだけを表示し、1枚も無いグループは見出しごと隠す
  function applyFilter() {
    document.querySelectorAll('#progressBox [data-filter]').forEach((b) => {
      const on = b.dataset.filter === filter;
      b.classList.toggle('btn-secondary', on);
      b.classList.toggle('btn-outline-secondary', !on);
      b.setAttribute('aria-pressed', String(on));
    });
    document.querySelectorAll('#caseList section').forEach((section) => {
      let visible = 0;
      section.querySelectorAll('.col[data-name]').forEach((col) => {
        const show = filter === 'all' || col.dataset.status === filter;
        col.hidden = !show;
        if (show) visible++;
      });
      section.hidden = visible === 0;
      const g = section.dataset.group;
      document.querySelector(`#groupNav [data-group="${CSS.escape(g)}"]`).hidden = visible === 0;
    });
    $('emptyMessage').hidden = !!document.querySelector('#caseList section:not([hidden])');
  }

  const groups = () => DATA.map((c) => c.group).filter((g, i, all) => all.indexOf(g) === i);

  function render() {
    const settings = savedSettings();

    // グループへのジャンプ
    const nav = $('groupNav');
    groups().forEach((g) => {
      const a = el('a', 'btn btn-outline-secondary btn-sm me-1 mb-1', g);
      a.dataset.group = g;
      a.href = '#group-' + g;
      a.title = groupLabel(g);
      nav.append(a);
    });

    const list = $('caseList');
    groups().forEach((g) => {
      const section = el('section', 'mb-4');
      section.id = 'group-' + g;
      section.dataset.group = g;
      const heading = el('h2', 'h5 border-bottom pb-1 d-flex justify-content-between align-items-baseline', groupLabel(g));
      heading.append(el('span', 'group-count'));
      section.append(heading);
      const row = el('div', 'row row-cols-2 row-cols-sm-3 row-cols-md-4 row-cols-lg-6 g-2');
      DATA.filter((c) => c.group === g).forEach((c) => row.append(caseCard(c, settings)));
      section.append(row);
      list.append(section);
    });
    const empty = el('p', 'text-muted text-center py-5', 'No cases with this status.');
    empty.id = 'emptyMessage';
    empty.hidden = true;
    list.append(empty);
    $('caseCount').textContent = `${DATA.length} cases`;

    buildSummary();
    updateSummary();
    const saved = readJSON(FILTER_KEY)[SET];
    filter = ['all'].concat(STATUSES).includes(saved) ? saved : 'all';
    applyFilter();
  }

  // 全ケースを PNG にして zip にまとめ、ダウンロードする。ファイル名は <pll|oll>-<名前>.png
  async function downloadAll(button) {
    const label = button.textContent;
    button.disabled = true;
    try {
      const settings = savedSettings(); // ダウンロードの時点の設定を読み直す
      const files = [];
      for (let i = 0; i < DATA.length; i++) {
        const c = DATA[i];
        button.textContent = `Creating... ${i + 1}/${DATA.length}`;
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
      link.download = `megaminx-${SET}.zip`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 10000);
    } finally {
      button.textContent = label;
      button.disabled = false;
    }
  }

  render();
  $('downloadZip').addEventListener('click', (e) => downloadAll(e.currentTarget));
})();
