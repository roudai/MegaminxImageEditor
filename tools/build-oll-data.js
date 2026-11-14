// oll/algs_info.json から js/oll-data.js を生成する。
// 実行: node tools/build-oll-data.js
// 仕様: reference/OLL_SPEC.md
//   - 形式は pll/algs_info.json と同じ（a・s は手順1本の文字列。AUF は括弧付きで直接書く）
//       a: [前AUF] 手順              例: "(U2') Br' R' U' R F U Br R U' R' F'"（最後のAUF・持ち替え y は付けない）
//       s: [AUF] setup [AUF]         例: "F U2' F U2 R' U2' F' U2 R F' (U)"
//   - 記法を読み替える（Br → BR, Bl → BL, Dfr → DR）。x（持ち替え）と LR のような同時回しには対応しない
//   - 次を確認し、合わないケースがあれば直し方の候補を表示してエラーで止める
//       s は最後の層（U層）だけを崩す
//       a が s のケースの上面の向きを揃える（F2L は崩さない。手順中の y による完成後の向きの違いは無視）
//       a の最後にAUF・持ち替え（y）が無い
//       a の case 表示と s の apply 表示で、上面の向き（OLL配色の画像）が同じになる
//         （OLL は向きだけを揃えるので、側面の色の並びは一致しなくてよい）
'use strict';
const fs = require('fs');
const path = require('path');
const M = require('../js/megaminx-state.js');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'oll', 'algs_info.json');
const OUT = path.join(ROOT, 'js', 'oll-data.js');

// 72°単位の回数 → 記号の付け方
const AMOUNT = ['', '', '2', "2'", "'"];
const turn = (face, n) => (n === 0 ? '' : face + AMOUNT[n]);
const auf = (n) => (n === 0 ? '' : '(' + turn('U', n) + ')');

const convert = (alg) => alg.replace(/Br/g, 'BR').replace(/Bl/g, 'BL').replace(/Dfr/g, 'DR');
const join = (...parts) => parts.filter(Boolean).join(' ');

// OLL では最後の U は向きに影響しないので、括弧の無い U も最後の AUF とみなす
const TRAILING_AUF = /(\s*\(U[0-9']*\)|\s+U[0-9']*)+\s*$/;
const TRAILING_AUF_OR_Y = /(\s*\(U[0-9']*\)|\s+U[0-9']*|\s+y[0-9']*)+\s*$/;
const TRAILING_Y = /\s+y[0-9']*\s*$/;

// 最後の層（U層）のステッカーの位置：U で動く位置と U の中心
const SOLVED = M.solved();
const INDEX = SOLVED.map((_, i) => i);
const MOVED_BY_U = M.applyMoves(INDEX, M.parseAlg('U'));
const LAST_LAYER = new Set(INDEX.filter((i) => MOVED_BY_U[i] !== i || SOLVED[i] === 'U'));

const f2lSolved = (state) => state.every((x, i) => LAST_LAYER.has(i) || x === SOLVED[i]);
const MASK = M.ollMask(M.DEFAULT_SCHEME);
// 上面の向き（OLL配色での画像の色）
const pattern = (state) => {
  const c = M.toImageColors(state, MASK);
  return c.ucolor.join('') + '|' + c.scolor.join('');
};
const oriented = (state) => M.toImageColors(state, MASK).ucolor.every((x) => x === MASK.U);

// a・s（読み替え済み）を確認し、問題があればその内容を返す。
function check(a, s) {
  if (TRAILING_Y.test(a)) return 'a の最後に持ち替え（y）が付いています（最後の持ち替えは付けない）';
  if (TRAILING_AUF.test(a)) return 'a の最後に AUF が付いています（最後の AUF は付けない）';
  const caseState = M.applyAlg(s);
  if (!f2lSolved(caseState)) return 's で最後の層以外が崩れています';
  const end = M.applyAlg(a, { state: caseState, cancelRotation: true });
  if (!f2lSolved(end) || !oriented(end)) return 'a で s のケースの上面が揃いません';
  if (pattern(M.applyAlg(a, { inverse: true, cancelRotation: true })) !== pattern(caseState)) {
    return 'Algorithm to solve case（a）と Algorithm to apply（s）の上面の向きが一致しません';
  }
  return null;
}

// 直し方の候補：書かれた a をそのまま使い、s の最後の AUF を付け直して確認を通るものを探す。
// a の最後に AUF や持ち替え（y）があれば外す。（OLL では s の前の AUF は上面の向きに影響しない）
function suggest(a, s) {
  const a2 = a.replace(TRAILING_AUF_OR_Y, '');
  const sBody = s.replace(TRAILING_AUF, '');
  for (let post = 0; post < 5; post++) {
    const s2 = join(sBody, auf(post));
    try {
      if (!check(convert(a2), convert(s2))) return { a: a2, s: s2 };
    } catch (e) {
      return null;
    }
  }
  return null;
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
  if (errors.length) throw new Error('oll/algs_info.json に問題があります:\n  ' + errors.join('\n  '));

  const lines = cases.map((c) => '  ' + JSON.stringify(c) + ',');
  return [
    '// 自動生成ファイル。手で編集しないこと。',
    '// 元データ: oll/algs_info.json / 生成: node tools/build-oll-data.js',
    '(function (root, data) {',
    "  if (typeof module === 'object' && module.exports) module.exports = data;",
    '  else root.OLL_DATA = data;',
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
