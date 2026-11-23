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
