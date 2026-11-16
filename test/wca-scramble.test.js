// 実行: node --test test/*.test.js
// js/wca-scramble.js（通しの練習用の WCA 形式のメガミンクスのスクランブル）
const test = require('node:test');
const assert = require('node:assert/strict');
const W = require('../js/wca-scramble.js');

test('7行で、各行は R と D を交互に 10 手（R から、++ か --）＋ U か U\'', () => {
  for (let k = 0; k < 50; k++) {
    const lines = W.megaminx().split('\n');
    assert.equal(lines.length, 7);
    lines.forEach((line) => {
      const moves = line.split(' ');
      assert.equal(moves.length, 11);
      moves.slice(0, 10).forEach((m, i) => assert.match(m, i % 2 === 0 ? /^R(\+\+|--)$/ : /^D(\+\+|--)$/));
      assert.match(moves[10], /^U'?$/);
    });
  }
});

test('乱数を差し替えると決まった出力になる（0.5 未満は ++ と U、それ以外は -- と U\'）', () => {
  const low = W.megaminx(() => 0.1).split('\n');
  assert.equal(low[0], 'R++ D++ R++ D++ R++ D++ R++ D++ R++ D++ U');
  const high = W.megaminx(() => 0.9).split('\n');
  assert.equal(high[6], "R-- D-- R-- D-- R-- D-- R-- D-- R-- D-- U'");
});

test('++ と -- はおおよそ半々（偏っていない）', () => {
  let plus = 0;
  let total = 0;
  for (let k = 0; k < 200; k++) {
    W.megaminx()
      .split(/\s+/)
      .filter((m) => m[0] !== 'U')
      .forEach((m) => {
        total++;
        if (m.endsWith('++')) plus++;
      });
  }
  const ratio = plus / total;
  assert.ok(ratio > 0.45 && ratio < 0.55, String(ratio));
});

test('encode / decode：13 文字にして、元のスクランブルに戻せる', () => {
  for (let k = 0; k < 200; k++) {
    const text = W.megaminx();
    const code = W.encode(text);
    assert.equal(code.length, 13);
    assert.match(code, /^[A-Za-z0-9_-]{13}$/);
    assert.equal(W.decode(code), text);
  }
  assert.equal(W.encode(W.megaminx(() => 0.1)), 'AAAAAAAAAAAAA');
});

test('encode / decode：形式が違えば null。textOf は短い形も古い全文の形も読める', () => {
  assert.equal(W.encode('R++ D--'), null);
  assert.equal(W.encode(W.megaminx().replace('R++', 'R+')), null);
  assert.equal(W.decode('short'), null);
  assert.equal(W.decode('!!!!!!!!!!!!!'), null);
  const text = W.megaminx();
  assert.equal(W.textOf({ s: W.encode(text) }), text);
  assert.equal(W.textOf({ scramble: text }), text);
  assert.equal(W.textOf({}), '');
});
