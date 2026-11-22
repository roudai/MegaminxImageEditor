// 手順入力：megaminx-state.js で色を計算し、uface0..10 / sface1..15（state-editor.js が生成）に書き込んで再描画する。
// 種類（visualcube に合わせる）
//   alg   : Algorithm to apply         … 手順を適用した状態
//   case  : Algorithm to solve case    … その手順で揃う状態（逆手順を適用。持ち替え y の合計は打ち消す）
//   state : Defines the puzzle state   … 各ステッカーを手で指定（state-editor.js。直前の計算結果から編集できる）
// PLL・OLL選択（pll-data.js / oll-data.js）: それぞれの行で Group → Case で選ぶ（同時に選べるのはどちらか1つ）。
//   選んでいる間は種類に応じて入力欄を差し替える
//   alg → setup（そのケースになる手順） / case → alg（AUF込みの解く手順）
//   OLL を選ぶと Color Preset を OLL にし、OLL 配色のまま PLL を選ぶと OLL を選ぶ前の配色に戻す（覚えていなければ Standard）
//   選んでいる間は Algorithm 入力欄を書き換えても選択を外さず、その手順を自分の手順として保存できる
//   （custom-algs.js。確認は case-check.js）
//   仕様: reference/PLL_SPEC.md、reference/OLL_SPEC.md
// 設定の保存: 配色・画像サイズ・Body/Background の色・背景を localStorage に保存し、次に開いたときに戻す
// URLパラメータ: ?alg=R U R' U' / ?case=R U R' U' / ?pll=A1%2B / ?oll=1A（?pll → ?oll → ?case → ?alg の順に優先）
(function () {
  'use strict';
  const M = window.MegaminxState;
  const I = window.I18N; // 日本語・英語の切り替え（i18n.js）
  const $ = (id) => document.getElementById(id);

  const BUTTONS = ['U', 'F', 'R', 'L', 'BR', 'BL', 'DR', 'DL', 'DBR', 'DBL', 'B', 'D', 'y', "'", '2', '(', ')'];
  const SUFFIXES = ["'", '2', ')'];

  const input = $('alg');
  const error = $('algError');
  const preset = $('algPreset');
  const typeRadios = document.querySelectorAll('input[name="algType"]');
  const faceInputs = {};
  // 選べるケースの種類（PLL・OLL）。各行の要素 id は <key>Group / <key>Case / <key>Prev / <key>Next
  const SETS = {
    pll: { label: 'PLL', base: window.PLL_DATA || [] },
    oll: { label: 'OLL', base: window.OLL_DATA || [] },
  };
  // 自分の手順（custom-algs.js）を既定データに重ねたもの。保存・Reset のたびに作り直す
  const CA = window.CustomAlgs;
  const mergeData = (set) => {
    set.data = CA ? CA.merged(set.key, set.base) : set.base;
  };
  Object.keys(SETS).forEach((key) => {
    Object.assign(SETS[key], { key: key, group: $(key + 'Group'), case: $(key + 'Case') });
    mergeData(SETS[key]);
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
    showCaseBar(); // ケースを選んだまま書き換えた（編集中）
    update();
  }

  // ---- PLL・OLL選択 ----
  const option = (value, text) => {
    const o = document.createElement('option');
    o.value = value;
    o.textContent = text;
    return o;
  };

  // グループ名（case-groups.js）
  SETS.pll.notes = (window.CASE_GROUP_NOTES || {}).pll;
  SETS.oll.notes = (window.CASE_GROUP_NOTES || {}).oll;

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

  // OLL を選ぶ前の配色 { preset, scheme }（OLL 配色のまま PLL を選んだときに戻すため）。
  // 設定と一緒に localStorage にも保存し、ページを移動・再読み込みしても戻せるようにする（PLL 一覧もこれを使う）。
  // 手で配色を変えたら（Color Preset の変更・面の色の変更）忘れる
  let schemeBeforeOll = null;

  // OLL を選んだら OLL 配色にする（もともと OLL 配色でなければ、その前の配色を覚えておく）。
  // PLL を選んだとき OLL 配色なら（OLL のあと・OLL 配色のまま再読み込みした・PLL 一覧から開いた など）、
  // OLL を選ぶ前の配色に戻す。覚えた配色が無ければ Standard にする（PLL 一覧の表示と同じ）。
  // OLL 配色でなければ何もしない
  function applySetScheme(set) {
    if (set.key === 'oll') {
      if (preset.value !== 'oll') {
        schemeBeforeOll = { preset: preset.value, scheme: currentScheme() };
        preset.value = 'oll';
        applyPreset();
      }
    } else if (preset.value === 'oll') {
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
  // [PLL | OLL] の切り替え：その種類のグループ・ケース・前後のボタンだけを出す（選んでいるケースはそのまま）
  const setRadios = document.querySelectorAll('input[name="caseSet"]');
  function showSet(key) {
    setRadios.forEach((r) => {
      r.checked = r.value === key;
    });
    document.querySelectorAll('#algEditor [data-set]').forEach((el) => {
      el.hidden = el.dataset.set !== key;
    });
  }

  function selectCase(set, c) {
    const keepType = selected() !== null;
    showSet(set.key);
    Object.values(SETS).forEach((other) => {
      if (other !== set) clearSet(other);
    });
    set.group.value = c.group;
    fillCases(set, c.group);
    set.case.value = c.name;
    $('fname').value = `${set.key}-${c.name}.png`;
    applySetScheme(set);
    if (keepType) onTypeChange(); // 手順を入れて再描画する（編集中の内容は捨てる）
    else setAlgType('case');
    setMyAlgMessage('');
    showCaseBar();
  }

  function clearSet(set) {
    set.group.value = '';
    fillCases(set, '');
  }

  function clearSelection() {
    Object.values(SETS).forEach(clearSet);
    setMyAlgMessage('');
    showCaseBar();
  }

  // ---- 自分の手順 ----
  // ケースを選んでいる間は、Algorithm 入力欄を書き換えても選択を外さず「編集中」と出し、
  // 「この手順で揃う状態（case）」のときに保存できる（custom-algs.js で確かめてから）。「既定に戻す」で自分の手順を消す。
  // 入力欄の下の行（#caseAlgBar）は高さをいつも確保し、ケースを選んでいないときは中身を隠す（下のレイアウトがずれないように）
  const myAlgMessage = $('myAlgMessage');
  const squash = (text) => text.replace(/\s+/g, ' ').trim();
  const isEdited = (sel) => algType() === 'case' && squash(input.value) !== squash(sel.c.alg);

  function showCaseBar() {
    const sel = selected();
    const bar = $('caseAlgBar');
    const enabled = !!sel && !!CA;
    bar.classList.toggle('is-empty', !enabled);
    if (!enabled) return;
    $('caseAlgName').textContent = sel.c.name;
    const badge = $('caseAlgBadge');
    I.set(badge, sel.c.custom ? 'myAlg.custom' : 'myAlg.default');
    badge.className = `badge rounded-pill fw-normal ${sel.c.custom ? 'text-bg-success' : 'text-bg-secondary'}`;
    const edited = isEdited(sel);
    $('caseAlgEdited').hidden = !edited;
    const save = $('myAlgSave');
    const canSave = algType() === 'case';
    save.disabled = !canSave || !edited;
    if (canSave) {
      delete save.dataset.i18nTitle;
      save.removeAttribute('title');
    } else {
      I.set(save, 'myAlg.caseOnly', null, 'title');
    }
    $('myAlgReset').disabled = !sel.c.custom;
  }

  // メッセージは1行（長いときは省略し、全文はマウスを乗せると出る）。行の高さは空でも確保しておく
  // undo を渡すと、メッセージの右に「元に戻す」を出す（押すと保存・既定に戻す前の状態に戻す）。
  // メッセージが変わる（別のケースを選ぶ・書き換える・種類を切り替える など）と「元に戻す」も消える
  // message：文を作る関数（言語を切り替えたら、出ている間も訳し直す。I.live）。空にするときは '' か無し
  function setMyAlgMessage(message, kind, undo) {
    myAlgMessage.replaceChildren();
    myAlgMessage.className = `small d-flex align-items-center gap-2 ${kind === 'error' ? 'text-danger' : 'text-success'}`;
    const span = document.createElement('span');
    span.className = 'text-truncate';
    myAlgMessage.append(span);
    const make = typeof message === 'function' ? message : () => message || '';
    I.live(span, make);
    I.live(span, make, 'title');
    if (undo) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn btn-link btn-sm p-0 flex-none my-alg-undo';
      I.set(button, 'myAlg.undo');
      button.addEventListener('click', undo);
      myAlgMessage.append(button);
    }
  }

  // 保存・既定に戻すのあと：データを作り直し、選択中のケースの手順で入力欄と画像を描き直す
  function afterMyAlgChange(set, message, undo) {
    mergeData(set);
    onTypeChange();
    showCaseBar();
    setMyAlgMessage(message, null, undo);
  }

  // 変える前の自分の手順を覚えておき、「元に戻す」で戻す関数を作る（前が既定なら自分の手順を消す）
  function undoFor(set, name) {
    const before = CA.get(set.key, name);
    return () => {
      if (before) CA.save(set.key, name, before);
      else CA.reset(set.key, name);
      afterMyAlgChange(set, () => I.t('myAlg.undone'));
    };
  }

  function saveMyAlg() {
    const sel = selected();
    if (!sel || !CA || algType() !== 'case') return;
    const result = CA.validate(sel.set.key, sel.c, input.value, sel.set.base);
    if (!result.ok) {
      const text = () => (result.code === 'parse' ? I.error(result.error) : I.t('myAlg.err.' + result.code, result.params));
      setMyAlgMessage(() => '✗ ' + text(), 'error');
      return;
    }
    const undo = undoFor(sel.set, sel.c.name);
    if (result.isDefault) {
      // 既定の手順と同じなら自分の手順としては保存しない。
      // 自分の手順があったときは消して既定に戻し「既定の手順に戻しました」（元に戻せる）、無かったときは「既定の手順と同じです」
      const hadCustom = !!sel.c.custom;
      CA.reset(sel.set.key, sel.c.name);
      afterMyAlgChange(sel.set, () => I.t(hadCustom ? 'myAlg.resetDone' : 'myAlg.sameAsDefault'), hadCustom ? undo : null);
      return;
    }
    CA.save(sel.set.key, sel.c.name, result);
    const message = () =>
      [I.t('myAlg.saved')].concat(result.notes.map((n) => I.t('myAlg.' + n)), [I.t('myAlg.setup', { setup: result.setup })]).join(' ');
    afterMyAlgChange(sel.set, message, undo);
  }

  function resetMyAlg() {
    const sel = selected();
    if (!sel || !CA) return;
    const undo = undoFor(sel.set, sel.c.name);
    CA.reset(sel.set.key, sel.c.name);
    afterMyAlgChange(sel.set, () => I.t('myAlg.resetDone'), undo);
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
        schemeBeforeOll = null;
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

  // 最後のカスタム配色（色を変えて Preset が Custom になったときの配色）。
  // Color Preset で Custom を選ぶとこの配色に戻す。設定と一緒に localStorage に保存する
  let customScheme = null;

  function rememberCustomScheme() {
    if (preset.value === 'custom') customScheme = currentScheme();
  }

  function applyPreset() {
    if (preset.value === 'standard') setScheme(M.DEFAULT_SCHEME);
    else if (preset.value === 'oll') setScheme(M.ollMask({ U: faceInputs.U.value }, CODE_HEX.d));
    else if (preset.value === 'custom' && customScheme) setScheme(customScheme);
  }

  // ステッカーの値（state-editor.js が作る hidden input）に書き込む。14色にある色は色コードにする
  function setStickerColor(input, hex) {
    input.value = HEX_CODE[hex] || hex;
  }

  function update() {
    rememberCustomScheme();
    const type = algType();
    if (type === 'state') return;

    let state;
    try {
      // case は「この手順で揃う状態」。手順中の持ち替え（y）で完成後の向きが変わっても揃ったとみなす
      state = M.applyAlg(input.value, { inverse: type === 'case', cancelRotation: type === 'case' });
    } catch (e) {
      error.textContent = I.error(e.message);
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
    $('algTypeSelect').value = algType(); // スマホのプルダウンの表示をラジオボタンにそろえる
    const isState = algType() === 'state';
    $('algEditor').hidden = isState;
    $('stateEditor').hidden = !isState;
    fillCaseAlg();
    update();
    setMyAlgMessage(''); // 前のメッセージ（保存のエラーなど）は消す
    showCaseBar();
  }

  buildButtons();
  Object.values(SETS).forEach((set) => {
    buildGroups(set);
    fillCases(set, '');
  });
  buildFaceColorInputs();
  setScheme(M.DEFAULT_SCHEME);

  // 手で書き換えても選択は外さない（「編集中」と出し、この手順で揃う状態なら保存できる）
  input.addEventListener('input', () => {
    setMyAlgMessage('');
    showCaseBar();
    update();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !$('myAlgSave').disabled) saveMyAlg();
  });
  typeRadios.forEach((r) => r.addEventListener('change', onTypeChange));
  // スマホのプルダウン：同じ値のラジオボタンを選んで change を投げる（ラジオボタンの処理・state-editor.js の色の描き直しをそのまま使う）
  $('algTypeSelect').addEventListener('change', (e) => {
    const radio = [...typeRadios].find((r) => r.value === e.target.value);
    if (!radio || radio.checked) return;
    radio.checked = true;
    radio.dispatchEvent(new Event('change', { bubbles: true }));
  });
  $('algClear').addEventListener('click', () => {
    input.value = '';
    clearSelection();
    update();
  });
  $('myAlgSave').addEventListener('click', saveMyAlg);
  $('myAlgReset').addEventListener('click', resetMyAlg);
  setRadios.forEach((r) => r.addEventListener('change', () => showSet(r.value)));
  Object.values(SETS).forEach((set) => {
    set.group.addEventListener('change', () => {
      const first = set.data.find((c) => c.group === set.group.value);
      if (first) selectCase(set, first);
      else {
        clearSet(set);
        showCaseBar();
      }
    });
    set.case.addEventListener('change', () => {
      const c = selectedIn(set);
      if (c) selectCase(set, c);
    });
    $(set.key + 'Prev').addEventListener('click', () => stepCase(set, -1));
    $(set.key + 'Next').addEventListener('click', () => stepCase(set, 1));
  });
  preset.addEventListener('change', () => {
    schemeBeforeOll = null;
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

  // ---- 設定の保存（store.js 経由で localStorage。ログイン中はクラウドにも）----
  // 配色（Color Preset・Face Colors・OLL を選ぶ前の配色・最後のカスタム配色）、Image Size、Body Color、Background Color、Background を保存し、
  // 次に開いたときに戻す。手順・種類・PLL/OLLの選択・ファイル名は保存しない（URLパラメータで指定する）。
  // 保存できない環境（プライベートモードなど）では何もしない
  const HEX = /^#[0-9a-f]{6}$/i;
  const SETTING_IDS = ['imageSize', 'border', 'bgColor', 'bg'];

  function saveSettings() {
    // ここでは rememberCustomScheme() を呼ばない。セレクトは change の前に input が来るので、
    // Custom を選んだ瞬間（まだ色が戻る前）の配色を覚えてしまう
    const settings = {
      preset: preset.value,
      faceColors: currentScheme(),
      beforeOll: schemeBeforeOll,
      customScheme: customScheme,
    };
    SETTING_IDS.forEach((id) => {
      settings[id] = $(id).value;
    });
    window.Store.set('settings', settings); // store.js（前と同じ内容なら何もしない）
  }

  // 保存された値のうち、正しい形のものだけを入力欄に戻す
  function loadSettings() {
    const settings = window.Store.get('settings');
    if (!settings || typeof settings !== 'object') return;
    const faceColors = settings.faceColors || {};
    M.FACES.forEach((face) => {
      if (HEX.test(faceColors[face])) faceInputs[face].value = faceColors[face].toLowerCase();
    });
    if ([...preset.options].some((o) => o.value === settings.preset)) preset.value = settings.preset;
    // 画像サイズは今の画面の範囲（megaminx.js の clampImageSize。上限は画面の幅で決まる）に収めてから入れる
    if (/^\d+$/.test(settings.imageSize)) $('imageSize').value = window.clampImageSize(settings.imageSize);
    ['border', 'bgColor'].forEach((id) => {
      if (HEX.test(settings[id])) $(id).value = settings[id];
    });
    if (settings.bg === 'y' || settings.bg === 'n') $('bg').value = settings.bg;
    schemeBeforeOll = validBeforeOll(settings.beforeOll);
    if (validScheme(settings.customScheme)) customScheme = settings.customScheme;
    else if (preset.value === 'custom') customScheme = currentScheme();
  }

  const validScheme = (scheme) => !!scheme && typeof scheme === 'object' && M.FACES.every((face) => HEX.test(scheme[face]));

  // 保存された「OLL を選ぶ前の配色」が正しい形ならそのまま、そうでなければ null
  function validBeforeOll(value) {
    if (!value || typeof value !== 'object' || !validScheme(value.scheme)) return null;
    if (![...preset.options].some((o) => o.value === value.preset)) return null;
    return { preset: value.preset, scheme: value.scheme };
  }

  loadSettings();
  // 各入力欄・ボタンの処理が終わったあと（document まで伝わったとき）に保存する
  ['input', 'change', 'click'].forEach((type) => document.addEventListener(type, saveSettings));

  showCaseBar(); // ケース未選択の状態で表示しておく
  // 言語を切り替えたら、その場で作る文（エラー・自分の手順の行）を作り直す
  I.onChange(() => {
    showCaseBar();
    update();
  });

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
