// <pll|oll>/scrambles.json から練習用のスクランブルのファイル（js/<pll|oll>-scrambles.js）を作る。
// tools/build-pll-data.js・tools/build-oll-data.js から使う。仕様: reference/PRACTICE_SPEC.md
//   - scrambles.json は { ケース番号: [スクランブル, ...] }（ケース番号は algs_info.json と同じ）
//   - 各スクランブルで崩した状態が、そのケースになるか（そのケースの手順で AUF を除いて揃うか）を確かめる。
//     だめなものがあればエラーで止める（js/case-check.js の fitSetup）
//   - 出力は { ケース名: [スクランブル, ...] }。記法は読み替える（Br → BR など）
'use strict';
const fs = require('fs');
const C = require('../js/case-check.js');

// set: 'pll' / 'oll'、src: algs_info.json の中身、cases: 生成したデータ（{ name, alg, … } の配列）
function buildScrambles(set, srcPath, scramblesPath, src, cases) {
  const raw = JSON.parse(fs.readFileSync(scramblesPath, 'utf8'));
  const byName = {};
  cases.forEach((c) => {
    byName[c.name] = c;
  });
  const errors = [];
  const out = {};
  Object.keys(src).forEach((id) => {
    const name = src[id].name;
    const list = raw[id];
    if (!Array.isArray(list) || !list.length) {
      errors.push(`${name}（${id}）: スクランブルがありません`);
      return;
    }
    out[name] = list.map((s, i) => {
      const scramble = C.convert(String(s).trim());
      if (!C.fitSetup(set, byName[name].alg, scramble)) errors.push(`${name}（${id}）の ${i + 1} 番目: このケースになりません: ${s}`);
      return scramble;
    });
  });
  Object.keys(raw).forEach((id) => {
    if (!src[id]) errors.push(`${id}: algs_info.json に無いケース番号です`);
  });
  if (errors.length) throw new Error(`${scramblesPath} に問題があります:\n  ` + errors.join('\n  '));

  const varName = set.toUpperCase() + '_SCRAMBLES';
  const lines = Object.keys(out).map((name) => '  ' + JSON.stringify(name) + ': ' + JSON.stringify(out[name]) + ',');
  return [
    '// 自動生成ファイル。手で編集しないこと。',
    `// 元データ: ${set}/scrambles.json / 生成: node tools/build-${set}-data.js`,
    '(function (root, data) {',
    "  if (typeof module === 'object' && module.exports) module.exports = data;",
    `  else root.${varName} = data;`,
    "})(typeof self !== 'undefined' ? self : this, {",
    ...lines,
    '});',
    '',
  ].join('\n');
}

module.exports = { buildScrambles };
