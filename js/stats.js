// 記録のページ（stats.html）：練習の記録（store.js の practice.log）を、期間の集計・日ごとのグラフ・ケースごとの表で見る。
// 仕様: reference/PRACTICE_SPEC.md「記録」
//   - 種類（PLL / OLL）・範囲（OLL の No Dot / Dot / All）・期間（7日 / 30日 / すべて）で絞る（選んだものは practice.stats に保存）
//   - 集計（回数・平均・解けなかった・習得済みの数）、日ごとの回数（棒）と平均タイム（線）の SVG、
//     ケースごとの表（既定は平均の遅い順。見出しで並べ替え。ケースを押すとそのケースを練習ページで出題）
//   - 期間内の記録を CSV で書き出す
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
  const SCOPES = { nd: (c) => c.algset === 'ND', d: (c) => c.algset === 'D', all: () => true };
  const PERIODS = { 7: 7, 30: 30, all: null };
  const DAY = 24 * 60 * 60 * 1000;

  const practice = () => {
    const p = S.get('practice');
    return p && typeof p === 'object' ? p : {};
  };
  const saved = practice().stats || {};
  const view = {
    set: ['pll', 'oll'].includes(saved.set) ? saved.set : practice().set === 'oll' ? 'oll' : 'pll',
    scope: SCOPES[saved.scope] ? saved.scope : 'nd',
    period: Object.prototype.hasOwnProperty.call(PERIODS, saved.period) ? saved.period : '30',
    sort: saved.sort || 'avg',
    desc: saved.desc !== false,
  };
  function saveView() {
    S.set('practice', Object.assign({}, practice(), { stats: Object.assign({}, view) }));
  }

  const fmt = (sec) => (typeof sec === 'number' ? sec.toFixed(2) : '–');
  const from = () => (PERIODS[view.period] ? Date.now() - PERIODS[view.period] * DAY : 0);
  const casesInScope = () => DATA[view.set].filter(view.set === 'oll' ? SCOPES[view.scope] : SCOPES.all);
  // 範囲に入るケースの記録だけを使う
  function logInScope() {
    const names = new Set(casesInScope().map((c) => c.name));
    return (practice().log || []).filter((e) => e && e.set === view.set && names.has(e.name));
  }

  // ---- 種類・範囲・期間 ----
  function segment(items, current, onPick) {
    const box = el('div', 'stats-segment');
    box.setAttribute('role', 'group');
    items.forEach((item) => {
      const b = el('button');
      b.type = 'button';
      if (item.key) I.set(b, item.key, item.params);
      else b.textContent = item.text;
      b.classList.toggle('active', item.value === current);
      b.setAttribute('aria-pressed', String(item.value === current));
      b.addEventListener('click', () => onPick(item.value));
      box.append(b);
    });
    return box;
  }

  function renderControls() {
    const box = $('statsControls');
    box.replaceChildren(
      segment(
        [
          { value: 'pll', text: 'PLL' },
          { value: 'oll', text: 'OLL' },
        ],
        view.set,
        (v) => change({ set: v })
      )
    );
    if (view.set === 'oll') {
      box.append(
        segment(
          [
            { value: 'nd', key: 'list.scopeNd' },
            { value: 'd', key: 'list.scopeD' },
            { value: 'all', key: 'list.scopeAll' },
          ],
          view.scope,
          (v) => change({ scope: v })
        )
      );
    }
    box.append(
      segment(
        [
          { value: '7', key: 'stats.days', params: { n: 7 } },
          { value: '30', key: 'stats.days', params: { n: 30 } },
          { value: 'all', key: 'stats.allTime' },
        ],
        view.period,
        (v) => change({ period: v })
      )
    );
  }

  function change(next) {
    Object.assign(view, next);
    saveView();
    render();
  }

  // ---- 集計のカード ----
  function renderCards(log) {
    const sum = P.summarize(log, { from: from() });
    const cases = casesInScope();
    const learned = cases.filter((c) => P.statusOf(view.set, c.name) === 'learned').length;
    const card = (labelKey, value, sub) => {
      const c = el('div', 'stats-card');
      const label = el('div', 'stats-card-label');
      I.set(label, labelKey);
      c.append(label, el('div', 'stats-card-value', value));
      if (sub) c.append(el('div', 'stats-card-sub', sub));
      return c;
    };
    $('statsCards').replaceChildren(
      card('stats.count', String(sum.count)),
      card('stats.average', sum.avg == null ? '–' : fmt(sum.avg), sum.best == null ? '' : I.t('stats.best', { t: fmt(sum.best) })),
      card('stats.dnf', String(sum.dnf)),
      card('stats.learned', `${learned} / ${cases.length}`)
    );
  }

  // ---- 日ごとのグラフ（棒＝回数、線＝平均タイム） ----
  const SVG = 'http://www.w3.org/2000/svg';
  const svgEl = (tag, attrs) => {
    const e = document.createElementNS(SVG, tag);
    Object.keys(attrs || {}).forEach((k) => e.setAttribute(k, attrs[k]));
    return e;
  };

  function renderChart(log) {
    const days = PERIODS[view.period] || 90;
    const data = P.daily(log, { days: days });
    const box = $('statsChart');
    box.replaceChildren();
    const W = 720;
    const H = 180;
    const pad = { l: 34, r: 40, t: 12, b: 24 };
    const iw = W - pad.l - pad.r;
    const ih = H - pad.t - pad.b;
    const maxCount = Math.max(1, ...data.map((d) => d.count));
    const avgs = data.map((d) => d.avg).filter((a) => a != null);
    const maxAvg = avgs.length ? Math.max(...avgs) * 1.1 : 10;
    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'stats-svg', role: 'img' });
    svg.setAttribute('aria-label', I.t('stats.daily'));
    const step = iw / data.length;
    // 目盛り（回数）
    [0, 0.5, 1].forEach((f) => {
      const y = pad.t + ih * (1 - f);
      svg.append(svgEl('line', { x1: pad.l, x2: W - pad.r, y1: y, y2: y, class: 'stats-grid' }));
      // 回数の目盛りは整数のときだけ出す（最大 3 の真ん中 1.5 などは出さない）
      if (Number.isInteger(maxCount * f)) {
        const t = svgEl('text', { x: pad.l - 6, y: y + 4, class: 'stats-axis', 'text-anchor': 'end' });
        t.textContent = String(maxCount * f);
        svg.append(t);
      }
      const t2 = svgEl('text', { x: W - pad.r + 6, y: y + 4, class: 'stats-axis stats-axis-avg' });
      t2.textContent = (maxAvg * f).toFixed(f ? 1 : 0) + 's';
      svg.append(t2);
    });
    // 棒
    data.forEach((d, i) => {
      if (!d.count) return;
      const h = (ih * d.count) / maxCount;
      const bar = svgEl('rect', {
        x: pad.l + i * step + step * 0.15,
        y: pad.t + ih - h,
        width: Math.max(1, step * 0.7),
        height: h,
        rx: Math.min(3, step * 0.2),
        class: 'stats-bar',
      });
      const title = svgEl('title');
      title.textContent = `${d.day}  ${I.t('stats.tooltip', { n: d.count, avg: fmt(d.avg) })}`;
      bar.append(title);
      svg.append(bar);
    });
    // 線（平均タイム。練習した日だけを結ぶ）
    const points = data
      .map((d, i) => (d.avg == null ? null : [pad.l + i * step + step / 2, pad.t + ih - (ih * d.avg) / maxAvg]))
      .filter(Boolean);
    if (points.length > 1) svg.append(svgEl('polyline', { points: points.map((p) => p.join(',')).join(' '), class: 'stats-line' }));
    points.forEach((p) => svg.append(svgEl('circle', { cx: p[0], cy: p[1], r: 2.5, class: 'stats-dot' })));
    // 日付（最初・真ん中・最後）
    [0, Math.floor((data.length - 1) / 2), data.length - 1].forEach((i) => {
      const t = svgEl('text', { x: pad.l + i * step + step / 2, y: H - 6, class: 'stats-axis', 'text-anchor': 'middle' });
      t.textContent = data[i].day.slice(5).replace('-', '/');
      svg.append(t);
    });
    box.append(svg);
    const legend = el('div', 'stats-legend');
    const item = (cls, key) => {
      const s = el('span', 'stats-legend-item');
      const label = el('span');
      I.set(label, key);
      s.append(el('span', 'stats-legend-mark ' + cls), label);
      return s;
    };
    legend.append(item('bar', 'stats.legendCount'), item('line', 'stats.legendAvg'));
    box.append(legend);
  }

  // ---- ケースごとの表 ----
  const COLUMNS = [
    { key: 'image', label: '', sortable: false },
    { key: 'name', label: 'stats.col.case' },
    { key: 'group', label: 'stats.col.group' },
    { key: 'status', label: 'stats.col.status' },
    { key: 'count', label: 'stats.col.count', num: true },
    { key: 'best', label: 'stats.col.best', num: true },
    { key: 'avg', label: 'stats.col.avg', num: true },
    { key: 'last', label: 'stats.col.last', num: true },
  ];
  const STATUS_ORDER = { new: 0, learning: 1, learned: 2 };

  function rows(log) {
    const per = P.perCase(log, { from: from() });
    return casesInScope()
      .filter((c) => per[c.name])
      .map((c) => Object.assign({ c: c, name: c.name, group: c.group, status: P.statusOf(view.set, c.name) }, per[c.name]));
  }

  function sortRows(list) {
    const k = view.sort;
    const dir = view.desc ? -1 : 1;
    const val = (r) => (k === 'status' ? STATUS_ORDER[r.status] : r[k]);
    return list.sort((a, b) => {
      const x = val(a);
      const y = val(b);
      if (x == null && y == null) return 0;
      if (x == null) return 1; // 値の無いもの（解けなかっただけ）は最後
      if (y == null) return -1;
      if (typeof x === 'string') return dir * x.localeCompare(y, undefined, { numeric: true });
      return dir * (x - y);
    });
  }

  function renderTable(log) {
    const head = el('tr');
    COLUMNS.forEach((col) => {
      const th = el('th', col.num ? 'text-end' : '');
      if (col.sortable !== false) {
        const b = el('button', 'stats-sort');
        b.type = 'button';
        const label = el('span');
        I.set(label, col.label);
        b.append(label);
        if (view.sort === col.key) b.append(el('span', 'stats-sort-mark', view.desc ? ' ▼' : ' ▲'));
        b.addEventListener('click', () => change(view.sort === col.key ? { desc: !view.desc } : { sort: col.key, desc: col.num }));
        th.append(b);
      }
      head.append(th);
    });
    $('statsHead').replaceChildren(head);

    const list = sortRows(rows(log));
    $('statsEmpty').hidden = list.length > 0;
    const display = P.displaySettings(view.set);
    const ratio = window.devicePixelRatio || 1;
    $('statsBody').replaceChildren(
      ...list.map((r) => {
        const tr = el('tr');
        const imgTd = el('td', 'stats-img');
        const canvas = el('canvas');
        canvas.width = canvas.height = Math.round(40 * ratio);
        canvas.style.width = canvas.style.height = '40px';
        const colors = P.caseColors(r.c, display.scheme);
        D.draw(canvas, colors.ucolor, colors.scolor, { border: display.border });
        imgTd.append(canvas);
        const nameTd = el('td');
        const link = el('a', 'stats-case');
        const q = new URLSearchParams({ set: view.set, case: r.name, filter: 'all' });
        if (view.set === 'oll') q.set('scope', 'all');
        link.href = 'practice.html?' + q.toString();
        link.textContent = r.name;
        I.set(link, 'stats.practiceThis', { name: r.name }, 'title');
        nameTd.append(link);
        const statusTd = el('td');
        const badge = el('span', 'stats-status ' + r.status);
        I.set(badge, 'status.' + r.status);
        statusTd.append(badge);
        const last = new Date(r.last);
        const cells = [
          el('td', 'text-muted', r.group),
          statusTd,
          el('td', 'text-end', r.dnf ? `${r.count} (${r.dnf} DNF)` : String(r.count)),
          el('td', 'text-end', fmt(r.best)),
          el('td', 'text-end fw-semibold', fmt(r.avg)),
          el('td', 'text-end text-muted', `${last.getMonth() + 1}/${last.getDate()}`),
        ];
        tr.append(imgTd, nameTd, ...cells);
        return tr;
      })
    );
  }

  // ---- CSV の書き出し ----
  function exportCsv() {
    const f = from();
    const names = new Set(casesInScope().map((c) => c.name));
    const list = (practice().log || []).filter((e) => e && e.set === view.set && names.has(e.name) && e.at >= f);
    const quote = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const lines = [['date', 'set', 'case', 'time', 'status', 'hint'].join(',')].concat(
      list.map((e) =>
        [new Date(e.at).toISOString(), e.set, quote(e.name), e.sec == null ? 'DNF' : e.sec.toFixed(2), e.status, e.hint ? 1 : 0].join(',')
      )
    );
    const blob = new Blob(['﻿' + lines.join('\n') + '\n'], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `megaminx-${view.set}-practice.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 10000);
  }

  function render() {
    renderControls();
    const log = logInScope();
    renderCards(log);
    renderChart(log);
    renderTable(log);
  }

  $('statsCsv').addEventListener('click', exportCsv);
  I.onChange(render);
  // ログインしてクラウドの記録が入ったとき（ページの読み直し）以外にも、別タブで練習したら反映する
  window.addEventListener('storage', (e) => {
    if (e.key && e.key.indexOf('megaminx-image-editor:') === 0) render();
  });
  render();
})();
