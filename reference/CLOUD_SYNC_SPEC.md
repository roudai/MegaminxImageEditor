# ログインとクラウド保存の仕様

## 目的
配色・画像の設定、覚えた度、一覧の絞り込み、自分の手順、言語を、ログインしたアカウントに保存し、どの端末・ブラウザでも同じ状態で使えるようにする。
ログインしなくても今までどおりブラウザ（localStorage）だけで使える。

## 構成
- サイトは GitHub Pages（静的ページ）のまま。Firebase（Authentication + Firestore）をブラウザの JS から直接使う（SDK は gstatic の CDN から ES モジュールで読み込む。バージョン固定）
- ログイン：Google / Facebook / GitHub（ポップアップ。メニューもこの順）
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
- ログイン前：言語の切り替えの右に、人のアイコン付きの濃い色のボタン **ログイン / Sign in**（角の丸い四角。マウスを乗せると少し浮く）。押すと Google・Facebook・GitHub のロゴ付きの「Google でログイン」「Facebook でログイン」「GitHub でログイン」のメニュー（よく使われる順）
- ログイン中：ナビバーにはアイコン（写真、無ければ名前の頭文字の丸）だけを出し、右下の小さな点で保存の状態を示す（緑＝保存済み、琥珀＝保存中で点滅、赤＝エラー。マウスを乗せると文で出る）
  - アイコンの右上に、ログインに使ったサービス（Google / GitHub / Facebook）のロゴを小さく出す。マウスを乗せると「Google でログイン中 · アカウントに保存済み」のように出る
  - アイコンを押すとメニュー：大きめのアイコン・名前・メールアドレス・「（ロゴ）GitHub でログイン中」、保存の状態（失敗したときはエラーの種類も）、**ログアウト**
- Facebook のプロフィール写真：Firebase が受け取る写真の URL はアクセストークンが無いと Facebook の既定の人型になるので、そのままは使わない。Facebook でログインした直後に、そのときのトークンで Graph API（`/me/picture`）から本人の写真の URL を受け取り、Firebase のプロフィールに保存する（トークンは保存しない）。写真の URL は Facebook 側で期限が切れるので、読めなくなったら頭文字の丸にする（次に Facebook でログインしたときに更新される）
- ページを開いたときのちらつきを防ぐ：ログイン状態が分かるまでは「ログイン」ボタンを出さない。前回ログインしていたときは、そのアカウントのアイコン・名前・ログイン方法を `megaminx-image-editor:account-hint` に覚えておき、ログイン状態が分かる前からアイコンを出しておく（分かるまではメニューは開かない。ログアウトしたら消す）
- メニューはメニューの外を押すか Esc で閉じる。ログインできなかったときはメニューの中にエラーを出す（同じメールアドレスを別のログイン方法で使っている場合はその旨）
- 文は `js/i18n.js`（`account.*`）、見た目は `css/common.css`

## プライバシーポリシーとデータの削除（`privacy.html`・`js/privacy.js`）
- 保存する情報には、練習の記録（タイム・日時・ケース・判定、通しのスクランブルとペナルティ）と練習の設定も含める。ブラウザへの保存の項には、ログイン中にアカウントの名前・メールアドレス・写真の URL・ログイン方法をブラウザに覚えること（ログアウトで消す）を書く
- 本文は日本語・英語の両方を HTML に書き、言語の切り替えに合わせて片方を出す（ログインで受け取る情報・保存する情報・使い方・保存先・削除の方法・問い合わせ先＝GitHub の Issues。運営は roudai.net）
- ナビバーのログインのメニューからリンクする：ログイン前は「ログイン」ボタンのメニュー、ログイン中はアイコンのメニューの「プライバシーポリシー」（データの削除はページの一番下）。Facebook のアプリの「プライバシーポリシーの URL」「データ削除の手順の URL」にこのページを登録する
- 「アカウントのデータを削除」（ログイン中だけ押せる）：押すと確認の文と「削除する」「キャンセル」を出し、「削除する」で削除する（ブラウザの確認ダイアログは使わない）
  - `CloudSync.deleteAccount()`：`users/{uid}/apps` の下の全アプリの文書を消し、ログインのアカウントも消す。しばらく前にログインした場合は Firebase が再ログインを求めるので、ログインしたときと同じサービスでもう一度ログインしてもらってから消す
  - ブラウザに保存された設定は残す（この端末とアカウントの結び付き `synced-uid`・アイコンの情報 `account-hint` は消す）
