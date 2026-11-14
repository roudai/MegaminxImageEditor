// 一覧ページ（pll.html / oll.html）：全ケースの画像と手順をグループごとに並べる。
// <body data-set="pll|oll"> の種類のデータ（pll-data.js / oll-data.js）とグループ名（case-groups.js）を使い、
// 画像は megaminx-draw.js で描く。仕様: reference/PLL_SPEC.md・reference/OLL_SPEC.md「一覧ページ」
//   - 画像は solve case（alg の逆手順を適用し、持ち替え y の合計を打ち消す）の状態
//   - Body Color はエディタで保存した設定（localStorage）を使う。配色は
//       PLL: 保存した配色。OLL 配色のときは OLL を選ぶ前の配色、それも無いときは Standard
//       OLL: 保存した U の色だけを残した OLL 配色（他の面は dimgray）
//   - ケースをクリックすると、そのケースを選んだ状態でエディタ（index.html?pll=… / ?oll=…）を開く
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

  function caseCard(c, settings) {
    const col = el('div', 'col');
    const link = el('a', 'card h-100 text-decoration-none text-body case-card');
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
    col.append(link);
    return col;
  }

  function render() {
    const settings = savedSettings();
    const groups = DATA.map((c) => c.group).filter((g, i, all) => all.indexOf(g) === i);

    // グループへのジャンプ
    const nav = $('groupNav');
    groups.forEach((g) => {
      const a = el('a', 'btn btn-outline-secondary btn-sm me-1 mb-1', g);
      a.href = '#group-' + g;
      a.title = groupLabel(g);
      nav.append(a);
    });

    const list = $('caseList');
    groups.forEach((g) => {
      const section = el('section', 'mb-4');
      section.id = 'group-' + g;
      section.append(el('h2', 'h5 border-bottom pb-1', groupLabel(g)));
      const row = el('div', 'row row-cols-2 row-cols-sm-3 row-cols-md-4 row-cols-lg-6 g-2');
      DATA.filter((c) => c.group === g).forEach((c) => row.append(caseCard(c, settings)));
      section.append(row);
      list.append(section);
    });
    $('caseCount').textContent = `${DATA.length} cases`;
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
