// 実行: node --test test/
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const M = require('../js/megaminx-state.js');
const PLL = require('../js/pll-data.js');
const SRC = require('../pll/algs_info.json');
const { build, OUT } = require('../tools/build-pll-data.js');

const SOLVED = M.solved();
const same = (a, b) => a.every((x, i) => x === b[i]);

test('元データの全ケースを順番どおり含み、名前が重複しない', () => {
  assert.deepEqual(
    PLL.map((c) => c.name),
    Object.values(SRC).map((c) => c.name)
  );
  assert.equal(PLL.length, 151);
  assert.equal(new Set(PLL.map((c) => c.name)).size, PLL.length);
});

test('js/pll-data.js が最新（生成し直しても変わらない）', () => {
  assert.equal(fs.readFileSync(OUT, 'utf8'), build());
});

PLL.forEach((c) => {
  test(`${c.name}: alg は最後のAUFなしで setup を揃え、case 表示は setup の状態と一致する`, () => {
    const caseState = M.applyAlg(c.setup);
    // 手順中の持ち替え（y）による完成後の向きの違いは無視する（画面の case 表示と同じ扱い）
    const end = M.applyAlg(c.alg, { state: caseState, cancelRotation: true });
    assert.ok(["", 'U', 'U2', "U2'", "U'"].some((u) => same(M.applyAlg(u, { state: end }), SOLVED)), 'setup + alg + AUF で揃わない');
    assert.ok(same(M.applyAlg(c.alg, { inverse: true, cancelRotation: true }), caseState), 'case 表示が setup と違う');
    assert.ok(!/\(U[^)]*\)\s*$/.test(c.alg), '最後にAUFが付いている');
    assert.ok(!/\sy\S*\s*$/.test(c.alg), '最後に持ち替え（y）が付いている');
    assert.ok(M.toImageColors(caseState).ucolor.every((x, _, arr) => x === arr[0]), '上面がU色だけでない');
  });
});
