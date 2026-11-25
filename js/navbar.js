// ナビバー（全ページ共通）：スマホの幅ではメニューのボタンで、言語の切り替えとページへのリンクを開く・閉じる。
// 広い画面では css/common.css で1行に並べるので、ここでは何もしない。i18n.js のあと、ほかのスクリプトより先に読み込む
(function () {
  'use strict';
  // 古い URL（pll.html・index.html など）で開いたときは、アドレスバーを .html なしの URL（pll・トップは ./）に書き換える。
  // ページは読み込み直さない（GitHub Pages はどちらの URL でも同じページを返す）
  const old = location.pathname.match(/^(.*\/)(?:index|([^/]+))\.html$/);
  if (old && history.replaceState) history.replaceState(history.state, '', old[1] + (old[2] || '') + location.search + location.hash);

  // 開け閉めする欄（練習の設定・記録のバッジの一覧など）が開いているか（window.UiState）。
  //   UiState.isOpen(name)       開いているか。読み直し・戻る・進むで開いたときだけ前の状態を使い、ほかのページから来た・新しく開いたときは閉じている
  //                              （ほかのページから来たときは、残っていた前の状態を消す。そのあと開かずに読み直しても閉じたまま）
  //   UiState.setOpen(name, on)  開け閉めを残す
  // タブの中だけに残し（sessionStorage）、localStorage には保存しない（ログイン中にアカウントへ同期しないように）。
  // 同期による読み直し（cloud-sync.js。ページを開いて 1 秒ほどあと）で、開いたばかりの欄が閉じないように、読み直しでは前の状態を使う
  const UI_PREFIX = 'megaminx-image-editor:open:';
  const nav = window.performance && performance.getEntriesByType ? performance.getEntriesByType('navigation')[0] : null;
  const reopened = !!nav && (nav.type === 'reload' || nav.type === 'back_forward');
  const opened = {}; // このページで開いているか（名前ごと。最初に聞かれたときに決める）
  window.UiState = {
    isOpen(name) {
      if (!(name in opened)) {
        try {
          if (!reopened) sessionStorage.removeItem(UI_PREFIX + name); // 前に開いたときの値は使わない
          opened[name] = reopened && sessionStorage.getItem(UI_PREFIX + name) === '1';
        } catch (e) {
          opened[name] = false;
        }
      }
      return opened[name];
    },
    setOpen(name, on) {
      opened[name] = !!on;
      try {
        sessionStorage.setItem(UI_PREFIX + name, on ? '1' : '0');
      } catch (e) {
        // 残せなくても続ける（このページの中では覚えている）
      }
    },
  };

  // 画面の明るさの切り替え（js/theme.js）：言語の切り替えの隣に、同じ形（.lang-switch）でボタンを 1 つ。
  // 押すと今と反対のテーマにする（それが端末の設定と同じなら、端末の設定に合わせる状態に戻る）。
  // アイコンは押したあとのテーマ（ライトのときは月、ダークのときは太陽）。説明（title）に、今は端末の設定に合わせているか・固定かを出す
  const themeBox = document.getElementById('themeSwitch');
  if (themeBox && window.Theme && window.I18N) {
    const ICONS = {
      // 太陽
      light:
        '<circle cx="8" cy="8" r="3" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 1.2v1.6M8 13.2v1.6M1.2 8h1.6M13.2 8h1.6M3.2 3.2l1.1 1.1M11.7 11.7l1.1 1.1M3.2 12.8l1.1-1.1M11.7 4.3l1.1-1.1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
      // 月
      dark: '<path d="M13.4 10.2A5.8 5.8 0 0 1 5.8 2.6a5.8 5.8 0 1 0 7.6 7.6z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>',
    };
    const I = window.I18N;
    themeBox.className = 'lang-switch theme-switch';
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'lang-option theme-option';
    b.addEventListener('click', () => window.Theme.toggle());
    themeBox.append(b);
    const text = () => {
      const next = window.Theme.current() === 'dark' ? 'light' : 'dark';
      const state = window.Theme.get() === 'auto' ? 'theme.followingOs' : 'theme.fixed';
      return I.t('theme.title', { action: I.t(next === 'dark' ? 'theme.toDark' : 'theme.toLight'), state: I.t(state) });
    };
    const render = () => {
      const next = window.Theme.current() === 'dark' ? 'light' : 'dark';
      b.innerHTML = `<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">${ICONS[next]}</svg>`;
      I.live(b, text, 'title');
      I.live(b, text, 'aria-label');
    };
    window.Theme.onChange(render);
    render();
  }

  const toggle = document.getElementById('navToggle');
  const menu = document.getElementById('navMenu');
  if (!toggle || !menu) return;

  function setOpen(open) {
    menu.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));
  }

  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    setOpen(!menu.classList.contains('open'));
  });
  // メニューの外を押す・Esc で閉じる
  document.addEventListener('click', (e) => {
    if (menu.classList.contains('open') && !menu.contains(e.target)) setOpen(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menu.classList.contains('open')) {
      setOpen(false);
      toggle.focus();
    }
  });
})();
