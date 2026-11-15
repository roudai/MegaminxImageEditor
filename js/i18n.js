/*
 * 日本語・英語の切り替え（エディタ index.html と一覧ページ pll.html / oll.html で共通）。
 *
 *   I18N.lang                    今の言語（'en' / 'ja'）
 *   I18N.t(key, params)          訳した文（{name} のような部分を params で埋める）
 *   I18N.set(el, key, params, attr)
 *                                el に訳した文を入れ、言語を切り替えたときに入れ直せるよう data-i18n* に覚えておく
 *                                attr: 'text'（既定）/ 'title' / 'placeholder' / 'aria-label'
 *   I18N.setLang(lang)           言語を変えて画面全体を入れ直し、onChange の関数を呼ぶ
 *   I18N.onChange(fn)            言語を変えたときに呼ぶ関数を登録する（件数など毎回作る文の作り直し用）
 *   I18N.error(message)          megaminx-state.js の解析エラー（英語）を訳す
 *
 * HTML では <span data-i18n="key">English</span> のように書く（属性は data-i18n-title / -placeholder / -aria-label）。
 * 言語は localStorage 'megaminx-image-editor:lang' に保存する。無ければブラウザの言語（ja なら日本語、それ以外は英語）。
 * ナビバーの #langSwitch に EN / 日本語 の切り替えを作る。
 */
