// Defines the puzzle state：各ステッカーの色を指定する入力欄を生成する。
// - 色は hidden input（uface0..10 / sface1..15）に持つ。imageChange()（megaminx.js）がこの値を読む
// - 色は既定14色のカラーパレットから選ぶ
// - 初期値は canvas の ucolor / scolor 属性
// megaminx-state.js と megaminx.js（color_convert）の後、alg-input.js の前に読み込む。
(function () {
  'use strict';
  const M = window.MegaminxState;
  const $ = (id) => document.getElementById(id);

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
    U_STICKERS.push({ id: 'uface' + (2 + 2 * k), label: faceOf(k) + ' edge' });
    U_STICKERS.push({ id: 'uface' + (1 + 2 * next), label: faceOf(k) + '-' + faceOf(next) + ' corner' });
  });

  const SIDE_STICKERS = [];
  ORDER.forEach((k) => {
    ['left', 'center', 'right'].forEach((pos, j) => {
      SIDE_STICKERS.push({ id: 'sface' + (3 * k + j + 1), label: faceOf(k) + ' ' + pos });
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
    label.textContent = def.label;

    const swatch = document.createElement('button');
    swatch.type = 'button';
    swatch.id = def.id + '-swatch';
    swatch.className = 'sticker-swatch';

    const item = { input: input, swatch: swatch, label: def.label };
    swatch.addEventListener('click', (e) => {
      e.stopPropagation();
      open(item);
    });
    items.push(item);
    return [label, input, swatch];
  }

  function section(title, defs, perRow) {
    const heading = document.createElement('div');
    heading.textContent = title;
    const nodes = [heading];
    for (let i = 0; i < defs.length; i += perRow) {
      const row = document.createElement('div');
      row.className = 'row';
      defs.slice(i, i + perRow).forEach((def) => {
        const col = document.createElement('div');
        col.className = 'col-12 col-md-2';
        col.append(...sticker(def));
        row.append(col);
      });
      nodes.push(row);
    }
    return nodes;
  }

  const editor = $('stateEditor');
  const center = sticker({ id: 'uface0', label: 'Center Color' });
  editor.append(...center, ...section('U Face Color', U_STICKERS, 5), ...section('Side Face Color', SIDE_STICKERS, 6));

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
    item.swatch.setAttribute('aria-label', item.label + ': ' + name);
  }

  const paintAll = () => items.forEach(paint);
  paintAll();

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
