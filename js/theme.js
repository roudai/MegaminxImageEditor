/*
 * 画面の明るさ（テーマ）：ライト・ダーク。既定は OS の設定に合わせる（自動）。仕様: reference/SITE_SPEC.md「テーマ」
 * 各ページの <head> で、ふつうの <script> として読む（描く前に <html> の data-bs-theme を決めて、白く光らないように）。
 *
 * 切り替えはボタン 1 つ（js/navbar.js）：押すと今と反対のテーマにする。選んだテーマが OS と同じなら、保存を消して
 * 自動に戻す（自動のボタンを置かずに、OS に合わせる状態へ戻れるように）。OS の側が変わって、選んだテーマと同じに
 * なったときも自動に戻す（例：昼にダークを選び、夜に OS がダークになったら、翌朝は OS に合わせてライトに戻る）。
 *
 *   Theme.MODES                     ['auto', 'light', 'dark']（保存の値。auto は保存しない）
 *   Theme.resolve(mode, osDark)     実際に使うテーマ 'light' | 'dark'（auto なら osDark で決める。知らない値は auto と同じ）
 *   Theme.toggled(mode, osDark)     ボタンを押したあとの mode（今と反対のテーマ。それが OS と同じなら 'auto'）
 *   Theme.followOs(mode, osDark)    OS の設定が変わったあとの mode（選んだテーマが OS と同じになったら 'auto'）
 *   Theme.get()                     保存している mode（無ければ 'auto'）
 *   Theme.current()                 今のテーマ 'light' | 'dark'
 *   Theme.toggle()                  ボタンを押したとき：toggled の mode を保存して、すぐ付け直す
 *   Theme.onChange(fn)              テーマや mode が変わったときに呼ぶ関数を登録する（fn(mode, theme)）
 *
 * 保存は localStorage の 'megaminx-image-editor:theme'。store.js の NAMES には入れない（アカウントに同期しない。
 * 見る端末の都合なので端末ごと。cloud-sync.js の読み込みでも消えない）。別のタブで変えたら storage イベントで合わせる。
 * ブラウザでは window.Theme、node では module.exports として公開する。
 */
(function (root, factory) {
  const api = factory(typeof window !== 'undefined' ? window : null);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Theme = api;
})(typeof self !== 'undefined' ? self : this, function (win) {
  'use strict';

  const MODES = ['auto', 'light', 'dark'];
  const KEY = 'megaminx-image-editor:theme';

  function resolve(mode, osDark) {
    if (mode === 'light' || mode === 'dark') return mode;
    return osDark ? 'dark' : 'light';
  }
  const osTheme = (osDark) => (osDark ? 'dark' : 'light');

  function toggled(mode, osDark) {
    const next = resolve(mode, osDark) === 'dark' ? 'light' : 'dark';
    return next === osTheme(osDark) ? 'auto' : next;
  }

  function followOs(mode, osDark) {
    return resolve(mode, osDark) === osTheme(osDark) ? 'auto' : mode;
  }

  const pure = { MODES: MODES, resolve: resolve, toggled: toggled, followOs: followOs };
  if (!win) return pure;

  const media = win.matchMedia ? win.matchMedia('(prefers-color-scheme: dark)') : null;
  const osDark = () => !!(media && media.matches);
  const listeners = [];
  let unsaved = null; // 保存できなかったときの mode（このページの中だけ）

  function get() {
    try {
      const v = win.localStorage.getItem(KEY);
      return MODES.includes(v) ? v : 'auto';
    } catch (e) {
      return unsaved || 'auto';
    }
  }

  function save(mode) {
    try {
      if (mode === 'auto') win.localStorage.removeItem(KEY);
      else win.localStorage.setItem(KEY, mode);
    } catch (e) {
      unsaved = mode; // 保存できなくても、このページでは切り替える
    }
  }

  const current = () => resolve(get(), osDark());

  function apply() {
    const mode = get();
    const theme = resolve(mode, osDark());
    win.document.documentElement.setAttribute('data-bs-theme', theme);
    listeners.forEach((fn) => fn(mode, theme));
  }

  function toggle() {
    save(toggled(get(), osDark()));
    apply();
  }

  function osChanged() {
    const mode = get();
    const next = followOs(mode, osDark());
    if (next !== mode) save(next);
    apply();
  }

  if (media) {
    if (media.addEventListener) media.addEventListener('change', osChanged);
    else if (media.addListener) media.addListener(osChanged);
  }
  win.addEventListener('storage', (e) => {
    if (e.key === KEY || e.key === null) apply();
  });
  // 開いたとき：閉じている間に OS が変わって、選んだテーマと同じになっていたら自動に戻す
  osChanged();

  return Object.assign(pure, { get: get, current: current, toggle: toggle, onChange: (fn) => listeners.push(fn) });
});
