// pll/algs_info.json から js/pll-data.js を生成する。
// 実行: node tools/build-pll-data.js
// 仕様: reference/PLL_SPEC.md
//   - 記法の読み替え（Br → BR, Dfr → DR）
//   - 手順の前後に AUF（U）と向きを戻す全体回転（y）を付け、setup（s）の状態を完全に揃える手順にする
//   - a が文字列でない・解釈できない・s を揃えられないケースがあればエラーで止める
'use strict';
const fs = require('fs');
const path = require('path');
const M = require('../js/megaminx-state.js');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'pll', 'algs_info.json');
const OUT = path.join(ROOT, 'js', 'pll-data.js');

// 72°単位の回数 → 記号の付け方
const AMOUNT = ['', '', '2', "2'", "'"];
const turn = (face, n) => (n === 0 ? '' : face + AMOUNT[n]);

const convert = (alg) => alg.replace(/Br/g, 'BR').replace(/Dfr/g, 'DR');
const join = (...parts) => parts.filter(Boolean).join(' ');
const same = (a, b) => a.every((x, i) => x === b[i]);

// setup の状態を alg で完全に揃えるため、前AUF・後AUF・全体回転を補った手順を返す。
// 候補が複数あるときは 前AUFなし → 補う手数が少ないもの を優先する。
function withAuf(alg, setup) {
  const solved = M.solved();
  const start = M.applyAlg(setup);
  const candidates = [];
  for (let pre = 0; pre < 5; pre++) {
    for (let post = 0; post < 5; post++) {
      for (let rot = 0; rot < 5; rot++) {
        const full = join(turn('U', pre), alg, turn('U', post), turn('y', rot));
        if (same(M.applyAlg(full, { state: start }), solved)) {
          candidates.push({ full, cost: [pre === 0 ? 0 : 1, (pre > 0) + (post > 0) + (rot > 0)] });
        }
      }
    }
  }
  candidates.sort((a, b) => a.cost[0] - b.cost[0] || a.cost[1] - b.cost[1]);
  return candidates.length ? candidates[0].full : null;
}

function build() {
  const src = JSON.parse(fs.readFileSync(SRC, 'utf8'));
  const errors = [];
  const cases = Object.values(src).map((c) => {
    if (typeof c.a !== 'string') {
      errors.push(`${c.name}: a は手順1本の文字列にしてください`);
      return null;
    }
    let alg;
    try {
      M.parseAlg(c.s);
      alg = withAuf(convert(c.a), c.s);
    } catch (e) {
      errors.push(`${c.name}: ${e.message}`);
      return null;
    }
    if (!alg) {
      errors.push(`${c.name}: AUF を補っても s のケースを揃えられません`);
      return null;
    }
    return { name: c.name, group: c.group, alg: alg, setup: c.s };
  });
  if (errors.length) throw new Error('pll/algs_info.json に問題があります:\n  ' + errors.join('\n  '));

  const lines = cases.map((c) => '  ' + JSON.stringify(c) + ',');
  return [
    '// 自動生成ファイル。手で編集しないこと。',
    '// 元データ: pll/algs_info.json / 生成: node tools/build-pll-data.js',
    '(function (root, data) {',
    "  if (typeof module === 'object' && module.exports) module.exports = data;",
    '  else root.PLL_DATA = data;',
    "})(typeof self !== 'undefined' ? self : this, [",
    ...lines,
    ']);',
    '',
  ].join('\n');
}

module.exports = { build, OUT };

if (require.main === module) {
  try {
    const text = build();
    fs.writeFileSync(OUT, text);
    console.log('wrote ' + path.relative(ROOT, OUT));
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
