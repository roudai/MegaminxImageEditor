// 手順入力：megaminx-state.js で色を計算し、既存の uface0..10 / sface1..15 に書き込んで再描画する。
// 種類（visualcube に合わせる）
//   alg   : Algorithm to apply         … 手順を適用した状態
//   case  : Algorithm to solve case    … その手順で揃う状態（逆手順を適用）
//   state : Defines the puzzle state   … 各ステッカーを手で指定（直前の計算結果から編集できる）
// URLパラメータ: ?alg=R U R' U' または ?case=R U R' U'
(function () {
  'use strict';
  const M = window.MegaminxState;
  const $ = (id) => document.getElementById(id);

  const BUTTONS = ['U', 'F', 'R', 'L', 'BR', 'BL', 'DR', 'DL', 'DBR', 'DBL', 'B', 'D', 'y', "'", '2', '(', ')'];
  const SUFFIXES = ["'", '2', ')'];

  const input = $('alg');
  const error = $('algError');
  const preset = $('algPreset');
  const typeRadios = document.querySelectorAll('input[name="algType"]');
  const faceInputs = {};

  const algType = () => document.querySelector('input[name="algType"]:checked').value;

  function setAlgType(type) {
    typeRadios.forEach((r) => {
      r.checked = r.value === type;
    });
    onTypeChange();
  }

  function buildButtons() {
    const container = $('algButtons');
    BUTTONS.forEach((token) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn btn-outline-secondary btn-sm mr-1 mb-1';
      button.textContent = token;
      button.addEventListener('click', () => addToken(token));
      container.append(button);
    });
  }

  // 面記号の前には必要に応じて空白を入れ、' 2 ) は直前に続ける
  function addToken(token) {
    let value = input.value;
    if (!SUFFIXES.includes(token) && value && !/[\s(]$/.test(value)) value += ' ';
    input.value = value + token;
    update();
  }

  // 既存の色コード ⇔ #rrggbb（megaminx.js の color_convert と同じ色）
  const CODE_HEX = {
    d: '#696969', u: '#d3d3d3', p: '#ffc0cb', c: '#fffacd', a: '#00ffff', o: '#ffa500', l: '#7cfc00',
    b: '#1e90ff', y: '#ffff00', s: '#9400d3', g: '#2e8b57', r: '#ff0000', w: '#ffffff', z: '#1b1b1b',
  };
  const HEX_CODE = {};
  Object.keys(CODE_HEX).forEach((code) => {
    HEX_CODE[CODE_HEX[code]] = code;
  });
  const toHex = (scheme) => {
    const out = {};
    Object.keys(scheme).forEach((face) => {
      out[face] = CODE_HEX[scheme[face]] || scheme[face];
    });
    return out;
  };

  // 面→色の割り当て（visualcube と同じく <input type="color">）
  function buildFaceColorInputs() {
    const container = $('faceColors');
    M.FACES.forEach((face) => {
      const col = document.createElement('div');
      col.className = 'col-4 col-md-2';
      const label = document.createElement('label');
      label.htmlFor = 'facecolor-' + face;
      label.textContent = face;
      const picker = document.createElement('input');
      picker.type = 'color';
      picker.id = 'facecolor-' + face;
      picker.className = 'form-control';
      picker.addEventListener('input', () => {
        preset.value = 'custom';
        update();
      });
      col.append(label, picker);
      container.append(col);
      faceInputs[face] = picker;
    });
  }

  function setScheme(scheme) {
    const hex = toHex(scheme);
    M.FACES.forEach((face) => {
      faceInputs[face].value = hex[face];
    });
  }

  function currentScheme() {
    const scheme = {};
    M.FACES.forEach((face) => {
      scheme[face] = faceInputs[face].value.toLowerCase();
    });
    return scheme;
  }

  function applyPreset() {
    if (preset.value === 'standard') setScheme(M.DEFAULT_SCHEME);
    else if (preset.value === 'oll') setScheme(M.ollMask({ U: faceInputs.U.value }, CODE_HEX.d));
  }

  // 27個のセレクトに書き込む。14色にない色は一時的な選択肢を足して保持する
  function setSelectColor(select, hex) {
    const code = HEX_CODE[hex];
    select.querySelectorAll('option[data-custom]').forEach((o) => o.remove());
    if (code) {
      select.value = code;
      return;
    }
    const option = document.createElement('option');
    option.value = hex;
    option.textContent = hex;
    option.dataset.custom = '1';
    select.append(option);
    select.value = hex;
  }

  function update() {
    const type = algType();
    if (type === 'state') return;

    let state;
    try {
      state = M.applyAlg(input.value, { inverse: type === 'case' });
    } catch (e) {
      error.textContent = e.message;
      input.classList.add('is-invalid');
      return;
    }
    error.textContent = '';
    input.classList.remove('is-invalid');

    const colors = M.toImageColors(state, currentScheme());
    colors.ucolor.forEach((c, i) => setSelectColor($('uface' + i), c));
    colors.scolor.forEach((c, i) => setSelectColor($('sface' + (i + 1)), c));
    imageChange();
  }

  function onTypeChange() {
    const isState = algType() === 'state';
    $('algEditor').hidden = isState;
    $('stateEditor').hidden = !isState;
    update();
  }

  buildButtons();
  buildFaceColorInputs();
  setScheme(M.DEFAULT_SCHEME);

  input.addEventListener('input', update);
  typeRadios.forEach((r) => r.addEventListener('change', onTypeChange));
  $('algClear').addEventListener('click', () => {
    input.value = '';
    update();
  });
  preset.addEventListener('change', () => {
    applyPreset();
    update();
  });
  $('faceColorsReset').addEventListener('click', () => {
    preset.value = 'standard';
    applyPreset();
    update();
  });

  const params = new URLSearchParams(location.search);
  if (params.has('case')) {
    input.value = params.get('case');
    setAlgType('case');
  } else if (params.has('alg')) {
    input.value = params.get('alg');
    setAlgType('alg');
  }
})();
