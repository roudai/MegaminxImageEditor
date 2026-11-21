# OLL選択の仕様

PLL（`reference/PLL_SPEC.md`）と同じ仕組みで、OLL を選ぶと手順が Algorithm 入力欄に入り、画像ができる。ここでは PLL との違いを中心に書く。

## データ
- 元データ：`data/oll/algs_info.json`（259ケース、54グループ：`1`〜`53` と `1C`）
- 形式は `data/pll/algs_info.json` と同じ
  ```json
  "1": { "name": "1A", "group": "1", "algset": "ND", "s": "F U2' F U2 R' U2' F' U2 R F' (U)", "a": "L R U R' U' R' F R F' L'" }
  ```
  - `a`：解く手順（solve case 用）。`[前AUF] 手順`。最後の AUF・持ち替え（y）は付けない
  - `s`：そのケースになる手順（apply 用）。`[AUF] setup [AUF]`
  - `algset`（`ND` / `D`）は一覧ページの No Dot / Dot の切り替えに使う
- 元のデータは1ケースに手順が1〜4個あった。最初の手順を `a` にし、前の AUF を `(U')` のように括弧で書く形に変換した
  - 先頭の手順が使えないケースは、使える次の手順にした。`28+`・`35A+` はどの手順も `x'` を含むので、`s` の逆手順を `a` にした（あとで見直す）
  - 元データの `s` には、上面の向きが `a` と合うように最後の AUF を足した
- 記法の読み替え（生成時）：`Br` → `BR`、`Bl` → `BL`、`Dfr` → `DR`。`x`（持ち替え）と `LR` のような同時回しには対応しない

## 生成：`tools/build-oll-data.js`
- 確認処理は `js/case-check.js`（エディタの自分の手順と共通）
- `node tools/build-oll-data.js` で `js/oll-data.js`（`window.OLL_DATA` / node では `module.exports`）を作る。各要素は `{ name, group, algset, alg, setup }`
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
- Group は `-- OLL --`（未選択）とデータに出てくる順のグループ。名前を括弧付きで添える（一覧は `js/case-groups.js` の `oll`）
  - 1〜37：形の名前（例：`6 (Anchor)`、`18 (Long Block)`）
  - `1C`・38〜53：Dot 系のカテゴリー名（`1C (Dot EO)`、38〜43 `Dot 2 Corner CO`、44〜49 `Dot 3 Corner CO`、50〜52 `Dot 4 Corner CO`、53 `Dot 5 Corner CO`）
- 同時に選べるのは PLL・OLL のどちらか1つ。片方を選ぶともう片方は未選択に戻る
- Prev / Next は OLL の中だけで前後に動く（端では反対の端に回る）

## 動作（PLL と違う点）
- **配色**：OLL を選ぶと Color Preset を `OLL (U color only)` にする。PLL を選んだときに OLL 配色なら、OLL を選ぶ前の配色（Preset と Face Colors）に戻す
  - OLL のあとに PLL を選んだ場合のほか、OLL 配色のまま再読み込みした場合や、PLL 一覧（`pll.html`）から `?pll=` で開いた場合も含む
  - OLL を選ぶ前の配色は設定と一緒に localStorage に保存する（`beforeOll`）。OLL 一覧からエディタに来て、そのまま PLL 一覧へ移動しても、PLL 一覧はこの配色で表示する
  - 手で配色を変えたとき（Color Preset の変更・面の色の変更）は、覚えた配色を忘れる
  - 戻す配色を覚えていないときは `Standard` にする（PLL 一覧の表示と同じ色になる）
- **Color Preset の Custom**：選択肢に `Custom` を表示する。色を変えて Custom になったときの配色（最後のカスタム配色）を覚えておき（localStorage の `customScheme`）、OLL や Standard に切り替えたあとでも `Custom` を選べばその配色に戻る。覚えた配色が無ければ今の色のまま
  - OLL を選んだあとに色を変えていた場合（Preset が OLL でなくなった場合）や、PLL から PLL へ選び直したときは配色を変えない
- ファイル名は `oll-<名前>.png`
- URL：`?oll=<名前>`（例：`?oll=3A%2B`）。優先順位は `?pll` → `?oll` → `?case` → `?alg`
- その他（種類による入力欄の差し替え、手での書き換えで未選択に戻る、など）は PLL と同じ

## 一括ダウンロード
- OLL の一覧ページ（`oll.html`）に **ZIP でダウンロード**（Download ZIP） を置く（広い画面のときだけ表示。エディタには置かない）
- 全259ケースを solve case の状態で描き、`megaminx-oll.zip` にまとめる。ファイル名は `oll-<名前>.png`
- 配色は一覧と同じ（保存した U の色だけを残した OLL 配色、他の面は dimgray）。サイズ・Body Color・背景はエディタで保存した設定

## 一覧ページ（`oll.html`）
- PLL の一覧ページ（`pll.html`、`reference/PLL_SPEC.md`）と同じ作り（`js/cases.js` を `<body data-set="oll">` で使う）
- 全259ケースを、グループ名付きの見出し（例：`6 (Anchor)`）で並べる。上部にグループのボタン（押すとそのグループだけを表示する。PLL 一覧と同じ。保存は `list-filter` の `ollGroups`）
- 画像は solve case の状態。配色は、エディタで保存した U の色だけを残した OLL 配色（他の面は dimgray）。Body Color も保存した設定
- ケースをクリックすると、そのケースを選んだ状態でエディタ（`./?oll=<名前>`）を開く
- ナビバー：エディタは `PLL`・`OLL`（一覧ページ）、一覧ページは `Editor` ともう一方の一覧へのリンク
- 習得状況の印・進み具合・絞り込みも PLL 一覧と同じ（`reference/PLL_SPEC.md`。保存は PLL と別）
- **No Dot / Dot の切り替え**：上部のセグメント型の切り替え（`No Dot 178` / `Dot 81` / `All 259`）で表示する範囲を選ぶ（既定は No Dot）
  - No Dot は `algset` が `ND` のケース（グループ 1〜37）、Dot は `D` のケース（`1C`・38〜53）
  - 件数・進捗バー・状態の絞り込み・グループのボタン・一括ダウンロードは、選んだ範囲だけを対象にする
    （ダウンロードのボタン名は `Download No Dot OLL (.zip)` などに変わり、ファイル名は `megaminx-oll-nd.zip` / `megaminx-oll-d.zip`。All は `megaminx-oll.zip`）
  - 習得状況の保存はケースごとなので、範囲を切り替えても印は共通。選んだ範囲は `megaminx-image-editor:list-filter` の `ollScope` に保存する
  - そのため `js/oll-data.js` の各ケースに `algset` を含める

## 自分の手順
- PLL と同じ（`reference/PLL_SPEC.md`「自分の手順」）。OLL では setup の最後の AUF だけを付け直し、上面の向きが揃うか（F2L を崩さないか）を確かめる

## テスト（`test/oll-data.test.js`）
- `js/oll-data.js` が元データの全259ケースを順番どおり含み、名前が重複しない。生成し直しても変わらない
- 259ケースの上面の向きがすべて違う（AUF 違いを含めて重複しない）
- 各ケースが上の確認を通る。確認処理が、揃わない手順・最後の AUF・最後の y をエラーにする
