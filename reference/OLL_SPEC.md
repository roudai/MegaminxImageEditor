# OLL選択の仕様

PLL（`reference/PLL_SPEC.md`）と同じ仕組みで、OLL を選ぶと手順が Algorithm 入力欄に入り、画像ができる。ここでは PLL との違いを中心に書く。

## データ
- 元データ：`oll/algs_info.json`（259ケース、54グループ：`1`〜`53` と `1C`）
- 形式は `pll/algs_info.json` と同じ
  ```json
  "1": { "name": "1A", "group": "1", "algset": "ND", "s": "F U2' F U2 R' U2' F' U2 R F' (U)", "a": "L R U R' U' R' F R F' L'" }
  ```
  - `a`：解く手順（solve case 用）。`[前AUF] 手順`。最後の AUF・持ち替え（y）は付けない
  - `s`：そのケースになる手順（apply 用）。`[AUF] setup [AUF]`
  - `algset`（`ND` / `D`）は今は使わない
- 元のデータは1ケースに手順が1〜4個あった。最初の手順を `a` にし、前の AUF を `(U')` のように括弧で書く形に変換した
  - 先頭の手順が使えないケースは、使える次の手順にした。`28+`・`35A+` はどの手順も `x'` を含むので、`s` の逆手順を `a` にした（あとで見直す）
  - 元データの `s` には、上面の向きが `a` と合うように最後の AUF を足した
- 記法の読み替え（生成時）：`Br` → `BR`、`Bl` → `BL`、`Dfr` → `DR`。`x`（持ち替え）と `LR` のような同時回しには対応しない

## 生成：`tools/build-oll-data.js`
- `node tools/build-oll-data.js` で `js/oll-data.js`（`window.OLL_DATA` / node では `module.exports`）を作る。各要素は `{ name, group, alg, setup }`
- 次を確認し、合わないケースがあれば直し方の候補（`s` の最後の AUF）を表示してエラーで止める（`js/oll-data.js` は書き換えない）
  - `s` は最後の層（U層）だけを崩す
  - `a` は `s` のケースの上面の向きを揃え、F2L を崩さない（手順中の y による完成後の向きの違いは無視）
  - `a` の最後に AUF・持ち替え（y）が無い（OLL では最後の U は向きに影響しないので、括弧の無い U も AUF とみなす）
  - `a` の case 表示と `s` の apply 表示で、上面の向き（OLL配色の画像）が同じ
- OLL は向きだけを揃えるので、PLL と違い、側面の色の並びは apply と solve case で一致しなくてよい

## 画面
```
PLL  [Group ▼] [Case ▼] [‹ Prev][Next ›]
OLL  [Group ▼] [Case ▼] [‹ Prev][Next ›]
```
- PLL の行の下に OLL の行を置く。並びと狭い画面での縦並びは PLL と同じ
- Group は `-- OLL --`（未選択）とデータに出てくる順のグループ。名前を括弧付きで添える（一覧は `js/alg-input.js` の `SETS.oll.notes`）
  - 1〜37：形の名前（例：`6 (Anchor)`、`18 (Long Block)`）
  - `1C`・38〜53：Dot 系のカテゴリー名（`1C (Dot EO)`、38〜43 `Dot 2 Corner CO`、44〜49 `Dot 3 Corner CO`、50〜52 `Dot 4 Corner CO`、53 `Dot 5 Corner CO`）
- 同時に選べるのは PLL・OLL のどちらか1つ。片方を選ぶともう片方は未選択に戻る
- Prev / Next は OLL の中だけで前後に動く（端では反対の端に回る）

## 動作（PLL と違う点）
- **配色**：OLL を選ぶと Color Preset を `OLL (U color only)` にする。OLL のあとに PLL を選んだときは、OLL を選ぶ前の配色（Preset と Face Colors）に戻す
  - 「OLL のあと」は、最後に選んだのが OLL だった場合（間に手で入力して未選択になっていても同じ）
  - 戻す配色を覚えていないとき（OLL 配色のまま再読み込みした場合、最初から OLL 配色だった場合）は `Standard` にする
  - OLL を選んだあとに色を変えていた場合（Preset が OLL でなくなった場合）は何もしない
  - PLL から PLL へ選び直したときは配色を変えない
- ファイル名は `oll-<名前>.png`
- URL：`?oll=<名前>`（例：`?oll=3A%2B`）。優先順位は `?pll` → `?oll` → `?case` → `?alg`
- その他（種類による入力欄の差し替え、手での書き換えで未選択に戻る、など）は PLL と同じ

## 一括ダウンロード
- `Download all PLL (.zip)` の右に **Download all OLL (.zip)** を置く（広い画面のときだけ表示）
- 全259ケースを solve case の状態で描き、`megaminx-oll.zip` にまとめる。ファイル名は `oll-<名前>.png`
- 配色は、今の U の色だけを残した OLL 配色（他の面は dimgray）。サイズ・Body Color・背景は今の設定

## テスト（`test/oll-data.test.js`）
- `js/oll-data.js` が元データの全259ケースを順番どおり含み、名前が重複しない。生成し直しても変わらない
- 259ケースの上面の向きがすべて違う（AUF 違いを含めて重複しない）
- 各ケースが上の確認を通る。確認処理が、揃わない手順・最後の AUF・最後の y をエラーにする
