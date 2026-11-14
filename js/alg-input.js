// 手順入力：megaminx-state.js で色を計算し、uface0..10 / sface1..15（state-editor.js が生成）に書き込んで再描画する。
// 種類（visualcube に合わせる）
//   alg   : Algorithm to apply         … 手順を適用した状態
//   case  : Algorithm to solve case    … その手順で揃う状態（逆手順を適用。持ち替え y の合計は打ち消す）
//   state : Defines the puzzle state   … 各ステッカーを手で指定（state-editor.js。直前の計算結果から編集できる）
// PLL選択（pll-data.js）: Group → Case で選ぶ。選んでいる間は種類に応じて入力欄を差し替える
//   alg → setup（そのケースになる手順） / case → alg（AUF込みの解く手順）。仕様: reference/PLL_SPEC.md
// URLパラメータ: ?alg=R U R' U' または ?case=R U R' U' または ?pll=A1%2B（?pll が優先）
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
  const PLL = window.PLL_DATA || [];
  const pllGroup = $('pllGroup');
  const pllCase = $('pllCase');

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
      button.className = 'btn btn-outline-secondary btn-sm me-1 mb-1';
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
    clearPll();
    update();
  }

  // ---- PLL選択 ----
  const option = (value, text) => {
    const o = document.createElement('option');
    o.value = value;
    o.textContent = text;
    return o;
  };

  // グループの特徴（選択肢に「A (3 corner CP)」のように括弧付きで出す）
  const PLL_GROUP_NOTES = {
    A: '3 corner CP',
    B: 'Double R block',
    C: '2 2x1s touching',
    D: '3x1 and 2x2',
    E: '4 corner CP',
    F: '3x1 and 2x1(s)',
    G: '2x1 and headlights',
    H: '5 piece EP/CP',
    I: '2x1',
    J: 'J block',
    K: '5 corner CP',
    L: 'Double headlights, no blocks',
    M: '2 3x1s',
    N: '5 2x1s',
    P: 'R block',
    Q: '5 edge EP',
    R: 'R block and 2x1',
    S: '2 2x1s, not touching',
    T: '2, 3 or 4 2x1s',
    U: '3 edge EP',
    V: '2x2 and 2x1',
    W: '2 2x2s',
    X: 'No blocks or headlights',
    Y: '2 2x1s in Y pattern and other stuff',
    Z: '4 edge EP',
  };

  function buildPllGroups() {
    pllGroup.append(option('', '-- PLL --'));
    PLL.map((c) => c.group)
      .filter((g, i, all) => all.indexOf(g) === i)
      .forEach((g) => pllGroup.append(option(g, PLL_GROUP_NOTES[g] ? `${g} (${PLL_GROUP_NOTES[g]})` : g)));
  }

  function fillPllCases(group) {
    pllCase.replaceChildren(...PLL.filter((c) => c.group === group).map((c) => option(c.name, c.name)));
    pllCase.disabled = !group;
  }

  const selectedPll = () => (pllCase.disabled ? null : PLL.find((c) => c.name === pllCase.value) || null);

  // 選択中のPLLの手順を、種類に合わせて入力欄に入れる（state のときは変更しない）
  function fillPllAlg() {
    const pll = selectedPll();
    const type = algType();
    if (!pll || type === 'state') return;
    input.value = type === 'alg' ? pll.setup : pll.alg;
  }

  // 未選択から選んだときは case にする。PLLを選んだまま別のPLLに変えたときは種類をそのままにする
  function selectPll(pll) {
    const keepType = selectedPll() !== null;
    pllGroup.value = pll.group;
    fillPllCases(pll.group);
    pllCase.value = pll.name;
    $('fname').value = 'pll-' + pll.name + '.png';
    if (keepType) onTypeChange(); // 手順を入れて再描画する
    else setAlgType('case');
  }

  function clearPll() {
    pllGroup.value = '';
    fillPllCases('');
  }

  // URLでは + が空白になるので、見つからなければ空白を + に戻して探す
  function findPll(name) {
    return PLL.find((c) => c.name === name) || PLL.find((c) => c.name === name.replace(/ /g, '+')) || null;
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
      label.className = 'form-label';
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

  // 面の色を U（y）と同じ向きに1回分回す：上段・下段とも、上から見て反時計回りに隣の面の色を受け取る
  // （例：F には R の色が来る）。U・D の色は変わらない
  function rotateSchemeU() {
    const before = currentScheme();
    const after = Object.assign({}, before);
    [M.UPPER, M.LOWER].forEach((ring) => {
      ring.forEach((face, i) => {
        after[face] = before[ring[(i + 1) % ring.length]];
      });
    });
    if (M.FACES.some((f) => after[f] !== before[f])) preset.value = 'custom';
    setScheme(after);
  }

  // パズルを上下にひっくり返したときの配色にする（F と DR の間の辺の中点を通る水平軸まわりに180°）。
  // 面 → その位置に来る面。2回で元に戻る。向きの違いは U ↻ で合わせる
  const FLIP = {
    U: 'D', D: 'U', F: 'DR', DR: 'F', R: 'DL', DL: 'R', BR: 'DBL', DBL: 'BR', BL: 'B', B: 'BL', L: 'DBR', DBR: 'L',
  };
  function flipScheme() {
    const before = currentScheme();
    const after = {};
    M.FACES.forEach((face) => {
      after[face] = before[FLIP[face]];
    });
    if (M.FACES.some((f) => after[f] !== before[f])) preset.value = 'custom';
    setScheme(after);
  }

  function applyPreset() {
    if (preset.value === 'standard') setScheme(M.DEFAULT_SCHEME);
    else if (preset.value === 'oll') setScheme(M.ollMask({ U: faceInputs.U.value }, CODE_HEX.d));
  }

  // ステッカーの値（state-editor.js が作る hidden input）に書き込む。14色にある色は色コードにする
  function setStickerColor(input, hex) {
    input.value = HEX_CODE[hex] || hex;
  }

  function update() {
    const type = algType();
    if (type === 'state') return;

    let state;
    try {
      // case は「この手順で揃う状態」。手順中の持ち替え（y）で完成後の向きが変わっても揃ったとみなす
      state = M.applyAlg(input.value, { inverse: type === 'case', cancelRotation: type === 'case' });
    } catch (e) {
      error.textContent = e.message;
      input.classList.add('is-invalid');
      return;
    }
    error.textContent = '';
    input.classList.remove('is-invalid');

    const colors = M.toImageColors(state, currentScheme());
    colors.ucolor.forEach((c, i) => setStickerColor($('uface' + i), c));
    colors.scolor.forEach((c, i) => setStickerColor($('sface' + (i + 1)), c));
    imageChange();
  }

  function onTypeChange() {
    const isState = algType() === 'state';
    $('algEditor').hidden = isState;
    $('stateEditor').hidden = !isState;
    fillPllAlg();
    update();
  }

  buildButtons();
  buildPllGroups();
  fillPllCases('');
  buildFaceColorInputs();
  setScheme(M.DEFAULT_SCHEME);

  input.addEventListener('input', () => {
    clearPll();
    update();
  });
  typeRadios.forEach((r) => r.addEventListener('change', onTypeChange));
  $('algClear').addEventListener('click', () => {
    input.value = '';
    clearPll();
    update();
  });
  pllGroup.addEventListener('change', () => {
    const first = PLL.find((c) => c.group === pllGroup.value);
    if (first) selectPll(first);
    else clearPll();
  });
  pllCase.addEventListener('change', () => {
    const pll = selectedPll();
    if (pll) selectPll(pll);
  });
  // 前後のPLLへ（データの並び順。端では反対の端に回る。未選択なら Next は先頭、Prev は末尾）
  function stepPll(delta) {
    if (!PLL.length) return;
    const i = PLL.indexOf(selectedPll());
    const next = i < 0 ? (delta > 0 ? 0 : PLL.length - 1) : (i + delta + PLL.length) % PLL.length;
    selectPll(PLL[next]);
  }
  $('pllPrev').addEventListener('click', () => stepPll(-1));
  $('pllNext').addEventListener('click', () => stepPll(1));
  preset.addEventListener('change', () => {
    applyPreset();
    update();
  });
  $('faceColorsRotate').addEventListener('click', () => {
    rotateSchemeU();
    update();
  });
  $('faceColorsFlip').addEventListener('click', () => {
    flipScheme();
    update();
  });
  $('faceColorsReset').addEventListener('click', () => {
    preset.value = 'standard';
    applyPreset();
    update();
  });

  const params = new URLSearchParams(location.search);
  const urlPll = params.has('pll') ? findPll(params.get('pll')) : null;
  if (urlPll) {
    selectPll(urlPll);
  } else if (params.has('case')) {
    input.value = params.get('case');
    setAlgType('case');
  } else if (params.has('alg')) {
    input.value = params.get('alg');
    setAlgType('alg');
  }
})();
