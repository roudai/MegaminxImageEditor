# 回転記号から画像生成：実装メモ

## ゴール
回転記号（U, R, F, L, BR, BL, DR, DL, DBR, DBL, B, D, y）を入力すると、
上面11枚＋側面上段15枚の色を計算して既存の画像に反映する。

## 参考実装
`reference/megaminx_top.py`（Python・検証済み）。12面の法線から132ステッカーの置換を作り、記号列を適用する。
- `X` = 外から見て時計回り72°、`X'` = 反時計、`X2` = 144°、`X2'` = 反時計144°
- 面配置（上から見て反時計回り）: 上段 `F, R, BR, BL, L` / 下段 `DR, DBR, B, DBL, DL` / 底 `D`

## 方針
1. `js/megaminx-state.js` を新規作成（DOM非依存の純関数）
   - `applyAlg(alg, {inverse})` → 状態
   - `toImageColors(state, faceColors)` → `{ ucolor: [11], scolor: [15] }`（既存の色コード `d u p c a o l b y s g r w z`）
2. 既存の `megaminx.js` の描画処理は変更しない
3. UI：手順入力欄を追加 → 計算結果を `uface0..10` / `sface1..15` のセレクトに書き込み → `imageChange()` を呼ぶ（手での微調整も可能なまま）
4. 機能
   - Algorithm to apply（適用後、既定）/ Algorithm to solve case（逆手順を適用）/ Defines the puzzle state（手で指定）の切り替え
   - 全体回転 `y`, `y'`, `y2`、括弧、全角アポストロフィ `’` に対応
   - 面→色の割り当て設定。OLL用マスク（U色のみ着色、他は灰色）プリセット
   - URLパラメータ `?alg=...`（適用）/ `?case=...`（ケース表示）
5. テスト（node で実行）
   - 各面5回で元に戻る、手順＋逆手順で元に戻る、`R U R' U'` の位数が6
   - Python版と出力が一致すること（例：`R U R' U'` 適用後）
     ```
     U辺(F,R,BR,BL,L側): U F U U U
     U角(F-R,R-BR,BR-BL,BL-L,L-F): F BL U U U
     F: F F DR / R: R R U / BR: BR R R / BL: BR BL BL / L: L L L
     ```

## 描画位置との対応（megaminx.js を読んで確認済み）
描画では頂点0が上、k は反時計回りに増え、辺2が下（＝F）。

| 描画側 | 状態側 |
|---|---|
| `ucolor[0]` | U中心 |
| `ucolor[1+2k]`（角k） | 面 `UPPER[(k+2)%5]` と `UPPER[(k+3)%5]` の間の角 |
| `ucolor[2+2k]`（辺k） | 面 `UPPER[(k+3)%5]` 側の辺 |
| `scolor[3k..3k+2]` | 面 `UPPER[(k+3)%5]` の上段（外から見て左→中→右） |

辺0=BL、辺1=L、辺2=F、辺3=R、辺4=BR。

## 進め方
- ステップ1：`js/megaminx-state.js` とテスト（上記1・5）
- ステップ2：UI統合（上記3・4）
- （別PR・任意）27個の手書き `<SELECT>` をJS生成に置き換え