(function () {
  'use strict';

  const KEY = 'megaminx-image-editor:lang';

  const DICT = {
    en: {
      // ナビバー・共通
      'nav.editor': 'Editor',
      'nav.pllList': 'PLL List',
      'nav.ollList': 'OLL List',
      'common.reset': 'Reset',
      'common.prev': '‹ Prev',
      'common.next': 'Next ›',
      // エディタ
      'title.editor': 'Megaminx Image Editor 2.0',
      'editor.download': 'Download',
      'editor.fileName': 'File Name',
      'editor.imageSize': 'Image Size (px)',
      'editor.algorithm': 'Algorithm',
      'editor.typeAlg': 'Algorithm to apply',
      'editor.typeCase': 'Algorithm to solve case',
      'editor.typeState': 'Defines the puzzle state',
      'editor.clear': 'Clear',
      'editor.colorPreset': 'Color Preset',
      'editor.presetStandard': 'Standard',
      'editor.presetOll': 'OLL (U color only)',
      'editor.presetCustom': 'Custom',
      'editor.faceColors': 'Face Colors',
      'editor.rotateTitle': 'Rotate face colors like U (y)',
      'editor.flip': 'Flip',
      'editor.flipTitle': 'Flip the puzzle upside down (U and D swap places)',
      'editor.bodyColor': 'Body Color',
      'editor.bgColor': 'Background Color',
      'editor.background': 'Background',
      'editor.transparent': 'Transparent',
      'editor.opaque': 'Opaque',
      'editor.groupAria': '{set} group',
      'editor.caseAria': '{set} case',
      'editor.navAria': '{set} navigation',
      // 自分の手順
      'myAlg.title': 'My algorithm',
      'myAlg.titleFor': 'My algorithm for {name}',
      'myAlg.default': 'default',
      'myAlg.custom': 'custom',
      'myAlg.placeholder': 'Select a PLL or OLL case to save your own algorithm',
      'myAlg.save': 'Save',
      'myAlg.saved': '✓ Saved.',
      'myAlg.stripped': 'Removed the final AUF / rotation.',
      'myAlg.setup': 'Setup: {setup}',
      'myAlg.resetDone': 'Reset to the default algorithm.',
      'myAlg.sameAsDefault': 'Same as the default algorithm, so it was not saved as your own.',
      'myAlg.err.empty': 'Enter an algorithm.',
      'myAlg.err.notSolved': 'This algorithm does not solve {name}.',
      'myAlg.err.solvesOther': 'This algorithm does not solve {name} (it solves {other}).',
      // 状態の手入力（state-editor.js）
      'state.center': 'Center Color',
      'state.uFace': 'U Face Color',
      'state.sideFace': 'Side Face Color',
      'state.edge': '{face} edge',
      'state.corner': '{a}-{b} corner',
      'state.left': '{face} left',
      'state.middle': '{face} center',
      'state.right': '{face} right',
      // 解析エラー
      'parse.invalid': 'Invalid move: {move}',
      'parse.missing': 'Missing closing parenthesis',
      'parse.unmatched': 'Unmatched ")"',
      // 一覧ページ
      'title.pllList': 'PLL List - Megaminx Image Editor 2.0',
      'title.ollList': 'OLL List - Megaminx Image Editor 2.0',
      'list.pllHeading': 'PLL List',
      'list.ollHeading': 'OLL List',
      'list.count': '{n} cases',
      'list.pllIntro': 'Click a case to open it in the editor, or tap the circle to mark how well you know it. Colors follow the settings saved in the editor.',
      'list.ollIntro': 'Click a case to open it in the editor, or tap the circle to mark how well you know it. Cases are shown with the U color saved in the editor.',
      'list.downloadAll': 'Download all {set} (.zip)',
      'list.downloadScope': 'Download {scope} {set} (.zip)',
      'list.downloadTitle': '{n} cases as PNG, with the colors shown here and the image settings saved in the editor',
      'list.creating': 'Creating... {i}/{n}',
      'list.scopeAria': 'Cases to show',
      'list.scopeNd': 'No Dot',
      'list.scopeD': 'Dot',
      'list.scopeAll': 'All',
      'list.scopeNdTitle': 'Groups 1-37 (no dot)',
      'list.scopeDTitle': 'Groups 1C and 38-53 (dot)',
      'list.scopeAllTitle': 'All OLL cases',
      'list.filterAria': 'Filter by status',
      'list.filterAll': 'All',
      'list.progressAria': 'Learning progress',
      'list.empty': 'No cases with this status.',
      'list.openTitle': 'Open {name} in the editor',
      'list.customTag': 'custom',
      'list.customTitle': 'Your own algorithm (saved in the editor)',
      'status.new': 'To learn',
      'status.learning': 'Learning',
      'status.learned': 'Learned',
      'status.legend.new': '{n} to learn',
      'status.legend.learning': '{n} learning',
      'status.legend.learned': '{n} learned',
      'status.badgeTitle': '{status} (click to change)',
      'status.badgeAria': '{name}: {status}. Click to change',
    },
    ja: {
      'nav.editor': 'エディタ',
      'nav.pllList': 'PLL一覧',
      'nav.ollList': 'OLL一覧',
      'common.reset': 'リセット',
      'common.prev': '‹ 前へ',
      'common.next': '次へ ›',
      'title.editor': 'Megaminx Image Editor 2.0',
      'editor.download': 'ダウンロード',
      'editor.fileName': 'ファイル名',
      'editor.imageSize': '画像サイズ (px)',
      'editor.algorithm': '手順',
      'editor.typeAlg': '手順を回した状態',
      'editor.typeCase': 'この手順で揃う状態',
      'editor.typeState': '色を直接指定',
      'editor.clear': 'クリア',
      'editor.colorPreset': '配色プリセット',
      'editor.presetStandard': '標準',
      'editor.presetOll': 'OLL（U面の色のみ）',
      'editor.presetCustom': 'カスタム',
      'editor.faceColors': '面の色',
      'editor.rotateTitle': '面の色を U（y）の向きに回す',
      'editor.flip': '上下反転',
      'editor.flipTitle': 'パズルを上下にひっくり返す（U と D が入れ替わる）',
      'editor.bodyColor': '本体の色',
      'editor.bgColor': '背景色',
      'editor.background': '背景',
      'editor.transparent': '透明',
      'editor.opaque': '不透明',
      'editor.groupAria': '{set} のグループ',
      'editor.caseAria': '{set} のケース',
      'editor.navAria': '{set} の前後へ移動',
      'myAlg.title': '自分の手順',
      'myAlg.titleFor': '{name} の自分の手順',
      'myAlg.default': '既定',
      'myAlg.custom': 'カスタム',
      'myAlg.placeholder': 'PLL か OLL のケースを選ぶと、自分の手順を保存できます',
      'myAlg.save': '保存',
      'myAlg.saved': '✓ 保存しました。',
      'myAlg.stripped': '最後の AUF・持ち替えを外しました。',
      'myAlg.setup': 'セットアップ: {setup}',
      'myAlg.resetDone': '既定の手順に戻しました。',
      'myAlg.sameAsDefault': '既定の手順と同じなので、自分の手順としては保存しませんでした。',
      'myAlg.err.empty': '手順を入力してください。',
      'myAlg.err.notSolved': 'この手順では {name} が揃いません。',
      'myAlg.err.solvesOther': 'この手順では {name} が揃いません（{other} が揃います）。',
      'state.center': '中心の色',
      'state.uFace': 'U面の色',
      'state.sideFace': '側面の色',
      // 各ステッカーのラベル（F edge・F-R corner など）は訳さない（英語のまま）
      'parse.invalid': '読めない記号があります: {move}',
      'parse.missing': '閉じ括弧 ) が足りません',
      'parse.unmatched': '対応する ( の無い ) があります',
      'title.pllList': 'PLL一覧 - Megaminx Image Editor 2.0',
      'title.ollList': 'OLL一覧 - Megaminx Image Editor 2.0',
      'list.pllHeading': 'PLL一覧',
      'list.ollHeading': 'OLL一覧',
      'list.count': '{n} ケース',
      'list.pllIntro': '画像を押すとエディタで開きます。右上の丸で覚えた度を記録できます。色はエディタの設定に合わせています。',
      'list.ollIntro': '画像を押すとエディタで開きます。右上の丸で覚えた度を記録できます。U面の色はエディタの設定に合わせています。',
      'list.downloadAll': '{set} をすべてダウンロード (.zip)',
      'list.downloadScope': '{scope} の {set} をダウンロード (.zip)',
      'list.downloadTitle': '{n} ケースを PNG で。色はこのページと同じ、画像の設定はエディタで保存したもの',
      'list.creating': '作成中… {i}/{n}',
      'list.scopeAria': '表示するケース',
      'list.scopeNd': 'No Dot',
      'list.scopeD': 'Dot',
      'list.scopeAll': 'すべて',
      'list.scopeNdTitle': 'グループ 1〜37（Dot なし）',
      'list.scopeDTitle': 'グループ 1C・38〜53（Dot）',
      'list.scopeAllTitle': 'すべての OLL',
      'list.filterAria': '覚えた度で絞り込む',
      'list.filterAll': 'すべて',
      'list.progressAria': '覚えた度の進み具合',
      'list.empty': 'この状態のケースはありません。',
      'list.openTitle': '{name} をエディタで開く',
      'list.customTag': 'カスタム',
      'list.customTitle': '自分の手順（エディタで保存したもの）',
      'status.new': '未習得',
      'status.learning': '練習中',
      'status.learned': '習得済み',
      'status.legend.new': '未習得 {n}',
      'status.legend.learning': '練習中 {n}',
      'status.legend.learned': '習得済み {n}',
      'status.badgeTitle': '{status}（押すと切り替え）',
      'status.badgeAria': '{name}: {status}。押すと切り替え',
    },
  };

  function initialLang() {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved === 'en' || saved === 'ja') return saved;
    } catch (e) {
      // 読めなければブラウザの言語
    }
    return /^ja\b/i.test(navigator.language || '') ? 'ja' : 'en';
  }

  let lang = initialLang();
  const listeners = [];

  function t(key, params) {
    const text = (DICT[lang] && DICT[lang][key]) || DICT.en[key] || key;
    return text.replace(/\{(\w+)\}/g, (m, name) => (params && params[name] != null ? String(params[name]) : m));
  }

  const ATTRS = { text: 'i18n', title: 'i18nTitle', placeholder: 'i18nPlaceholder', 'aria-label': 'i18nAriaLabel' };

  function render(el, attr) {
    const key = el.dataset[ATTRS[attr]];
    if (!key) return;
    let params;
    try {
      params = el.dataset.i18nParams ? JSON.parse(el.dataset.i18nParams) : undefined;
    } catch (e) {
      params = undefined;
    }
    const text = t(key, params);
    if (attr === 'text') el.textContent = text;
    else el.setAttribute(attr, text);
  }

  function set(el, key, params, attr) {
    const a = attr || 'text';
    el.dataset[ATTRS[a]] = key;
    if (params) el.dataset.i18nParams = JSON.stringify(params);
    render(el, a);
  }

  function apply(root) {
    const base = root || document;
    Object.keys(ATTRS).forEach((attr) => {
      const name = 'data-' + ATTRS[attr].replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());
      base.querySelectorAll('[' + name + ']').forEach((el) => render(el, attr));
    });
    document.documentElement.lang = lang;
    const titleKey = document.documentElement.dataset.i18nTitlePage;
    if (titleKey) document.title = t(titleKey);
    updateSwitch();
  }

  function setLang(next) {
    if (next !== 'en' && next !== 'ja') return;
    lang = next;
    try {
      localStorage.setItem(KEY, next);
    } catch (e) {
      // 保存できなくても切り替えは続ける
    }
    apply();
    listeners.forEach((fn) => fn(lang));
  }

  // megaminx-state.js の解析エラー（英語の文）を訳す
  function error(message) {
    const m = /^Invalid move: (.*)$/.exec(message);
    if (m) return t('parse.invalid', { move: m[1] });
    if (message === 'Missing closing parenthesis') return t('parse.missing');
    if (message === 'Unmatched ")"') return t('parse.unmatched');
    return message;
  }

  // ---- ナビバーの切り替え（EN / 日本語）----
  function buildSwitch() {
    const box = document.getElementById('langSwitch');
    if (!box) return;
    box.className = 'lang-switch';
    box.setAttribute('role', 'group');
    box.setAttribute('aria-label', 'Language / 言語');
    [
      ['en', 'EN'],
      ['ja', 'JA'],
    ].forEach(([code, label]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'lang-option';
      b.dataset.lang = code;
      b.lang = code;
      b.textContent = label;
      b.addEventListener('click', () => setLang(code));
      box.append(b);
    });
  }

  function updateSwitch() {
    document.querySelectorAll('#langSwitch [data-lang]').forEach((b) => {
      const on = b.dataset.lang === lang;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', String(on));
    });
  }

  window.I18N = {
    get lang() {
      return lang;
    },
    t: t,
    set: set,
    apply: apply,
    setLang: setLang,
    onChange: (fn) => listeners.push(fn),
    error: error,
  };

  buildSwitch();
  apply();
})();
