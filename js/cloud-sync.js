// ログイン（Google / GitHub）とクラウド保存（Firebase Authentication + Firestore）。
// 3ページ共通。<script type="module"> で、ほかのスクリプトのあとに読み込む。仕様: reference/CLOUD_SYNC_SPEC.md
//   - js/firebase-config.js の window.FIREBASE_CONFIG が null なら何もしない（ログインのボタンも出さない）
//   - Firestore の users/{uid}/apps/megaminx-image-editor の1文書に、store.js の snapshot を JSON 文字列で保存する（{ json, savedAt }）
//     同じ Firebase プロジェクトのほかのアプリ（VisualCube Editor など）は users/{uid}/apps/<アプリ名> に保存し、ログインは共通
//   - ログインしたとき（ページを開いたときも）：クラウドを読み → Store.merge で手元と合わせ → 両方に書く。
//     この端末で初めてそのアカウントと合わせるときは、覚えた度・自分の手順をケースごとに合わせる（union）。
//     手元の内容が変わったら、画面に反映するためにページを1回読み直す
//   - 手元のデータがどのアカウントのものかを SYNCED_KEY に覚え、別のアカウントでログインしたときは手元の内容を持ち込まず、
//     そのアカウントの内容に入れ替える（Store.resolveLogin）
//   - ログイン中は store-change を受けて、少しまとめてからクラウドに書く。ページを離れるときはすぐ書く
//   - ログアウトしても手元のデータは消さない
//   - ログイン中はアイコンの右上に、ログインに使ったサービス（Google / GitHub）のロゴを小さく出す
const CONFIG = window.FIREBASE_CONFIG;
const Store = window.Store;
const I = window.I18N;
const box = document.getElementById('accountBox');

const SDK = 'https://www.gstatic.com/firebasejs/10.12.2';
const APP_ID = 'megaminx-image-editor'; // users/{uid}/apps/<APP_ID> に保存する
const SYNCED_KEY = 'megaminx-image-editor:synced-uid'; // この端末でクラウドと合わせたことのあるアカウント
const PUSH_DELAY = 1500;

const readLocal = (key) => {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    return null;
  }
};
const writeLocal = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    // 保存できなくても続ける
  }
};
const el = (tag, className) => {
  const e = document.createElement(tag);
  if (className) e.className = className;
  return e;
};

