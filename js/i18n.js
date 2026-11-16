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
 * 言語は store.js の 'lang'（localStorage 'megaminx-image-editor:lang'）に保存する。無ければブラウザの言語（ja なら日本語、それ以外は英語）。
 * ナビバーの #langSwitch に EN / 日本語 の切り替えを作る。
 */
(function () {
  'use strict';


  const DICT = {
    en: {
      // ナビバー・共通
      'nav.editor': 'Editor',
      'nav.menu': 'Menu',
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
      'myAlg.default': 'default',
      'myAlg.custom': 'custom',
      'myAlg.save': 'Save',
      'myAlg.resetToDefault': 'Reset to default',
      'myAlg.edited': 'edited',
      'myAlg.caseOnly': 'Switch to "Algorithm to solve case" to save your own algorithm',
      'myAlg.saved': '✓ Saved.',
      'myAlg.stripped': 'Removed the final AUF / rotation.',
      'myAlg.setup': 'Setup: {setup}',
      'myAlg.resetDone': 'Reset to the default algorithm.',
      'myAlg.undo': 'Undo',
      'myAlg.undone': 'Undone.',
      'myAlg.sameAsDefault': 'Same as the default algorithm.',
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
      // ログイン・クラウド保存（cloud-sync.js）
      'account.signIn': 'Sign in',
      'account.signOut': 'Sign out',
      'account.privacyPolicy': 'Privacy policy',
      // 練習（practice.html・practice.js）
      'nav.practice': 'Practice',
      'title.practice': 'Practice - Megaminx Image Editor 2.0',
      'practice.heading': 'Practice',
      'practice.scramble': 'Scramble',
      'practice.hint': 'Space to start, any key to stop (tap on phones)',
      'practice.dnf': "Couldn't solve",
      'practice.skip': 'Skip',
      'practice.hintButton': 'Hint',
      'practice.hintHide': 'Hide hint',
      'practice.verdict.hint': 'You used a hint — marked as learning',
      'practice.empty': 'No cases match. Change the target.',
      'practice.target': 'Target',
      'practice.groups': 'Groups',
      'practice.groupsAll': 'All groups',
      'practice.groupsHelp': 'Only the selected groups are practiced (all groups if none is selected).',
      'practice.groupsClear': 'Clear selection',
      'practice.threshold': 'Learned within',
      'practice.seconds': '{n}s',
      'practice.customSeconds': 'Seconds to count as learned',
      'practice.verdict.learned': '✓ Marked as learned (within {t}s)',
      'practice.verdict.learning': 'Marked as learning (over {t}s)',
      'practice.verdict.dnf': "Couldn't solve — marked as learning",
      'practice.undo': 'Undo',
      'practice.undone': 'Undone.',
      'practice.caseStats': 'Recent: best {best} / average {avg} ({n} solves)',
      'practice.history': 'Recent results',
      'practice.listButton': 'Practice',
      'practice.listButtonTitle': 'Practice the cases shown here with a timer',
      // 記録（stats.html・stats.js）
      'nav.stats': 'Stats',
      'title.stats': 'Stats - Megaminx Image Editor 2.0',
      'practice.allStats': 'See all stats',
      'stats.heading': 'Stats',
      'stats.days': '{n} days',
      'stats.allTime': 'All time',
      'stats.count': 'Solves',
      'stats.average': 'Average (s)',
      'stats.best': 'Best {t}',
      'stats.dnf': "Couldn't solve",
      'stats.learned': 'Learned',
      'stats.daily': 'Daily practice',
      'stats.tooltip': '{n} solves · average {avg}s',
      'stats.legendCount': 'Solves',
      'stats.legendAvg': 'Average time',
      'stats.byCase': 'By case',
      'stats.csv': 'Export CSV',
      'stats.empty': 'No records yet. Practice on the practice page and your results will appear here.',
      'stats.col.case': 'Case',
      'stats.col.group': 'Group',
      'stats.col.status': 'Status',
      'stats.col.count': 'Solves',
      'stats.col.best': 'Best',
      'stats.col.avg': 'Average',
      'stats.col.last': 'Last',
      'stats.practiceThis': 'Practice {name}',
      // プライバシーポリシー（privacy.html・privacy.js）
      'title.privacy': 'Privacy Policy - Megaminx Image Editor 2.0',
      'privacy.deleteTitle': 'Delete my account data',
      'privacy.checking': 'Checking your sign-in status…',
      'privacy.unavailable': 'Sign-in is not available right now.',
      'privacy.signInFirst': 'Sign in (top right) with the account whose data you want to delete.',
      'privacy.signedInAs': 'Signed in as {name}. Your saved data and sign-in account will be permanently deleted.',
      'privacy.deleteButton': 'Delete my account data',
      'privacy.confirm': 'Are you sure? This cannot be undone.',
      'privacy.deleteConfirm': 'Delete',
      'privacy.cancel': 'Cancel',
      'privacy.deleting': 'Deleting…',
      'privacy.deleted': 'Your account data has been deleted.',
      'privacy.reauthCancelled': 'Deletion was cancelled. To delete, please sign in again when asked.',
      'privacy.failed': 'Could not delete your data ({code}). Please try again or contact us.',
      'account.menuLabel': 'Account: {name}',
      'account.via': 'Signed in with {provider}',
      'account.withGoogle': 'Sign in with Google',
      'account.withGithub': 'Sign in with GitHub',
      'account.withFacebook': 'Sign in with Facebook',
      'account.synced': 'Saved to your account',
      'account.syncing': 'Saving…',
      'account.error': 'Could not save to your account',
      'account.signInFailed': 'Could not sign in. Please try again.',
      'account.otherProvider': 'This email is already used with another sign-in method. Sign in with that one.',
    },
    ja: {
      'nav.editor': 'エディタ',
      'nav.menu': 'メニュー',
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
      'myAlg.default': '既定',
      'myAlg.custom': 'カスタム',
      'myAlg.save': '保存',
      'myAlg.resetToDefault': '既定に戻す',
      'myAlg.edited': '編集中',
      'myAlg.caseOnly': '「この手順で揃う状態」に切り替えると、自分の手順として保存できます',
      'myAlg.saved': '✓ 保存しました。',
      'myAlg.stripped': '最後の AUF・持ち替えを外しました。',
      'myAlg.setup': 'セットアップ: {setup}',
      'myAlg.resetDone': '既定の手順に戻しました。',
      'myAlg.undo': '元に戻す',
      'myAlg.undone': '元に戻しました。',
      'myAlg.sameAsDefault': '既定の手順と同じです。',
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
      'account.signIn': 'ログイン',
      'account.signOut': 'ログアウト',
      'account.privacyPolicy': 'プライバシーポリシー',
      'nav.practice': '練習',
      'title.practice': '練習 - Megaminx Image Editor 2.0',
      'practice.heading': '練習',
      'practice.scramble': 'スクランブル',
      'practice.hint': 'スペースでスタート、任意のキーでストップ（スマホはタップ）',
      'practice.dnf': '解けなかった',
      'practice.skip': 'スキップ',
      'practice.hintButton': 'ヒント',
      'practice.hintHide': 'ヒントを隠す',
      'practice.verdict.hint': 'ヒントを見たので練習中にしました',
      'practice.empty': '対象のケースがありません。対象を変えてください。',
      'practice.target': '対象',
      'practice.groups': 'グループ',
      'practice.groupsAll': 'すべてのグループ',
      'practice.groupsHelp': '選んだグループだけを出題します（選んでいなければすべて）。',
      'practice.groupsClear': '選択を解除',
      'practice.threshold': '習得の目安',
      'practice.seconds': '{n}秒',
      'practice.customSeconds': '習得とみなす秒数',
      'practice.verdict.learned': '✓ 習得済みにしました（目安 {t} 秒以内）',
      'practice.verdict.learning': '練習中にしました（目安 {t} 秒を超えました）',
      'practice.verdict.dnf': '解けなかったので練習中にしました',
      'practice.undo': '取り消す',
      'practice.undone': '取り消しました。',
      'practice.caseStats': '最近：ベスト {best} / 平均 {avg}（{n} 回）',
      'practice.history': '直近の記録',
      'practice.listButton': '練習する',
      'practice.listButtonTitle': 'ここに表示しているケースをタイマーで練習する',
      'nav.stats': '記録',
      'title.stats': '記録 - Megaminx Image Editor 2.0',
      'practice.allStats': 'すべての記録を見る',
      'stats.heading': '記録',
      'stats.days': '{n}日',
      'stats.allTime': 'すべて',
      'stats.count': '練習回数',
      'stats.average': '平均（秒）',
      'stats.best': 'ベスト {t}',
      'stats.dnf': '解けなかった',
      'stats.learned': '習得済み',
      'stats.daily': '日ごとの練習',
      'stats.tooltip': '{n} 回 · 平均 {avg} 秒',
      'stats.legendCount': '回数',
      'stats.legendAvg': '平均タイム',
      'stats.byCase': 'ケースごと',
      'stats.csv': 'CSV で書き出す',
      'stats.empty': 'まだ記録がありません。練習ページで練習すると、ここに記録が出ます。',
      'stats.col.case': 'ケース',
      'stats.col.group': 'グループ',
      'stats.col.status': '覚えた度',
      'stats.col.count': '回数',
      'stats.col.best': 'ベスト',
      'stats.col.avg': '平均',
      'stats.col.last': '最後に練習',
      'stats.practiceThis': '{name} を練習する',
      'title.privacy': 'プライバシーポリシー - Megaminx Image Editor 2.0',
      'privacy.deleteTitle': 'アカウントのデータを削除',
      'privacy.checking': 'ログインの状態を確認しています…',
      'privacy.unavailable': '今はログインの機能を使えません。',
      'privacy.signInFirst': '削除したいアカウントで、右上からログインしてください。',
      'privacy.signedInAs': '{name} でログイン中です。保存した内容とログインのアカウントが完全に削除されます。',
      'privacy.deleteButton': 'アカウントのデータを削除',
      'privacy.confirm': '本当に削除しますか？元に戻すことはできません。',
      'privacy.deleteConfirm': '削除する',
      'privacy.cancel': 'キャンセル',
      'privacy.deleting': '削除しています…',
      'privacy.deleted': 'アカウントのデータを削除しました。',
      'privacy.reauthCancelled': '削除を中止しました。削除するには、求められたときにもう一度ログインしてください。',
      'privacy.failed': '削除できませんでした（{code}）。もう一度お試しいただくか、お問い合わせください。',
      'account.menuLabel': 'アカウント: {name}',
      'account.via': '{provider} でログイン中',
      'account.withGoogle': 'Google でログイン',
      'account.withGithub': 'GitHub でログイン',
      'account.withFacebook': 'Facebook でログイン',
      'account.synced': 'アカウントに保存済み',
      'account.syncing': '保存中…',
      'account.error': 'アカウントに保存できませんでした',
      'account.signInFailed': 'ログインできませんでした。もう一度お試しください。',
      'account.otherProvider': 'このメールアドレスは別のログイン方法で使われています。そちらでログインしてください。',
    },
  };

  function initialLang() {
    const saved = window.Store ? window.Store.get('lang') : null;
    if (saved === 'en' || saved === 'ja') return saved;
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
    if (window.Store) window.Store.set('lang', next);
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
