# 日本語・英語の切り替えの仕様

## 画面
- エディタ（`index.html`）と一覧ページ（`pll.html`・`oll.html`）のナビバーに **EN / 日本語** の切り替えを置く（セグメント型。見た目は `css/common.css`）
- 押すとその場で画面の文を入れ替える（再読み込みしないので、エディタの手順・選択中のケース・色などはそのまま）
- 選んだ言語は localStorage の `megaminx-image-editor:lang` に保存し、3ページで共通にする。保存が無ければブラウザの言語（`ja` で始まれば日本語、それ以外は英語）
- `<html lang>` とページのタイトルも切り替える

## 訳す範囲
- ナビバー、エディタの見出し・ボタン・選択肢・ツールチップ、状態の手入力（Defines the puzzle state）の見出し
- 自分の手順（My algorithm）の欄・メッセージ・エラー、手順の解析エラー（`Invalid move` など）
- 一覧ページの見出し・説明・件数・範囲の切り替え・絞り込み・覚えた度の名前・一括ダウンロードのボタン
- 訳さないもの：色を直接指定のステッカーのラベル（`F edge`・`F-R corner`・`F left` など。見出しは訳す）、ケース名・グループ名（`A (3 corner CP)` など）、回転記号、`No Dot` / `Dot`、色の名前（ツールチップの `dimgray` など）、`presented by`
- 覚えた度の日本語：未習得 / 練習中 / 習得済み

## 仕組み（`js/i18n.js`）
- 訳は `DICT.en` / `DICT.ja` に key ごとに書く。`{name}` のような部分は params で埋める
- HTML の文は `data-i18n="key"`（属性は `data-i18n-title` / `data-i18n-placeholder` / `data-i18n-aria-label`、埋める値は `data-i18n-params`）。HTML には英語の文をそのまま書いておく
- JS で作る文は `I18N.set(el, key, params, attr)` で入れる（言語を切り替えたときに自動で入れ直す）。件数など毎回作る文は `I18N.onChange(fn)` で作り直す
- 各ページで、ほかのスクリプトより先に `js/i18n.js` を読み込む