async function main() {
  if (!CONFIG || !box || !Store) return;
  // SDK は下で読み込む（その前に、前回ログインしていたアカウントのアイコンを先に出しておく）
  let authSdk = null;
  let dbSdk = null;
  let auth = null;
  let db = null;
  let authKnown = false; // ログイン状態が分かったか（分かるまではログインボタンを出さない）
  const providers = {
    google: () => new authSdk.GoogleAuthProvider(),
    github: () => new authSdk.GithubAuthProvider(),
  };

  // 前回ログインしていたアカウントの表示用の情報（ページを切り替えたときにボタンがちらつかないように、
  // ログイン状態が分かる前からアイコンを出しておく。ログアウトしたら消す）
  const HINT_KEY = 'megaminx-image-editor:account-hint';
  function readHint() {
    try {
      const h = JSON.parse(readLocal(HINT_KEY));
      return h && typeof h === 'object' ? h : null;
    } catch (e) {
      return null;
    }
  }
  function saveHint(u) {
    try {
      if (!u) localStorage.removeItem(HINT_KEY);
      else {
        const p = (u.providerData || []).find((d) => d.providerId) || {};
        writeLocal(HINT_KEY, JSON.stringify({ displayName: u.displayName, email: u.email, photoURL: u.photoURL, providerId: p.providerId }));
      }
    } catch (e) {
      // 保存できなくても続ける
    }
  }
  const hint = readHint();

  // pending: 前回の情報で仮に出しているあいだ（メニューは開かない）
  let user = hint
    ? { pending: true, displayName: hint.displayName, email: hint.email, photoURL: hint.photoURL, providerData: [{ providerId: hint.providerId }] }
    : null;
  let ready = false; // ログイン後の最初の合わせ込みが終わるまではクラウドに書かない
  let status = hint ? 'syncing' : 'synced'; // synced / syncing / error
  let message = '';
  let errorCode = ''; // 保存に失敗したときの Firebase のエラーコード（メニューとコンソールに出す）
  let timer = null;

  const docRef = () => dbSdk.doc(db, 'users', user.uid, 'apps', APP_ID);
  const write = (snap) => dbSdk.setDoc(docRef(), { json: JSON.stringify(snap), savedAt: dbSdk.serverTimestamp() });

  async function push() {
    timer = null;
    if (!user || !ready) return;
    setStatus('syncing');
    try {
      await write(Store.snapshot());
      setStatus('synced');
    } catch (e) {
      fail(e);
    }
  }
  const schedule = () => {
    if (!user || !ready) return;
    clearTimeout(timer);
    timer = setTimeout(push, PUSH_DELAY);
  };
  window.addEventListener('store-change', schedule);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && timer) {
      clearTimeout(timer);
      push();
    }
  });

  async function syncOnLogin() {
    setStatus('syncing');
    try {
      const got = await dbSdk.getDoc(docRef());
      let remote = null;
      if (got.exists()) {
        try {
          remote = JSON.parse(got.data().json);
        } catch (e) {
          remote = null; // 壊れていれば手元の内容で上書きする
        }
      }
      const local = Store.snapshot();
      // 手元のデータが別のアカウントのものなら持ち込まない（store.js の resolveLogin）
      const merged = Store.resolveLogin(local, remote, { owner: readLocal(SYNCED_KEY), uid: user.uid });
      const localChanged = JSON.stringify(merged.data) !== JSON.stringify(local.data);
      if (localChanged) Store.replace(merged);
      if (JSON.stringify(merged) !== JSON.stringify(remote)) await write(merged);
      writeLocal(SYNCED_KEY, user.uid);
      ready = true;
      setStatus('synced');
      if (localChanged) location.reload(); // クラウドの内容を画面に反映する
    } catch (e) {
      fail(e);
    }
  }

  function fail(e) {
    errorCode = (e && (e.code || e.message)) || 'unknown';
    console.warn('[cloud-sync] could not save to the account:', e);
    setStatus('error');
  }

  // ログアウトの前に、まだクラウドに書いていない変更を書いておく
  async function signOutNow() {
    if (timer) {
      clearTimeout(timer);
      await push();
    }
    await authSdk.signOut(auth);
  }

  async function signIn(key) {
    message = '';
    try {
      await authSdk.signInWithPopup(auth, providers[key]());
    } catch (e) {
      if (e && e.code === 'auth/popup-closed-by-user') return;
      message = e && e.code === 'auth/account-exists-with-different-credential' ? 'account.otherProvider' : 'account.signInFailed';
      menuOpen = true; // メニューの中にエラーを出す
      render();
    }
  }

  function setStatus(next) {
    status = next;
    render();
  }

  // ---- ナビバーの表示 ----
  // ログイン前：人のアイコン付きの丸いボタン → Google / GitHub のロゴ付きのメニュー
  // ログイン中：アイコン（写真か頭文字）だけを出し、右下の小さな点で保存の状態を示す → 押すと名前・状態・ログアウトのメニュー
  let menuOpen = false;
  const svg = (markup) => {
    const span = el('span', 'account-icon');
    span.setAttribute('aria-hidden', 'true');
    span.innerHTML = markup;
    return span;
  };
  const ICON_PERSON =
    '<svg viewBox="0 0 16 16" width="14" height="14"><circle cx="8" cy="5.2" r="2.9" fill="none" stroke="currentColor" stroke-width="1.4"/>' +
    '<path d="M2.6 14c.6-2.9 2.8-4.4 5.4-4.4s4.8 1.5 5.4 4.4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';
  const ICON_GOOGLE =
    '<svg viewBox="0 0 18 18" width="16" height="16"><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"/>' +
    '<path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"/>' +
    '<path fill="#FBBC05" d="M3.97 10.72A5.41 5.41 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33z"/>' +
    '<path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"/></svg>';
  const ICON_GITHUB =
    '<svg viewBox="0 0 16 16" width="16" height="16"><path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>';

  // ログインに使ったサービス（Google / GitHub）
  const PROVIDERS = {
    'google.com': { name: 'Google', icon: ICON_GOOGLE },
    'github.com': { name: 'GitHub', icon: ICON_GITHUB },
  };
  function providerOf(u) {
    const p = (u.providerData || []).find((d) => PROVIDERS[d.providerId]);
    return p ? PROVIDERS[p.providerId] : null;
  }

  // 写真が無ければ名前の頭文字の丸
  function avatar(size) {
    const wrap = el('span', 'account-avatar');
    wrap.style.width = wrap.style.height = size + 'px';
    if (user.photoURL) {
      const img = el('img');
      img.src = user.photoURL;
      img.alt = '';
      img.referrerPolicy = 'no-referrer';
      wrap.append(img);
    } else {
      wrap.textContent = (user.displayName || user.email || '?').trim().charAt(0).toUpperCase();
      wrap.style.fontSize = Math.round(size * 0.45) + 'px';
    }
    return wrap;
  }

  function toggle(e) {
    e.stopPropagation();
    if (user && user.pending) return; // ログイン状態が分かるまではメニューを開かない
    menuOpen = !menuOpen;
    render();
  }

  function menuItem(icon, labelKey, onClick, className) {
    const b = el('button', 'account-menu-item' + (className ? ' ' + className : ''));
    b.type = 'button';
    if (icon) b.append(svg(icon));
    const label = el('span');
    I.set(label, labelKey);
    b.append(label);
    b.addEventListener('click', () => {
      menuOpen = false;
      render();
      onClick();
    });
    return b;
  }

  function render() {
    box.replaceChildren();
    box.className = 'account-box';
    if (!user && !authKnown) return; // ログイン状態が分かるまでは何も出さない（ログインボタンが一瞬出ないように）
    const menu = el('div', 'account-menu');
    menu.hidden = !menuOpen;

    if (!user) {
      const button = el('button', 'account-signin');
      button.type = 'button';
      button.setAttribute('aria-expanded', String(menuOpen));
      button.setAttribute('aria-haspopup', 'true');
      const label = el('span');
      I.set(label, 'account.signIn');
      button.append(svg(ICON_PERSON), label);
      button.addEventListener('click', toggle);
      menu.append(
        menuItem(ICON_GOOGLE, 'account.withGoogle', () => signIn('google')),
        menuItem(ICON_GITHUB, 'account.withGithub', () => signIn('github'))
      );
      if (message) {
        const m = el('div', 'account-menu-message');
        I.set(m, message);
        menu.append(m);
      }
      box.append(button, menu);
      return;
    }

    const button = el('button', 'account-avatar-button');
    button.type = 'button';
    button.setAttribute('aria-expanded', String(menuOpen));
    button.setAttribute('aria-haspopup', 'true');
    I.set(button, 'account.menuLabel', { name: user.displayName || user.email || '' }, 'aria-label');
    const dot = el('span', `sync-dot ${status}`);
    const provider = providerOf(user);
    // マウスを乗せると「Google でログイン中 · アカウントに保存済み」のように出す
    button.title = (provider ? I.t('account.via', { provider: provider.name }) + ' · ' : '') + I.t('account.' + status);
    button.append(avatar(26), dot);
    if (provider) {
      const mark = svg(provider.icon);
      mark.classList.add('account-provider-badge');
      button.append(mark);
    }
    button.addEventListener('click', toggle);

    const head = el('div', 'account-menu-head');
    const who = el('div', 'account-menu-who');
    const name = el('div', 'account-menu-name');
    name.textContent = user.displayName || '';
    const email = el('div', 'account-menu-email');
    email.textContent = user.email || '';
    who.append(name, email);
    if (provider) {
      const via = el('div', 'account-menu-via');
      const text = el('span');
      I.set(text, 'account.via', { provider: provider.name });
      via.append(svg(provider.icon), text);
      who.append(via);
    }
    head.append(avatar(36), who);
    const state = el('div', 'account-menu-status');
    const stateText = el('span');
    I.set(stateText, 'account.' + status);
    state.append(el('span', `sync-dot inline ${status}`), stateText);
    if (status === 'error' && errorCode) {
      const code = el('span', 'account-menu-code');
      code.textContent = errorCode.replace(/^firestore\//, '');
      state.append(code);
    }
    menu.append(head, state, el('div', 'account-menu-divider'), menuItem(null, 'account.signOut', signOutNow, 'signout'));
    box.append(button, menu);
  }
  document.addEventListener('click', (e) => {
    if (menuOpen && !box.contains(e.target)) {
      menuOpen = false;
      render();
    }
  });
  I.onChange(() => render()); // 言語を切り替えたらツールチップなども作り直す
  document.addEventListener('keydown', (e) => {
    if (menuOpen && e.key === 'Escape') {
      menuOpen = false;
      render();
    }
  });

  render(); // 前回ログインしていたならアイコンを先に出す

  const [appSdk, authModule, dbModule] = await Promise.all([
    import(`${SDK}/firebase-app.js`),
    import(`${SDK}/firebase-auth.js`),
    import(`${SDK}/firebase-firestore.js`),
  ]);
  authSdk = authModule;
  dbSdk = dbModule;
  const app = appSdk.initializeApp(CONFIG);
  auth = authSdk.getAuth(app);
  db = dbSdk.getFirestore(app);

  authSdk.onAuthStateChanged(auth, (next) => {
    authKnown = true;
    user = next;
    ready = false;
    saveHint(next);
    render();
    if (user) syncOnLogin();
  });
}

main().catch(() => {
  // 読み込めなければ（オフラインなど）ログインのボタンを出さずに今までどおり動く
  if (box) box.replaceChildren();
});
