# サイト全体（URL・公開・ローカルでの確認）

## URL（.html を付けない）
- 公開は GitHub Pages（`https://roudai.github.io/MegaminxImageEditor/`）。GitHub Pages は `/pll` で `pll.html` を返すので、ページへのリンクには `.html` を付けない
  - トップ（エディタ）：`./`（`index.html` とは書かない）。ケースを指定するときは `./?pll=<名前>`
  - ほかのページ：`pll`・`oll`・`practice`・`stats`・`privacy`・`terms`（クエリ・`#` はそのまま。例：`practice?set=oll`、`privacy#delete`）
  - ページはすべてルート直下に置く（相対パスの `css/`・`js/` がどの URL でもそのまま使えるように）
- 古い URL（`pll.html`・`index.html` など）で開いても同じページが出る。そのときは `js/navbar.js` が読み込み直さずにアドレスバーを `.html` なしの URL に書き換える
- ページと同じ名前のフォルダをルートに置かない（`/pll` が `pll/` フォルダの方を見てしまうため）。元データは `data/pll/`・`data/oll/` に置く（ページからは読まない。`tools/build-*-data.js` が `js/` のファイルを作るときに使う）

## ローカルでの確認
- `node tools/serve.js`（ポートを変えるなら `node tools/serve.js 8080`）→ `http://localhost:8765/`
  - GitHub Pages と同じく `.html` なしの URL で各ページを返す（`python3 -m http.server` は `/pll` を返せないので使わない）
