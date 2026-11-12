// Defines the puzzle state：各ステッカーの色を、既定14色のカラーパレットから選ぶ。
// 既存の27個のセレクト（uface0..10 / sface1..15）は imageChange() が値を読むので、隠して値の保持に使う。
// 色はセレクトの選択肢（14色）と color_convert()（megaminx.js）から取る。
(function () {
  'use strict';
  const editor = document.getElementById('stateEditor');
  const selects = Array.from(editor.querySelectorAll('select'));
  const COLORS = Array.from(selects[0].options).map((o) => ({ value: o.value, name: o.textContent }));

  const swatches = [];
  let current = null; // 開いているステッカー { select, swatch }

  // ---- パレット（全ステッカーで1つを共有）----
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
      b.classList.toggle('selected', b.dataset.value === item.select.value);
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
    item.select.value = value;
    close(true);
    paint(item);
    imageChange();
  }

  function paint(item) {
    const option = item.select.selectedOptions[0];
    const name = option ? option.textContent : item.select.value;
    item.swatch.style.background = color_convert(item.select.value);
    item.swatch.title = name;
    item.swatch.setAttribute('aria-label', item.label ? item.label + ': ' + name : name);
  }

  const paintAll = () => swatches.forEach(paint);

  // ---- セレクトを色見本ボタンに置き換える ----
  selects.forEach((select) => {
    const swatch = document.createElement('button');
    swatch.type = 'button';
    swatch.className = 'sticker-swatch';
    const label = select.previousElementSibling;
    const item = { select: select, swatch: swatch, label: label && label.tagName === 'LABEL' ? label.textContent : '' };
    swatch.addEventListener('click', (e) => {
      e.stopPropagation();
      open(item);
    });
    select.hidden = true;
    select.after(swatch);
    swatches.push(item);
  });
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
