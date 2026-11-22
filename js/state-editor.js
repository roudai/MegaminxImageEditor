// Defines the puzzle state：各ステッカーの色を指定する入力欄を生成する。
// - 色は hidden input（uface0..10 / sface1..15）に持つ。imageChange()（megaminx.js）がこの値を読む
// - 色は既定14色のカラーパレットから選ぶ
// - 初期値は canvas の ucolor / scolor 属性
// - 見出し・ラベルは i18n.js で日本語・英語を切り替える（ステッカーの def は key と params を持つ）
// megaminx-state.js と megaminx.js（color_convert）の後、alg-input.js の前に読み込む。
(function () {
  'use strict';
  const M = window.MegaminxState;
  const $ = (id) => document.getElementById(id);
  const I = window.I18N;

  // 既定14色（megaminx.js の color_convert が扱う色コード）
  const COLORS = [
    ['d', 'dimgray'], ['u', 'lightgray'], ['p', 'pink'], ['c', 'lemonchiffon'], ['a', 'aqua'],
    ['o', 'orange'], ['l', 'lawngreen'], ['b', 'dodgerblue'], ['y', 'yellow'], ['s', 'darkviolet'],
    ['g', 'seagreen'], ['r', 'red'], ['w', 'white'], ['z', 'black'],
  ].map(([value, name]) => ({ value: value, name: name }));
  const colorName = (value) => (COLORS.find((c) => c.value === value) || { name: value }).name;

  // ---- ステッカーの並び ----
  // 描画側の番号 k：辺k は面 UPPER[(k+3)%5] 側、角k は UPPER[(k+2)%5] と UPPER[(k+3)%5] の間。
  // 表示は F から反時計回り（F, R, BR, BL, L）に並べる。
  const faceOf = (k) => M.UPPER[(k + 3) % 5];
  const ORDER = [2, 3, 4, 0, 1];

  const U_STICKERS = [];
  ORDER.forEach((k) => {
    const next = (k + 1) % 5;
    U_STICKERS.push({ id: 'uface' + (2 + 2 * k), key: 'state.edge', params: { face: faceOf(k) } });
    U_STICKERS.push({ id: 'uface' + (1 + 2 * next), key: 'state.corner', params: { a: faceOf(k), b: faceOf(next) } });
  });

  const SIDE_STICKERS = [];
  ORDER.forEach((k) => {
    ['state.left', 'state.middle', 'state.right'].forEach((key, j) => {
      SIDE_STICKERS.push({ id: 'sface' + (3 * k + j + 1), key: key, params: { face: faceOf(k) } });
    });
  });

  // ---- 入力欄の生成 ----
  const canvas = $('canvas');
  const initialU = canvas.getAttribute('ucolor');
  const initialS = canvas.getAttribute('scolor');
  const initialValue = (id) => (id[0] === 'u' ? initialU : initialS)[parseInt(id.slice(5), 10) - (id[0] === 'u' ? 0 : 1)];

  const items = [];

  function sticker(def) {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.id = def.id;
    input.value = initialValue(def.id);

    const label = document.createElement('label');
    label.className = 'form-label';
    label.htmlFor = def.id + '-swatch';
    I.set(label, def.key, def.params);

    const swatch = document.createElement('button');
    swatch.type = 'button';
    swatch.id = def.id + '-swatch';
    swatch.className = 'sticker-swatch';

    const item = { input: input, swatch: swatch, label: label };
    swatch.addEventListener('click', (e) => {
      e.stopPropagation();
      open(item);
    });
    items.push(item);
    return [label, input, swatch];
  }

  // 1 つの row に並べ、1 行の数は Bootstrap の row-cols で決める（mobile：スマホ（幅 768px 未満）、wide：それより広い画面）
  function section(title, defs, mobile, wide) {
    const heading = document.createElement('div');
    I.set(heading, title);
    const row = document.createElement('div');
    row.className = `row row-cols-${mobile} row-cols-md-${wide}`;
    defs.forEach((def) => {
      const col = document.createElement('div');
      col.className = 'col';
      col.append(...sticker(def));
      row.append(col);
    });
    return [heading, row];
  }

  const editor = $('stateEditor');
  const center = sticker({ id: 'uface0', key: 'state.center' });
  // U 面：スマホは 2 列（1 行に 1 面ぶんの辺と角）、広い画面は 5 列。
  // 側面：スマホは 3 列（1 行に 1 面ぶんの左・中・右。配色の設定と同じ 3 列）、広い画面は 6 列（2 面ぶん）
  editor.append(...center, ...section('state.uFace', U_STICKERS, 2, 5), ...section('state.sideFace', SIDE_STICKERS, 3, 6));

  // ---- パレット（全ステッカーで1つを共有）----
  let current = null; // 開いているステッカー
  const palette = document.createElement('div');
  palette.className = 'sticker-palette';
  palette.hidden = true;
  COLORS.forEach((color) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'sticker-palette-color';
    button.style.background = color_convert(color.value);
    button.title = color.name;
    button.setAttribute('aria-label', color.name);
    button.dataset.value = color.value;
    button.addEventListener('click', () => choose(color.value));
    palette.append(button);
  });
  document.body.append(palette);

  function open(item) {
    if (current === item && !palette.hidden) {
      close();
      return;
    }
    current = item;
    palette.querySelectorAll('.sticker-palette-color').forEach((b) => {
      b.classList.toggle('selected', b.dataset.value === item.input.value);
    });
    palette.hidden = false;

    // ステッカーの真下に表示（画面からはみ出さないよう左右を調整）
    const rect = item.swatch.getBoundingClientRect();
    const width = palette.offsetWidth;
    const left = Math.max(8, Math.min(rect.left, document.documentElement.clientWidth - width - 8));
    palette.style.left = left + window.scrollX + 'px';
    palette.style.top = rect.bottom + window.scrollY + 4 + 'px';

    (palette.querySelector('.selected') || palette.firstElementChild).focus();
  }

  function close(returnFocus) {
    if (palette.hidden) return;
    palette.hidden = true;
    if (returnFocus && current) current.swatch.focus();
    current = null;
  }

  function choose(value) {
    const item = current;
    item.input.value = value;
    close(true);
    paint(item);
    imageChange();
  }

  function paint(item) {
    const name = colorName(item.input.value);
    item.swatch.style.background = color_convert(item.input.value);
    item.swatch.title = name;
    item.swatch.setAttribute('aria-label', item.label.textContent + ': ' + name);
  }

  const paintAll = () => items.forEach(paint);
  paintAll();
  I.onChange(paintAll); // ラベルの言語が変わったら読み上げ用の名前も作り直す

  // 手順から計算した色は表示を切り替えたときに反映する
  document.querySelectorAll('input[name="algType"]').forEach((r) => r.addEventListener('change', paintAll));

  document.addEventListener('click', (e) => {
    if (!palette.contains(e.target)) close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close(true);
  });
  window.addEventListener('resize', () => close());
})();
