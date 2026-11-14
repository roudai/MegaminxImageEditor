# PLL一覧から手順を選んで画像を作る：仕様

## ゴール
メガミンクスのPLL（全151ケース）から1つ選ぶと、その手順（AUF込み）が Algorithm 入力欄に入り、
そのPLLのケース画像がすぐに作られるようにする。

## 前提（既存の仕組み）
- 手順入力は `js/alg-input.js`。入力欄 `#alg` の値を `MegaminxState.applyAlg()` で計算し、
  `uface0..10` / `sface1..15` に書き込んで `imageChange()` で再描画する
- 種類は `alg`（Algorithm to apply）/ `case`（Algorithm to solve case）/ `state`（Defines the puzzle state）
- 記法は `megaminx-state.js` の先頭コメントのとおり（`U F R L BR BL DR DL DBR DBL B D y`、`'`、`2`、括弧）

## 元データ：`pll/algs_info.json`
```json
"1": {
  "name": "A1+",
  "group": "A",
  "algset": "PLL",
  "s": "(U') R U R' U2 R' U' R U' R U' R' U2 R' U R",
  "a": "(U') F' R' F R U' R' F' R2 U R' U' R' F R"
}
```
- `name`：ケース名（151件、23グループ A〜Z）
- `group`：グループ名
- `s`：揃った状態から適用するとそのケースになる手順。Algorithm to apply で入力欄に入る
- `a`：そのケースを解く手順（1本の文字列）。Algorithm to solve case で入力欄に入る
- **AUF はここに直接書く**（下記「AUF」）。生成スクリプトは AUF を足さない
- 経緯：トレーナーの書き出し `customAlgsExport.json`（83ケース）にあるケースは `a`・`s` ともその内容で置き換え、書き出しに無い68ケースは元のまま（`J3+` は利用者が手順を選んだ）。その後、自動計算した AUF を `a`（85件）・`s`（86件）に書き込んだ

### 記法の違い
| 元データ | このアプリ |
|---|---|
| `Br` | `BR` |
| `Dfr` | `DR` |
| `x` / `x'` | 未対応 |

- 生成スクリプトで `Br`・`Dfr` を読み替える
- `x` / `x'` を含む手順は扱えないので、`a` に使わない

## AUF
`a`・`s` は次の形で書く:

```
a = [前AUF] 手順
s = [AUF] setup [AUF]
```
- AUF：`(U)` `(U2)` `(U2')` `(U')` のいずれか（括弧で囲む）、または無し
- **`a` の最後のAUFは一律付けない**。例：`(U') F' R' F R U' R' F' R2 U R' U' R' F R`
- **`a` の最後の持ち替え（`y`）も付けない**。手順中に `y` があって完成後の向きが変わっても（例：H2+・H2-）、揃ったとみなす
  - そのため Algorithm to solve case の表示と生成スクリプトの確認では、手順中の `y` の合計を自動で打ち消す（`MegaminxState.applyAlg` の `cancelRotation`）
- 満たすべき条件（生成スクリプトが確認する）
  - `s` の状態に `a` を適用すると、最後のAUFを除いて揃う（向きも元どおり）
  - `a` を Algorithm to solve case で表示した画像と、`s` を Algorithm to apply で表示した画像が一致する
- `a` の前AUFを変えると solve case の画像が（ケースを U で回した形に）変わるので、`s` のAUFも合わせて直す。`s` の前だけでは合わせられないことがあるため、`s` は後ろにもAUFを書ける。`s` の前後のAUFを付け直せば、`a` の前AUFがどれでも合わせられる（全151ケース×5通りで確認済み）
- 合っていなければ生成スクリプトが直し方の候補を表示する

## データファイル（生成）
- 生成スクリプト `tools/build-pll-data.js`（node で実行）：`pll/algs_info.json` を読み、記法を読み替え、上記の条件を確認して `js/pll-data.js` を書き出す
- 次の場合はエラーで止め、ケース名と理由を表示する（`js/pll-data.js` は書き出さない）
  - `a`・`s` が文字列でない
  - 手順が解釈できない（`x` を含むなど）
  - `a` の最後にAUF・持ち替え（`y`）が付いている
  - `a` で `s` のケースが揃わない
  - solve case と apply の画像が一致しない
- AUF の付け直しで直るときは、直し方の候補も表示する
  - 書かれた `a` の前AUFは活かし、`s` の前後のAUFを付け直したものを出す（`a` の最後のAUFだけは外す）
  - `a` の最後のAUF・持ち替え（`y`）は外す。`a` を変えたときだけ「候補 a」も出す
  - 候補が複数あるときは `s` に付けるAUFが少ない → `s` の前にAUFを付けない を優先する
  ```
  pll/algs_info.json に問題があります:
    A1+: a で s のケースが揃いません（最後の AUF を除いても揃わない）
      候補 s: (U') R U R' U2 R' U' R U' R U' R' U2 R' U R (U2')
  ```
