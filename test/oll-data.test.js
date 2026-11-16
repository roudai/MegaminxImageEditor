// 実行: node --test test/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const M = require('../js/megaminx-state.js');
const OLL = require('../js/oll-data.js');
const SRC = require('../oll/algs_info.json');
const { build, check, OUT } = require('../tools/build-oll-data.js');

const MASK = M.ollMask(M.DEFAULT_SCHEME);
const pattern = (state) => {
  const c = M.toImageColors(state, MASK);
  return c.ucolor.join('') + '|' + c.scolor.join('');
};

test('元データの全ケースを順番どおり含み、名前が重複しない', () => {
  assert.deepEqual(
    OLL.map((c) => c.name),
    Object.values(SRC).map((c) => c.name)
  );
  assert.equal(OLL.length, 259);
  assert.equal(new Set(OLL.map((c) => c.name)).size, OLL.length);
});

test('js/oll-data.js が最新（生成し直しても変わらない）', () => {
  assert.equal(fs.readFileSync(OUT, 'utf8'), build());
});

test('259ケースの上面の向きがすべて違う（AUF違いも別ケースとして重複しない）', () => {
  const keys = OLL.map((c) => {
    const st = M.applyAlg(c.setup);
    return ['', 'U', 'U2', "U2'", "U'"].map((u) => pattern(M.applyAlg(u, { state: st }))).sort()[0];
  });
  assert.equal(new Set(keys).size, OLL.length);
});

test('確認処理は向きの揃わない手順・最後の AUF をエラーにする', () => {
  const c = OLL[0];
  assert.equal(check(c.alg, c.setup), null);
  assert.match(check('R U R\'', c.setup), /揃いません/);
  assert.match(check(c.alg + ' U', c.setup), /最後に AUF/);
  assert.match(check(c.alg + ' y', c.setup), /持ち替え/);
});

OLL.forEach((c) => {
  test(`${c.name}: alg で setup の上面が揃い、case 表示の上面の向きが setup と一致する`, () => {
    assert.equal(check(c.alg, c.setup), null);
    assert.equal(pattern(M.applyAlg(c.alg, { inverse: true, cancelRotation: true })), pattern(M.applyAlg(c.setup)));
  });
});

test('練習用のスクランブル js/oll-scrambles.js が最新で、全ケース分ある（各スクランブルがそのケースになるかは生成時に確認）', () => {
  const { buildScrambleFile, SCRAMBLES_OUT } = require('../tools/build-oll-data.js');
  assert.equal(fs.readFileSync(SCRAMBLES_OUT, 'utf8'), buildScrambleFile());
  const scrambles = require('../js/oll-scrambles.js');
  const data = require('../js/oll-data.js');
  assert.deepEqual(Object.keys(scrambles), data.map((c) => c.name));
  Object.values(scrambles).forEach((list) => assert.ok(list.length > 0));
});
