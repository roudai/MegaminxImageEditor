// 手順入力：megaminx-state.js で色を計算し、uface0..10 / sface1..15（state-editor.js が生成）に書き込んで再描画する。
// 種類（visualcube に合わせる）
//   alg   : Algorithm to apply         … 手順を適用した状態
//   case  : Algorithm to solve case    … その手順で揃う状態（逆手順を適用。持ち替え y の合計は打ち消す）
//   state : Defines the puzzle state   … 各ステッカーを手で指定（state-editor.js。直前の計算結果から編集できる）
// PLL・OLL選択（pll-data.js / oll-data.js）: それぞれの行で Group → Case で選ぶ（同時に選べるのはどちらか1つ）。
//   選んでいる間は種類に応じて入力欄を差し替える
//   alg → setup（そのケースになる手順） / case → alg（AUF込みの解く手順）
//   OLL を選ぶと Color Preset を OLL にし、そのあと PLL を選ぶと OLL を選ぶ前の配色に戻す（覚えていなければ Standard）
//   仕様: reference/PLL_SPEC.md、reference/OLL_SPEC.md
// 一括ダウンロード: 全PLL（今の配色）・全OLL（OLL配色）を描いて zip にする（zip-store.js、megaminx.js の renderImage）
// 設定の保存: 配色・画像サイズ・Body/Background の色・背景を localStorage に保存し、次に開いたときに戻す
// URLパラメータ: ?alg=R U R' U' / ?case=R U R' U' / ?pll=A1%2B / ?oll=1A（?pll → ?oll → ?case → ?alg の順に優先）
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
  // 選べるケースの種類（PLL・OLL）。各行の要素 id は <key>Group / <key>Case / <key>Prev / <key>Next / <key>Zip
  const SETS = {
    pll: { label: 'PLL', data: window.PLL_DATA || [] },
    oll: { label: 'OLL', data: window.OLL_DATA || [] },
  };
  Object.keys(SETS).forEach((key) => {
    Object.assign(SETS[key], { key: key, group: $(key + 'Group'), case: $(key + 'Case') });
  });

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
    clearSelection();
    update();
  }

  // ---- PLL・OLL選択 ----
  const option = (value, text) => {
    const o = document.createElement('option');
    o.value = value;
    o.textContent = text;
    return o;
  };

  // PLL グループの特徴（選択肢に「A (3 corner CP)」のように括弧付きで出す）
  SETS.pll.notes = {
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

  // OLL グループの名前（選択肢に「6 (Anchor)」のように括弧付きで出す）
  // 1〜37 は形の名前、1C・38〜53 は Dot 系のカテゴリー名（53 は上面の角5つの向きが崩れた Dot ケース）
  SETS.oll.notes = {
    1: 'EO',
    2: '2 Corner CO',
    3: '3 Corner CO',
    4: '4 Corner CO',
    5: '5 Corner CO',
    6: 'Anchor',
    7: 'T',
    8: 'C',
    9: 'S',
    10: 'Pi',
    11: 'Y',
    12: 'Hammerhead',
    13: 'W',
    14: 'Duckhead',
    15: 'Megaphone',
    16: 'Claw',
    17: 'Rabbit',
    18: 'Long Block',
    19: 'Fox Head',
    20: 'Scorpion',
    21: 'Line',
    22: 'Flower',
    23: 'Chandelier',
    24: 'P',
    25: 'E',
    26: 'Sprinter',
    27: 'Eagle',
    28: 'Big Block',
    29: 'Lobster',
    30: 'Lightning',
    31: 'Cobra',
    32: 'Hand',
    33: 'Magic Lamp',
    34: 'Human',
    35: 'Axe',
    36: 'Parrot',
    37: 'L',
    '1C': 'Dot EO',
    38: 'Dot 2 Corner CO',
    39: 'Dot 2 Corner CO',
    40: 'Dot 2 Corner CO',
    41: 'Dot 2 Corner CO',
    42: 'Dot 2 Corner CO',
    43: 'Dot 2 Corner CO',
    44: 'Dot 3 Corner CO',
    45: 'Dot 3 Corner CO',
    46: 'Dot 3 Corner CO',
    47: 'Dot 3 Corner CO',
    48: 'Dot 3 Corner CO',
    49: 'Dot 3 Corner CO',
    50: 'Dot 4 Corner CO',
    51: 'Dot 4 Corner CO',
    52: 'Dot 4 Corner CO',
    53: 'Dot 5 Corner CO',
  };

  function buildGroups(set) {
    const notes = set.notes || {};
    set.group.append(option('', `-- ${set.label} --`));
    set.data
      .map((c) => c.group)
      .filter((g, i, all) => all.indexOf(g) === i)
      .forEach((g) => set.group.append(option(g, notes[g] ? `${g} (${notes[g]})` : g)));
  }

  function fillCases(set, group) {
    set.case.replaceChildren(...set.data.filter((c) => c.group === group).map((c) => option(c.name, c.name)));
    set.case.disabled = !group;
  }

  const selectedIn = (set) => (set.case.disabled ? null : set.data.find((c) => c.name === set.case.value) || null);

  // 選択中のケース { set, c }（どれも選んでいなければ null）
  function selected() {
    for (const set of Object.values(SETS)) {
      const c = selectedIn(set);
      if (c) return { set: set, c: c };
    }
    return null;
  }

  // 選択中のケースの手順を、種類に合わせて入力欄に入れる（state のときは変更しない）
  function fillCaseAlg() {
    const sel = selected();
    const type = algType();
    if (!sel || type === 'state') return;
    input.value = type === 'alg' ? sel.c.setup : sel.c.alg;
  }

  // 最後に選んだ種類と、OLL を選ぶ前の配色（OLL のあとに PLL を選んだときに戻すため）
  let lastSet = null;
  let schemeBeforeOll = null;

  // OLL を選んだら OLL 配色にする（もともと OLL 配色でなければ、その前の配色を覚えておく）。
  // OLL のあとに PLL を選んだら、OLL 配色のままなら OLL を選ぶ前の配色に戻す。
  // 覚えた配色が無いとき（OLL 配色のまま再読み込みした場合など）は Standard にする。
  // OLL を選んだあとに色を変えていた場合（Preset が OLL でない）は何もしない
  function applySetScheme(set) {
    if (set.key === 'oll') {
      if (preset.value !== 'oll') {
        schemeBeforeOll = { preset: preset.value, scheme: currentScheme() };
        preset.value = 'oll';
        applyPreset();
      }
    } else if (lastSet && lastSet.key === 'oll' && preset.value === 'oll') {
      if (schemeBeforeOll) {
        preset.value = schemeBeforeOll.preset;
        setScheme(schemeBeforeOll.scheme);
      } else {
        preset.value = 'standard';
        applyPreset();
      }
      schemeBeforeOll = null;
    }
  }

  // 未選択から選んだときは case にする。選んだまま別のケースに変えたときは種類をそのままにする
  function selectCase(set, c) {
    const keepType = selected() !== null;
    Object.values(SETS).forEach((other) => {
      if (other !== set) clearSet(other);
    });
    set.group.value = c.group;
    fillCases(set, c.group);
    set.case.value = c.name;
    $('fname').value = `${set.key}-${c.name}.png`;
    applySetScheme(set);
    lastSet = set;
    if (keepType) onTypeChange(); // 手順を入れて再描画する
    else setAlgType('case');
  }

  function clearSet(set) {
    set.group.value = '';
    fillCases(set, '');
  }

  function clearSelection() {
    Object.values(SETS).forEach(clearSet);
  }

  // URLでは + が空白になるので、見つからなければ空白を + に戻して探す
  function findCase(set, name) {
    return set.data.find((c) => c.name === name) || set.data.find((c) => c.name === name.replace(/ /g, '+')) || null;
  }

  // 前後のケースへ（その種類のデータの並び順。端では反対の端に回る。未選択なら Next は先頭、Prev は末尾）
  function stepCase(set, delta) {
    const list = set.data;
    if (!list.length) return;
    const i = list.indexOf(selectedIn(set));
    const next = i < 0 ? (delta > 0 ? 0 : list.length - 1) : (i + delta + list.length) % list.length;
    selectCase(set, list[next]);
  }

  // その種類の全ケースを描き、zip にまとめてダウンロードする。
  // 各ケースは solve case（alg の逆手順を適用、持ち替え y は打ち消す）の状態で描く。ファイル名は <pll|oll>-<名前>.png
  // 配色：PLL は今の配色、OLL は今の U の色だけを残した OLL 配色。サイズ・Body Color・背景は今の設定
  async function downloadAll(set, button) {
    const label = button.textContent;
    button.disabled = true;
    try {
      const scheme = set.key === 'oll' ? M.ollMask({ U: currentScheme().U }, CODE_HEX.d) : currentScheme();
      const list = set.data;
      const files = [];
      for (let i = 0; i < list.length; i++) {
        const c = list[i];
        button.textContent = `Creating... ${i + 1}/${list.length}`;
        const state = M.applyAlg(c.alg, { inverse: true, cancelRotation: true });
        const colors = M.toImageColors(state, scheme);
        const canvas = window.renderImage(colors.ucolor, colors.scolor);
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
        files.push({ name: `${set.key}-${c.name}.png`, data: new Uint8Array(await blob.arrayBuffer()) });
      }
      const zip = new Blob([window.ZipStore.create(files)], { type: 'application/zip' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(zip);
      link.download = `megaminx-${set.key}.zip`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 10000);
    } finally {
      button.textContent = label;
      button.disabled = false;
    }
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
    fillCaseAlg();
    update();
  }

  buildButtons();
  Object.values(SETS).forEach((set) => {
    buildGroups(set);
    fillCases(set, '');
  });
  buildFaceColorInputs();
  setScheme(M.DEFAULT_SCHEME);

  input.addEventListener('input', () => {
    clearSelection();
    update();
  });
  typeRadios.forEach((r) => r.addEventListener('change', onTypeChange));
  $('algClear').addEventListener('click', () => {
    input.value = '';
    clearSelection();
    update();
  });
  Object.values(SETS).forEach((set) => {
    set.group.addEventListener('change', () => {
      const first = set.data.find((c) => c.group === set.group.value);
      if (first) selectCase(set, first);
      else clearSet(set);
    });
    set.case.addEventListener('change', () => {
      const c = selectedIn(set);
      if (c) selectCase(set, c);
    });
    $(set.key + 'Prev').addEventListener('click', () => stepCase(set, -1));
    $(set.key + 'Next').addEventListener('click', () => stepCase(set, 1));
    $(set.key + 'Zip').addEventListener('click', (e) => downloadAll(set, e.currentTarget));
  });
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

  // ---- 設定の保存（localStorage）----
  // 配色（Color Preset・Face Colors）、Image Size、Body Color、Background Color、Background を保存し、
  // 次に開いたときに戻す。手順・種類・PLL/OLLの選択・ファイル名は保存しない（URLパラメータで指定する）。
  // 保存できない環境（プライベートモードなど）では何もしない
  const SETTINGS_KEY = 'megaminx-image-editor:settings';
  const HEX = /^#[0-9a-f]{6}$/i;
  const SETTING_IDS = ['imageSize', 'border', 'bgColor', 'bg'];

  function saveSettings() {
    const settings = { preset: preset.value, faceColors: currentScheme() };
    SETTING_IDS.forEach((id) => {
      settings[id] = $(id).value;
    });
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {
      // 保存できなくても動作は続ける
    }
  }

  // 保存された値のうち、正しい形のものだけを入力欄に戻す
  function loadSettings() {
    let settings;
    try {
      settings = JSON.parse(localStorage.getItem(SETTINGS_KEY));
    } catch (e) {
      return;
    }
    if (!settings || typeof settings !== 'object') return;
    const faceColors = settings.faceColors || {};
    M.FACES.forEach((face) => {
      if (HEX.test(faceColors[face])) faceInputs[face].value = faceColors[face].toLowerCase();
    });
    if ([...preset.options].some((o) => o.value === settings.preset)) preset.value = settings.preset;
    if (/^\d+$/.test(settings.imageSize)) $('imageSize').value = settings.imageSize;
    ['border', 'bgColor'].forEach((id) => {
      if (HEX.test(settings[id])) $(id).value = settings[id];
    });
    if (settings.bg === 'y' || settings.bg === 'n') $('bg').value = settings.bg;
  }

  loadSettings();
  // 各入力欄・ボタンの処理が終わったあと（document まで伝わったとき）に保存する
  ['input', 'change', 'click'].forEach((type) => document.addEventListener(type, saveSettings));

  const params = new URLSearchParams(location.search);
  const urlPll = params.has('pll') ? findCase(SETS.pll, params.get('pll')) : null;
  const urlOll = params.has('oll') ? findCase(SETS.oll, params.get('oll')) : null;
  if (urlPll) {
    selectCase(SETS.pll, urlPll);
  } else if (urlOll) {
    selectCase(SETS.oll, urlOll);
  } else if (params.has('case')) {
    input.value = params.get('case');
    setAlgType('case');
  } else if (params.has('alg')) {
    input.value = params.get('alg');
    setAlgType('alg');
  } else {
    update(); // 戻した配色・サイズで描き直す
  }
})();
