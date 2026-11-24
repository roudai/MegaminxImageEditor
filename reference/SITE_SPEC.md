# サイト全体（URL・公開・ローカルでの確認）

## URL（.html を付けない）
- 公開は GitHub Pages（`https://roudai.github.io/MegaminxImageEditor/`）。GitHub Pages は `/pll` で `pll.html` を返すので、ページへのリンクには `.html` を付けない
  - トップ（エディタ）：`./`（`index.html` とは書かない）。ケースを指定するときは `./?pll=<名前>`
  - ほかのページ：`pll`・`oll`・`practice`・`stats`・`guide`・`privacy`・`terms`（クエリ・`#` はそのまま。例：`practice?set=oll`、`privacy#delete`）
  - ページはすべてルート直下に置く（相対パスの `css/`・`js/` がどの URL でもそのまま使えるように）
- 古い URL（`pll.html`・`index.html` など）で開いても同じページが出る。そのときは `js/navbar.js` が読み込み直さずにアドレスバーを `.html` なしの URL に書き換える
- ページと同じ名前のフォルダをルートに置かない（`/pll` が `pll/` フォルダの方を見てしまうため）。元データは `data/pll/`・`data/oll/` に置く（ページからは読まない。`tools/build-*-data.js` が `js/` のファイルを作るときに使う）

## ページを開いたときのちらつきを防ぐ
- どのページも JS を `<body>` の最後で順に読み込むので、JS を取りに行くあいだに、英語の仮の文字（`data-i18n` の中身）や空の一覧が一度描かれてちらつく（公開先では JS ごとに通信があるので目立つ）
- そこで、JS で中身を作り終えるまでページを見せない：各ページの `<head>`（`css/common.css` の前）の短い script が `<html>` に `booting` を付け、`DOMContentLoaded`（body の最後のスクリプトと `cloud-sync.js` の最初の同期の部分を実行したあと。Firebase の SDK は `import()` で後から読むので待たない）で外す。極端に遅いときも 3 秒で外す
  - `css/common.css` の `html.booting body { visibility: hidden }`。`display: none` にしないのは、隠している間もレイアウトを計算して、記録のページのグラフの幅などを正しく測れるようにするため
  - ページを移るときは、見えない間は前のページが残る（ブラウザの paint holding）ので、白い画面もはさまらない
  - JS が無効なら `booting` が付かないので、そのまま見える
- 新しいページを作るときも、`<head>` に同じ script を入れる

## スマホでの拡大
- ダブルタップでの拡大は止める（`css/common.css` の `html { touch-action: manipulation; }`）。前へ・次へや手順のボタン、一覧のバッジなどを続けて押したときに拡大しないように。`touch-action` は祖先と重なって効くので、記録のページのグラフの `pan-y` / `none`・練習のタイマーの指定はそのまま効く
- ピンチでの拡大は止めない（拡大して見たい人のため。iPhone の Safari は `user-scalable=no` を無視するので、viewport にも書かない）
- iPhone では文字が 16px より小さい入力欄・プルダウンを押すと勝手に拡大するので、タッチの端末（`@media (pointer: coarse)`）では小さい欄も 16px にする：記録のページの並べ替え（スマホのとき）・ページ送りのプルダウン（`css/stats.css`）、ログインできなかったときの URL の欄（`.account-url-field`。`css/common.css`）。新しく小さい欄（`-sm` など）を作るときも同じようにする

## ローカルでの確認
- `node tools/serve.js`（ポートを変えるなら `node tools/serve.js 8080`）→ `http://localhost:8765/`
  - GitHub Pages と同じく `.html` なしの URL で各ページを返す（`python3 -m http.server` は `/pll` を返せないので使わない）
- テストデータで動かす：`node tools/serve.js --demo`（既定のポート 8766）→ `http://localhost:8766/stats`
  - 練習の記録（PLL 約 290 件・OLL 約 190 件・ソルブ約 210 件。PLL は過去 45 日、OLL は 30 日、ソルブは 60 日ぶん）・ケースごとの最近のタイム・習得状況を入れた状態で開く（`tools/demo-data.js`。乱数の種は固定）
  - ページを開いたときに、まだ入れていなければ入れる（印は localStorage の `megaminx-image-editor:demo-seeded`。値は `demo@版:日時` / `max@版:日時`）。`/__demo/reset` でこのサイトの保存をすべて消して入れ直す。同じポートで `--max` の有無を変えて起動し直したときも、保存を消して入れ直す。版はデータを作るのに使ったファイル（`tools/demo-data.js` と、それが読み込む `js/` のファイル）の中身から起動したときに決め、変わっていれば（作り方や手順の確かめ方を直して起動し直したら）次に開いたときに保存を消して入れ直す（そのポートで変えた習得状況なども消える。古いデータで確かめてしまわないように）
  - ログインは使えなくする（`js/firebase-config.js` の代わりに `FIREBASE_CONFIG = null` を返す）。テストデータがアカウントに送られないように。ポートも普段と分けるので、普段の保存とは混ざらない
  - 画面の右下に「テストデータ（ログインしている扱い） · 入れ直す」を出す（称号とバッジはログイン中だけ出すので、`session` を in にしておく）
  - 最大のデータで動かす：`node tools/serve.js --demo --max`（既定のポート 8767。`--max` は起動のオプションで、URL には付けない。ポートを変えるなら `node tools/serve.js --demo --max 8766`）→ `http://localhost:8767/stats`。表示の崩れ・重さ・保存の容量を確かめる用
    - 記録はどれも上限まで（PLL・OLL 各 10000 件・ソルブ 5000 件・LL 5000 件、過去 400 日）。全ケース習得・全ケースの手順を自分の手順に・バッジ（隠しバッジも）をすべて取得・連続 400 日（`buildMax`）
    - データはサーバーを起動したときに 1 回だけ作り、`/__demo/data.json` から読む（localStorage でおよそ 2.5MB）。保存に入りきらないときは右下に出す
    - 記録だけでは条件を満たさないバッジもある。記録を消すと、記録から決まるバッジ（隠しの一部も）が外れることがある（入れ直すで戻る）
  - 本番（GitHub Pages）には関係しない（サーバーが返すときにだけ足す）

## ファビコン
- 画像は `img/` に置く：`favicon-32.png`（32px）・`favicon-192.png`（192px）・`apple-touch-icon.png`（180px、白い背景。ホーム画面のアイコン）。ファビコンの 2 つは背景が透明
- 絵は、標準の配色で `R2 F' U2 R U F2` を回したメガミンクスの上面（エディタと同じ描画）。小さくても見分けやすいよう、上面にいろいろな色が出る手順にしている
- どのページも `<head>` で 3 つを読む（相対パス `img/…`）
- 作り直すとき：`node tools/serve.js` → `http://localhost:8765/tools/favicon.html` で画像を出し、「保存」で `img/` に置き換える（手順・大きさはこのページの中で変える）
