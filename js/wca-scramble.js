/*
 * 通しの練習用のメガミンクスのスクランブル（WCA 公式と同じ形式。DOM 非依存）。仕様: reference/PRACTICE_SPEC.md「通し」
 *
 *   WcaScramble.megaminx(random)  7行のスクランブル（行は '\n' で区切る）
 *     1行 = R±± と D±± を交互に 10 手（R から。++ と -- は等確率）＋最後に U か U'（等確率）
 *     例：R++ D-- R++ D++ R-- D-- R++ D++ R-- D-- U'
 *     （Pochmann 記法。R++ は左側の面を除いたパズル全体を右向きに 2/5 回転。画像の記法とは別物）
 *   random は 0 以上 1 未満を返す関数（省略時は crypto.getRandomValues、無ければ Math.random）
 *   WcaScramble.encode(text)      スクランブルを短い文字列（13 文字）にする（記録を軽くするため）。形式が違えば null
 *     77 か所（各行 R/D の10手の ++/-- と最後の U/U'）をそれぞれ 1 ビットにし、6 ビットずつ base64url の文字にする
 *   WcaScramble.decode(code)      encode した文字列を元のスクランブル（7行）に戻す。形式が違えば null
 *   WcaScramble.textOf(rec)       通しの記録のスクランブル（rec.s を戻したもの。古い記録の rec.scramble もそのまま）
 *   WcaScramble.render(el, text)  （ブラウザ）el の中にスクランブルを1行ずつ div.scramble-line で入れる（1行おきのストライプ用）
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

  // ---- 記録用の短い形 ----
  const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const BITS = LINES * (MOVES_PER_LINE + 1); // 77
  const CODE_LENGTH = Math.ceil(BITS / 6); // 13
  const LINE_RE = /^R(\+\+|--) D(\+\+|--) R(\+\+|--) D(\+\+|--) R(\+\+|--) D(\+\+|--) R(\+\+|--) D(\+\+|--) R(\+\+|--) D(\+\+|--) (U'?)$/;

  function encode(text) {
    const lines = String(text || '').trim().split(/\n/).map((l) => l.trim().replace(/\s+/g, ' '));
    if (lines.length !== LINES) return null;
    const bits = [];
    for (const line of lines) {
      const m = LINE_RE.exec(line);
      if (!m) return null;
      for (let i = 1; i <= MOVES_PER_LINE; i++) bits.push(m[i] === '--' ? 1 : 0);
      bits.push(m[MOVES_PER_LINE + 1] === "U'" ? 1 : 0);
    }
    let code = '';
    for (let i = 0; i < CODE_LENGTH; i++) {
      let v = 0;
      for (let b = 0; b < 6; b++) v = (v << 1) | (bits[i * 6 + b] || 0);
      code += ALPHABET[v];
    }
    return code;
  }

  function decode(code) {
    if (typeof code !== 'string' || code.length !== CODE_LENGTH) return null;
    const bits = [];
    for (const ch of code) {
      const v = ALPHABET.indexOf(ch);
      if (v < 0) return null;
      for (let b = 5; b >= 0; b--) bits.push((v >> b) & 1);
    }
    const lines = [];
    let k = 0;
    for (let l = 0; l < LINES; l++) {
      const moves = [];
      for (let i = 0; i < MOVES_PER_LINE; i++) moves.push((i % 2 === 0 ? 'R' : 'D') + (bits[k++] ? '--' : '++'));
      moves.push(bits[k++] ? "U'" : 'U');
      lines.push(moves.join(' '));
    }
    return lines.join('\n');
  }

  const textOf = (rec) => (rec && typeof rec.s === 'string' ? decode(rec.s) || '' : (rec && rec.scramble) || '');

  function render(el, text) {
    el.replaceChildren(
      ...String(text || '')
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          const d = el.ownerDocument.createElement('div');
          d.className = 'scramble-line';
          d.textContent = line;
          return d;
        })
    );
  }

  return { megaminx: megaminx, encode: encode, decode: decode, textOf: textOf, render: render, LINES: LINES, MOVES_PER_LINE: MOVES_PER_LINE };
});
