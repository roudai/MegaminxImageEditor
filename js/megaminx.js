// エディタ（index.html）の画像：入力欄（サイズ・各ステッカーの色・Body Color・背景）を読み、
// megaminx-draw.js で canvas に描く。
// 外から使う関数（index.html と他のスクリプト）: imageChange, downloadImage, color_convert
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const D = window.MegaminxDraw;
  const canvas = $('canvas');

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

  // 画像サイズを 100〜1000 に収める（空欄なら 200）
  function sizecheck() {
    const size = $('imageSize').value;
    if (size === '') $('imageSize').value = 200;
    else if (size < 100) $('imageSize').value = 100;
    else if (size > 1000) $('imageSize').value = 1000;
  }

  window.imageChange = imageChange;
  window.downloadImage = downloadImage;
  window.color_convert = D.colorConvert;

  render();
})();
