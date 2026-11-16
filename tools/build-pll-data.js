// pll/algs_info.json から js/pll-data.js を生成する。
// 実行: node tools/build-pll-data.js（練習用のスクランブル js/pll-scrambles.js も作る。tools/scrambles-lib.js）
// 仕様: reference/PLL_SPEC.md
//   - AUF は pll/algs_info.json の a・s に括弧付きで直接書く（このスクリプトは足さない）
//       a: [前AUF] 手順              例: "(U') F' R' F R ..."（最後のAUF・持ち替え y は付けない）
//       s: [AUF] setup [AUF]         例: "(U') R U R' ..."（a の前AUFを変えたら s の前後のAUFで合わせる）
//   - 記法を読み替える（Br → BR, Bl → BL, Dfr → DR）
//   - 確認処理は js/case-check.js（エディタの「自分の手順」と共通）
//   - 次を確認し、合わないケースがあれば直し方の候補を表示してエラーで止める
//       a が s のケースを最後のAUFを除いて揃える（手順中の y による完成後の向きの違いは無視）
//       a の最後にAUF・持ち替え（y）が無い
//       a の case 表示と s の apply 表示が同じ画像になる
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'pll', 'algs_info.json');
const OUT = path.join(ROOT, 'js', 'pll-data.js');
const SCRAMBLES_SRC = path.join(ROOT, 'pll', 'scrambles.json');
const SCRAMBLES_OUT = path.join(ROOT, 'js', 'pll-scrambles.js');

const C = require('../js/case-check.js');
const { buildScrambles } = require('./scrambles-lib.js');

const convert = C.convert;

// 確認の結果（js/case-check.js のコード）→ 表示する文
const MESSAGES = {
  'trailing-y': 'a の最後に持ち替え（y）が付いています（最後の持ち替えは付けない）',
  'trailing-auf': 'a の最後に AUF が付いています（最後の AUF は付けない）',
  'not-solved': 'a で s のケースが揃いません（最後の AUF を除いても揃わない）',
  mismatch: 'Algorithm to solve case（a）と Algorithm to apply（s）の画像が一致しません',
};

// a・s（読み替え済み）を確認し、問題があればその内容を返す。
// 手順中の持ち替え（y）で完成後の向きが変わっても揃ったとみなす（cancelRotation）。
function check(a, s) {
  const code = C.check('pll', a, s);
  return code ? MESSAGES[code] : null;
}

// 直し方の候補：書かれた a の前AUFを活かし、s の前後の AUF を付け直して確認を通るものを探す。
// a の最後に AUF や持ち替え（y）があれば外す。
// 候補が複数あるときは s に付ける AUF が少ない → s の前に AUF を付けない を優先する。
const suggest = (a, s) => C.fitSetup('pll', a, s);

// 生成するファイルの中身 { data: js/pll-data.js, scrambles: js/pll-scrambles.js }
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
    return { name: c.name, group: c.group, alg: alg, setup: setup };
  });
  if (errors.length) throw new Error('pll/algs_info.json に問題があります:\n  ' + errors.join('\n  '));

  const lines = cases.map((c) => '  ' + JSON.stringify(c) + ',');
  const data = [
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
  return { data: data, scrambles: buildScrambles('pll', SRC, SCRAMBLES_SRC, src, cases) };
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
