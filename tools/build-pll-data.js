// pll/algs_info.json から js/pll-data.js を生成する。
// 実行: node tools/build-pll-data.js
// 仕様: reference/PLL_SPEC.md
//   - AUF は pll/algs_info.json の a・s に括弧付きで直接書く（このスクリプトは足さない）
//       a: [前AUF] 手順              例: "(U') F' R' F R ..."（最後のAUF・持ち替え y は付けない）
//       s: [AUF] setup [AUF]         例: "(U') R U R' ..."（a の前AUFを変えたら s の前後のAUFで合わせる）
//   - 記法を読み替える（Br → BR, Dfr → DR）
//   - 次を確認し、合わないケースがあれば直し方の候補を表示してエラーで止める
//       a が s のケースを最後のAUFを除いて揃える（手順中の y による完成後の向きの違いは無視）
//       a の最後にAUF・持ち替え（y）が無い
//       a の case 表示と s の apply 表示が同じ画像になる
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
const auf = (n) => (n === 0 ? '' : '(' + turn('U', n) + ')');

const convert = (alg) => alg.replace(/Br/g, 'BR').replace(/Dfr/g, 'DR');
const join = (...parts) => parts.filter(Boolean).join(' ');
const same = (a, b) => a.every((x, i) => x === b[i]);

const LEADING_AUF = /^(\s*\(U[0-9']*\))+\s*/;
const TRAILING_AUF = /(\s*\(U[0-9']*\))+\s*$/;
const TRAILING_AUF_OR_Y = /(\s*\(U[0-9']*\)|\s+y[0-9']*)+\s*$/;
const TRAILING_Y = /\s+y[0-9']*\s*$/;

// a・s（読み替え済み）を確認し、問題があればその内容を返す。
// 手順中の持ち替え（y）で完成後の向きが変わっても揃ったとみなす（cancelRotation）。
function check(a, s) {
  if (TRAILING_Y.test(a)) return 'a の最後に持ち替え（y）が付いています（最後の持ち替えは付けない）';
  if (TRAILING_AUF.test(a)) return 'a の最後に AUF が付いています（最後の AUF は付けない）';
  const solved = M.solved();
  const end = M.applyAlg(a, { state: M.applyAlg(s), cancelRotation: true });
  if (![0, 1, 2, 3, 4].some((n) => same(M.applyAlg(turn('U', n), { state: end }), solved))) {
    return 'a で s のケースが揃いません（最後の AUF を除いても揃わない）';
  }
  if (!same(M.applyAlg(a, { inverse: true, cancelRotation: true }), M.applyAlg(s))) {
    return 'Algorithm to solve case（a）と Algorithm to apply（s）の画像が一致しません';
  }
  return null;
}

// 直し方の候補：書かれた a の前AUFを活かし、s の前後の AUF を付け直して確認を通るものを探す。
// a の最後に AUF や持ち替え（y）があれば外す。
// 候補が複数あるときは s に付ける AUF が少ない → s の前に AUF を付けない を優先する。
function suggest(a, s) {
  const a2 = a.replace(TRAILING_AUF_OR_Y, '');
  const sBody = s.replace(LEADING_AUF, '').replace(TRAILING_AUF, '');
  const candidates = [];
  for (let pre = 0; pre < 5; pre++) {
    for (let post = 0; post < 5; post++) {
      const s2 = join(auf(pre), sBody, auf(post));
      if (!check(convert(a2), convert(s2))) {
        candidates.push({ a: a2, s: s2, cost: [(pre > 0) + (post > 0), pre > 0] });
      }
    }
  }
  candidates.sort((x, y) => x.cost[0] - y.cost[0] || x.cost[1] - y.cost[1]);
  return candidates[0] || null;
}

function build() {
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

module.exports = { build, check, suggest, OUT };

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
