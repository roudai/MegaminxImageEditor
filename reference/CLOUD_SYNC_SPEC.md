# ログインとクラウド保存の仕様

## 目的
配色・画像の設定、覚えた度、一覧の絞り込み、自分の手順、言語を、ログインしたアカウントに保存し、どの端末・ブラウザでも同じ状態で使えるようにする。
ログインしなくても今までどおりブラウザ（localStorage）だけで使える。

## 構成
- サイトは GitHub Pages（静的ページ）のまま。Firebase（Authentication + Firestore）をブラウザの JS から直接使う（SDK は gstatic の CDN から ES モジュールで読み込む。バージョン固定）
- ログイン：Google / GitHub（ポップアップ）
- 保存先：Firestore の `users/{uid}/apps/megaminx-image-editor` の1文書 `{ json, savedAt }`。`json` は下の snapshot を JSON にした文字列
- 同じ Firebase プロジェクトで、ほかのアプリ（別リポジトリの VisualCube Editor など）も同じアカウントで使う。各アプリは `users/{uid}/apps/<アプリ名>` に保存し、互いの保存先はぶつからない
  - ほかのアプリも同じ形（`{ json, savedAt }`）で保存すれば、`firestore.rules` は変えなくてよい
  - GitHub Pages の同じドメイン（`roudai.github.io`）に置くアプリは localStorage を共有するので、ほかのアプリは別のキーの頭（`megaminx-image-editor:` 以外）を使う
- `firestore.rules`：本人の `users/{uid}/apps/{アプリ名}` だけ読み書きでき、中身は `json`（50万文字未満の文字列）と `savedAt` だけ（プロジェクト共通のルール）

## 保存の窓口（`js/store.js`）
- エディタ・一覧ページの保存はすべて `Store.get(name)` / `Store.set(name, value)` を通す（localStorage のキーは `megaminx-image-editor:<name>`。今までと同じ形式なので既存のデータはそのまま読める）
- 名前：`settings`（配色・画像の設定）、`progress`（覚えた度）、`list-filter`（一覧の絞り込み）、`custom-algs`（自分の手順）、`lang`（言語）
- `set` は値が変わったときだけ、名前ごとの更新時刻（`megaminx-image-editor:updated`）を記録し、`store-change` を通知する
- `snapshot()` = `{ data: { name: value }, updated: { name: 時刻 } }`

## ログインしたときの合わせ方（`Store.resolveLogin`）
- 手元のデータがどのアカウントのものかを `megaminx-image-editor:synced-uid` に覚えておき、ログインしたときに次のように決める
  - そのアカウントのもの：下の `Store.merge`（名前ごとに新しい方）
  - まだどのアカウントとも合わせていない（ログインせずに使っていた）：`Store.merge` の union（その内容をアカウントに持ち込む）
  - 別のアカウントのもの：手元の内容は使わず、ログインしたアカウントの内容に入れ替える（アカウントが空なら初期状態）。別のアカウントの配色・覚えた度・自分の手順が混ざらないように
- ログアウトするときは、まだクラウドに書いていない変更を先に書いてからログアウトする。手元のデータはそのまま残る（持ち主もそのまま）

## 合わせ方（`Store.merge`）
- 名前ごとに更新時刻の新しい方を使う（片方にしか無い名前は残す）
- この端末で初めてそのアカウントと合わせるとき（`megaminx-image-editor:synced-uid` が違う）は、覚えた度と自分の手順をケースごとに合わせる（両方にあれば新しい方、片方にしか無いケースは残す）。2回目以降は名前ごとに新しい方をそのまま使う（片方で消したケースが戻ってこないように）

## 動き（`js/cloud-sync.js`）
- `js/firebase-config.js` の `window.FIREBASE_CONFIG` が `null`、または SDK を読み込めないときは何もしない（ログインのボタンも出さない）
- ログインしたとき・ログイン中にページを開いたとき：クラウドを読み → 手元と合わせ → 両方に書く。手元の内容が変わったらページを1回読み直して画面に反映する
- ログイン中：`store-change` を受けて 1.5 秒まとめてからクラウドに書く。ページを離れる（非表示になる）ときは待たずに書く
- 別の端末で変えた内容は、次にページを開いたときに反映される
- ログアウトしても手元のデータは消さない

## 画面（3ページ共通のナビバー）
- ログイン前：言語の切り替えの右に、人のアイコン付きの濃い色のボタン **ログイン / Sign in**（角の丸い四角。マウスを乗せると少し浮く）。押すと Google・GitHub のロゴ付きの「Google でログイン」「GitHub でログイン」のメニュー
- ログイン中：ナビバーにはアイコン（写真、無ければ名前の頭文字の丸）だけを出し、右下の小さな点で保存の状態を示す（緑＝保存済み、琥珀＝保存中で点滅、赤＝エラー。マウスを乗せると文で出る）
  - アイコンの右上に、ログインに使ったサービス（Google / GitHub）のロゴを小さく出す。マウスを乗せると「Google でログイン中 · アカウントに保存済み」のように出る
  - アイコンを押すとメニュー：大きめのアイコン・名前・メールアドレス・「（ロゴ）GitHub でログイン中」、保存の状態（失敗したときはエラーの種類も）、**ログアウト**
- ページを開いたときのちらつきを防ぐ：ログイン状態が分かるまでは「ログイン」ボタンを出さない。前回ログインしていたときは、そのアカウントのアイコン・名前・ログイン方法を `megaminx-image-editor:account-hint` に覚えておき、ログイン状態が分かる前からアイコンを出しておく（分かるまではメニューは開かない。ログアウトしたら消す）
- メニューはメニューの外を押すか Esc で閉じる。ログインできなかったときはメニューの中にエラーを出す（同じメールアドレスを別のログイン方法で使っている場合はその旨）
- 文は `js/i18n.js`（`account.*`）、見た目は `css/common.css`

## Firebase の設定手順（サイトの管理者がやる）
1. https://console.firebase.google.com/ でプロジェクトを作成（無料の Spark プランでよい）。ほかのアプリと共通にするので、名前・ID はアプリ名ではなく全体の名前にする（ID はログインのポップアップに出て、あとから変えられない）
2. 「プロジェクトの設定」→「マイアプリ」でウェブアプリを追加し（SDK は「script タグを使用する」、Firebase Hosting は使わない）、表示される `firebaseConfig` の中身を `js/firebase-config.js` の `window.FIREBASE_CONFIG` に貼る。ほかのアプリは同じプロジェクトにウェブアプリをもう1つ登録する
3. Authentication → ログイン方法
   - Google を有効にする
   - GitHub を有効にする：GitHub の Settings → Developer settings → OAuth Apps で新しいアプリを作り、Authorization callback URL に Firebase の画面に出る URL（`https://<project-id>.firebaseapp.com/__/auth/handler`）を入れる。発行された Client ID / Client Secret を Firebase に登録する
4. Authentication → 設定 → 承認済みドメインに `roudai.github.io` を追加（`localhost` は最初から入っている）
5. Firestore Database を作成し、「ルール」にリポジトリの `firestore.rules` の内容を貼って公開する