- `firestore.rules`：本人は自分の文書を削除できる（`allow delete`）

## 利用規約（`terms.html`）
- 本文は日本語・英語（言語の切り替えは `js/legal.js`。プライバシーポリシーと共通）。制定日・運営（roudai.net）・問い合わせ（GitHub の Issues）はプライバシーポリシーと同じ
- 内容：適用、無料、アカウント（各サービスの規約にも従う）、禁止事項、作った画像は自由に使える、無保証・免責（故意・重大な過失を除く。データの控えを CSV などで）、予告なしの変更・停止・終了、規約の変更、準拠法（日本法）、個人情報はプライバシーポリシー
- ログインのメニュー（ログイン前・ログイン中とも）の「プライバシーポリシー」の下に「利用規約」。プライバシーポリシーの本文の最後からもリンク

## Firebase の設定手順（サイトの管理者がやる）
1. https://console.firebase.google.com/ でプロジェクトを作成（無料の Spark プランでよい）。ほかのアプリと共通にするので、名前・ID はアプリ名ではなく全体の名前にする（ID はログインのポップアップに出て、あとから変えられない）
2. 「プロジェクトの設定」→「マイアプリ」でウェブアプリを追加し（SDK は「script タグを使用する」、Firebase Hosting は使わない）、表示される `firebaseConfig` の中身を `js/firebase-config.js` の `window.FIREBASE_CONFIG` に貼る。ほかのアプリは同じプロジェクトにウェブアプリをもう1つ登録する
3. Authentication → ログイン方法
   - Google を有効にする
   - GitHub を有効にする：GitHub の Settings → Developer settings → OAuth Apps で新しいアプリを作り、Authorization callback URL に Firebase の画面に出る URL（`https://<project-id>.firebaseapp.com/__/auth/handler`）を入れる。発行された Client ID / Client Secret を Firebase に登録する
   - Facebook を有効にする：https://developers.facebook.com/ でアプリを作り（ユースケースは「Facebook ログインでユーザーを認証」）、アプリ ID / app secret を Firebase に登録する。Facebook ログインの設定の「有効な OAuth リダイレクト URI」に Firebase の画面に出る URL（`https://<project-id>.firebaseapp.com/__/auth/handler`）を入れる。一般の人がログインできるようにするにはアプリを「ライブ」にする（プライバシーポリシーの URL などが必要）
4. Authentication → 設定 → 承認済みドメインに `roudai.github.io` を追加（`localhost` は最初から入っている）
5. Firestore Database を作成し、「ルール」にリポジトリの `firestore.rules` の内容を貼って公開する

## 公開するときにやること（未対応）
GitHub Pages（master）に公開するときに、あわせて次を行う。Facebook のアプリは今は開発モードなので、このままでは管理者・テスター以外は Facebook でログインできない。
1. Facebook アプリ → 「アプリの設定」→「ベーシック」
   - アプリドメイン：`roudai.github.io`
   - プライバシーポリシーの URL：`https://roudai.github.io/MegaminxImageEditor/privacy.html`
   - ユーザーデータの削除：「データ削除の手順の URL」に `https://roudai.github.io/MegaminxImageEditor/privacy.html#delete`
   - 利用規約の URL（任意）：`https://roudai.github.io/MegaminxImageEditor/terms.html`
   - アプリアイコン（1024×1024）・カテゴリ・連絡先メールアドレス
   - 「プラットフォームを追加」→ ウェブサイト：`https://roudai.github.io/MegaminxImageEditor/`
2. 左のメニューの「公開」から、アプリをライブにする（`public_profile`・`email` だけなので、ふつうはアプリレビューは不要）
3. 管理者ではない Facebook アカウントで、公開中のサイトからログインできるか確かめる
4. Firebase の承認済みドメインに `roudai.github.io` があるか、Firestore のルールが最新か確かめる

