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
  - 先頭の手順が使えないケースは、使える次の手順にした
  - 元データの `s` には、上面の向きが `a` と合うように最後の AUF を足した
- **No Dot（178 ケース）の `a` は、IronCuber333「メガミンクスOLLを覚えよう」[前編](https://note.com/ironcuber333/n/n7f71bee8c8f5)・[後編](https://note.com/ironcuber333/n/n3c37b0e551c0)（2024-12-12）の本文の手順に合わせた**（2026-11）
  - 記事の 178 手順は、すべて同じ名前のケースを解くことを `js/case-check.js` で確かめた（ケース名の付け方は記事と同じ）。もとの手順と違ったのは 34。そのうち 2B・4B・4E+ は先頭の持ち替えだけの違いで（下の持ち替えを外すと元と同じ）、35A- は下の例外なので、手順が変わったのは 30 ケース
  - 例外：`35A-` は、記事が「こちらの方が良い」と書いている別解 `F R' F' R U R U R' U' R U' R'`（もとの手順と同じ）のまま
  - 記事で先頭に持ち替え `(y)`・`(y')`・`(y2)`・`(y2')` が付いている 24 手順（2B・2D・4B・4D・4E+・8A-・11B-・14A-・15B+・17A-・18B・18E+・20E-・21D+・30A-・30B-・31A-・32B+・35B+・35D-・35F+・36B+・37C+・37C-）は、持ち替えを外し、ケースの向きを持ち替えたあとの向きにした（画像も持ち替えたあとの向きで出る）。そのぶん `s` の最後の AUF を付け直した
  - 以前 `28+`・`35A+` は、元データの手順がどれも `x'` を含んだため `s` の逆手順を仮に入れていた。記事の手順にしたので解消した
  - 記事の表記の揺れ：後編の 37A は画像では「37A+」、手順の行だけ「37A」。`37A+` として扱う（照合でも 37A+ を解く）
  - 手順を変えて上面の向きが合わなくなったケースは、`s` の最後の AUF を付け直した（`C.fitSetup`）
  - Dot（81 ケース）は記事に無いので、元の手順のまま
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
[PLL|OLL] [Group ▼] [Case ▼] [‹ Prev][Next ›]
```
- PLL と同じ行で、[PLL | OLL] の切り替えで OLL を選ぶと OLL の Group・Case・ボタンを出す（reference/PLL_SPEC.md の「画面」）
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
- **No Dot / Dot の切り替え**：上部のセグメント型の切り替え（`No Dot 178` / `Dot 81` / `All 259`）で表示する範囲を選ぶ（既定は No Dot）。「グループ順 / 覚える順」の切り替えの右に置く（並びは PLL と共通の切り替えなので、PLL の一覧と同じ左端にそろえる）
  - No Dot は `algset` が `ND` のケース（グループ 1〜37）、Dot は `D` のケース（`1C`・38〜53）
  - 見出しの横のケース数は、範囲に関係なく全ケースの数（`259 ケース`）で固定する（範囲ごとの数はこの切り替えに出ているので繰り返さない）。ZIP でダウンロードのボタンの説明の数は、選んでいる範囲の数
  - 件数・進捗バー・状態の絞り込み・グループのボタン・一括ダウンロードは、選んだ範囲だけを対象にする
    （ダウンロードのボタン名は `Download No Dot OLL (.zip)` などに変わり、ファイル名は `megaminx-oll-nd.zip` / `megaminx-oll-d.zip`。All は `megaminx-oll.zip`）
  - 習得状況の保存はケースごとなので、範囲を切り替えても印は共通。選んだ範囲は `megaminx-image-editor:list-filter` の `ollScope` に保存する
  - そのため `js/oll-data.js` の各ケースに `algset` を含める

## 覚える順番（`data/oll/learn_order.json`）
- PLL（`reference/PLL_SPEC.md`「覚える順番」）と同じ仕組み。`tools/build-oll-data.js` がこれを読み（`tools/learn-order.js`。PLL と共通）、`js/oll-data.js` の各ケースに `stage`（段階 1〜54）と `order`（通し番号 1〜259）を付ける（全ケースがちょうど1回ずつ無ければエラー）
- 1 段階が 1 グループ。段階の中は記事に出てくる順
- No Dot（37 段階）：IronCuber333「メガミンクスOLLを覚えよう」（上の記事 2 本）に出てくる順
  - 前編：2・3・4・5（スター OLL）→ 1（エッジ OLL）→ 7・6・8・9・22・24・28・32・18・35・15（3x3 と同じ手順系）→ 14・17・30・31・27・13・29（6〜8 手・セットアップ＋簡単な OLL 系）
  - 後編：12・23・26・33・25・10・11・16（2CO/3CO の残り）→ 34・21・19・20・36・37（4CO/5CO）
- Dot（17 段階）：記事に無いので、No Dot のあとにグループ順（1C・38〜53）。段階の中はデータの順
- 段階の短い名前は、グループの番号と文字の範囲（2A–D、3A–B、28、35A–F、1C …。`js/case-sections.js` の `stageLabel`）
- 一覧・練習・記録の「グループ順 / 覚える順」は PLL と同じ動き。選んだ並びは `list-filter` の `ollOrder`、一覧で選んだ段階は `ollStages`、練習で選んだ段階は `practice.groups['oll-stage']`
  - 範囲（No Dot / Dot / All）で表示を絞ると、段階のボタンも範囲のケースがある段階だけになる（No Dot の段階は No Dot のケースだけ、Dot の段階は Dot のケースだけ）
- 並びのボタンの説明は種類ごと（`list.orderGroupTitle.oll`・`list.orderLearnTitle.oll`。記事の題名を出典として出す）

## 自分の手順
- PLL と同じ（`reference/PLL_SPEC.md`「自分の手順」）。OLL では setup の最後の AUF だけを付け直し、上面の向きが揃うか（F2L を崩さないか）を確かめる

## テスト（`test/oll-data.test.js`）
- `js/oll-data.js` が元データの全259ケースを順番どおり含み、名前が重複しない。生成し直しても変わらない
- 259ケースの上面の向きがすべて違う（AUF 違いを含めて重複しない）
- 各ケースが上の確認を通る。確認処理が、揃わない手順・最後の AUF・最後の y をエラーにする
- 覚える順番（`data/oll/learn_order.json`）が 54 段階で全259ケースをちょうど1回ずつ含み、`stage`・`order` と合う（`test/oll-data.test.js`）。段階の並び・名前（`test/case-sections.test.js`）
- 全ケースで、練習の LL の PLL が決まる（`C.pllAfter`。`test/case-check.test.js`）
