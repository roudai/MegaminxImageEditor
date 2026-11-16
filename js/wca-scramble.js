/*
 * 通しの練習用のメガミンクスのスクランブル（WCA 公式と同じ形式。DOM 非依存）。仕様: reference/PRACTICE_SPEC.md「通し」
 *
 *   WcaScramble.megaminx(random)  7行のスクランブル（行は '\n' で区切る）
 *     1行 = R±± と D±± を交互に 10 手（R から。++ と -- は等確率）＋最後に U か U'（等確率）
 *     例：R++ D-- R++ D++ R-- D-- R++ D++ R-- D-- U'
 *     （Pochmann 記法。R++ は左側の面を除いたパズル全体を右向きに 2/5 回転。画像の記法とは別物）
 *   random は 0 以上 1 未満を返す関数（省略時は crypto.getRandomValues、無ければ Math.random）
 *
 * ブラウザでは window.WcaScramble、node では module.exports として公開する。
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.WcaScramble = api;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const LINES = 7;
  const MOVES_PER_LINE = 10;

  // 0 以上 1 未満の乱数（なるべく暗号論的な乱数を使う）
  function defaultRandom() {
    const c = typeof crypto !== 'undefined' ? crypto : null;
    if (c && typeof c.getRandomValues === 'function') {
      const buf = new Uint32Array(1);
      c.getRandomValues(buf);
      return buf[0] / 4294967296;
    }
    return Math.random();
  }

  function megaminx(random) {
    const rand = typeof random === 'function' ? random : defaultRandom;
    const lines = [];
    for (let l = 0; l < LINES; l++) {
      const moves = [];
      for (let i = 0; i < MOVES_PER_LINE; i++) {
        moves.push((i % 2 === 0 ? 'R' : 'D') + (rand() < 0.5 ? '++' : '--'));
      }
      moves.push(rand() < 0.5 ? 'U' : "U'");
      lines.push(moves.join(' '));
    }
    return lines.join('\n');
  }

  return { megaminx: megaminx, LINES: LINES, MOVES_PER_LINE: MOVES_PER_LINE };
});