- `js/pll-data.js` は手で編集しない。ブラウザでは `window.PLL_DATA`、node では `module.exports`
- 形式（元データの順番を保つ。`alg`・`setup` は `a`・`s` を読み替えたもの）
  ```js
  [
    { name: 'A1+', group: 'A', alg: "(U') F' R' F R U' R' F' R2 U R' U' R' F R", setup: "(U') R U R' U2 R' U' ..." },
    ...
  ]
  ```

## 画面
全151ケースを常に並べると画面を圧迫するので、**2つのセレクト**（広い画面では1行に並ぶ）で選ぶ。

```
PLL  [Group ▼ A (3 corner CP) ] [Case ▼ A1+ ] [‹ Prev][Next ›]
```
- 置き場所：`#algEditor` 内、手順入力欄の上。狭い画面（md 未満）では Group・Case・ボタンを1行ずつ縦に並べる（Bootstrap の `row` / `col-12 col-md-*`）
- **Group**：`-- PLL --`（未選択）と A〜Z の23グループ。グループの特徴を括弧付きで添える（例：`A (3 corner CP)`。一覧は `js/alg-input.js` の `PLL_GROUP_NOTES`）
- **Case**：選んだグループのケースだけを出す（最大でも I・X の14件程度）。グループ未選択なら無効
- **‹ Prev / Next ›**：データの並び順（A1+ → A1- → … → Z3）で前後のケースを選ぶ。グループをまたいで移動し、端では反対の端に回る。未選択のときは Next で先頭、Prev で末尾を選ぶ
- 選択肢はすべて JS でデータから生成する

## 動作
PLLを選んでいる間は、種類に応じて入力欄 `#alg` に入れる手順を変える。どちらでも画像は同じケースになる。

| 種類 | 入力欄に入れる手順 |
|---|---|
| `alg`（Algorithm to apply） | `setup`（元データの `s`。必要なら前後にAUF付き） |
| `case`（Algorithm to solve case） | `alg`（元データの `a`。必要なら前にAUF、最後のAUFは無し） |
| `state`（Defines the puzzle state） | 変更しない（入力欄は非表示） |

1. **ケースを選んだとき**（Group を選ぶと、そのグループの先頭ケースを自動で選ぶ）
   - 未選択の状態から選んだときは、種類を `case`（Algorithm to solve case）に切り替える（既定）
   - PLLを選んだまま別のPLLに変えたときは、種類をそのままにする（`alg` なら `alg` のまま）
   - 入力欄に上の表の手順を入れる
   - 配色プリセットは変更しない
   - ファイル名 `#fname` を `pll-<名前>.png`（例：`pll-A1+.png`）にする
   - `update()` で画像を作り直す
2. **PLLを選んだまま種類を切り替えたとき**
   - `alg` ⇔ `case` を切り替えると、入力欄を上の表の手順に差し替える（PLLの選択は保つ）
   - `state` に切り替えたときも選択は保ち、`alg` / `case` に戻したら表の手順を入れ直す
3. **選んだ後の編集**
   - 入力欄・種類・配色はこれまでどおり手で変更できる
   - 入力欄を手で書き換えたら、2つのセレクトを未選択に戻す（表示中の手順とPLL名がずれないように）。種類の切り替えによる差し替えは手での書き換えに含めない
   - Clear ボタンでも未選択に戻す
4. **URLパラメータ**
   - `?pll=<名前>` で、そのケースを選んだ状態で開く。`+` は `%2B` と書く（例：`?pll=A1%2B`）。URLでは `+` が空白になるため、名前の末尾の空白は `+` とみなして探す
   - `?alg=` / `?case=` と同時に指定された場合は `?pll=` を優先する
   - 存在しない名前なら無視する（未選択のまま）

## テスト（`test/pll-data.test.js`、node で実行）
- `js/pll-data.js` が元データの全151ケースを含み、名前が重複していない
- 各ケースについて
  - `alg` と `setup` が `applyAlg()` でエラーにならない
  - `setup` の状態に `alg` を適用すると、最後のAUFを除いて揃う（`alg` の最後にAUFが付いていない）
  - `alg` を `case` として表示した状態（逆手順を適用）が `setup` を適用した状態と一致する
  - 上面11枚がすべてU色（＝PLLは向きを崩さない）
- `js/pll-data.js` が最新（生成スクリプトを再実行しても変わらない）

## 変更するファイル
| ファイル | 内容 |
|---|---|
| `tools/build-pll-data.js` | 新規。`js/pll-data.js` を生成 |
| `js/pll-data.js` | 新規（生成物）。PLLの名前・手順・setup |
| `js/alg-input.js` | セレクトの生成・選択時の処理・URLパラメータ |
| `index.html` | `pll-data.js` の読み込み、セレクトを置く場所 |
| `test/pll-data.test.js` | 新規。上記テスト |

`megaminx.js`（描画）は変更しない。`megaminx-state.js`（状態計算）には `applyAlg` の `cancelRotation` だけを足す。

## 補足
- 名前は `pll/algs_info.json` の `name` をそのまま使う（元データの `Q1A` は、Q1- と対にするため `Q1+` に変えた）
- 将来の案：ケースをサムネイル画像の一覧から選べる折りたたみパネル（今回は対象外）
