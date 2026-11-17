// data/oll/algs_info.json から js/oll-data.js を生成する。
// 実行: node tools/build-oll-data.js（練習用のスクランブル js/oll-scrambles.js も作る。tools/scrambles-lib.js）
// 仕様: reference/OLL_SPEC.md
//   - 形式は data/pll/algs_info.json と同じ（a・s は手順1本の文字列。AUF は括弧付きで直接書く）
//       a: [前AUF] 手順              例: "(U2') Br' R' U' R F U Br R U' R' F'"（最後のAUF・持ち替え y は付けない）
//       s: [AUF] setup [AUF]         例: "F U2' F U2 R' U2' F' U2 R F' (U)"
//   - 記法を読み替える（Br → BR, Bl → BL, Dfr → DR）。x（持ち替え）と LR のような同時回しには対応しない
//   - 確認処理は js/case-check.js（エディタの「自分の手順」と共通）
//   - 次を確認し、合わないケースがあれば直し方の候補を表示してエラーで止める
//       s は最後の層（U層）だけを崩す
//       a が s のケースの上面の向きを揃える（F2L は崩さない。手順中の y による完成後の向きの違いは無視）
//       a の最後にAUF・持ち替え（y）が無い
//       a の case 表示と s の apply 表示で、上面の向き（OLL配色の画像）が同じになる
//         （OLL は向きだけを揃えるので、側面の色の並びは一致しなくてよい）
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'data', 'oll', 'algs_info.json');
const OUT = path.join(ROOT, 'js', 'oll-data.js');
const SCRAMBLES_SRC = path.join(ROOT, 'data', 'oll', 'scrambles.json');
const SCRAMBLES_OUT = path.join(ROOT, 'js', 'oll-scrambles.js');

const C = require('../js/case-check.js');
const { buildScrambles } = require('./scrambles-lib.js');

const convert = C.convert;

// 確認の結果（js/case-check.js のコード）→ 表示する文
const MESSAGES = {
  'trailing-y': 'a の最後に持ち替え（y）が付いています（最後の持ち替えは付けない）',
  'trailing-auf': 'a の最後に AUF が付いています（最後の AUF は付けない）',
  'setup-f2l': 's で最後の層以外が崩れています',
  'not-solved': 'a で s のケースの上面が揃いません',
  mismatch: 'Algorithm to solve case（a）と Algorithm to apply（s）の上面の向きが一致しません',
};

// a・s（読み替え済み）を確認し、問題があればその内容を返す。
function check(a, s) {
  const code = C.check('oll', a, s);
  return code ? MESSAGES[code] : null;
}

// 直し方の候補：書かれた a をそのまま使い、s の最後の AUF を付け直して確認を通るものを探す。
// a の最後に AUF や持ち替え（y）があれば外す。（OLL では s の前の AUF は上面の向きに影響しない）
const suggest = (a, s) => C.fitSetup('oll', a, s);

// 生成するファイルの中身 { data: js/oll-data.js, scrambles: js/oll-scrambles.js }
function buildAll() {
  const src = JSON.parse(fs.readFileSync(SRC, 'utf8'));
  const errors = [];
  const cases = Object.values(src).map((c) => {
    if (typeof c.a !== 'string' || typeof c.s !== 'string') {
      errors.push(`${c.name}: a と s は手順1本の文字列にしてください`);
      return null;
    }
    const alg = convert(c.a);
    const setup = convert(c.s);
    let problem;
    try {
      problem = check(alg, setup);
    } catch (e) {
      errors.push(`${c.name}: ${e.message}`);
      return null;
    }
    if (problem) {
      const fix = suggest(c.a, c.s);
      errors.push(
        `${c.name}: ${problem}` +
          (fix ? (fix.a !== c.a ? `\n    候補 a: ${fix.a}` : '') + `\n    候補 s: ${fix.s}` : '\n    （AUF を付け直しても合いません。手順を確認してください）')
      );
      return null;
    }
    return { name: c.name, group: c.group, algset: c.algset, alg: alg, setup: setup };
  });
  if (errors.length) throw new Error('data/oll/algs_info.json に問題があります:\n  ' + errors.join('\n  '));

  const lines = cases.map((c) => '  ' + JSON.stringify(c) + ',');
  const data = [
    '// 自動生成ファイル。手で編集しないこと。',
    '// 元データ: data/oll/algs_info.json / 生成: node tools/build-oll-data.js',
    '(function (root, data) {',
    "  if (typeof module === 'object' && module.exports) module.exports = data;",
    '  else root.OLL_DATA = data;',
    "})(typeof self !== 'undefined' ? self : this, [",
    ...lines,
    ']);',
    '',
  ].join('\n');
  return { data: data, scrambles: buildScrambles('oll', SRC, SCRAMBLES_SRC, src, cases) };
}

const build = () => buildAll().data;
const buildScrambleFile = () => buildAll().scrambles;

module.exports = { build, buildScrambleFile, check, suggest, OUT, SCRAMBLES_OUT };

if (require.main === module) {
  try {
    const out = buildAll();
    fs.writeFileSync(OUT, out.data);
    console.log('wrote ' + path.relative(ROOT, OUT));
    fs.writeFileSync(SCRAMBLES_OUT, out.scrambles);
    console.log('wrote ' + path.relative(ROOT, SCRAMBLES_OUT));
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
