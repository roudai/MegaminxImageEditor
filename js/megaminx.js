// エディタ（index.html）の画像：入力欄（サイズ・各ステッカーの色・Body Color・背景）を読み、
// megaminx-draw.js で canvas に描く。
// 外から使う関数（index.html と他のスクリプト）: imageChange, downloadImage, color_convert, clampImageSize
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const D = window.MegaminxDraw;
  const canvas = $('canvas');

  // 画像サイズの範囲。上限はページを開いたときの画面の幅の 80% を 100 単位に丸めたもの（最大 1000。
  // 例：パソコンは 1000、幅 390px のスマホは 300）。開いたときに 1 回だけ決める。
  // とても狭い画面でも下限（100）を下回らないようにする
  const SIZE_MIN = 100;
  const SIZE_MAX = Math.max(SIZE_MIN, Math.min(Math.round((window.innerWidth * 0.8) / 100) * 100, 1000));
  const SIZE_DEFAULT = Math.min(200, SIZE_MAX); // 空欄のとき（上限が 200 より小さい画面では上限）
  $('imageSize').min = String(SIZE_MIN);
  $('imageSize').max = String(SIZE_MAX); // ↑↓でも範囲の外に出ないように

  // 画像サイズを SIZE_MIN〜SIZE_MAX に収める（空欄なら SIZE_DEFAULT）
  function clampImageSize(value) {
    if (value === '' || value === null || value === undefined) return SIZE_DEFAULT;
    const n = Number(value);
    if (!Number.isFinite(n)) return SIZE_DEFAULT;
    return Math.min(Math.max(n, SIZE_MIN), SIZE_MAX);
  }

  // 描く色（初期値は canvas の属性）
  let ucolor = canvas.getAttribute('ucolor');
  let scolor = canvas.getAttribute('scolor');

  // 今の Body Color・背景の設定
  const drawOptions = () => ({
    border: $('border').value,
    background: $('bg').value === 'n' ? $('bgColor').value : null,
  });

  function render() {
    D.draw(canvas, ucolor, scolor, drawOptions());
  }

  // ---- 外から呼ぶ関数 ----
  // 入力欄（サイズ・各ステッカーの色）を読み直して描き直す
  function imageChange() {
    sizecheck();
    const size = $('imageSize').value;
    canvas.width = size;
    canvas.height = size;

    ucolor = [];
    for (let i = 0; i <= 10; i++) ucolor.push($('uface' + i).value);
    scolor = [];
    for (let i = 1; i <= 15; i++) scolor.push($('sface' + i).value);

    render();
  }

  // PNG で保存する。ファイル名が .png で終わらなければ付け足す（空欄なら megaminx.png）
  function downloadImage() {
    render();
    const name = $('fname').value.trim() || 'megaminx';
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = /\.png$/i.test(name) ? name : name + '.png';
    link.click();
  }

  // 入力欄の画像サイズを範囲に収める（空欄なら SIZE_DEFAULT）。範囲の中なら入力欄は変えない
  function sizecheck() {
    const input = $('imageSize');
    const size = clampImageSize(input.value);
    if (String(size) !== input.value) input.value = size;
  }

  window.imageChange = imageChange;
  window.downloadImage = downloadImage;
  window.color_convert = D.colorConvert;
  window.clampImageSize = clampImageSize; // alg-input.js が保存した設定を読み込むときに使う

  render();
})();
